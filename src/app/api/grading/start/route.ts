import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createServiceClient } from '@/lib/supabase/server'
import { DifficultyMode } from '@/types'
import { sendPapersReadyEmail } from '@/services/email'

export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const authClient = await createAdminClient()
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Use service client (bypasses RLS) for all data operations
    const supabase = createServiceClient()

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
    const allUploadIds = [questionPaperId, sampleAnswerId, ...studentScriptIds]
    const { data: uploads } = await supabase
      .from('uploads')
      .select('*')
      .in('id', allUploadIds)

    const uploadsMap = Object.fromEntries((uploads || []).map(u => [u.id, u]))

    const qp = uploadsMap[questionPaperId]
    const sa = uploadsMap[sampleAnswerId]
    const scripts = studentScriptIds.map(id => uploadsMap[id]).filter(Boolean)

    // Build file list for email
    const emailFiles: Array<{ label: string; fileName: string; url: string }> = []
    if (qp) emailFiles.push({ label: 'Question Paper', fileName: qp.file_name, url: qp.file_url })
    if (sa) emailFiles.push({ label: 'Sample Answer', fileName: sa.file_name, url: sa.file_url })
    for (const s of scripts) {
      emailFiles.push({
        label: 'Student Script',
        fileName: s.student_name ? `${s.student_name} — ${s.file_name}` : s.file_name,
        url: s.file_url,
      })
    }

    const uploadedCount = scripts.length

    // Mark job completed
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

    // ZIP download URL for this job
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
    const zipUrl = `${appUrl}/api/grading/download/${job.id}`

    // Send email
    try {
      await sendPapersReadyEmail({
        to: user.email!,
        professorName: userProfile.full_name || '',
        job,
        files: emailFiles,
        zipUrl,
      })
    } catch (emailError) {
      console.error('Email sending failed:', emailError)
    }

    return NextResponse.json({ jobId: job.id, processed: uploadedCount, emailSent: true })
  } catch (error) {
    console.error('Job creation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create job' },
      { status: 500 }
    )
  }
}
