import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'

export default async function JobsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: jobs } = await supabase
    .from('grading_jobs')
    .select('*')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false })

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-50 text-yellow-700',
    processing: 'bg-blue-50 text-blue-700',
    completed: 'bg-green-50 text-green-700',
    failed: 'bg-red-50 text-red-700',
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Grading Jobs</h1>
          <p className="text-sm text-gray-500 mt-1">All your exam grading sessions</p>
        </div>
        <Link
          href="/dashboard/upload"
          className="bg-gray-900 text-white text-sm px-4 py-2 rounded-xl hover:bg-gray-800 transition-colors"
        >
          + New job
        </Link>
      </div>

      {!jobs || jobs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <p className="text-gray-400">No grading jobs yet</p>
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
              className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900">{job.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {formatDate(job.created_at)} · {job.total_papers} papers · {job.difficulty_mode} mode
                </p>
              </div>
              <div className="flex items-center gap-4 ml-4 shrink-0">
                {job.status === 'completed' && (
                  <p className="text-xs text-gray-400">
                    {job.processed_papers} / {job.total_papers} graded
                  </p>
                )}
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusColors[job.status]}`}>
                  {job.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
