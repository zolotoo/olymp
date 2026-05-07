import 'server-only'
import { supabaseAdmin } from './supabase'
import { miniAppUrl } from './mini-app'

// Сборщик еженедельного дайджеста: «что вышло на этой неделе» из library_items.
// Берём только status='published' за последние 7 дней по созданию записи
// (created_at у нас — момент попадания поста в очередь = почти момент
// публикации в TG для большинства случаев).
//
// Подход «минимально жизнеспособного шаблона»:
//   - один формат текста на все недели; intro/outro можно переопределить из БД
//   - группировка по kind в порядке tg_topics.sort_order
//   - топ-3 строки на kind, дальше «и ещё N…» — чтобы дайджест не разносило
//   - один CTA-link в мини-апп с фильтром «новое»

const PER_KIND_LIMIT = 3
const DEFAULT_INTRO = '📚 Что вышло в Олимпе на этой неделе:'
const DEFAULT_OUTRO = ''

interface DigestItem {
  message_id: number
  chat_id: number
  thread_id: number | null
  kind: string
  title_override: string | null
  is_featured: boolean
  text: string | null
  sent_at: string | null
}

interface KindSection {
  kind: string
  topic_title: string
  topic_emoji: string | null
  items: DigestItem[]
  total: number
}

export interface DigestPreview {
  week_start: string                 // ISO date понедельник
  week_end: string                   // ISO date воскресенье
  total_published: number
  featured: DigestItem[]
  sections: KindSection[]
  text_md: string                    // готовый текст для отправки
}

// Понедельник недели в UTC (для group-by). МСК-сдвиг неважен — недельный
// бакет считается достаточно грубо.
function mondayOf(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const day = d.getUTCDay() // 0=вс
  const diff = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diff)
  return d
}

function deriveTitle(text: string | null, override: string | null): string {
  if (override?.trim()) return override.trim().slice(0, 80)
  const t = (text ?? '').trim()
  const first = t.split(/\n+/).map(s => s.trim()).find(Boolean) ?? ''
  return first.slice(0, 80) || 'Пост'
}

function formatDateRange(start: Date, end: Date): string {
  const fmt = (d: Date) => d.toLocaleDateString('ru', { day: 'numeric', month: 'short' })
  return `${fmt(start)} – ${fmt(end)}`
}

export async function buildDigestPreview(weekStart?: Date): Promise<DigestPreview> {
  const now = new Date()
  const monday = weekStart ? mondayOf(weekStart) : mondayOf(now)
  const sunday = new Date(monday)
  sunday.setUTCDate(sunday.getUTCDate() + 6)
  sunday.setUTCHours(23, 59, 59, 999)

  const since = monday.toISOString()
  const until = sunday.toISOString()

  const { data: rowsRaw } = await supabaseAdmin
    .from('library_items')
    .select(`
      message_id, chat_id, thread_id, kind, title_override, is_featured,
      tg_messages:tg_messages!inner ( text, sent_at )
    `)
    .eq('status', 'published')
    .gte('created_at', since)
    .lte('created_at', until)
    .order('created_at', { ascending: false })

  const rows: DigestItem[] = (rowsRaw ?? []).map(r => {
    const tg = (r as { tg_messages?: { text?: string | null; sent_at?: string | null } }).tg_messages
    return {
      message_id: r.message_id,
      chat_id: r.chat_id,
      thread_id: r.thread_id,
      kind: r.kind,
      title_override: r.title_override,
      is_featured: r.is_featured,
      text: tg?.text ?? null,
      sent_at: tg?.sent_at ?? null,
    }
  })

  // Заголовки топиков для секций. Берём первый видимый топик с этим kind —
  // если у нас два топика «guides» (основной + С нуля), показываем общий
  // ярлык «Гайды и промты».
  const { data: topics } = await supabaseAdmin
    .from('tg_topics')
    .select('kind, title, emoji, sort_order')
    .eq('is_visible', true)
    .order('sort_order', { ascending: true })

  const kindMeta = new Map<string, { title: string; emoji: string | null; order: number }>()
  for (const t of topics ?? []) {
    if (!kindMeta.has(t.kind)) {
      kindMeta.set(t.kind, { title: t.title, emoji: t.emoji, order: t.sort_order })
    }
  }

  const byKind = new Map<string, DigestItem[]>()
  for (const r of rows) {
    const arr = byKind.get(r.kind) ?? []
    arr.push(r)
    byKind.set(r.kind, arr)
  }

  const sections: KindSection[] = [...byKind.entries()]
    .map(([kind, items]) => ({
      kind,
      topic_title: kindMeta.get(kind)?.title ?? kind,
      topic_emoji: kindMeta.get(kind)?.emoji ?? null,
      items: items.slice(0, PER_KIND_LIMIT),
      total: items.length,
    }))
    .sort((a, b) => (kindMeta.get(a.kind)?.order ?? 999) - (kindMeta.get(b.kind)?.order ?? 999))

  const featured = rows.filter(r => r.is_featured)

  return {
    week_start: monday.toISOString().slice(0, 10),
    week_end: sunday.toISOString().slice(0, 10),
    total_published: rows.length,
    featured,
    sections,
    text_md: renderDefaultText({ monday, sunday, sections, featured, total: rows.length }),
  }
}

