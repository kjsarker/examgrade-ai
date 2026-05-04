import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createServiceClient } from '@/lib/supabase/server'
import JSZip from 'jszip'

export const maxDuration = 60

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params

    const authClient = await createAdminClient()
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServiceClient()

    // Verify job belongs to user
    const { data: job } = await supabase
      .from('grading_jobs')
      .select('id, title, user_id')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .single()

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // Get all uploads for this job's question paper, sample answer, student scripts
    // They were uploaded before the job was created so we fetch by matching the
    // grading_results or by fetching from the job's related uploads via upload_type
    // Simplest: get all uploads belonging to this user created around job time
    // Instead, fetch from grading_results for context, and uploads by user + recent
    // The cleanest approach: store upload IDs on the job. Since we don't have that,
    // fetch uploads by user_id that were created within a window near the job.
    const { data: jobRow } = await supabase
      .from('grading_jobs')
      .select('created_at')
      .eq('id', jobId)
      .single()

    // Fetch uploads created within 10 minutes before the job
    const jobTime = new Date(jobRow?.created_at || Date.now())
    const windowStart = new Date(jobTime.getTime() - 10 * 60 * 1000).toISOString()
    const windowEnd = new Date(jobTime.getTime() + 60 * 1000).toISOString()

    const { data: uploads } = await supabase
      .from('uploads')
      .select('*')
      .eq('user_id', user.id)
      .gte('created_at', windowStart)
      .lte('created_at', windowEnd)
      .order('created_at', { ascending: true })

    if (!uploads || uploads.length === 0) {
      return NextResponse.json({ error: 'No files found for this job' }, { status: 404 })
    }

    // Build zip
    const zip = new JSZip()

    const labelMap: Record<string, string> = {
      question_paper: '1_Question_Paper',
      sample_answer: '2_Sample_Answer',
      student_script: '3_Student_Scripts',
    }

    const folders: Record<string, JSZip> = {}

    await Promise.all(uploads.map(async (upload) => {
      try {
        const res = await fetch(upload.file_url)
        if (!res.ok) return
        const buffer = Buffer.from(await res.arrayBuffer())
        const folderName = labelMap[upload.upload_type] || '4_Other'
        if (!folders[folderName]) folders[folderName] = zip.folder(folderName)!
        const fileName = upload.student_name
          ? `${upload.student_name} — ${upload.file_name}`
          : upload.file_name
        folders[folderName].file(fileName, buffer)
      } catch (e) {
        console.error(`Failed to fetch ${upload.file_name}:`, e)
      }
    }))

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
    const safeTitle = job.title.replace(/[^a-zA-Z0-9\s-]/g, '').trim().replace(/\s+/g, '_')

    return new NextResponse(zipBuffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${safeTitle}.zip"`,
        'Content-Length': String(zipBuffer.length),
      },
    })
  } catch (error) {
    console.error('Download error:', error)
    return NextResponse.json({ error: 'Download failed' }, { status: 500 })
  }
}
