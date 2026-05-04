import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { DifficultyMode } from '@/types'
import { uploadJobFilesToDrive } from '@/services/drive'
import { sendGradingCompleteEmail } from '@/services/email'

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

    // Fetch file metadata
    const [questionPaperUpload, sampleAnswerUpload] = await Promise.all([
      supabase.from('uploads').select('*').eq('id', questionPaperId).single(),
      supabase.from('uploads').select('*').eq('id', sampleAnswerId).single(),
    ])

    const studentUploads = await Promise.all(
      studentScriptIds.map((id) =>
        supabase.from('uploads').select('*').eq('id', id).single()
      )
    )

    // Build file list for Drive upload
    const driveFiles: Array<{
      url: string
      fileName: string
      mimeType: string
      category: string
    }> = []

    if (questionPaperUpload.data) {
      driveFiles.push({
        url: questionPaperUpload.data.file_url,
        fileName: questionPaperUpload.data.file_name,
        mimeType: questionPaperUpload.data.file_type || 'application/octet-stream',
        category: 'Question Paper',
      })
    }

    if (sampleAnswerUpload.data) {
      driveFiles.push({
        url: sampleAnswerUpload.data.file_url,
        fileName: sampleAnswerUpload.data.file_name,
        mimeType: sampleAnswerUpload.data.file_type || 'application/octet-stream',
        category: 'Sample Answer',
      })
    }

    for (const { data: script } of studentUploads) {
      if (script) {
        driveFiles.push({
          url: script.file_url,
          fileName: script.student_name
            ? `${script.student_name} — ${script.file_name}`
            : script.file_name,
          mimeType: script.file_type || 'application/octet-stream',
          category: 'Student Script',
        })
      }
    }

    // Upload all files to Google Drive
    let driveResult: { folderId: string; folderUrl: string; fileLinks: Record<string, string> } | null = null
    let driveError: string | null = null

    try {
      driveResult = await uploadJobFilesToDrive({ jobTitle, files: driveFiles })
    } catch (err) {
      console.error('Google Drive upload failed:', err)
      driveError = err instanceof Error ? err.message : 'Drive upload failed'
    }

    const uploadedCount = studentUploads.filter((u) => u.data).length
    const failedCount = studentScriptIds.length - uploadedCount

    // Mark job complete
    await supabase
      .from('grading_jobs')
      .update({
        status: driveError ? 'failed' : 'completed',
        processed_papers: uploadedCount,
        failed_papers: failedCount,
        pdf_report_url: driveResult?.folderUrl || null,
        completed_at: new Date().toISOString(),
      })
      .eq('id', job.id)

    // Update user paper count
    await supabase
      .from('users')
      .update({ papers_used: userProfile.papers_used + uploadedCount })
      .eq('id', user.id)

    // Send notification email with Drive folder link
    if (driveResult) {
      try {
        const { data: profile } = await supabase
          .from('users')
          .select('full_name')
          .eq('id', user.id)
          .single()

        await sendGradingCompleteEmail({
          to: user.email!,
          professorName: profile?.full_name || '',
          job: { ...job, status: 'completed' },
          results: [],
          driveFolderUrl: driveResult.folderUrl,
        })
      } catch (emailError) {
        console.error('Email sending failed:', emailError)
      }
    }

    return NextResponse.json({
      jobId: job.id,
      processed: uploadedCount,
      failed: failedCount,
      driveFolderUrl: driveResult?.folderUrl || null,
      driveError,
    })
  } catch (error) {
    console.error('Grading error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process job' },
      { status: 500 }
    )
  }
}
