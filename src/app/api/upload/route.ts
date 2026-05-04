import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createServiceClient } from '@/lib/supabase/server'
import { UploadType } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const authClient = await createAdminClient()
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const supabase = createServiceClient()

    const formData = await request.formData()
    const file = formData.get('file') as File
    const uploadType = formData.get('uploadType') as UploadType
    const jobId = formData.get('jobId') as string | null
    const studentName = formData.get('studentName') as string | null
    const studentId = formData.get('studentId') as string | null

    if (!file || !uploadType) {
      return NextResponse.json({ error: 'Missing file or uploadType' }, { status: 400 })
    }

    const MAX_SIZE = 20 * 1024 * 1024 // 20MB
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large (max 20MB)' }, { status: 400 })
    }

    const allowedTypes = [
      'application/pdf',
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'text/plain', 'text/csv',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.oasis.opendocument.text',
      'application/vnd.oasis.opendocument.spreadsheet',
      'application/vnd.oasis.opendocument.presentation',
    ]
    // Also allow by extension for files where browsers report wrong MIME
    const ext = file.name.split('.').pop()?.toLowerCase()
    const allowedExts = ['pdf','jpg','jpeg','png','webp','gif','txt','csv','doc','docx','xls','xlsx','ppt','pptx','odt','ods','odp']
    if (!allowedTypes.includes(file.type) && !allowedExts.includes(ext || '')) {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 })
    }

    const path = `${user.id}/${uploadType}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    const bytes = await file.arrayBuffer()
    const { error: storageError } = await supabase.storage
      .from('exam-files')
      .upload(path, bytes, { contentType: file.type, upsert: false })

    if (storageError) {
      return NextResponse.json({ error: storageError.message }, { status: 500 })
    }

    const { data: urlData } = supabase.storage.from('exam-files').getPublicUrl(path)

    const { data: upload, error: dbError } = await supabase
      .from('uploads')
      .insert({
        user_id: user.id,
        job_id: jobId || null,
        file_name: file.name,
        file_url: urlData.publicUrl,
        file_type: file.type,
        file_size: file.size,
        upload_type: uploadType,
        student_name: studentName || null,
        student_id: studentId || null,
      })
      .select()
      .single()

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 })
    }

    return NextResponse.json({ upload, path })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
