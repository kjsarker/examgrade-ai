import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { GradingResult, GradingJob } from '@/types'
import { calculateGrade } from '@/lib/utils'

export async function generatePDFReport(
  job: GradingJob,
  results: GradingResult[]
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica)

  const addPage = () => {
    const page = pdfDoc.addPage([595, 842]) // A4
    return page
  }

  const drawText = (
    page: ReturnType<typeof addPage>,
    text: string,
    x: number,
    y: number,
    size: number,
    bold = false,
    color = rgb(0, 0, 0)
  ) => {
    page.drawText(text, {
      x,
      y,
      size,
      font: bold ? boldFont : regularFont,
      color,
    })
  }

  // Cover page
  let page = addPage()
  drawText(page, 'Speedy ExamGrade', 50, 780, 24, true, rgb(0.1, 0.1, 0.8))
  drawText(page, 'Grading Report', 50, 750, 18, true)
  drawText(page, `Job: ${job.title}`, 50, 710, 12)
  drawText(page, `Date: ${new Date(job.created_at).toLocaleDateString()}`, 50, 690, 12)
  drawText(page, `Total Students: ${results.length}`, 50, 670, 12)
  drawText(page, `Difficulty Mode: ${job.difficulty_mode.toUpperCase()}`, 50, 650, 12)

  const avg =
    results.length > 0
      ? results.reduce((sum, r) => sum + (r.percentage || 0), 0) / results.length
      : 0
  drawText(page, `Class Average: ${avg.toFixed(1)}%`, 50, 630, 12)

  // Summary table header
  drawText(page, 'Student', 50, 580, 11, true)
  drawText(page, 'Score', 250, 580, 11, true)
  drawText(page, 'Percentage', 320, 580, 11, true)
  drawText(page, 'Grade', 430, 580, 11, true)

  // Draw line
  page.drawLine({
    start: { x: 50, y: 575 },
    end: { x: 545, y: 575 },
    thickness: 1,
    color: rgb(0.7, 0.7, 0.7),
  })

  let y = 555
  for (const result of results) {
    if (y < 80) {
      page = addPage()
      y = 780
    }

    const pct = result.percentage?.toFixed(1) || '0.0'
    const grade = result.grade || calculateGrade(result.percentage || 0)
    const name = result.student_name.substring(0, 25)

    drawText(page, name, 50, y, 10)
    drawText(page, `${result.total_score}/${result.max_score}`, 250, y, 10)
    drawText(page, `${pct}%`, 320, y, 10)
    drawText(page, grade, 430, y, 10)
    y -= 22
  }

  // Individual result pages
  for (const result of results) {
    page = addPage()
    y = 790

    drawText(page, result.student_name, 50, y, 16, true)
    y -= 25
    if (result.student_id) {
      drawText(page, `Student ID: ${result.student_id}`, 50, y, 11)
      y -= 20
    }

    const pct = result.percentage?.toFixed(1) || '0.0'
    const grade = result.grade || calculateGrade(result.percentage || 0)
    drawText(page, `Total Score: ${result.total_score} / ${result.max_score}  (${pct}%)  Grade: ${grade}`, 50, y, 12, true)
    y -= 30

    // Question breakdown
    if (result.question_breakdown && result.question_breakdown.length > 0) {
      drawText(page, 'Question Breakdown', 50, y, 13, true)
      y -= 20

      for (const q of result.question_breakdown) {
        if (y < 100) {
          page = addPage()
          y = 790
        }
        drawText(page, `Q: ${q.question.substring(0, 60)}`, 50, y, 10, true)
        y -= 15
        drawText(page, `Score: ${q.score}/${q.max_score}`, 60, y, 10)
        y -= 15

        // Wrap feedback text
        const words = q.feedback.split(' ')
        let line = ''
        for (const word of words) {
          if ((line + word).length > 75) {
            drawText(page, line, 60, y, 9)
            y -= 13
            line = word + ' '
            if (y < 100) {
              page = addPage()
              y = 790
            }
          } else {
            line += word + ' '
          }
        }
        if (line.trim()) {
          drawText(page, line, 60, y, 9)
          y -= 13
        }
        y -= 10
      }
    }

    // Overall feedback
    if (result.overall_feedback && y > 100) {
      y -= 10
      drawText(page, 'Overall Feedback', 50, y, 13, true)
      y -= 18
      const words = result.overall_feedback.split(' ')
      let line = ''
      for (const word of words) {
        if ((line + word).length > 80) {
          if (y < 80) { page = addPage(); y = 790 }
          drawText(page, line, 50, y, 10)
          y -= 14
          line = word + ' '
        } else {
          line += word + ' '
        }
      }
      if (line.trim()) {
        drawText(page, line, 50, y, 10)
      }
    }
  }

  return await pdfDoc.save()
}
