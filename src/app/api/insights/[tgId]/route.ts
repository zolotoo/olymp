// Инсайты по юзеру: агрегаты из user_profile_v + LLM-резюме (кешируется в user_insights).
// GET   → отдаёт кеш (если есть) + актуальные числа из view
// POST  → форсированно перегенерирует LLM-резюме и записывает в user_insights

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentAdminTgId } from '@/lib/admin-auth'
import { generateInsight, type ProfileForInsight } from '@/lib/insight-generator'

export async function GET(_req: NextRequest, ctx: { params: Promise<{ tgId: string }> }) {
  const admin = await getCurrentAdminTgId()
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { tgId: tgIdStr } = await ctx.params
  const tgId = Number(tgIdStr)
  if (!Number.isFinite(tgId)) return NextResponse.json({ error: 'bad_tg_id' }, { status: 400 })

  const [{ data: profile }, { data: insight }] = await Promise.all([
    supabaseAdmin.from('user_profile_v').select('*').eq('tg_id', tgId).maybeSingle(),
    supabaseAdmin.from('user_insights').select('*').eq('tg_id', tgId).maybeSingle(),
  ])
  if (!profile) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  return NextResponse.json({ profile, insight })
}

export async function POST(_req: NextRequest, ctx: { params: Promise<{ tgId: string }> }) {
  const admin = await getCurrentAdminTgId()
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { tgId: tgIdStr } = await ctx.params
  const tgId = Number(tgIdStr)
  if (!Number.isFinite(tgId)) return NextResponse.json({ error: 'bad_tg_id' }, { status: 400 })

  const { data: profile } = await supabaseAdmin
    .from('user_profile_v')
    .select('*')
    .eq('tg_id', tgId)
    .maybeSingle()
  if (!profile) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const gen = await generateInsight(profile as ProfileForInsight)
  if (!gen) return NextResponse.json({ error: 'llm_unavailable' }, { status: 500 })

  const { error } = await supabaseAdmin
    .from('user_insights')
    .upsert(
      {
        tg_id: tgId,
        summary: gen.summary,
        suggested_action: gen.suggested_action,
        engagement_hook: gen.engagement_hook,
        draft_message: gen.draft_message,
        model: gen.model,
        generated_at: new Date().toISOString(),
      },
      { onConflict: 'tg_id' },
    )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, ...gen })
}
