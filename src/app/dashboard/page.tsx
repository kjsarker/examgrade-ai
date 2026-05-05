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
  const limit = profile?.papers_limit || 5
  const remaining = limit - used

  const statusConfig: Record<string, { label: string; dot: string; text: string }> = {
    pending:    { label: 'Pending',    dot: 'bg-yellow-400', text: 'text-yellow-700' },
    processing: { label: 'Grading…',  dot: 'bg-blue-400 animate-pulse', text: 'text-blue-700' },
    completed:  { label: 'Completed', dot: 'bg-green-400',  text: 'text-green-700' },
    failed:     { label: 'Failed',    dot: 'bg-red-400',    text: 'text-red-600' },
  }

  return (
    <div className="max-w-2xl space-y-6">
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

      {/* Start Grading CTA */}
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
          <p className="text-sm text-gray-400 mt-1">Upload papers and get results in minutes</p>
        </div>
      </Link>

      {/* Recent Jobs */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">Recent Jobs</h2>
          <Link href="/dashboard/jobs" className="text-sm text-gray-400 hover:text-gray-700 transition-colors">
            View all →
          </Link>
        </div>

        {!jobs || jobs.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
            <p className="text-gray-400 text-sm">No grading jobs yet.</p>
            <Link href="/dashboard/upload" className="mt-2 inline-block text-sm text-gray-900 font-medium hover:underline">
              Create your first →
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
            {jobs.map((job) => {
              const cfg = statusConfig[job.status] || statusConfig.pending
              return (
                <Link
                  key={job.id}
                  href={`/dashboard/jobs/${job.id}`}
                  className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{job.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {formatDate(job.created_at)} · {job.total_papers} paper{job.total_papers !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <span className={`flex items-center gap-1.5 shrink-0 ml-4 text-xs font-medium ${cfg.text}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                    {cfg.label}
                  </span>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
