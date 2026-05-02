import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { DifficultyMode } from '@/types'
import { gradeStudentPaper } from '@/services/claude'
import { generateCSV } from '@/services/csv'
import { generatePDFReport } from '@/services/pdf'
import { sendGradingCompleteEmail } from '@/services/email'
import { extractTextFromFile } from '@/services/storage'
import { calculateGrade } from '@/lib/utils'

export const maxDuration = 300 // 5 minutes

export async function POST(request: NextRequest) {
  try {
    const supabase = await createAdminClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      title,
      difficultyMode = 'medium',
      questionPaperId,
      sampleAnswerId,
      studentScriptIds,
    } = body as {
      title: string
      difficultyMode: DifficultyMode
      questionPaperId: string
      sampleAnswerId: string
      studentScriptIds: string[]
    }

    if (!questionPaperId || !sampleAnswerId || !studentScriptIds?.length) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Check plan limits
    const { data: userProfile } = await supabase
      .from('users')
      .select('plan, papers_used, papers_limit')
      .eq('id', user.id)
      .single()

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    const remainingPapers = userProfile.papers_limit - userProfile.papers_used
    if (studentScriptIds.length > remainingPapers) {
      return NextResponse.json({
        error: `Insufficient quota. You have ${remainingPapers} papers remaining but submitted ${studentScriptIds.length}.`
      }, { status: 403 })
    }

    // Get custom prompt if any
    const { data: settings } = await supabase
      .from('grading_settings')
      .select('custom_prompt_override, use_custom_prompt')
      .eq('user_id', user.id)
      .eq('difficulty_mode', difficultyMode)
      .single()

    const customPrompt =
      settings?.use_custom_prompt && settings?.custom_prompt_override
        ? settings.custom_prompt_override
        : undefined

    // Create grading job
    const { data: job, error: jobError } = await supabase
      .from('grading_jobs')
      .insert({
        user_id: user.id,
        title: title || 'Grading Job',
        status: 'processing',
        difficulty_mode: difficultyMode,
        total_papers: studentScriptIds.length,
        processed_papers: 0,
        failed_papers: 0,
      })
      .select()
      .single()

    if (jobError || !job) {
      return NextResponse.json({ error: 'Failed to create grading job' }, { status: 500 })
    }

    // Fetch file contents
    const [questionPaperUpload, sampleAnswerUpload] = await Promise.all([
      supabase.from('uploads').select('*').eq('id', questionPaperId).single(),
      supabase.from('uploads').select('*').eq('id', sampleAnswerId).single(),
    ])

    const questionPaperText = await fetchAndExtractText(
      questionPaperUpload.data?.file_url,
      questionPaperUpload.data?.file_name
    )
    const sampleAnswerText = await fetchAndExtractText(
      sampleAnswerUpload.data?.file_url,
      sampleAnswerUpload.data?.file_name
    )

    // Grade each student paper
    const gradingResults = []
    let processedCount = 0
    let failedCount = 0

    for (const scriptId of studentScriptIds) {
      const { data: scriptUpload } = await supabase
        .from('uploads')
        .select('*')
        .eq('id', scriptId)
        .single()

      if (!scriptUpload) {
        failedCount++
        continue
      }

      try {
        const startTime = Date.now()
        const studentText = await fetchAndExtractText(
          scriptUpload.file_url,
          scriptUpload.file_name
        )

        const aiResult = await gradeStudentPaper({
          questionPaper: questionPaperText,
          sampleAnswer: sampleAnswerText,
          studentScript: studentText,
          studentName: scriptUpload.student_name || scriptUpload.file_name,
          studentId: scriptUpload.student_id || undefined,
          difficultyMode,
          customPromptOverride: customPrompt,
        })

        const processingTime = Date.now() - startTime
        const percentage = aiResult.max_score > 0
          ? (aiResult.total_score / aiResult.max_score) * 100
          : 0

        const { data: result } = await supabase
          .from('grading_results')
          .insert({
            job_id: job.id,
            user_id: user.id,
            student_id: aiResult.student_id || scriptUpload.student_id || null,
            student_name: aiResult.student_name || scriptUpload.student_name || 'Unknown',
            total_score: aiResult.total_score,
            max_score: aiResult.max_score,
            percentage,
            grade: calculateGrade(percentage),
            question_breakdown: aiResult.question_wise_breakdown,
            overall_feedback: aiResult.overall_feedback,
            raw_ai_response: aiResult,
            processing_time_ms: processingTime,
          })
          .select()
          .single()

        if (result) gradingResults.push(result)
        processedCount++
      } catch (error) {
        console.error(`Failed to grade ${scriptUpload.file_name}:`, error)
        failedCount++

        // Store failed result placeholder
        await supabase.from('grading_results').insert({
          job_id: job.id,
          user_id: user.id,
          student_name: scriptUpload.student_name || scriptUpload.file_name,
          student_id: scriptUpload.student_id || null,
          total_score: 0,
          max_score: 0,
          percentage: 0,
          grade: 'F',
          overall_feedback: 'Grading failed for this submission.',
        })
      }

      // Update job progress
      await supabase
        .from('grading_jobs')
        .update({ processed_papers: processedCount, failed_papers: failedCount })
        .eq('id', job.id)
    }

    // Generate reports
    const csvContent = generateCSV(gradingResults)
    const csvBuffer = Buffer.from(csvContent, 'utf-8')

    let pdfBuffer: Buffer | undefined
    try {
      const pdfBytes = await generatePDFReport(job, gradingResults)
      pdfBuffer = Buffer.from(pdfBytes)
    } catch (e) {
      console.error('PDF generation failed:', e)
    }

    // Upload reports to storage
    let csvUrl = ''
    let pdfUrl = ''

    try {
      const { data } = await supabase.storage
        .from('reports')
        .upload(`${user.id}/${job.id}/results.csv`, csvBuffer, {
          contentType: 'text/csv',
          upsert: true,
        })
      if (data) {
        const { data: url } = supabase.storage.from('reports').getPublicUrl(`${user.id}/${job.id}/results.csv`)
        csvUrl = url.publicUrl
      }

      if (pdfBuffer) {
        await supabase.storage
          .from('reports')
          .upload(`${user.id}/${job.id}/report.pdf`, pdfBuffer, {
            contentType: 'application/pdf',
            upsert: true,
          })
        const { data: pdfUrl2 } = supabase.storage.from('reports').getPublicUrl(`${user.id}/${job.id}/report.pdf`)
        pdfUrl = pdfUrl2.publicUrl
      }
    } catch (e) {
      console.error('Report upload failed:', e)
    }

    // Mark job complete
    await supabase
      .from('grading_jobs')
      .update({
        status: failedCount === studentScriptIds.length ? 'failed' : 'completed',
        processed_papers: processedCount,
        failed_papers: failedCount,
        csv_report_url: csvUrl,
        pdf_report_url: pdfUrl,
        completed_at: new Date().toISOString(),
      })
      .eq('id', job.id)

    // Update user paper count
    await supabase
      .from('users')
      .update({ papers_used: userProfile.papers_used + processedCount })
      .eq('id', user.id)

    // Send email
    try {
      const { data: profile } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', user.id)
        .single()

      await sendGradingCompleteEmail({
        to: user.email!,
        professorName: profile?.full_name || '',
        job,
        results: gradingResults,
        csvBuffer,
        pdfBuffer,
      })
    } catch (emailError) {
      console.error('Email sending failed:', emailError)
    }

    return NextResponse.json({
      jobId: job.id,
      processed: processedCount,
      failed: failedCount,
      csvUrl,
      pdfUrl,
    })
  } catch (error) {
    console.error('Grading error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Grading failed' },
      { status: 500 }
    )
  }
}

async function fetchAndExtractText(url: string, fileName: string): Promise<string> {
  const response = await fetch(url)
  const buffer = await response.arrayBuffer()
  const { extractTextFromFile } = await import('@/services/storage')
  return extractTextFromFile(buffer, fileName)
}
