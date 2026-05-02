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

  // Соглашение: thread_id = 0 в tg_topics означает «весь чат/канал, без веток».
  // Для группы с форумом thread_id — реальный id ветки.
  // Это позволяет одной таблицей tg_topics покрыть и форумы, и плоские каналы.
  //
  // Чаты могут быть разные (группа + канал), поэтому ходим в tg_messages
  // одним запросом по каждому уникальному chat_id отдельно — Supabase не
  // умеет в OR(eq+in) одной строкой через JS-клиент так, чтобы не плодить
  // фильтры. Группируем по (chat_id, thread_id).
  type Bucket = { topic: Topic; key: string; messages: MessageRow[] }
  const buckets: Bucket[] = topics.map(t => ({ topic: t, key: `${t.chat_id}:${t.thread_id}`, messages: [] }))

  // Объединяем все запросы в Promise.all — параллельно по каждому уникальному chat_id.
  const byChatId = new Map<number, Topic[]>()
  for (const t of topics) {
    const arr = byChatId.get(t.chat_id) ?? []
    arr.push(t)
    byChatId.set(t.chat_id, arr)
  }

  const fetches = [...byChatId.entries()].map(async ([chatId, ts]) => {
    const realThreads = ts.filter(t => t.thread_id !== 0).map(t => t.thread_id)
    const hasFlat = ts.some(t => t.thread_id === 0)

    // Forum-ветки (real thread ids).
    if (realThreads.length) {
      const { data } = await supabaseAdmin
        .from('tg_messages')
        .select('message_id, chat_id, message_thread_id, text, has_media, media_kind, sent_at')
        .eq('chat_id', chatId)
        .in('message_thread_id', realThreads)
        .order('sent_at', { ascending: false })
        .limit(POSTS_PER_TOPIC * realThreads.length)
      for (const m of (data ?? []) as MessageRow[]) {
        const b = buckets.find(b => b.key === `${chatId}:${m.message_thread_id}`)
        if (b && b.messages.length < POSTS_PER_TOPIC) b.messages.push(m)
      }
    }

    // Плоский канал/чат без веток (thread_id = 0 в tg_topics).
    if (hasFlat) {
      const { data } = await supabaseAdmin
        .from('tg_messages')
        .select('message_id, chat_id, message_thread_id, text, has_media, media_kind, sent_at')
        .eq('chat_id', chatId)
        .is('message_thread_id', null)
        .order('sent_at', { ascending: false })
        .limit(POSTS_PER_TOPIC)
      const b = buckets.find(b => b.key === `${chatId}:0`)
      if (b) b.messages.push(...((data ?? []) as MessageRow[]))
    }
  })
  await Promise.all(fetches)

  const result = buckets.map(b => {
    const items = b.messages.map(m => {
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
      kind: b.topic.kind,
      title: b.topic.title,
      emoji: b.topic.emoji,
      thread_id: b.topic.thread_id,
      chat_id: b.topic.chat_id,
      items,
    }
  })

  return NextResponse.json({ topics: result })
}
