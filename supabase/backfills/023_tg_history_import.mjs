// Backfill для tg_messages из Telegram Desktop HTML-экспорта.
//
// Зачем: Bot API не даёт читать историю задним числом — Библиотека показала
// бы пустые ветки до тех пор, пока в группу не придут НОВЫЕ посты.
// Этот скрипт пробегает по экспорту чата (HTML), достаёт текст + thread_id +
// дату и выплёвывает SQL-файл с INSERT … ON CONFLICT для tg_messages.
// SQL вставляешь в Supabase SQL Editor — вуаля, история есть, Библиотека
// сразу заполнена.
//
// Запуск:
//   node supabase/backfills/023_tg_history_import.mjs \
//     --in messages.html --chat -1003828793815 --kind group  --out group.sql
//   node supabase/backfills/023_tg_history_import.mjs \
//     --in messages2.html --chat <CHANNEL_ID> --kind channel --out channel.sql
//
// HTML-формат Telegram Desktop:
//   <div class="message service" id="messageN">…created topic «…»…</div>
//     → ID топика-ветки (равен thread_id для всех сообщений в этом топике).
//   <div class="message default" id="messageN">…<div class="reply_to">go_to_messageM</div>…</div>
//     → reply на сообщение M. Через цепочку reply_to доходим до topic-root → thread_id.

import { readFileSync, writeFileSync } from 'node:fs'

// ─── CLI args ────────────────────────────────────────────────────────────────
function arg(name, fallback) {
  const i = process.argv.indexOf(name)
  if (i === -1) return fallback
  return process.argv[i + 1]
}
const IN_FILE  = arg('--in')
const CHAT_ID  = Number(arg('--chat'))
const CHAT_KIND = arg('--kind', 'group') // 'group' | 'channel'
const OUT_FILE = arg('--out', 'tg_history.sql')

if (!IN_FILE || !Number.isFinite(CHAT_ID)) {
  console.error('Usage: --in <html> --chat <chat_id> [--kind group|channel] [--out file.sql]')
  process.exit(1)
}

const html = readFileSync(IN_FILE, 'utf-8')

// ─── HTML-утилиты ────────────────────────────────────────────────────────────
function decodeEntities(s) {
  return s
    .replace(/&laquo;/g, '«').replace(/&raquo;/g, '»')
    .replace(/&lsquo;/g, '‘').replace(/&rsquo;/g, '’')
    .replace(/&ldquo;/g, '“').replace(/&rdquo;/g, '”')
    .replace(/&ndash;/g, '–').replace(/&mdash;/g, '—')
    .replace(/&nbsp;/g, ' ').replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&quot;/g, '"')
}

// HTML → plain text. <br> → \n, всё остальное (strong/em/a/blockquote) — отбрасываем.
function htmlToText(html) {
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|blockquote|li|h[1-6])>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim(),
  )
}

