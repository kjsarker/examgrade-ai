import { Resend } from 'resend'
import { GradingJob, GradingResult } from '@/types'

const resend = new Resend(process.env.RESEND_API_KEY!)

export async function sendGradingCompleteEmail(params: {
  to: string
  professorName: string
  job: GradingJob
  results: GradingResult[]
  csvBuffer: Buffer
  pdfBuffer?: Buffer
}): Promise<void> {
  const { to, professorName, job, results, csvBuffer, pdfBuffer } = params

  const avg =
    results.length > 0
      ? (results.reduce((s, r) => s + (r.percentage || 0), 0) / results.length).toFixed(1)
      : '0'

  const attachments: Array<{ filename: string; content: Buffer }> = [
    { filename: `grading-results-${job.id}.csv`, content: csvBuffer },
  ]

  if (pdfBuffer) {
    attachments.push({
      filename: `grading-report-${job.id}.pdf`,
      content: pdfBuffer,
    })
  }

  await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to,
    subject: `✅ Grading Completed: ${job.title}`,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #1a1a2e;">Grading Complete</h1>
        <p>Hi ${professorName || 'Professor'},</p>
        <p>Your grading job <strong>${job.title}</strong> has been completed.</p>

        <div style="background: #f5f5f7; border-radius: 12px; padding: 20px; margin: 20px 0;">
          <h3 style="margin-top:0;">Summary</h3>
          <p>📄 Papers graded: <strong>${results.length}</strong></p>
          <p>📊 Class average: <strong>${avg}%</strong></p>
          <p>⚡ Difficulty mode: <strong>${job.difficulty_mode.toUpperCase()}</strong></p>
        </div>

        <p>Your CSV report${pdfBuffer ? ' and PDF report are' : ' is'} attached to this email.</p>
        <p>Log in to your dashboard for the full breakdown with question-by-question analysis.</p>

        <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/jobs/${job.id}"
           style="display:inline-block; background:#1a1a2e; color:white; padding:12px 24px;
                  border-radius:8px; text-decoration:none; margin-top:10px;">
          View Full Results
        </a>

        <p style="color:#888; font-size:12px; margin-top:30px;">ExamGrade AI</p>
      </div>
    `,
    attachments,
  })
}
