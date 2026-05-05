/**
 * Outreach email templates for professor engagement
 */

export const outreachEmailTemplates = {
  professorOutreach: {
    subject: 'Save 10+ Hours Grading Papers with Speedy ExamGrade',
    body: `Hi [Professor Name],

We've built Speedy ExamGrade, an AI-powered tool that grades exam papers in minutes, not hours.

Here's what it does:
- Upload question papers, answer keys, and student submissions
- AI grades everything and generates a detailed report for each student
- Download results or receive a professional summary email
- Works with any subject or exam format

Your first 5 papers are free with Speedy ExamGrade. No card required.

Try it now: ${process.env.NEXT_PUBLIC_APP_URL}

Questions? Reply to this email.

Best regards,
Speedy ExamGrade Team`,
  },

  professorOutreachShort: {
    subject: 'Grade 50 Papers Free with Speedy ExamGrade',
    body: `Hi [Professor Name],

Stop spending hours grading papers. Speedy ExamGrade does it in minutes using AI.

Upload papers → Get graded results in your inbox → Download or review online.

Free for your first 5 papers: ${process.env.NEXT_PUBLIC_APP_URL}

Let me know if you have questions.

Best,
Speedy ExamGrade Team`,
  },
}

export function renderOutreachEmail(
  template: keyof typeof outreachEmailTemplates,
  professorName: string
): { subject: string; body: string } {
  const t = outreachEmailTemplates[template]
  return {
    subject: t.subject,
    body: t.body.replace('[Professor Name]', professorName),
  }
}