// ─── Разбивка HTML на блоки сообщений ────────────────────────────────────────
// Каждое сообщение начинается с `<div class="message ...">` и заканчивается
// перед следующим таким `<div class="message`. Финальный конец — закрытие
// `<div class="page_body">` или EOF; нам это не критично, мы просто берём
// всё «между двумя стартами».
function splitMessages(src) {
  const parts = []
  const re = /<div class="message ([^"]+)" id="([^"]+)">/g
  let m, prev = null
  while ((m = re.exec(src))) {
    if (prev) parts.push({ ...prev, raw: src.slice(prev.start, m.index) })
    prev = { kind: m[1], idAttr: m[2], start: m.index }
  }
  if (prev) parts.push({ ...prev, raw: src.slice(prev.start) })
  return parts
}

// ─── Парсинг одного сообщения ────────────────────────────────────────────────
const TOPIC_RE = /created topic\s+«([^»]+)»/u

function parseMessage(block) {
  const isService = block.kind.includes('service')
  const idMatch = block.idAttr.match(/^message(-?\d+)$/)
  if (!idMatch) return null
  const id = Number(idMatch[1])
  // Telegram использует id="message-N" для дат-сепараторов и т.п. служебных штук
  // и id="messageN" для реальных сообщений. Реальные — N>=1.
  if (id <= 0) return null

  if (isService) {
    const body = block.raw.match(/<div class="body details">\s*([\s\S]*?)\s*<\/div>/)
    const text = body ? decodeEntities(htmlToText(body[1])) : ''
    const tm = text.match(TOPIC_RE)
    return {
      id,
      isService: true,
      isTopicCreation: !!tm,
      topicTitle: tm ? tm[1] : null,
    }
  }

  // default-сообщение
  const dateAttr = block.raw.match(/title="(\d{2})\.(\d{2})\.(\d{4}) (\d{2}):(\d{2}):(\d{2}) UTC([+-]\d{2}:\d{2})"/)
  let sentAt = null
  if (dateAttr) {
    const [, dd, mm, yyyy, hh, mi, ss, tz] = dateAttr
    sentAt = `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}${tz}`
  }
  // Имя автора (для атрибуции — позже мапим к members.tg_first_name).
  const fromMatch = block.raw.match(/<div class="from_name">\s*([\s\S]*?)\s*<\/div>/)
  const fromName = fromMatch ? decodeEntities(htmlToText(fromMatch[1])).trim() : null

  // Reply-link → id сообщения, на которое отвечает.
  const replyMatch = block.raw.match(/go_to_message(\d+)/)
  const replyTo = replyMatch ? Number(replyMatch[1]) : null

  // Текст.
  const textMatch = block.raw.match(/<div class="text">\s*([\s\S]*?)\s*<\/div>\s*\n*\s*(?=<\/div>|<div class="signature)/)
  // Если нет `text` — может быть только медиа. Берём caption из media_wrap если есть.
  let text = textMatch ? htmlToText(textMatch[1]) : ''
  if (!text) {
    // Иногда caption у media лежит в `<div class="text">` ниже media_wrap — наша
    // регулярка обычно его и ловит. Если нет — оставляем пустым.
  }

  // Медиа-детект. Берём первый класс media_<kind>.
  let hasMedia = false
  let mediaKind = null
  if (/media_wrap|photo_wrap/i.test(block.raw)) {
    hasMedia = true
    if (/photo_wrap/i.test(block.raw))                mediaKind = 'photo'
    else if (/media_video_file/i.test(block.raw))     mediaKind = 'video'
    else if (/media_voice_message/i.test(block.raw))  mediaKind = 'voice'
    else if (/media_audio_file/i.test(block.raw))     mediaKind = 'audio'
    else if (/media_document/i.test(block.raw))       mediaKind = 'document'
    else if (/media_animation|media_gif/i.test(block.raw)) mediaKind = 'animation'
    else if (/media_sticker/i.test(block.raw))        mediaKind = 'sticker'
    else if (/media_video_message/i.test(block.raw))  mediaKind = 'video_note'
    else                                               mediaKind = 'document'
  }

  return {
    id,
    isService: false,
    sentAt,
    fromName,
    replyTo,
    text,
    hasMedia,
    mediaKind,
  }
}

// ─── Главный pipeline ────────────────────────────────────────────────────────
const blocks = splitMessages(html)
const parsed = blocks.map(parseMessage).filter(Boolean)

// 1) Топики — для resolve-цепочки.
const topicIds = new Set()
for (const m of parsed) if (m.isTopicCreation) topicIds.add(m.id)

// 2) Map id → reply_to для default-сообщений.
const replyMap = new Map()
for (const m of parsed) if (!m.isService && m.replyTo) replyMap.set(m.id, m.replyTo)

// 3) Resolve thread_id: идём по цепочке reply_to пока не упрёмся в топик.
function resolveThreadId(messageId) {
  if (CHAT_KIND !== 'group') return null
  let cur = messageId
  const seen = new Set()
  while (cur != null && !seen.has(cur)) {
    if (topicIds.has(cur)) return cur
    seen.add(cur)
    cur = replyMap.get(cur) ?? null
  }
  return null
}

// 4) SQL-эскейп.
function sqlStr(s) {
  if (s == null) return 'NULL'
  return `'${String(s).replace(/'/g, "''")}'`
}
function sqlBool(b) { return b ? 'true' : 'false' }
function sqlNum(n)  { return n == null ? 'NULL' : String(n) }

// ─── Сборка SQL ──────────────────────────────────────────────────────────────
const rows = []
let skippedNoText = 0
let skippedTopicCreation = 0

for (const m of parsed) {
  if (m.isService) {
    // Service-сообщения (created topic, joined, etc) не пишем в tg_messages.
    if (m.isTopicCreation) skippedTopicCreation++
    continue
  }
  const threadId = resolveThreadId(m.id)
  // Если нет ни текста, ни медиа — пропускаем (пустая запись бесполезна).
  if (!m.text && !m.hasMedia) { skippedNoText++; continue }

  // author_tg_id NOT NULL. Реального tg_id из HTML нет — ставим 0
  // как маркер «backfill, автор не атрибутирован». Потом можно будет
  // обновить UPDATE-запросом, маппинг по from_name → members.
  const authorTgId = 0

  rows.push({
    message_id: m.id,
    chat_id: CHAT_ID,
    author_tg_id: authorTgId,
    text: m.text || null,
    chat_type: CHAT_KIND === 'channel' ? 'channel' : 'supergroup',
    chat_title: null, // не добавляем — в БД с веба уже ставится
    reply_to_message_id: m.replyTo ?? null,
    has_media: m.hasMedia,
    media_kind: m.mediaKind,
    sent_at: m.sentAt,
    edited_at: null,
    message_thread_id: threadId,
  })
}

// Группируем в батчи по 200, чтобы SQL Editor не подавился.
const BATCH = 200
let sql = ''
sql += `-- Backfill tg_messages из ${IN_FILE}\n`
sql += `-- chat_id=${CHAT_ID} (${CHAT_KIND}), сообщений: ${rows.length}, веток: ${topicIds.size}\n`
sql += `-- Сгенерировано: ${new Date().toISOString()}\n\n`

for (let i = 0; i < rows.length; i += BATCH) {
  const chunk = rows.slice(i, i + BATCH)
  sql += `INSERT INTO public.tg_messages (\n`
  sql += `  message_id, chat_id, author_tg_id, text, chat_type, reply_to_message_id,\n`
  sql += `  has_media, media_kind, sent_at, message_thread_id\n`
  sql += `) VALUES\n`
  sql += chunk.map(r => '  (' + [
    sqlNum(r.message_id),
    sqlNum(r.chat_id),
    sqlNum(r.author_tg_id),
    sqlStr(r.text),
    sqlStr(r.chat_type),
    sqlNum(r.reply_to_message_id),
    sqlBool(r.has_media),
    sqlStr(r.media_kind),
    r.sent_at ? sqlStr(r.sent_at) : 'now()',
    sqlNum(r.message_thread_id),
  ].join(', ') + ')').join(',\n')
  sql += `\nON CONFLICT (message_id, chat_id) DO UPDATE SET\n`
  sql += `  text                = EXCLUDED.text,\n`
  sql += `  reply_to_message_id = EXCLUDED.reply_to_message_id,\n`
  sql += `  has_media           = EXCLUDED.has_media,\n`
  sql += `  media_kind          = EXCLUDED.media_kind,\n`
  sql += `  sent_at             = EXCLUDED.sent_at,\n`
  sql += `  message_thread_id   = EXCLUDED.message_thread_id;\n\n`
}

writeFileSync(OUT_FILE, sql, 'utf-8')

console.log(`[ok] записано ${rows.length} рядов в ${OUT_FILE}`)
console.log(`     топиков-веток: ${topicIds.size} (id: ${[...topicIds].sort((a,b)=>a-b).join(', ')})`)
console.log(`     пропущено пустых: ${skippedNoText}`)
console.log(`     пропущено топиков-creation (служебные): ${skippedTopicCreation}`)

// Сводка по веткам — сколько постов в каждой.
const byThread = new Map()
for (const r of rows) {
  const k = r.message_thread_id ?? 'no_thread'
  byThread.set(k, (byThread.get(k) ?? 0) + 1)
}
console.log(`     распределение по веткам:`)
for (const [k, v] of [...byThread.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`       thread_id=${k}: ${v} сообщ.`)
}
