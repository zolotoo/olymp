import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentAdminTgId } from '@/lib/admin-auth'

// GET /api/library/items?status=pending|published|rejected
//   Список карточек для админки + JOIN на tg_messages.
//   В отличие от мини-аппного /api/library, этот:
//     - возвращает все статусы
//     - не группирует по топикам (плоский список)
//     - даёт сырой text целиком (не превью)

export async function GET(req: NextRequest) {
  const adminTgId = await getCurrentAdminTgId()
  if (!adminTgId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const status = url.searchParams.get('status') ?? 'pending'
  if (!['pending', 'published', 'rejected'].includes(status)) {
    return NextResponse.json({ error: 'bad_status' }, { status: 400 })
  }

  // pending — старые сверху (чтобы залежавшиеся посты не терялись).
  // published/rejected — свежие сверху.
  const ascending = status === 'pending'

  const { data: rows, error } = await supabaseAdmin
    .from('library_items')
    .select(`
      id, chat_id, message_id, thread_id, kind, status,
      title_override, is_featured, approved_at, created_at,
      tg_messages:tg_messages!inner ( text, has_media, media_kind, sent_at, author_tg_id )
    `)
    .eq('status', status)
    .order('created_at', { ascending })
    .limit(200)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: topicsRaw } = await supabaseAdmin
    .from('tg_topics')
    .select('chat_id, thread_id, kind, title, emoji')
  const topicMap = new Map<string, { kind: string; title: string; emoji: string | null }>()
  for (const t of topicsRaw ?? []) {
    topicMap.set(`${t.chat_id}:${t.thread_id}`, { kind: t.kind, title: t.title, emoji: t.emoji })
  }

  // Также возвращаем счётчики по всем статусам — на табах.
  const { data: counts } = await supabaseAdmin
    .from('library_items')
    .select('status', { count: 'exact', head: false })
  const tally = { pending: 0, published: 0, rejected: 0 }
  for (const r of (counts ?? []) as Array<{ status: string }>) {
    if (r.status in tally) tally[r.status as keyof typeof tally] += 1
  }

  return NextResponse.json({
    items: (rows ?? []).map(r => {
      const tg = (r as { tg_messages?: { text?: string | null; sent_at?: string | null; has_media?: boolean; media_kind?: string | null; author_tg_id?: number | null } }).tg_messages
      const topic = topicMap.get(`${r.chat_id}:${r.thread_id ?? 0}`)
      return {
        id: r.id,
        chat_id: r.chat_id,
        message_id: r.message_id,
        thread_id: r.thread_id,
        kind: r.kind,
        status: r.status,
        title_override: r.title_override,
        is_featured: r.is_featured,
        approved_at: r.approved_at,
        created_at: r.created_at,
        text: tg?.text ?? null,
        has_media: tg?.has_media ?? false,
        media_kind: tg?.media_kind ?? null,
        sent_at: tg?.sent_at ?? null,
        author_tg_id: tg?.author_tg_id ?? null,
        topic_title: topic?.title ?? r.kind,
        topic_emoji: topic?.emoji ?? null,
      }
    }),
    counts: tally,
  })
}

// PATCH /api/library/items
// body: { id, action: 'approve'|'reject'|'unpublish'|'feature'|'unfeature', title?: string }
//
// Семантика:
//   approve     — pending|rejected → published, approved_by/approved_at записываются
//   reject      — любой → rejected
//   unpublish   — published → pending (вернуть в очередь)
//   feature     — only on published, is_featured=true
//   unfeature   — is_featured=false
// Изменение заголовка — отдельным action 'title' с body.title.
export async function PATCH(req: NextRequest) {
  const adminTgId = await getCurrentAdminTgId()
  if (!adminTgId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as {
    id?: number
    action?: string
    title?: string
  }
  const id = Number(body.id)
  const action = String(body.action ?? '')
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: 'bad_id' }, { status: 400 })
  }

  const now = new Date().toISOString()
  let patch: Record<string, unknown> = { updated_at: now }
  switch (action) {
    case 'approve':
      patch = { ...patch, status: 'published', approved_by: adminTgId, approved_at: now }
      break
    case 'reject':
      patch = { ...patch, status: 'rejected' }
      break
    case 'unpublish':
      patch = { ...patch, status: 'pending', is_featured: false }
      break
    case 'feature':
      patch = { ...patch, is_featured: true }
      break
    case 'unfeature':
      patch = { ...patch, is_featured: false }
      break
    case 'title': {
      const t = (body.title ?? '').trim()
      patch = { ...patch, title_override: t.length ? t.slice(0, 120) : null }
      break
    }
    default:
      return NextResponse.json({ error: 'bad_action' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('library_items')
    .update(patch)
    .eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
