import { Resend } from 'resend'
import { GradingJob } from '@/types'

const resend = new Resend(process.env.RESEND_API_KEY!)

export async function sendPapersReadyEmail(params: {
  to: string
  professorName: string
  job: GradingJob
  files: Array<{
    label: string
    fileName: string
    url: string
  }>
}): Promise<void> {
  const { to, professorName, job, files } = params

  const questionPapers = files.filter(f => f.label === 'Question Paper')
  const sampleAnswers = files.filter(f => f.label === 'Sample Answer')
  const studentScripts = files.filter(f => f.label === 'Student Script')

  const section = (title: string, items: typeof files) =>
    items.length === 0 ? '' : `
      <div style="margin: 20px 0;">
        <h3 style="margin:0 0 10px; font-size:14px; color:#555; text-transform:uppercase; letter-spacing:0.05em;">${title}</h3>
        ${items.map(f => `
          <div style="margin-bottom:8px;">
            <a href="${f.url}" style="color:#1a1a2e; font-weight:500; text-decoration:none;">
              📄 ${f.fileName}
            </a>
          </div>
        `).join('')}
      </div>
    `

  await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to,
    subject: `📬 New Grading Job: ${job.title}`,
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;color:#1a1a2e;">
        <div style="background:#1a1a2e;padding:24px 32px;border-radius:12px 12px 0 0;">
          <h1 style="margin:0;color:#fff;font-size:20px;font-weight:600;">Papers Ready for Grading</h1>
        </div>
        <div style="background:#f9f9fb;padding:32px;border-radius:0 0 12px 12px;border:1px solid #e5e5ea;border-top:none;">
          <p style="margin:0 0 20px;">Hi ${professorName || 'Professor'},</p>
          <p style="margin:0 0 24px;color:#444;">
            A new grading job <strong>${job.title}</strong> has been submitted with
            <strong>${studentScripts.length}</strong> student script${studentScripts.length !== 1 ? 's' : ''}.
            Click the links below to download the files for grading.
          </p>

          <div style="background:#fff;border:1px solid #e5e5ea;border-radius:10px;padding:20px 24px;">
            ${section('Question Paper', questionPapers)}
            ${section('Sample Answer / Rubric', sampleAnswers)}
            ${section(`Student Scripts (${studentScripts.length})`, studentScripts)}
          </div>

          <p style="margin:24px 0 0;font-size:13px;color:#888;">
            Once you have finished grading, log in to your dashboard to record results.
          </p>

          <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/jobs/${job.id}"
             style="display:inline-block;margin-top:16px;background:#1a1a2e;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:500;font-size:14px;">
            View Job Dashboard
          </a>

          <p style="margin:32px 0 0;font-size:12px;color:#bbb;">ExamGrade AI</p>
        </div>
      </div>
    `,
  })
}
