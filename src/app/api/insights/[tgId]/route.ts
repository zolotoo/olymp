// Инсайты по юзеру: агрегаты из user_profile_v + LLM-резюме (кешируется в user_insights).
// GET   → отдаёт кеш (если есть) + актуальные числа из view
// POST  → форсированно перегенерирует LLM-резюме и записывает в user_insights

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentAdminTgId } from '@/lib/admin-auth'

type ProfileRow = {
  tg_id: number
  tg_first_name: string | null
  tg_username: string | null
  funnel_stage: string
  engagement_score: number
  is_member: boolean
  subscription_active: boolean
  onboarding_done: boolean
  goal: string | null
  goal_custom: string | null
  level: string | null
  skills: unknown
  hours_per_week: string | null
  has_business: string | null
  recommended_paths: unknown
  mini_app_opens_30d: number
  mini_app_opens_total: number
  library_clicks_30d: number
  library_clicks_total: number
  top_kinds: { kind: string; clicks: number }[] | null
  broadcasts_received_90d: number
  broadcasts_engaged_90d: number
  broadcast_engagement_pct: number | null
  messages_30d: number
  reactions_given_30d: number
  days_since_active: number | null
  rank: string | null
  points: number | null
  source: string | null
}

function buildPrompt(p: ProfileRow): string {
  const name = p.tg_first_name || p.tg_username || `id:${p.tg_id}`
  const topKindsStr = (p.top_kinds && p.top_kinds.length)
    ? p.top_kinds.map(k => `${k.kind}(${k.clicks})`).join(', ')
    : '—'
  const skillsStr = Array.isArray(p.skills) ? (p.skills as string[]).join(', ') : '—'
  return `Ты — аналитик AI Олимпа. Дай админу краткое (3–4 предложения) резюме по участнику и ОДНО конкретное предложение, что сделать дальше (рассылка, контент, нудж).

Имя: ${name}
Стадия воронки: ${p.funnel_stage}
Подписка активна: ${p.subscription_active ? 'да' : 'нет'}
Источник: ${p.source ?? '—'}, ранг: ${p.rank ?? '—'}, фантиков: ${p.points ?? 0}
Онбординг пройден: ${p.onboarding_done ? 'да' : 'нет'}; цель: ${p.goal || '—'}${p.goal_custom ? ` (${p.goal_custom})` : ''}; уровень: ${p.level || '—'}; часов/нед: ${p.hours_per_week || '—'}; есть бизнес: ${p.has_business || '—'}
Навыки: ${skillsStr}
Активность: дней с активности ${p.days_since_active ?? '—'}, сообщений за 30д ${p.messages_30d}, реакций за 30д ${p.reactions_given_30d}
Miniapp: открытий за 30д ${p.mini_app_opens_30d} (всего ${p.mini_app_opens_total})
Библиотека: кликов за 30д ${p.library_clicks_30d} (всего ${p.library_clicks_total}); топ направления: ${topKindsStr}
Рассылки: получил за 90д ${p.broadcasts_received_90d}, открыл ${p.broadcasts_engaged_90d} (${p.broadcast_engagement_pct ?? 0}%)
Engagement-скор: ${p.engagement_score}/100

Формат строго JSON, без markdown:
{
  "summary": "3–4 предложения по-русски: кто это, что цепляет, чего не сделал, риск/потенциал",
  "suggested_action": "одно действие 1 строкой: например 'отправить ему дайджест trends + продление, цена ему подходит'"
}`
}

async function genSummary(p: ProfileRow): Promise<{ summary: string; suggested_action: string; model: string } | null> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) return null
  const model = 'anthropic/claude-haiku-4-5'
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://ai-olymp.vercel.app',
      'X-Title': 'AI Олимп Insights',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: buildPrompt(p) }],
      max_tokens: 400,
      response_format: { type: 'json_object' },
    }),
  })
  const data = await res.json()
  const raw = data?.choices?.[0]?.message?.content
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as { summary?: string; suggested_action?: string }
    return {
      summary: parsed.summary || '',
      suggested_action: parsed.suggested_action || '',
      model,
    }
  } catch {
    // модель иногда возвращает не-JSON — отдадим как есть в summary
    return { summary: String(raw), suggested_action: '', model }
  }
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ tgId: string }> }) {
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

export async function POST(req: NextRequest, ctx: { params: Promise<{ tgId: string }> }) {
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

  const gen = await genSummary(profile as ProfileRow)
  if (!gen) return NextResponse.json({ error: 'llm_unavailable' }, { status: 500 })

  const { error } = await supabaseAdmin
    .from('user_insights')
    .upsert({
      tg_id: tgId,
      summary: gen.summary,
      suggested_action: gen.suggested_action,
      model: gen.model,
      generated_at: new Date().toISOString(),
    }, { onConflict: 'tg_id' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, summary: gen.summary, suggested_action: gen.suggested_action, model: gen.model })
  // воркэраунд для req unused
  void req
}
