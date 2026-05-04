import nodemailer from 'nodemailer'
import { GradingJob } from '@/types'

function getTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  })
}

export async function sendPapersReadyEmail(params: {
  to: string
  professorName: string
  job: GradingJob
  files: Array<{ label: string; fileName: string; url: string }>
  zipUrl: string
}): Promise<void> {
  const { to, professorName, job, files, zipUrl } = params

  const grouped: Record<string, typeof files> = {
    'Question Paper': [],
    'Sample Answer': [],
    'Student Script': [],
  }
  for (const f of files) {
    if (grouped[f.label]) grouped[f.label].push(f)
  }

  const renderSection = (title: string, items: typeof files) => {
    if (items.length === 0) return ''
    return `
      <tr><td style="padding:16px 0 6px;">
        <p style="margin:0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#999;">${title}</p>
      </td></tr>
      ${items.map(f => `
        <tr><td style="padding:4px 0;">
          <a href="${f.url}" style="color:#1a1a2e;text-decoration:none;font-size:14px;">
            📄 &nbsp;${f.fileName}
          </a>
        </td></tr>
      `).join('')}
    `
  }

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f7;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5ea;">

        <!-- Header -->
        <tr><td style="background:#1a1a2e;padding:28px 32px;">
          <p style="margin:0;color:#fff;font-size:20px;font-weight:700;font-family:-apple-system,sans-serif;">
            📬 New Grading Job
          </p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:28px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
          <p style="margin:0 0 6px;font-size:15px;color:#333;">Hi ${professorName || 'Professor'},</p>
          <p style="margin:0 0 24px;font-size:15px;color:#555;">
            <strong style="color:#1a1a2e;">${job.title}</strong> has been submitted with
            <strong>${grouped['Student Script'].length}</strong> student script${grouped['Student Script'].length !== 1 ? 's' : ''}.
          </p>

          <!-- Download All button -->
          <table cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            <tr><td style="background:#1a1a2e;border-radius:8px;">
              <a href="${zipUrl}" style="display:inline-block;padding:13px 28px;color:#fff;text-decoration:none;font-size:15px;font-weight:600;">
                ⬇️ &nbsp;Download All Files (.zip)
              </a>
            </td></tr>
          </table>

          <!-- File list -->
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e5ea;border-radius:8px;padding:8px 16px;">
            ${renderSection('Question Paper', grouped['Question Paper'])}
            ${renderSection('Sample Answer / Rubric', grouped['Sample Answer'])}
            ${renderSection('Student Scripts', grouped['Student Script'])}
          </table>

          <p style="margin:24px 0 0;font-size:13px;color:#999;">
            Links expire after 7 days. Use the ZIP button above to download everything at once.
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:16px 32px;border-top:1px solid #f0f0f0;">
          <p style="margin:0;font-size:12px;color:#bbb;">ExamGrade AI &nbsp;·&nbsp;
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/jobs/${job.id}" style="color:#bbb;">View in dashboard</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`

  await getTransporter().sendMail({
    from: `"ExamGrade AI" <${process.env.GMAIL_USER}>`,
    to,
    subject: `📬 ${job.title} — ${grouped['Student Script'].length} papers ready`,
    html,
  })
}
