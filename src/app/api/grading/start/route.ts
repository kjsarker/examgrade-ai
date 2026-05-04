import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { DifficultyMode } from '@/types'
import { sendPapersReadyEmail } from '@/services/email'

export const maxDuration = 60

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
      .select('plan, papers_used, papers_limit, full_name')
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

    const jobTitle = title || `Grading Job — ${new Date().toLocaleDateString()}`

    // Create grading job
    const { data: job, error: jobError } = await supabase
      .from('grading_jobs')
      .insert({
        user_id: user.id,
        title: jobTitle,
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

    // Fetch all file metadata in parallel
    const [questionPaperUpload, sampleAnswerUpload, ...studentUploadsRaw] = await Promise.all([
      supabase.from('uploads').select('*').eq('id', questionPaperId).single(),
      supabase.from('uploads').select('*').eq('id', sampleAnswerId).single(),
      ...studentScriptIds.map(id => supabase.from('uploads').select('*').eq('id', id).single()),
    ])

    // Build file list for email
    const emailFiles: Array<{ label: string; fileName: string; url: string }> = []

    if (questionPaperUpload.data) {
      emailFiles.push({
        label: 'Question Paper',
        fileName: questionPaperUpload.data.file_name,
        url: questionPaperUpload.data.file_url,
      })
    }

    if (sampleAnswerUpload.data) {
      emailFiles.push({
        label: 'Sample Answer',
        fileName: sampleAnswerUpload.data.file_name,
        url: sampleAnswerUpload.data.file_url,
      })
    }

    for (const { data: script } of studentUploadsRaw) {
      if (script) {
        emailFiles.push({
          label: 'Student Script',
          fileName: script.student_name
            ? `${script.student_name} — ${script.file_name}`
            : script.file_name,
          url: script.file_url,
        })
      }
    }

    const uploadedCount = studentUploadsRaw.filter(u => u.data).length

    // Mark job as completed (manual grading)
    await supabase
      .from('grading_jobs')
      .update({
        status: 'completed',
        processed_papers: uploadedCount,
        failed_papers: studentScriptIds.length - uploadedCount,
        completed_at: new Date().toISOString(),
      })
      .eq('id', job.id)

    // Update user paper count
    await supabase
      .from('users')
      .update({ papers_used: userProfile.papers_used + uploadedCount })
      .eq('id', user.id)

    // Send email with all download links
    try {
      await sendPapersReadyEmail({
        to: user.email!,
        professorName: userProfile.full_name || '',
        job,
        files: emailFiles,
      })
    } catch (emailError) {
      console.error('Email sending failed:', emailError)
    }

    return NextResponse.json({
      jobId: job.id,
      processed: uploadedCount,
      emailSent: true,
    })
  } catch (error) {
    console.error('Job creation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create job' },
      { status: 500 }
    )
  }
}
