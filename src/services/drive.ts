import { google } from 'googleapis'
import { Readable } from 'stream'

function getDriveClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n')
  if (!email || !key) throw new Error('Google Drive credentials not configured')

  const auth = new google.auth.JWT({
    email,
    key,
    scopes: ['https://www.googleapis.com/auth/drive'],
  })
  return google.drive({ version: 'v3', auth })
}

export async function createDriveFolder(name: string, parentId?: string): Promise<string> {
  const drive = getDriveClient()
  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : undefined,
    },
    fields: 'id',
  })
  return res.data.id!
}

export async function uploadFileToDrive(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
  parentFolderId: string
): Promise<{ id: string; webViewLink: string }> {
  const drive = getDriveClient()

  const stream = new Readable()
  stream.push(fileBuffer)
  stream.push(null)

  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [parentFolderId],
    },
    media: {
      mimeType,
      body: stream,
    },
    fields: 'id,webViewLink',
  })

  return {
    id: res.data.id!,
    webViewLink: res.data.webViewLink || `https://drive.google.com/file/d/${res.data.id}/view`,
  }
}

export async function uploadJobFilesToDrive(params: {
  jobTitle: string
  files: Array<{
    url: string
    fileName: string
    mimeType: string
    category: 'Question Paper' | 'Sample Answer' | string
  }>
}): Promise<{ folderId: string; folderUrl: string; fileLinks: Record<string, string> }> {
  const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID

  const jobFolderId = await createDriveFolder(
    `${params.jobTitle} — ${new Date().toLocaleDateString('en-GB')}`,
    rootFolderId
  )
  const folderUrl = `https://drive.google.com/drive/folders/${jobFolderId}`

  const fileLinks: Record<string, string> = {}

  for (const file of params.files) {
    try {
      const response = await fetch(file.url)
      if (!response.ok) throw new Error(`Failed to fetch ${file.fileName}`)
      const buffer = Buffer.from(await response.arrayBuffer())

      const { webViewLink } = await uploadFileToDrive(
        buffer,
        `[${file.category}] ${file.fileName}`,
        file.mimeType || 'application/octet-stream',
        jobFolderId
      )
      fileLinks[file.fileName] = webViewLink
    } catch (err) {
      console.error(`Drive upload failed for ${file.fileName}:`, err)
    }
  }

  return { folderId: jobFolderId, folderUrl, fileLinks }
}
