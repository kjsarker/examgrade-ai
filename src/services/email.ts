import { Resend } from 'resend'
import { GradingJob, GradingResult } from '@/types'

const resend = new Resend(process.env.RESEND_API_KEY!)

export async function sendGradingCompleteEmail(params: {
  to: string
  professorName: string
  job: GradingJob
  results: GradingResult[]
  csvBuffer?: Buffer
  pdfBuffer?: Buffer
  driveFolderUrl?: string
}): Promise<void> {
  const { to, professorName, job, results, csvBuffer, pdfBuffer, driveFolderUrl } = params

  const attachments: Array<{ filename: string; content: Buffer }> = []

  if (csvBuffer) {
    attachments.push({ filename: `grading-results-${job.id}.csv`, content: csvBuffer })
  }
  if (pdfBuffer) {
    attachments.push({ filename: `grading-report-${job.id}.pdf`, content: pdfBuffer })
  }

  const avg =
    results.length > 0
      ? (results.reduce((s, r) => s + (r.percentage || 0), 0) / results.length).toFixed(1)
      : null

  const driveSection = driveFolderUrl
    ? `
      <div style="background: #e8f5e9; border-radius: 12px; padding: 20px; margin: 20px 0; border-left: 4px solid #4caf50;">
        <h3 style="margin-top:0; color:#2e7d32;">📁 Files Uploaded to Google Drive</h3>
        <p>All exam papers have been organised into a Google Drive folder for manual grading.</p>
        <a href="${driveFolderUrl}"
           style="display:inline-block; background:#4caf50; color:white; padding:10px 20px;
                  border-radius:8px; text-decoration:none; margin-top:8px;">
          Open Drive Folder
        </a>
      </div>
    `
    : ''

  const summarySection = avg
    ? `
      <div style="background: #f5f5f7; border-radius: 12px; padding: 20px; margin: 20px 0;">
        <h3 style="margin-top:0;">Summary</h3>
        <p>📄 Papers graded: <strong>${results.length}</strong></p>
        <p>📊 Class average: <strong>${avg}%</strong></p>
        <p>⚡ Difficulty mode: <strong>${job.difficulty_mode?.toUpperCase()}</strong></p>
      </div>
    `
    : `
      <div style="background: #f5f5f7; border-radius: 12px; padding: 20px; margin: 20px 0;">
        <h3 style="margin-top:0;">Summary</h3>
        <p>📄 Papers uploaded: <strong>${job.total_papers}</strong></p>
      </div>
    `

  await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to,
    subject: `✅ Papers Ready: ${job.title}`,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #1a1a2e;">Papers Ready for Grading</h1>
        <p>Hi ${professorName || 'Professor'},</p>
        <p>Your exam papers for <strong>${job.title}</strong> have been uploaded successfully.</p>

        ${summarySection}
        ${driveSection}

        <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/jobs/${job.id}"
           style="display:inline-block; background:#1a1a2e; color:white; padding:12px 24px;
                  border-radius:8px; text-decoration:none; margin-top:10px;">
          View Job
        </a>

        <p style="color:#888; font-size:12px; margin-top:30px;">ExamGrade AI</p>
      </div>
    `,
    attachments: attachments.length > 0 ? attachments : undefined,
  })
}
