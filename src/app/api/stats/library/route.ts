import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentAdminTgId } from '@/lib/admin-auth'

// GET /api/stats/library?days=7
//   Простая текстовая аналитика библиотеки:
//   - публикации по kind (за период)
//   - top постов по кликам
//   - очередь модерации (общая, не за период)

const DEFAULT_DAYS = 7

export async function GET(req: NextRequest) {
  const adminTg = await getCurrentAdminTgId()
  if (!adminTg) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const days = Math.min(90, Math.max(1, Number(url.searchParams.get('days') ?? DEFAULT_DAYS)))
  const since = new Date(Date.now() - days * 86_400_000).toISOString()

  // 1. Публикации по kind за период.
  const { data: pubs } = await supabaseAdmin
    .from('library_items')
    .select('kind, message_id, chat_id, title_override, is_featured, created_at')
    .eq('status', 'published')
    .gte('created_at', since)
  const pubsByKind = new Map<string, number>()
  for (const p of pubs ?? []) {
    pubsByKind.set(p.kind, (pubsByKind.get(p.kind) ?? 0) + 1)
  }

  // 2. Клики по kind + по постам.
  const { data: clicks } = await supabaseAdmin
    .from('library_events')
    .select('chat_id, message_id, kind, member_tg_id, created_at')
    .eq('event_type', 'click')
    .gte('created_at', since)

  const clicksByKind = new Map<string, number>()
  const clicksByPost = new Map<string, number>()       // key = chat_id:message_id
  const uniqueClickers = new Set<number>()
  for (const c of clicks ?? []) {
    if (c.kind) clicksByKind.set(c.kind, (clicksByKind.get(c.kind) ?? 0) + 1)
    const k = `${c.chat_id}:${c.message_id}`
    clicksByPost.set(k, (clicksByPost.get(k) ?? 0) + 1)
    if (c.member_tg_id) uniqueClickers.add(c.member_tg_id)
  }

  // 3. Топ-5 постов по кликам — добавляем заголовки/kind/ссылку.
  const topKeys = [...clicksByPost.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([k]) => {
      const [cid, mid] = k.split(':').map(Number)
      return { chat_id: cid, message_id: mid }
    })

  let topPosts: Array<{ message_id: number; chat_id: number; kind: string; title: string; clicks: number; is_featured: boolean }> = []
  if (topKeys.length) {
    // Один RPC-стиль запрос — фильтруем по составному ключу client-side.
    const messageIds = topKeys.map(k => k.message_id)
    const { data: items } = await supabaseAdmin
      .from('library_items')
      .select(`
        chat_id, message_id, kind, title_override, is_featured,
        tg_messages:tg_messages!inner ( text )
      `)
      .in('message_id', messageIds)
    topPosts = (items ?? [])
      .map(it => {
        const tg = (it as { tg_messages?: { text?: string | null } }).tg_messages
        const txt = (tg?.text ?? '').trim()
        const first = txt.split(/\n+/).map(s => s.trim()).find(Boolean) ?? ''
        const title = (it.title_override?.trim() || first).slice(0, 80) || 'Пост'
        const clicks = clicksByPost.get(`${it.chat_id}:${it.message_id}`) ?? 0
        return { chat_id: it.chat_id, message_id: it.message_id, kind: it.kind, title, clicks, is_featured: it.is_featured }
      })
      .filter(p => p.clicks > 0)
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 5)
  }

  // 4. Очередь модерации — общая.
  const { count: pendingCount } = await supabaseAdmin
    .from('library_items')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')

  const { data: oldestPending } = await supabaseAdmin
    .from('library_items')
    .select('created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  const oldestDays = oldestPending
    ? Math.floor((Date.now() - new Date(oldestPending.created_at).getTime()) / 86_400_000)
    : 0

  // 5. Заголовки топиков для красивых лейблов.
  const { data: topics } = await supabaseAdmin
    .from('tg_topics')
    .select('kind, title, emoji, sort_order')
    .eq('is_visible', true)
    .order('sort_order', { ascending: true })

  const kindMeta = new Map<string, { title: string; emoji: string | null; order: number }>()
  for (const t of topics ?? []) {
    if (!kindMeta.has(t.kind)) kindMeta.set(t.kind, { title: t.title, emoji: t.emoji, order: t.sort_order })
  }

  const allKinds = new Set<string>([...pubsByKind.keys(), ...clicksByKind.keys()])
  const byKind = [...allKinds]
    .map(kind => ({
      kind,
      title: kindMeta.get(kind)?.title ?? kind,
      emoji: kindMeta.get(kind)?.emoji ?? null,
      published: pubsByKind.get(kind) ?? 0,
      clicks: clicksByKind.get(kind) ?? 0,
    }))
    .sort((a, b) => (kindMeta.get(a.kind)?.order ?? 999) - (kindMeta.get(b.kind)?.order ?? 999))

  return NextResponse.json({
    days,
    by_kind: byKind,
    top_posts: topPosts,
    totals: {
      published: pubs?.length ?? 0,
      clicks: clicks?.length ?? 0,
      unique_clickers: uniqueClickers.size,
    },
    queue: {
      pending: pendingCount ?? 0,
      oldest_days: oldestDays,
    },
  })
}
