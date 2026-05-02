import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function uploadFileToStorage(
  file: Buffer | Uint8Array,
  path: string,
  contentType: string,
  bucket = 'exam-files'
): Promise<string> {
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { contentType, upsert: true })

  if (error) throw new Error(`Storage upload failed: ${error.message}`)

  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}

export async function getFileFromStorage(
  path: string,
  bucket = 'exam-files'
): Promise<ArrayBuffer> {
  const { data, error } = await supabase.storage.from(bucket).download(path)
  if (error) throw new Error(`Storage download failed: ${error.message}`)
  return await data.arrayBuffer()
}

export async function getSignedUrl(
  path: string,
  bucket = 'exam-files',
  expiresIn = 3600
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn)
  if (error) throw new Error(`Signed URL failed: ${error.message}`)
  return data.signedUrl
}

export async function extractTextFromFile(
  fileBuffer: ArrayBuffer,
  fileName: string
): Promise<string> {
  // For text files, decode directly
  if (fileName.endsWith('.txt')) {
    return new TextDecoder().decode(fileBuffer)
  }

  // For PDF files, extract using basic text extraction
  // In production, use a proper PDF parser or Supabase Edge Function with pdf-parse
  const bytes = new Uint8Array(fileBuffer)
  const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes)

  // Extract readable text from PDF binary (basic approach)
  const matches = text.match(/[^\x00-\x1F\x7F-\xFF]{4,}/g) || []
  const readable = matches
    .filter((s) => s.trim().length > 0 && !/^[^a-zA-Z0-9 ]+$/.test(s))
    .join(' ')

  if (readable.length > 100) return readable

  // Fallback message for complex PDFs
  return `[PDF content from: ${fileName}. Note: For accurate PDF text extraction, configure Tesseract OCR in your deployment.]`
}
