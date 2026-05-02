import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { DifficultyMode } from '@/types'
import { DEFAULT_PROMPTS } from '@/services/prompts'

export async function GET(request: NextRequest) {
  const supabase = await createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const mode = (request.nextUrl.searchParams.get('mode') || 'medium') as DifficultyMode

  const { data: settings } = await supabase
    .from('grading_settings')
    .select('*')
    .eq('user_id', user.id)
    .eq('difficulty_mode', mode)
    .single()

  return NextResponse.json({
    settings: settings || null,
    defaultPrompt: DEFAULT_PROMPTS[mode],
  })
}

export async function POST(request: NextRequest) {
  const supabase = await createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('plan')
    .eq('id', user.id)
    .single()

  if (profile?.plan === 'free') {
    return NextResponse.json({ error: 'Custom prompts require Pro or Premium plan' }, { status: 403 })
  }

  const body = await request.json()
  const { difficulty_mode, custom_prompt_override, use_custom_prompt } = body

  const { data, error } = await supabase
    .from('grading_settings')
    .upsert({
      user_id: user.id,
      difficulty_mode,
      custom_prompt_override,
      use_custom_prompt,
    }, { onConflict: 'user_id,difficulty_mode' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ settings: data })
}

export async function DELETE(request: NextRequest) {
  const supabase = await createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const mode = (request.nextUrl.searchParams.get('mode') || 'medium') as DifficultyMode

  await supabase
    .from('grading_settings')
    .update({ use_custom_prompt: false, custom_prompt_override: null })
    .eq('user_id', user.id)
    .eq('difficulty_mode', mode)

  return NextResponse.json({ success: true })
}
