import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createServiceClient } from '@/lib/supabase/server'
import { DifficultyMode } from '@/types'
import { gradeStudentPaper } from '@/services/ai'
import { sendGradingReportEmail } from '@/services/email'
import { calculateGrade } from '@/lib/utils'

export const maxDuration = 300

export async function POST(request: NextRequest) {
  try {
    const authClient = await createAdminClient()
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = createServiceClient()

    const body = await request.json()
    const { title, difficultyMode = 'medium', questionPaperId, sampleAnswerId, studentScriptIds } = body as {
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
      .select('plan, papers_used, papers_limit, full_name')
      .eq('id', user.id)
      .single()

    if (!userProfile) return NextResponse.json({ error: 'User profile not found' }, { status: 404 })

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

    const customPrompt = settings?.use_custom_prompt && settings?.custom_prompt_override
      ? settings.custom_prompt_override : undefined

    // Create job
    const { data: job, error: jobError } = await supabase
      .from('grading_jobs')
      .insert({
        user_id: user.id,
        title: title || `Grading Job — ${new Date().toLocaleDateString()}`,
        status: 'processing',
        difficulty_mode: difficultyMode,
        total_papers: studentScriptIds.length,
        processed_papers: 0,
        failed_papers: 0,
      })
      .select()
      .single()

    if (jobError || !job) return NextResponse.json({ error: 'Failed to create grading job' }, { status: 500 })

    // Fetch all upload metadata
    const allIds = [questionPaperId, sampleAnswerId, ...studentScriptIds]
    const { data: uploads } = await supabase.from('uploads').select('*').in('id', allIds)
    const uploadsMap = Object.fromEntries((uploads || []).map(u => [u.id, u]))

    const questionPaperUrl = uploadsMap[questionPaperId]?.file_url
    const sampleAnswerUrl = uploadsMap[sampleAnswerId]?.file_url

    // Grade each student
    const gradingResults = []
    let processedCount = 0
    let failedCount = 0

    for (const scriptId of studentScriptIds) {
      const script = uploadsMap[scriptId]
      if (!script) { failedCount++; continue }

      try {
        const startTime = Date.now()

        const aiResult = await gradeStudentPaper({
          questionPaperUrl,
          sampleAnswerUrl,
          studentScriptUrl: script.file_url,
          studentName: script.student_name || script.file_name,
          studentId: script.student_id || undefined,
          difficultyMode,
          customPromptOverride: customPrompt,
        })

        const processingTime = Date.now() - startTime
        const percentage = aiResult.max_score > 0
          ? (aiResult.total_score / aiResult.max_score) * 100 : 0

        const { data: result } = await supabase
          .from('grading_results')
          .insert({
            job_id: job.id,
            user_id: user.id,
            student_id: aiResult.student_id || script.student_id || null,
            student_name: aiResult.student_name || script.student_name || 'Unknown',
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
        console.error(`Failed to grade ${script.file_name}:`, error)
        failedCount++
        await supabase.from('grading_results').insert({
          job_id: job.id,
          user_id: user.id,
          student_name: script.student_name || script.file_name,
          student_id: script.student_id || null,
          total_score: 0,
          max_score: 0,
          percentage: 0,
          grade: 'F',
          overall_feedback: 'Grading failed for this submission.',
        })
      }

      await supabase
        .from('grading_jobs')
        .update({ processed_papers: processedCount, failed_papers: failedCount })
        .eq('id', job.id)
    }

    // Mark job complete
    const finalStatus = failedCount === studentScriptIds.length ? 'failed' : 'completed'
    await supabase
      .from('grading_jobs')
      .update({
        status: finalStatus,
        processed_papers: processedCount,
        failed_papers: failedCount,
        completed_at: new Date().toISOString(),
      })
      .eq('id', job.id)

    // Update paper count
    await supabase
      .from('users')
      .update({ papers_used: userProfile.papers_used + processedCount })
      .eq('id', user.id)

    // Send email report
    try {
      await sendGradingReportEmail({
        to: user.email!,
        professorName: userProfile.full_name || '',
        job: { ...job, status: finalStatus },
        results: gradingResults,
      })
    } catch (e) {
      console.error('Email failed:', e)
    }

    return NextResponse.json({ jobId: job.id, processed: processedCount, failed: failedCount })
  } catch (error) {
    console.error('Grading error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Grading failed' },
      { status: 500 }
    )
  }
}
