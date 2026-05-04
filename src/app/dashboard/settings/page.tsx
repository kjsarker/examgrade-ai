'use client'

import { useState, useEffect } from 'react'
import { DifficultyMode, PLAN_FEATURES } from '@/types'

export default function SettingsPage() {
  const [activeMode, setActiveMode] = useState<DifficultyMode>('medium')
  const [promptText, setPromptText] = useState('')
  const [defaultPrompt, setDefaultPrompt] = useState('')
  const [useCustom, setUseCustom] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [plan, setPlan] = useState('free')
  const [checkoutLoading, setCheckoutLoading] = useState('')
  const [upgradeError, setUpgradeError] = useState('')

  useEffect(() => {
    fetch('/api/settings?mode=' + activeMode)
      .then((r) => r.json())
      .then(({ settings, defaultPrompt }) => {
        setDefaultPrompt(defaultPrompt)
        setPromptText(settings?.custom_prompt_override || defaultPrompt)
        setUseCustom(settings?.use_custom_prompt || false)
      })
  }, [activeMode])

  useEffect(() => {
    fetch('/api/auth/profile').then((r) => r.json()).then((d) => {
      if (d.plan) setPlan(d.plan)
    }).catch(() => {})
  }, [])

  const handleSave = async () => {
    setSaving(true)
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ difficulty_mode: activeMode, custom_prompt_override: promptText, use_custom_prompt: useCustom }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleReset = async () => {
    await fetch(`/api/settings?mode=${activeMode}`, { method: 'DELETE' })
    setPromptText(defaultPrompt)
    setUseCustom(false)
  }

  const handleUpgrade = async (targetPlan: 'pro' | 'premium') => {
    setCheckoutLoading(targetPlan)
    setUpgradeError('')
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: targetPlan }),
      })
      const data = await res.json()
      if (!res.ok) {
        setUpgradeError(data.error || 'Upgrade failed. Please try again.')
      } else if (data.url) {
        window.location.href = data.url
      } else {
        setUpgradeError('Could not start checkout. Please try again.')
      }
    } catch {
      setUpgradeError('Network error. Please try again.')
    }
    setCheckoutLoading('')
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Customize grading behavior and manage your plan</p>
      </div>

      {/* Prompt editor */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
        <div>
          <h2 className="font-semibold text-gray-900">Grading Prompt</h2>
          <p className="text-sm text-gray-500 mt-0.5">Customize the grading instructions per difficulty level</p>
        </div>

        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {(['easy', 'medium', 'hard'] as DifficultyMode[]).map((mode) => (
            <button key={mode} onClick={() => setActiveMode(mode)}
              className={`flex-1 py-1.5 text-sm rounded-lg font-medium transition-colors capitalize ${activeMode === mode ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {mode}
            </button>
          ))}
        </div>

        {plan === 'free' ? (
          <div className="bg-amber-50 text-amber-700 text-sm px-4 py-3 rounded-xl border border-amber-100">
            Custom prompt editing requires a Pro or Premium plan.
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={useCustom} onChange={(e) => setUseCustom(e.target.checked)} className="rounded" />
                Use custom prompt for <strong>{activeMode}</strong> mode
              </label>
              <button onClick={handleReset} className="text-xs text-gray-400 hover:text-gray-600 underline">
                Reset to default
              </button>
            </div>
            <textarea
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              disabled={!useCustom}
              rows={10}
              className="w-full border border-gray-200 rounded-xl p-3 text-xs font-mono text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:bg-gray-50 disabled:text-gray-400 resize-none"
            />
            <button onClick={handleSave} disabled={saving || !useCustom}
              className="bg-gray-900 text-white text-sm px-5 py-2 rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-40">
              {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save prompt'}
            </button>
          </>
        )}
      </div>

      {/* Billing */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
        {upgradeError && (
          <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl border border-red-100">{upgradeError}</div>
        )}
        <div>
          <h2 className="font-semibold text-gray-900">Billing & Plan</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Current plan: <span className="font-medium text-gray-900 capitalize">{plan}</span>
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {(Object.entries(PLAN_FEATURES) as Array<[string, typeof PLAN_FEATURES['free']]>).map(([key, p]) => (
            <div key={key} className={`rounded-xl border p-4 flex flex-col ${plan === key ? 'border-gray-900 bg-gray-50' : 'border-gray-200'}`}>
              <div className="flex items-center justify-between mb-2 min-h-[24px]">
                <span className="text-sm font-semibold text-gray-900">{p.name}</span>
                {plan === key && <span className="text-xs bg-gray-900 text-white px-2 py-0.5 rounded-full">Current</span>}
              </div>
              <p className="text-lg font-semibold text-gray-900 mb-1">{p.price === 0 ? 'Free' : `$${p.price}/mo`}</p>
              <p className="text-xs text-gray-500 mb-3">{p.papers_per_month} papers{key === 'free' ? ' lifetime' : '/month'}</p>
              <ul className="space-y-1.5 mb-4 flex-1">
                {p.features.slice(0, 3).map((f) => (
                  <li key={f} className="text-xs text-gray-600 flex items-start gap-1.5">
                    <span className="text-green-500 shrink-0 leading-none mt-0.5">✓</span>
                    <span className="leading-snug">{f}</span>
                  </li>
                ))}
              </ul>
              {key !== 'free' && plan !== key ? (
                <button onClick={() => handleUpgrade(key as 'pro' | 'premium')} disabled={!!checkoutLoading}
                  className="mt-auto w-full bg-gray-900 text-white text-xs font-medium py-2.5 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-40">
                  {checkoutLoading === key ? 'Loading…' : `Upgrade to ${p.name}`}
                </button>
              ) : (
                <div className="mt-auto h-[38px]" />
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400">Overage: $0.50/paper. Cancel anytime.</p>
      </div>
    </div>
  )
}
