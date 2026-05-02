import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthedUser } from '@/lib/telegram-auth'

// GET /api/library?kind=lessons|guides|cases|...
//   возвращает список топиков нужного kind + последние посты по каждому
//   как карточки. Если kind не указан — отдаёт все видимые топики.
//
// Источник:
//   tg_topics — справочник веток (заполняется руками админом).
//   tg_messages — посты в этих ветках (пишутся вебхуком).
//
// Доступ: только аутентифицированному участнику клуба (initData валиден +
// есть запись в members). Это не «секретный» контент, но мы не отдаём
// материалы клуба наружу.

interface Topic {
  chat_id: number
  thread_id: number
  kind: string
  title: string
  emoji: string | null
  sort_order: number
}

interface MessageRow {
  message_id: number
  chat_id: number
  message_thread_id: number | null
  text: string | null
  has_media: boolean
  media_kind: string | null
  sent_at: string
}

const POSTS_PER_TOPIC = 8
const POST_PREVIEW_LEN = 220

// Глубокая ссылка на сообщение в супергруппе. Формат для приватной супергруппы:
//   https://t.me/c/<short_chat_id>/<thread_id>/<message_id>
// short_chat_id = abs(chat_id) - 1_000_000_000_000 (т.к. supergroup id вида -100xxxxxxxxxx).
function deepLink(chatId: number, threadId: number | null, messageId: number): string {
  const shortId = String(Math.abs(chatId)).startsWith('100')
    ? Math.abs(chatId) - 1_000_000_000_000
    : Math.abs(chatId)
  return threadId
    ? `https://t.me/c/${shortId}/${threadId}/${messageId}`
    : `https://t.me/c/${shortId}/${messageId}`
}

// Заголовок карточки = первая «осмысленная» строка текста (≤ 80 симв).
// Дальше идёт preview из остального. Если текста нет — показываем тип медиа.
function deriveTitleAndPreview(m: MessageRow): { title: string; preview: string } {
  const txt = (m.text ?? '').trim()
  if (!txt) {
    const kind = m.media_kind ?? 'media'
    return {
      title: kind === 'video' || kind === 'video_note' ? 'Видео'
           : kind === 'photo' ? 'Изображение'
           : kind === 'document' ? 'Файл'
           : kind === 'voice' || kind === 'audio' ? 'Аудио'
           : 'Медиа',
      preview: '',
    }
  }
  const lines = txt.split(/\n+/).map(s => s.trim()).filter(Boolean)
  const first = (lines[0] ?? txt).slice(0, 80)
  const rest = lines.slice(1).join(' ').slice(0, POST_PREVIEW_LEN)
  return {
    title: first || 'Пост',
    preview: rest || (lines.length === 1 && txt.length > first.length ? txt.slice(first.length, first.length + POST_PREVIEW_LEN) : ''),
  }
}

export async function GET(req: NextRequest) {
  const initData = req.headers.get('x-telegram-init-data')
  const user = getAuthedUser(initData)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: member } = await supabaseAdmin
    .from('members')
    .select('id, status')
    .eq('tg_id', user.id)
    .maybeSingle()
  if (!member) return NextResponse.json({ error: 'not_member' }, { status: 403 })

  const url = new URL(req.url)
  const kind = url.searchParams.get('kind')

  let topicsQuery = supabaseAdmin
    .from('tg_topics')
    .select('chat_id, thread_id, kind, title, emoji, sort_order')
    .eq('is_visible', true)
    .order('sort_order', { ascending: true })

  if (kind) topicsQuery = topicsQuery.eq('kind', kind)

  const { data: topicsRaw } = await topicsQuery
  const topics = (topicsRaw ?? []) as Topic[]

  if (topics.length === 0) {
    return NextResponse.json({ topics: [] })
  }

  // Один общий запрос на все нужные thread_id, потом раскидаем по топикам.
  const chatId = topics[0].chat_id // в наших данных все ветки — одной группы
  const threadIds = topics.map(t => t.thread_id)
  const { data: msgsRaw } = await supabaseAdmin
    .from('tg_messages')
    .select('message_id, chat_id, message_thread_id, text, has_media, media_kind, sent_at')
    .eq('chat_id', chatId)
    .in('message_thread_id', threadIds)
    .order('sent_at', { ascending: false })
    .limit(POSTS_PER_TOPIC * topics.length)

  const msgs = (msgsRaw ?? []) as MessageRow[]
  const byThread = new Map<number, MessageRow[]>()
  for (const m of msgs) {
    if (!m.message_thread_id) continue
    const arr = byThread.get(m.message_thread_id) ?? []
    if (arr.length < POSTS_PER_TOPIC) arr.push(m)
    byThread.set(m.message_thread_id, arr)
  }

  const result = topics.map(t => {
    const items = (byThread.get(t.thread_id) ?? []).map(m => {
      const { title, preview } = deriveTitleAndPreview(m)
      return {
        message_id: m.message_id,
        title,
        preview,
        sent_at: m.sent_at,
        has_media: m.has_media,
        media_kind: m.media_kind,
        link: deepLink(m.chat_id, m.message_thread_id, m.message_id),
      }
    })
    return {
      kind: t.kind,
      title: t.title,
      emoji: t.emoji,
      thread_id: t.thread_id,
      chat_id: t.chat_id,
      items,
    }
  })

  return NextResponse.json({ topics: result })
}
