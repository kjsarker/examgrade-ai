import { GradingResult } from '@/types'
import { calculateGrade } from '@/lib/utils'

export function generateCSV(results: GradingResult[]): string {
  const headers = [
    'Student Name',
    'Student ID',
    'Total Score',
    'Max Score',
    'Percentage',
    'Grade',
    'Overall Feedback',
  ]

  const rows = results.map((r) => {
    const pct = r.percentage?.toFixed(2) || ((r.total_score / r.max_score) * 100).toFixed(2)
    const grade = r.grade || calculateGrade(parseFloat(pct))
    return [
      `"${r.student_name}"`,
      `"${r.student_id || ''}"`,
      r.total_score,
      r.max_score,
      `${pct}%`,
      grade,
      `"${(r.overall_feedback || '').replace(/"/g, "'")}"`,
    ].join(',')
  })

  return [headers.join(','), ...rows].join('\n')
}
