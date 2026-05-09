import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthedUser } from '@/lib/telegram-auth'

// GET /api/library?kind=...&new=1&featured=1
//   Возвращает список топиков + карточки. Только status='published'.
//
// Источник:
//   library_items — кураторский слой (status, is_featured, title_override).
//   tg_messages — сырой текст и метаданные.
//   tg_topics   — справочник веток для заголовков секций.
//
// Доступ: только аутентифицированному участнику клуба.

const POSTS_PER_TOPIC = 8
const POST_PREVIEW_LEN = 220
const NEW_WINDOW_DAYS = 7

interface LibraryRow {
  id: number
  chat_id: number
  message_id: number
  thread_id: number | null
  kind: string
  is_featured: boolean
  title_override: string | null
  path_kinds: string[] | null
  tg_messages: {
    text: string | null
    has_media: boolean
    media_kind: string | null
    sent_at: string
  } | null
}

function deepLink(chatId: number, threadId: number | null, messageId: number): string {
  const shortId = String(Math.abs(chatId)).startsWith('100')
    ? Math.abs(chatId) - 1_000_000_000_000
    : Math.abs(chatId)
  return threadId
    ? `https://t.me/c/${shortId}/${threadId}/${messageId}`
    : `https://t.me/c/${shortId}/${messageId}`
}

function deriveTitleAndPreview(rawText: string | null, override: string | null): { title: string; preview: string } {
  const txt = (rawText ?? '').trim()
  const lines = txt.split(/\n+/).map(s => s.trim()).filter(Boolean)
  const firstFromText = (lines[0] ?? txt).slice(0, 80)
  const title = (override?.trim() || firstFromText || 'Пост').slice(0, 120)
  const restLines = override?.trim() ? lines : lines.slice(1)
  const preview = restLines.join(' ').slice(0, POST_PREVIEW_LEN)
  return { title, preview }
}

export async function GET(req: NextRequest) {
  const initData = req.headers.get('x-telegram-init-data')
  const user = getAuthedUser(initData)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: member } = await supabaseAdmin
    .from('members').select('id').eq('tg_id', user.id).maybeSingle()
  if (!member) return NextResponse.json({ error: 'not_member' }, { status: 403 })

  const url = new URL(req.url)
  const kind = url.searchParams.get('kind')
  const onlyNew = url.searchParams.get('new') === '1'
  const onlyFeatured = url.searchParams.get('featured') === '1'
  // path_kind: фильтр для онбординг-рекомендаций. Берём посты, у которых
  // path_kinds содержит запрошенный ключ. Если path_kinds=[] (нетегированный)
  // пост в выборку не попадает — это поведение by design: либо тегируем, либо
  // используем без фильтра.
  const pathKind = url.searchParams.get('path_kind')

  // Загружаем все видимые топики — нужны для заголовков секций и порядка чипов.
  const { data: topicsRaw } = await supabaseAdmin
    .from('tg_topics')
    .select('chat_id, thread_id, kind, title, emoji, sort_order')
    .eq('is_visible', true)
    .order('sort_order', { ascending: true })

  const topics = (topicsRaw ?? []) as Array<{
    chat_id: number; thread_id: number; kind: string; title: string; emoji: string | null; sort_order: number
  }>
  if (topics.length === 0) return NextResponse.json({ topics: [] })

  // Один запрос за всеми published-карточками. Лимит достаточный: 8 на топик
  // × ~10 топиков = 80, берём с запасом до 200.
  let q = supabaseAdmin
    .from('library_items')
    .select(`
      id, chat_id, message_id, thread_id, kind, is_featured, title_override, path_kinds,
      tg_messages:tg_messages!inner ( text, has_media, media_kind, sent_at )
    `)
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(200)
  if (kind) q = q.eq('kind', kind)
  if (onlyFeatured) q = q.eq('is_featured', true)
  if (onlyNew) {
    const since = new Date(Date.now() - NEW_WINDOW_DAYS * 86400_000).toISOString()
    q = q.gte('created_at', since)
  }
  if (pathKind) {
    // contains: вернёт строки где path_kinds содержит [pathKind].
    q = q.contains('path_kinds', [pathKind])
  }

  const { data: rowsRaw } = await q
  const rows = (rowsRaw ?? []) as unknown as LibraryRow[]

  // Группируем по (chat_id, thread_id) совпадая с tg_topics.
  const buckets = new Map<string, typeof rows>()
  for (const r of rows) {
    const key = `${r.chat_id}:${r.thread_id ?? 0}`
    const arr = buckets.get(key) ?? []
    if (arr.length < POSTS_PER_TOPIC) arr.push(r)
    buckets.set(key, arr)
  }

  // Сборка ответа в порядке tg_topics.sort_order, чтобы UI не зависел от того,
  // в какой ветке свежий пост. Пустые топики возвращаем тоже, мини-апп
  // покажет «пока ничего» — лучше, чем дыра в фильтре.
  const result = topics.map(t => {
    const items = (buckets.get(`${t.chat_id}:${t.thread_id}`) ?? []).map(r => {
      const tg = r.tg_messages
      const { title, preview } = deriveTitleAndPreview(tg?.text ?? null, r.title_override)
      return {
        message_id: r.message_id,
        title,
        preview,
        sent_at: tg?.sent_at ?? null,
        has_media: tg?.has_media ?? false,
        media_kind: tg?.media_kind ?? null,
        is_featured: r.is_featured,
        path_kinds: Array.isArray(r.path_kinds) ? r.path_kinds : [],
        link: deepLink(r.chat_id, r.thread_id, r.message_id),
      }
    })
    return {
      kind: t.kind, title: t.title, emoji: t.emoji,
      thread_id: t.thread_id, chat_id: t.chat_id,
      items,
    }
  })

  return NextResponse.json({ topics: result })
}
