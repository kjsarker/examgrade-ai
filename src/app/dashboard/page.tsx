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
      .limit(5),
  ])

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-50 text-yellow-700',
    processing: 'bg-blue-50 text-blue-700',
    completed: 'bg-green-50 text-green-700',
    failed: 'bg-red-50 text-red-700',
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          Welcome back{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}
        </h1>
        <p className="text-sm text-gray-500 mt-1">Here&apos;s your grading overview</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Papers graded', value: profile?.papers_used || 0 },
          { label: 'Remaining', value: (profile?.papers_limit || 50) - (profile?.papers_used || 0) },
          { label: 'Total jobs', value: jobs?.length || 0 },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-2xl border border-gray-100 p-5">
            <p className="text-2xl font-semibold text-gray-900">{stat.value}</p>
            <p className="text-sm text-gray-500 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Quick action */}
      <Link
        href="/dashboard/upload"
        className="flex items-center justify-between bg-gray-900 text-white rounded-2xl p-6 hover:bg-gray-800 transition-colors"
      >
        <div>
          <p className="font-semibold">Start a new grading job</p>
          <p className="text-sm text-gray-400 mt-0.5">Upload papers and get AI grades in minutes</p>
        </div>
        <span className="text-2xl">→</span>
      </Link>

      {/* Recent jobs */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">Recent jobs</h2>
          <Link href="/dashboard/jobs" className="text-sm text-gray-500 hover:text-gray-900">View all</Link>
        </div>

        {!jobs || jobs.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
            <p className="text-gray-400 text-sm">No grading jobs yet.</p>
            <Link href="/dashboard/upload" className="mt-3 inline-block text-sm text-gray-900 font-medium hover:underline">
              Create your first job →
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
            {jobs.map((job) => (
              <Link
                key={job.id}
                href={`/dashboard/jobs/${job.id}`}
                className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{job.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{formatDate(job.created_at)} · {job.total_papers} papers</p>
                </div>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusColors[job.status]}`}>
                  {job.status}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
