// Персональная карта уроков под конкретного юзера.
//
// Алгоритм (без LLM):
//   1) recommended_paths из onboarding_answers — главное направление (vibecode/content/…)
//   2) top_kinds из user_profile_v — что юзер уже сам кликал
//   3) library_items published, не открытые юзером
//   4) скоринг: пересечение path_kinds с recommended_paths +10, kind в top_kinds +5,
//      featured +3, свежее (30д) +2
//   5) выдача — top 10
//
// Используется в карточке участника (блок «Карта уроков») и потенциально
// в будущем — в персональных рассылках типа «вот следующий урок».

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

type LibraryItemRow = {
  id: number
  chat_id: number
  message_id: number
  kind: string
  status: string
  title_override: string | null
  is_featured: boolean
  created_at: string
  path_kinds: string[]
  tg_messages?: { text?: string | null } | null
}

type RecommendedItem = {
  id: number
  chat_id: number
  message_id: number
  kind: string
  title: string
  is_featured: boolean
  score: number
  reasons: string[]
  miniapp_url: string
  chat_url: string
}

function firstLine(s: string | null | undefined, max = 80): string {
  if (!s) return ''
  const t = s.split('\n')[0].trim()
  return t.length > max ? t.slice(0, max) + '…' : t
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ tgId: string }> }) {
  const { tgId: tgIdStr } = await ctx.params
  const tgId = Number(tgIdStr)
  if (!Number.isFinite(tgId)) return NextResponse.json({ error: 'bad_tg_id' }, { status: 400 })

  // 1) onboarding-рекомендации.
  // В БД лежит как [{kind:'vibecode',score:100}, …] (отсортировано по убыванию score).
  // Нам нужны только сами ключи направлений для сравнения с library_items.path_kinds.
  const { data: onb } = await supabaseAdmin
    .from('onboarding_answers')
    .select('recommended_paths, goal, level')
    .eq('tg_id', tgId)
    .maybeSingle()
  type PathScore = { kind: string; score?: number }
  const recommendedPaths: string[] = Array.isArray(onb?.recommended_paths)
    ? ((onb!.recommended_paths as PathScore[])
        .map((p) => (typeof p === 'string' ? p : p?.kind))
        .filter((k): k is string => typeof k === 'string'))
    : []

  // 2) топ-интересы юзера
  const { data: profile } = await supabaseAdmin
    .from('user_profile_v')
    .select('top_kinds')
    .eq('tg_id', tgId)
    .maybeSingle()
  type Top = { kind: string; clicks: number }
  const topKinds: string[] = Array.isArray(profile?.top_kinds)
    ? (profile!.top_kinds as Top[]).map((k) => k.kind)
    : []

  // 3) уже открытые юзером посты библиотеки — исключим
  const { data: clicks } = await supabaseAdmin
    .from('library_events')
    .select('chat_id, message_id')
    .eq('member_tg_id', tgId)
    .not('message_id', 'is', null)
    .limit(500)
  const clicked = new Set<string>(
    (clicks ?? []).map((c) => `${c.chat_id}:${c.message_id}`),
  )

  // 4) published-каталог
  const { data: items } = await supabaseAdmin
    .from('library_items')
    .select(`
      id, chat_id, message_id, kind, status, title_override, is_featured,
      created_at, path_kinds,
      tg_messages:tg_messages!inner ( text )
    `)
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(200)

  const now = Date.now()
  const THIRTY_DAYS = 30 * 86400 * 1000

  const ranked: RecommendedItem[] = []
  for (const raw of (items ?? []) as LibraryItemRow[]) {
    if (clicked.has(`${raw.chat_id}:${raw.message_id}`)) continue
    const pathKinds = Array.isArray(raw.path_kinds) ? raw.path_kinds : []

    let score = 0
    const reasons: string[] = []

    // совпадение с направлением из анкеты
    const pathHit = pathKinds.some((p) => recommendedPaths.includes(p))
    if (pathHit) { score += 10; reasons.push('под твой путь') }

    // совпадение с тем, что юзер уже сам кликал
    if (topKinds.includes(raw.kind)) { score += 5; reasons.push('тебе уже заходило') }

    if (raw.is_featured) { score += 3; reasons.push('featured') }

    const ageMs = now - new Date(raw.created_at).getTime()
    if (ageMs < THIRTY_DAYS) { score += 2; reasons.push('свежее') }

    // отбрасываем совсем нерелевантное только когда у юзера ЕСТЬ предпочтения
    if (score === 0 && (recommendedPaths.length > 0 || topKinds.length > 0)) continue

    const title = raw.title_override || firstLine(raw.tg_messages?.text) || `Урок #${raw.message_id}`
    // chat_id в TG для приватных супергрупп начинается с -100; во внешней
    // ссылке оно идёт без -100. У нас в БД chat_id хранится «как есть».
    const chatIdForUrl = String(raw.chat_id).replace(/^-100/, '')
    const chatUrl = `https://t.me/c/${chatIdForUrl}/${raw.message_id}`
    const miniappUrl = `https://aiolymp.vercel.app/app?tab=library&kind=${encodeURIComponent(raw.kind)}&msg=${raw.message_id}`

    ranked.push({
      id: raw.id,
      chat_id: raw.chat_id,
      message_id: raw.message_id,
      kind: raw.kind,
      title,
      is_featured: raw.is_featured,
      score,
      reasons,
      miniapp_url: miniappUrl,
      chat_url: chatUrl,
    })
  }

  ranked.sort((a, b) => b.score - a.score || b.message_id - a.message_id)
  const top = ranked.slice(0, 10)

  return NextResponse.json({
    tg_id: tgId,
    recommended_paths: recommendedPaths,
    top_kinds: topKinds,
    onboarding: onb ? { goal: onb.goal, level: onb.level } : null,
    items: top,
  })
}
