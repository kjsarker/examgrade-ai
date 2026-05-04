'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { UserProfile } from '@/types'
import { User } from '@supabase/supabase-js'

interface Props {
  user: User
  profile: UserProfile | null
}

const navItems = [
  { href: '/dashboard', label: 'Overview', icon: '⊞' },
  { href: '/dashboard/upload', label: 'New Grading Job', icon: '+' },
  { href: '/dashboard/jobs', label: 'Recent Grading Jobs', icon: '≡' },
  { href: '/dashboard/settings', label: 'Settings', icon: '⚙' },
]

export default function DashboardNav({ user, profile }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const planColors: Record<string, string> = {
    free: 'bg-gray-100 text-gray-600',
    pro: 'bg-blue-50 text-blue-700',
    premium: 'bg-purple-50 text-purple-700',
  }

  const plan = profile?.plan || 'free'
  const used = profile?.papers_used || 0
  const limit = profile?.papers_limit || 50
  const pct = Math.min((used / limit) * 100, 100)

  return (
    <aside className="fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-100 flex flex-col z-10">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-100">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg gradient-brand flex items-center justify-center">
            <span className="text-white font-bold text-xs">E</span>
          </div>
          <span className="font-semibold text-gray-900 text-sm">Speedy ExamGrade</span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map((item) => {
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                active
                  ? 'bg-gray-100 text-gray-900 font-medium'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Usage */}
      <div className="px-4 py-3 border-t border-gray-100">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-gray-500">Papers used</span>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${planColors[plan]}`}>
            {plan.toUpperCase()}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs text-gray-600 mb-1.5">
          <span>{used} / {limit}</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-1.5">
          <div
            className={`h-1.5 rounded-full ${pct > 80 ? 'bg-red-500' : 'bg-gray-800'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        {plan === 'free' && (
          <Link href="/dashboard/settings" className="mt-2 block text-center text-xs bg-gray-900 text-white py-1.5 rounded-lg hover:bg-gray-800 transition-colors">
            Upgrade plan
          </Link>
        )}
      </div>

      {/* User */}
      <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-900 truncate">{profile?.full_name || 'Professor'}</p>
          <p className="text-xs text-gray-400 truncate">{user.email}</p>
        </div>
        <button onClick={handleSignOut} className="text-xs text-gray-400 hover:text-gray-700 ml-2 shrink-0">
          Sign out
        </button>
      </div>
    </aside>
  )
}
