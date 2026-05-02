import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { formatDate, calculateGrade } from '@/lib/utils'
import Link from 'next/link'

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: job }, { data: results }] = await Promise.all([
    supabase.from('grading_jobs').select('*').eq('id', id).eq('user_id', user!.id).single(),
    supabase.from('grading_results').select('*').eq('job_id', id).eq('user_id', user!.id).order('student_name'),
  ])

  if (!job) notFound()

  const avg = results && results.length > 0
    ? (results.reduce((s: number, r) => s + (r.percentage || 0), 0) / results.length).toFixed(1)
    : '0'

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-50 text-yellow-700',
    processing: 'bg-blue-50 text-blue-700',
    completed: 'bg-green-50 text-green-700',
    failed: 'bg-red-50 text-red-700',
  }

  const gradeColors: Record<string, string> = {
    'A+': 'text-green-600', 'A': 'text-green-600', 'B': 'text-blue-600',
    'C': 'text-yellow-600', 'D': 'text-orange-600', 'F': 'text-red-600',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/dashboard/jobs" className="text-sm text-gray-400 hover:text-gray-600">Jobs</Link>
            <span className="text-gray-300">/</span>
            <span className="text-sm text-gray-600">{job.title}</span>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">{job.title}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {formatDate(job.created_at)} · {job.difficulty_mode} mode
          </p>
        </div>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusColors[job.status]}`}>
          {job.status}
        </span>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total papers', value: job.total_papers },
          { label: 'Processed', value: job.processed_papers },
          { label: 'Failed', value: job.failed_papers },
          { label: 'Class average', value: `${avg}%` },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xl font-semibold text-gray-900">{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Downloads */}
      {job.status === 'completed' && (job.csv_report_url || job.pdf_report_url) && (
        <div className="flex items-center gap-3">
          {job.csv_report_url && (
            <a
              href={job.csv_report_url}
              download
              className="flex items-center gap-2 text-sm border border-gray-200 px-4 py-2 rounded-xl hover:bg-gray-50 transition-colors"
            >
              ↓ Download CSV
            </a>
          )}
          {job.pdf_report_url && (
            <a
              href={job.pdf_report_url}
              download
              className="flex items-center gap-2 text-sm border border-gray-200 px-4 py-2 rounded-xl hover:bg-gray-50 transition-colors"
            >
              ↓ Download PDF Report
            </a>
          )}
        </div>
      )}

      {/* Processing indicator */}
      {job.status === 'processing' && (
        <div className="bg-blue-50 text-blue-700 rounded-xl px-4 py-3 text-sm">
          Grading in progress… {job.processed_papers} of {job.total_papers} papers done.
          <span className="ml-1 text-blue-500">Refresh to update.</span>
        </div>
      )}

      {/* Results table */}
      {results && results.length > 0 && (
        <div>
          <h2 className="font-semibold text-gray-900 mb-3">Student Results</h2>
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Student</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Score</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">%</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Grade</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Feedback</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {results.map((r) => {
                  const pct = r.percentage?.toFixed(1) || '0.0'
                  const grade = r.grade || calculateGrade(r.percentage || 0)
                  return (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3">
                        <p className="font-medium text-gray-900">{r.student_name}</p>
                        {r.student_id && <p className="text-xs text-gray-400">{r.student_id}</p>}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{r.total_score}/{r.max_score}</td>
                      <td className="px-4 py-3 text-gray-600">{pct}%</td>
                      <td className="px-4 py-3">
                        <span className={`font-semibold ${gradeColors[grade] || 'text-gray-600'}`}>{grade}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">
                        {r.overall_feedback || '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Question breakdown expandable */}
      {results && results.length > 0 && results[0]?.question_breakdown && (
        <div>
          <h2 className="font-semibold text-gray-900 mb-3">Question-by-Question Breakdown</h2>
          <div className="space-y-3">
            {results.map((r) => (
              <details key={r.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <summary className="px-5 py-3 cursor-pointer text-sm font-medium text-gray-900 hover:bg-gray-50 flex items-center justify-between">
                  <span>{r.student_name}</span>
                  <span className="text-gray-500 font-normal">{r.total_score}/{r.max_score} — {r.percentage?.toFixed(1)}%</span>
                </summary>
                <div className="px-5 pb-4 space-y-3">
                  {(r.question_breakdown as Array<{question: string; score: number; max_score: number; feedback: string}>)?.map((q, i) => (
                    <div key={i} className="border-l-2 border-gray-200 pl-3">
                      <p className="text-xs font-medium text-gray-700">{q.question}</p>
                      <p className="text-xs text-gray-500 mt-0.5">Score: <strong>{q.score}/{q.max_score}</strong></p>
                      <p className="text-xs text-gray-400 mt-0.5">{q.feedback}</p>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
