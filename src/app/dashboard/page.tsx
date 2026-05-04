import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: profile }, { data: jobs }] = await Promise.all([
    supabase.from('users').select('*').eq('id', user!.id).single(),
    supabase
      .from('grading_jobs')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false })
      .limit(8),
  ])

  const used = profile?.papers_used || 0
  const limit = profile?.papers_limit || 50
  const remaining = limit - used

  const statusConfig: Record<string, { label: string; dot: string; text: string }> = {
    pending:    { label: 'Pending',    dot: 'bg-yellow-400', text: 'text-yellow-700' },
    processing: { label: 'Grading…',  dot: 'bg-blue-400 animate-pulse', text: 'text-blue-700' },
    completed:  { label: 'Completed', dot: 'bg-green-400',  text: 'text-green-700' },
    failed:     { label: 'Failed',    dot: 'bg-red-400',    text: 'text-red-600' },
  }

  return (
    <div className="flex gap-6 items-start">

      {/* ── Left column ── */}
      <div className="flex-1 min-w-0 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Welcome back{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}
          </h1>
          <p className="text-sm text-gray-500 mt-1">Ready to grade some papers?</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <p className="text-4xl font-bold text-gray-900">{used}</p>
            <p className="text-sm text-gray-500 mt-1">Papers graded</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <p className="text-4xl font-bold text-gray-900">{remaining}</p>
            <p className="text-sm text-gray-500 mt-1">Remaining</p>
          </div>
        </div>

        {/* Big CTA */}
        <Link
          href="/dashboard/upload"
          className="group flex flex-col items-center justify-center gap-3 bg-gray-900 text-white rounded-2xl p-12 hover:bg-gray-800 transition-colors text-center"
        >
          <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <div>
            <p className="text-xl font-semibold">Start Grading</p>
            <p className="text-sm text-gray-400 mt-1">Upload papers and get AI grades in minutes</p>
          </div>
        </Link>
      </div>

      {/* ── Right pane — Recent Jobs ── */}
      <div className="w-80 shrink-0 bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
          <h2 className="text-sm font-semibold text-gray-900">Recent Jobs</h2>
          <Link href="/dashboard/jobs" className="text-xs text-gray-400 hover:text-gray-700 transition-colors">
            View all →
          </Link>
        </div>

        {/* Job list */}
        {!jobs || jobs.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm text-gray-400">No grading jobs yet.</p>
            <Link href="/dashboard/upload" className="mt-2 inline-block text-sm text-gray-900 font-medium hover:underline">
              Create your first →
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {jobs.map((job) => {
              const cfg = statusConfig[job.status] || statusConfig.pending
              const pct = job.total_papers > 0
                ? Math.round(((job.processed_papers || 0) / job.total_papers) * 100)
                : 0

              return (
                <Link
                  key={job.id}
                  href={`/dashboard/jobs/${job.id}`}
                  className="flex flex-col gap-1.5 px-5 py-3.5 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-gray-900 leading-tight line-clamp-1">
                      {job.title}
                    </p>
                    <span className={`flex items-center gap-1.5 shrink-0 text-xs font-medium ${cfg.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                      {cfg.label}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>{job.total_papers} paper{job.total_papers !== 1 ? 's' : ''}</span>
                    <span>{formatDate(job.created_at)}</span>
                  </div>

                  {/* Progress bar for processing jobs */}
                  {job.status === 'processing' && (
                    <div className="w-full bg-gray-100 rounded-full h-1 mt-0.5">
                      <div
                        className="h-1 bg-blue-500 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}

                  {/* Score summary for completed jobs */}
                  {job.status === 'completed' && job.processed_papers > 0 && (
                    <p className="text-xs text-gray-400">
                      {job.processed_papers} graded
                      {job.failed_papers > 0 ? `, ${job.failed_papers} failed` : ''}
                    </p>
                  )}
                </Link>
              )
            })}
          </div>
        )}
      </div>

    </div>
  )
}
