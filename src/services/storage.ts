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
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  const buffer = Buffer.from(fileBuffer)

  // Plain text & CSV
  if (ext === 'txt' || ext === 'csv') {
    return new TextDecoder().decode(fileBuffer)
  }

  // PDF
  if (ext === 'pdf') {
    try {
      const { extractText } = await import('unpdf')
      const { text } = await extractText(new Uint8Array(fileBuffer), { mergePages: true })
      const combined = typeof text === 'string' ? text : (text as string[]).join('\n')
      if (combined?.trim().length > 50) return combined
    } catch (e) {
      console.error('unpdf extraction failed:', e)
    }
    return `[PDF: ${fileName} — text could not be extracted. Please use a text-selectable PDF or DOCX format.]`
  }

  // Word DOCX
  if (ext === 'docx') {
    const mammoth = (await import('mammoth')).default
    const result = await mammoth.extractRawText({ buffer })
    return result.value
  }

  // Excel XLSX / XLS / ODS
  if (ext === 'xlsx' || ext === 'xls' || ext === 'ods') {
    const XLSX = await import('xlsx')
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const lines: string[] = []
    for (const sheetName of workbook.SheetNames) {
      lines.push(`--- Sheet: ${sheetName} ---`)
      const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName])
      lines.push(csv)
    }
    return lines.join('\n')
  }

  // PowerPoint PPTX / OpenDocument Presentation ODP
  if (ext === 'pptx' || ext === 'odp') {
    const JSZip = (await import('jszip')).default
    const zip = await JSZip.loadAsync(buffer)
    const texts: string[] = []
    const xmlPattern = ext === 'pptx' ? /ppt\/slides\/slide\d+\.xml/ : /content\.xml/
    for (const [path, file] of Object.entries(zip.files)) {
      if (xmlPattern.test(path)) {
        const xml = await file.async('text')
        // Strip XML tags, keep text nodes
        const stripped = xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
        if (stripped) texts.push(stripped)
      }
    }
    return texts.join('\n\n') || `[Presentation: ${fileName}]`
  }

  // OpenDocument Text ODT
  if (ext === 'odt') {
    const JSZip = (await import('jszip')).default
    const zip = await JSZip.loadAsync(buffer)
    const contentFile = zip.file('content.xml')
    if (contentFile) {
      const xml = await contentFile.async('text')
      return xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    }
    return `[Document: ${fileName}]`
  }

  // Old .doc binary format — limited support
  if (ext === 'doc') {
    const text = new TextDecoder('utf-8', { fatal: false }).decode(fileBuffer)
    const matches = text.match(/[\x20-\x7E]{4,}/g) || []
    return matches.filter((s) => /[a-zA-Z]/.test(s)).join(' ') || `[DOC: ${fileName} — use DOCX for best results]`
  }

  // PPT binary — limited support
  if (ext === 'ppt') {
    const text = new TextDecoder('utf-8', { fatal: false }).decode(fileBuffer)
    const matches = text.match(/[\x20-\x7E]{4,}/g) || []
    return matches.filter((s) => /[a-zA-Z]/.test(s)).join(' ') || `[PPT: ${fileName} — use PPTX for best results]`
  }

  return `[Unsupported file type: ${fileName}]`
}
