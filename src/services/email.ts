import nodemailer from 'nodemailer'
import { GradingJob, GradingResult } from '@/types'

function getTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  })
}

export async function sendGradingReportEmail(params: {
  to: string
  professorName: string
  job: GradingJob
  results: GradingResult[]
}): Promise<void> {
  const { to, professorName, job, results } = params

  const avg = results.length > 0
    ? (results.reduce((s, r) => s + (r.percentage || 0), 0) / results.length).toFixed(1)
    : '0'

  const gradeColor = (pct: number) => {
    if (pct >= 80) return '#16a34a'
    if (pct >= 60) return '#d97706'
    return '#dc2626'
  }

  const gradeRow = (r: GradingResult) => `
    <tr style="border-bottom:1px solid #f0f0f0;">
      <td style="padding:10px 12px;font-size:14px;color:#1a1a2e;font-weight:500;">${r.student_name}</td>
      <td style="padding:10px 12px;font-size:14px;text-align:center;">${r.total_score} / ${r.max_score}</td>
      <td style="padding:10px 12px;font-size:14px;text-align:center;">
        <span style="color:${gradeColor(r.percentage || 0)};font-weight:700;">${(r.percentage || 0).toFixed(1)}%</span>
      </td>
      <td style="padding:10px 12px;font-size:14px;text-align:center;font-weight:700;color:${gradeColor(r.percentage || 0)};">${r.grade}</td>
      <td style="padding:10px 12px;font-size:13px;color:#666;max-width:240px;">${(r.overall_feedback || '').slice(0, 120)}${(r.overall_feedback?.length || 0) > 120 ? '…' : ''}</td>
    </tr>
  `

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f7;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:32px 16px;">
<tr><td align="center">
<table width="640" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e5ea;">

  <!-- Header -->
  <tr><td style="background:#1a1a2e;padding:28px 32px;">
    <p style="margin:0;color:#fff;font-size:22px;font-weight:700;font-family:-apple-system,sans-serif;">✅ Grading Complete</p>
    <p style="margin:6px 0 0;color:#aaa;font-size:14px;">${job.title}</p>
  </td></tr>

  <!-- Summary cards -->
  <tr><td style="padding:24px 32px 0;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td width="30%" style="background:#f9f9fb;border-radius:10px;padding:16px;text-align:center;border:1px solid #e5e5ea;">
          <p style="margin:0;font-size:28px;font-weight:700;color:#1a1a2e;">${results.length}</p>
          <p style="margin:4px 0 0;font-size:12px;color:#999;text-transform:uppercase;letter-spacing:0.05em;">Papers Graded</p>
        </td>
        <td width="4%"></td>
        <td width="30%" style="background:#f9f9fb;border-radius:10px;padding:16px;text-align:center;border:1px solid #e5e5ea;">
          <p style="margin:0;font-size:28px;font-weight:700;color:#1a1a2e;">${avg}%</p>
          <p style="margin:4px 0 0;font-size:12px;color:#999;text-transform:uppercase;letter-spacing:0.05em;">Class Average</p>
        </td>
        <td width="4%"></td>
        <td width="30%" style="background:#f9f9fb;border-radius:10px;padding:16px;text-align:center;border:1px solid #e5e5ea;">
          <p style="margin:0;font-size:28px;font-weight:700;color:#1a1a2e;">${job.difficulty_mode?.toUpperCase()}</p>
          <p style="margin:4px 0 0;font-size:12px;color:#999;text-transform:uppercase;letter-spacing:0.05em;">Grading Mode</p>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- Results table -->
  <tr><td style="padding:24px 32px;">
    <p style="margin:0 0 12px;font-size:14px;font-weight:600;color:#1a1a2e;">Results Breakdown</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e5ea;border-radius:10px;overflow:hidden;">
      <tr style="background:#f9f9fb;">
        <th style="padding:10px 12px;font-size:12px;text-align:left;color:#666;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Student</th>
        <th style="padding:10px 12px;font-size:12px;text-align:center;color:#666;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Score</th>
        <th style="padding:10px 12px;font-size:12px;text-align:center;color:#666;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">%</th>
        <th style="padding:10px 12px;font-size:12px;text-align:center;color:#666;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Grade</th>
        <th style="padding:10px 12px;font-size:12px;text-align:left;color:#666;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Feedback</th>
      </tr>
      ${results.map(gradeRow).join('')}
    </table>
  </td></tr>

  <!-- CTA -->
  <tr><td style="padding:0 32px 28px;">
    <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/jobs/${job.id}"
       style="display:inline-block;background:#1a1a2e;color:#fff;padding:13px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
      View Full Report →
    </a>
  </td></tr>

  <!-- Footer -->
  <tr><td style="padding:16px 32px;border-top:1px solid #f0f0f0;">
    <p style="margin:0;font-size:12px;color:#bbb;">Speedy ExamGrade</p>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`

  await getTransporter().sendMail({
    from: `"Speedy ExamGrade" <${process.env.GMAIL_USER}>`,
    to,
    subject: `Grading Report: ${job.title} — ${results.length} papers graded, ${avg}% class average`,
    html,
  })
}