function renderDefaultText(args: {
  monday: Date; sunday: Date
  sections: KindSection[]
  featured: DigestItem[]
  total: number
}): string {
  const lines: string[] = []
  lines.push(`${DEFAULT_INTRO} (${formatDateRange(args.monday, args.sunday)})`)
  lines.push('')

  if (args.total === 0) {
    lines.push('На этой неделе тихо. До встречи на следующей.')
    return lines.join('\n')
  }

  if (args.featured.length > 0) {
    const f = args.featured[0]
    lines.push(`🔥 Топ недели: ${deriveTitle(f.text, f.title_override)}`)
    lines.push('')
  }

  for (const s of args.sections) {
    const head = s.topic_emoji ? `${s.topic_emoji} ${s.topic_title}` : s.topic_title
    // Plain text заголовок секции без HTML-тегов — чтобы превью в админке
    // и итоговое DM-сообщение выглядели идентично. Если потом захочется
    // bold — добавим parse_mode handling и одинаковый рендер в превью.
    lines.push(`${head} · ${s.total}`)
    for (const it of s.items) {
      lines.push(`• ${deriveTitle(it.text, it.title_override)}`)
    }
    if (s.total > s.items.length) {
      lines.push(`  …и ещё ${s.total - s.items.length}`)
    }
    lines.push('')
  }

  if (DEFAULT_OUTRO) {
    lines.push(DEFAULT_OUTRO)
  }

  return lines.join('\n').trim()
}

// Применяем сохранённый intro/outro к шаблонному тексту, если они заданы.
// Клампим до 4000 символов с запасом — Telegram режет всё, что больше 4096,
// и при добавлении CTA-ссылки за счёт wrapLink длина растёт ещё. 4000 +
// «\n\nОткрыть в приложении» влезет всегда.
const TG_MAX_TEXT = 4000
export function applyOverrides(textMd: string, intro?: string | null, outro?: string | null): string {
  let out = textMd
  if (intro?.trim()) {
    out = intro.trim() + '\n' + out.split('\n').slice(1).join('\n')
  }
  if (outro?.trim()) {
    out = out + '\n\n' + outro.trim()
  }
  if (out.length > TG_MAX_TEXT) {
    out = out.slice(0, TG_MAX_TEXT - 1).trim() + '…'
  }
  return out
}

export function digestCtaUrl(): string {
  // Мини-апп открывает таб «Знания», подсветка фильтра «🆕 Новое 7д» —
  // делается в фазе 6.
  return `${miniAppUrl()}&tab=library&new=1`
}
