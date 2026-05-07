import 'server-only'
import { supabaseAdmin } from './supabase'
import { sendMessage } from './telegram'

// Notifier-функции для системы Библиотеки. Бот ничего не делает сам — только
// пишет админу ссылку на нужный экран дашборда. Кнопок-callback нет (вся
// модерация в /library), это упрощает webhook и избавляет от состояний.
//
// Все функции — best-effort: если что-то не получилось (нет ADMIN_TG_ID,
// сеть упала, нет токена бота) — молча логируем и не валим вызывающий код.

function getAdminTgId(): number | null {
  // В коде проекта три исторически разных env-имени для одного значения.
  // Принимаем любое, чтобы бот не молчал в зависимости от того, какое из
  // них настроено в Vercel.
  const v = process.env.ADMIN_TG_ID
    || process.env.TELEGRAM_ADMIN_TG_ID
    || process.env.TELEGRAM_ADMIN_CHAT_ID
  if (!v) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function getDashboardBase(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://aiolymp.vercel.app'
  return base.replace(/\/$/, '')
}

function adminLibraryUrl(_status: 'pending' | 'published' | 'rejected' = 'pending'): string {
  // /library в админке всегда открывается на табе pending по умолчанию;
  // если когда-нибудь захотим запрашивать конкретный таб — добавим чтение
  // ?tab= в LibraryAdmin.tsx и пропишем сюда status.
  void _status
  return `${getDashboardBase()}/library`
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function deriveTitle(text: string | null, override: string | null): string {
  if (override?.trim()) return override.trim().slice(0, 80)
  const t = (text ?? '').trim()
  const first = t.split(/\n+/).map(s => s.trim()).find(Boolean) ?? ''
  return first.slice(0, 80) || 'Пост без текста'
}

// === 1) Новый пост в очередь модерации ====================================
// Вызывается из webhook сразу после INSERT INTO library_items.
// Один пинг на пост, без батчинга — частота низкая (5-15 постов/неделя).
export async function notifyAdminNewLibraryItem(libraryItemId: number): Promise<void> {
  const adminTg = getAdminTgId()
  if (!adminTg) return

  try {
    const { data: item } = await supabaseAdmin
      .from('library_items')
      .select(`
        id, kind, title_override,
        tg_messages:tg_messages!inner ( text )
      `)
      .eq('id', libraryItemId)
      .maybeSingle()
    if (!item) return

    const tgText = (item as { tg_messages?: { text?: string | null } }).tg_messages?.text ?? null
    const title = deriveTitle(tgText, item.title_override ?? null)

    const { count: pendingCount } = await supabaseAdmin
      .from('library_items')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')

    const tail = pendingCount && pendingCount > 1 ? `\n\nВсего на разборе: <b>${pendingCount}</b>` : ''
    const text =
      `🆕 Новый пост на модерации\n\n` +
      `<b>${escapeHtml(title)}</b>` +
      tail

    await sendMessage(adminTg, text, [
      { label: '📥 Открыть библиотеку', url: adminLibraryUrl('pending') },
    ])
  } catch (e) {
    console.error('notifyAdminNewLibraryItem failed:', e)
  }
}

// === 2) Бэклог-напоминалка (cron пн/чт) ===================================
// Дедуп не делаем — Vercel Cron срабатывает один раз в назначенный момент,
// и если случится повторный пинг (ретрай при таймауте) — лишнее DM-сообщение
// неприятно, но не фатально. Если станет проблемой, добавим табличку.
export async function nudgeAdminBacklogIfNeeded(): Promise<{ sent: boolean; reason?: string }> {
  const adminTg = getAdminTgId()
  if (!adminTg) return { sent: false, reason: 'no_admin_tg' }

  // Ищем оба сигнала: количество и возраст. Если pending=0 — молчим.
  const { count } = await supabaseAdmin
    .from('library_items')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')
  if (!count) return { sent: false, reason: 'empty_queue' }

  const { data: oldest } = await supabaseAdmin
    .from('library_items')
    .select('created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  const oldestDays = oldest
    ? Math.floor((Date.now() - new Date(oldest.created_at).getTime()) / 86_400_000)
    : 0

  const ageLine = oldestDays > 0 ? `, самому старому ${oldestDays} ${plural(oldestDays, 'день', 'дня', 'дней')}` : ''
  const text =
    `📥 На разборе ${count} ${plural(count, 'пост', 'поста', 'постов')}${ageLine}.\n\n` +
    `Загляни и одобри что нужно — иначе оно не появится в мини-аппе и ребятам.`

  try {
    await sendMessage(adminTg, text, [
      { label: '📥 Открыть библиотеку', url: adminLibraryUrl('pending') },
    ])
    return { sent: true }
  } catch (e) {
    console.error('nudgeAdminBacklog send failed:', e)
    return { sent: false, reason: 'send_failed' }
  }
}

// === 3) Featured старше 14 дней — пинаем «оставлять или сбрасывать?» =======
// Раз в неделю достаточно. Не дублируем нудж-чек, потому что сообщение полезное
// само по себе и не относится к очереди модерации.
export async function nudgeStaleFeatured(): Promise<{ sent: number }> {
  const adminTg = getAdminTgId()
  if (!adminTg) return { sent: 0 }

  const cutoff = new Date(Date.now() - 14 * 86_400_000).toISOString()
  const { data: stale } = await supabaseAdmin
    .from('library_items')
    .select(`
      id, title_override,
      tg_messages:tg_messages!inner ( text )
    `)
    .eq('is_featured', true)
    .eq('status', 'published')
    .lt('approved_at', cutoff)
    .order('approved_at', { ascending: true })
    .limit(5)
  if (!stale || stale.length === 0) return { sent: 0 }

  const lines = stale.map(s => {
    const tgText = (s as { tg_messages?: { text?: string | null } }).tg_messages?.text ?? null
    return '• ' + escapeHtml(deriveTitle(tgText, s.title_override ?? null))
  })
  const text =
    `🔥 В Featured уже &gt;14 дней:\n\n` +
    lines.join('\n') +
    `\n\nОставляем или сбрасываем?`

  try {
    await sendMessage(adminTg, text, [
      { label: '🔥 Открыть Featured', url: adminLibraryUrl('published') },
    ])
    return { sent: stale.length }
  } catch (e) {
    console.error('nudgeStaleFeatured send failed:', e)
    return { sent: 0 }
  }
}

// === 4) Воскресенье 12:00 — дайджест готов =================================
// Бот пишет «черновик дайджеста собран, открой и отправь». Без авто-отправки.
export async function notifyDigestReady(): Promise<{ sent: boolean; reason?: string }> {
  const adminTg = getAdminTgId()
  if (!adminTg) return { sent: false, reason: 'no_admin_tg' }

  // Считаем сколько постов опубликовано за неделю — если ноль, не пинаем.
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString()
  const { count } = await supabaseAdmin
    .from('library_items')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'published')
    .gte('created_at', since)
  if (!count) return { sent: false, reason: 'empty_week' }

  const text =
    `📬 Дайджест за неделю собран\n\n` +
    `Опубликовано постов: <b>${count}</b>.\n` +
    `Открой превью, поправь шаблон если хочешь, и отправь в канал и/или участникам.`

  try {
    await sendMessage(adminTg, text, [
      { label: '📬 Открыть дайджест', url: `${getDashboardBase()}/digest` },
    ])
    return { sent: true }
  } catch (e) {
    console.error('notifyDigestReady send failed:', e)
    return { sent: false, reason: 'send_failed' }
  }
}

function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}
