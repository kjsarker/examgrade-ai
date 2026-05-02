'use client'

import { useState, useEffect } from 'react'
import { DifficultyMode, PLAN_FEATURES, AIProvider } from '@/types'
import { AI_PROVIDERS } from '@/services/ai'

const PROVIDER_ICONS: Record<AIProvider, string> = {
  openai: '🟢',
  anthropic: '🟣',
  gemini: '🔵',
}

export default function SettingsPage() {
  const [activeMode, setActiveMode] = useState<DifficultyMode>('medium')
  const [promptText, setPromptText] = useState('')
  const [defaultPrompt, setDefaultPrompt] = useState('')
  const [useCustom, setUseCustom] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [plan, setPlan] = useState('free')
  const [checkoutLoading, setCheckoutLoading] = useState('')

  // AI Provider state
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>('openai')
  const [configuredProviders, setConfiguredProviders] = useState<Record<string, boolean>>({})
  const [providerSaving, setProviderSaving] = useState(false)
  const [providerSaved, setProviderSaved] = useState(false)

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

    fetch('/api/settings/provider').then((r) => r.json()).then((d) => {
      setConfiguredProviders(d.configured || {})
      if (d.selectedProvider) setSelectedProvider(d.selectedProvider)
      else {
        // Auto-select first configured provider
        const first = Object.entries(d.configured || {}).find(([, v]) => v)?.[0]
        if (first) setSelectedProvider(first as AIProvider)
      }
    }).catch(() => {})
  }, [])

  const handleSavePrompt = async () => {
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

  const handleSaveProvider = async (provider: AIProvider) => {
    setSelectedProvider(provider)
    setProviderSaving(true)
    await fetch('/api/settings/provider', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider }),
    })
    setProviderSaving(false)
    setProviderSaved(true)
    setTimeout(() => setProviderSaved(false), 2000)
  }

  const handleUpgrade = async (targetPlan: 'pro' | 'premium') => {
    setCheckoutLoading(targetPlan)
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: targetPlan }),
    })
    const { url } = await res.json()
    if (url) window.location.href = url
    setCheckoutLoading('')
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Configure AI provider, grading behavior, and your plan</p>
      </div>

      {/* AI Provider Selector */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
        <div>
          <h2 className="font-semibold text-gray-900">AI Provider</h2>
          <p className="text-sm text-gray-500 mt-0.5">Choose which AI model grades your papers</p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {(Object.entries(AI_PROVIDERS) as [AIProvider, typeof AI_PROVIDERS[AIProvider]][]).map(([key, info]) => {
            const isConfigured = configuredProviders[key]
            const isSelected = selectedProvider === key
            return (
              <button
                key={key}
                onClick={() => isConfigured && handleSaveProvider(key)}
                disabled={!isConfigured}
                className={`relative p-4 rounded-xl border text-left transition-colors ${
                  isSelected && isConfigured
                    ? 'border-gray-900 bg-gray-900 text-white'
                    : isConfigured
                    ? 'border-gray-200 hover:border-gray-400'
                    : 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                }`}
              >
                <div className="text-xl mb-2">{PROVIDER_ICONS[key]}</div>
                <p className={`text-sm font-medium ${isSelected && isConfigured ? 'text-white' : 'text-gray-900'}`}>
                  {info.name}
                </p>
                <p className={`text-xs mt-0.5 ${isSelected && isConfigured ? 'text-gray-400' : 'text-gray-400'}`}>
                  {info.defaultModel}
                </p>
                {!isConfigured && (
                  <p className="text-xs text-gray-400 mt-1">No API key</p>
                )}
                {isSelected && isConfigured && (
                  <div className="absolute top-2 right-2 w-2 h-2 bg-green-400 rounded-full" />
                )}
              </button>
            )
          })}
        </div>

        {providerSaved && (
          <p className="text-sm text-green-600">✓ Provider saved</p>
        )}

        <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-2">
          <p className="font-medium text-gray-700">Add API keys in Vercel environment variables:</p>
          <div className="space-y-1 font-mono text-xs text-gray-500">
            <p>OPENAI_API_KEY — from platform.openai.com</p>
            <p>ANTHROPIC_API_KEY — from console.anthropic.com</p>
            <p>GEMINI_API_KEY — from aistudio.google.com</p>
          </div>
        </div>
      </div>

      {/* Grading Prompt Editor */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
        <div>
          <h2 className="font-semibold text-gray-900">Grading Prompt</h2>
          <p className="text-sm text-gray-500 mt-0.5">Customize AI grading instructions per difficulty level</p>
        </div>

        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {(['easy', 'medium', 'hard'] as DifficultyMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setActiveMode(mode)}
              className={`flex-1 py-1.5 text-sm rounded-lg font-medium transition-colors capitalize ${
                activeMode === mode ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>

        {plan === 'free' ? (
          <div className="bg-amber-50 text-amber-700 text-sm px-4 py-3 rounded-xl">
            Custom prompt editing requires a Pro or Premium plan.
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={useCustom} onChange={(e) => setUseCustom(e.target.checked)} className="rounded" />
                Use custom prompt for {activeMode} mode
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
            <button
              onClick={handleSavePrompt}
              disabled={saving || !useCustom}
              className="bg-gray-900 text-white text-sm px-5 py-2 rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-40"
            >
              {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save prompt'}
            </button>
          </>
        )}
      </div>

      {/* Billing */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
        <div>
          <h2 className="font-semibold text-gray-900">Billing & Plan</h2>
          <p className="text-sm text-gray-500 mt-0.5">Current plan: <span className="font-medium text-gray-900 capitalize">{plan}</span></p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {(Object.entries(PLAN_FEATURES) as Array<[string, typeof PLAN_FEATURES['free']]>).map(([key, p]) => (
            <div key={key} className={`rounded-xl border p-4 ${plan === key ? 'border-gray-900 bg-gray-50' : 'border-gray-200'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-900">{p.name}</span>
                {plan === key && <span className="text-xs bg-gray-900 text-white px-2 py-0.5 rounded-full">Current</span>}
              </div>
              <p className="text-lg font-semibold text-gray-900 mb-1">{p.price === 0 ? 'Free' : `$${p.price}/mo`}</p>
              <p className="text-xs text-gray-500 mb-3">{p.papers_per_month} papers{key === 'free' ? ' lifetime' : '/month'}</p>
              <ul className="space-y-1 mb-3">
                {p.features.slice(0, 3).map((f) => (
                  <li key={f} className="text-xs text-gray-500 flex items-start gap-1.5">
                    <span className="text-green-500 shrink-0">✓</span>{f}
                  </li>
                ))}
              </ul>
              {key !== 'free' && plan !== key && (
                <button
                  onClick={() => handleUpgrade(key as 'pro' | 'premium')}
                  disabled={!!checkoutLoading}
                  className="w-full bg-gray-900 text-white text-xs py-2 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-40"
                >
                  {checkoutLoading === key ? 'Loading…' : `Upgrade to ${p.name}`}
                </button>
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400">Overage: $0.50/paper. Cancel anytime.</p>
      </div>
    </div>
  )
}
