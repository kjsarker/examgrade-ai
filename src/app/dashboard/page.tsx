import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user!.id)
    .single()

  const used = profile?.papers_used || 0
  const limit = profile?.papers_limit || 50
  const remaining = limit - used

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          Welcome back{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}
        </h1>
        <p className="text-sm text-gray-500 mt-1">Ready to grade some papers?</p>
      </div>

      {/* 2-stat row */}
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

      {/* Big Start Grading CTA */}
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
  )
}
