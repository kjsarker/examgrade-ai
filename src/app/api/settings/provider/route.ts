import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// Returns which AI providers are configured (have real API keys)
export async function GET() {
  const configured: Record<string, boolean> = {
    openai: !!(process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.startsWith('placeholder')),
    anthropic: !!(process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_API_KEY.startsWith('placeholder')),
    gemini: !!(process.env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY.startsWith('placeholder')),
  }

  const supabase = await createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: settings } = await supabase
    .from('grading_settings')
    .select('ai_provider')
    .eq('user_id', user.id)
    .eq('difficulty_mode', 'medium')
    .single()

  return NextResponse.json({
    configured,
    selectedProvider: settings?.ai_provider || null,
  })
}

export async function POST(request: NextRequest) {
  const supabase = await createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { provider } = await request.json()

  // Update all difficulty modes to use this provider
  for (const mode of ['easy', 'medium', 'hard']) {
    await supabase.from('grading_settings').upsert({
      user_id: user.id,
      difficulty_mode: mode,
      ai_provider: provider,
    }, { onConflict: 'user_id,difficulty_mode' })
  }

  return NextResponse.json({ success: true })
}
