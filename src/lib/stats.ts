// Server-only. Агрегаты для дашборда /stats.
// Все запросы — через supabaseAdmin (service role), под капотом REST.
// Каждый запрос работает в своём диапазоне дат и параллелится с остальными.

import { supabaseAdmin } from './supabase'

export type SourceKey = 'main' | 'hochy' | 'promts' | 'claude'
export const SOURCES: SourceKey[] = ['main', 'hochy', 'promts', 'claude']

export interface DayPoint {
  date: string                  // ISO YYYY-MM-DD
  new_users: number             // первое касание бота
  starts: number                // /start (включая повторные)
  sales_sent: number            // отправили продающее
  clicks: number                // уникальных юзеров кликнувших по кнопке
  payments: number              // новых подписок
  cancellations: number         // отписок
  miniapp_opens: number         // уникальных юзеров открывших мини-апп
  dm_messages: number           // ответили боту в DM
  wheel_spins: number           // крутили колесо
}

export interface SourceRow {
  source: SourceKey | 'unknown'
  came: number
  got_sales: number
  clicked: number
  paid: number
  ctr_pct: number      // clicked / got_sales
  conv_pct: number     // paid / came
}

export interface Totals {
  new_users: number
  starts: number
  sales_sent: number
  clicks: number
  payments: number
  cancellations: number
  miniapp_opens: number
  dm_messages: number
  wheel_spins: number
  net_growth: number   // payments - cancellations
}

export interface Conversion {
  start_to_payment_pct: number      // payments / new_users
  sales_to_click_pct: number        // unique clicked / unique who got sales
  click_to_payment_pct: number      // payments / unique clicked
}

export interface Retention {
  day_30_pct: number    // % active в когорте «вступили 30-60 дней назад»
  day_60_pct: number    // 60-90 назад
  day_90_pct: number    // более 90 назад
  cohort_30: number     // размер когорты для day_30
  cohort_60: number
  cohort_90: number
}

export interface StatsBundle {
  range: { from: string; to: string; days: number }
  totals: Totals
  prev_totals: Totals
  conversion: Conversion
  by_day: DayPoint[]
  by_source: SourceRow[]
  retention: Retention
}

// Дата в ISO без времени (UTC). Так выходит JS-вывод consistent.
function dayKey(iso: string): string {
  return iso.slice(0, 10)
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / (24 * 3600_000))
}

// Все даты в диапазоне (включая дни без событий — нужны для графика).
function enumerateDays(from: string, to: string): string[] {
  const out: string[] = []
  const start = new Date(from)
  const end = new Date(to)
  for (let d = start; d < end; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10))
  }
  return out
}

// Утилита: считает count(*) с группировкой по дате — на основе массива строк.
// Возвращает Map<YYYY-MM-DD, number>.
function countByDay<T extends { created_at?: string; sent_at?: string; first_seen_at?: string }>(
  rows: T[],
  dateField: keyof T,
): Map<string, number> {
  const m = new Map<string, number>()
  for (const r of rows) {
    const v = r[dateField] as unknown as string
    if (!v) continue
    const k = dayKey(v)
    m.set(k, (m.get(k) ?? 0) + 1)
  }
  return m
}

// То же, но уникальных tg_id в день.
function uniqByDay<T extends { tg_id: number }>(
  rows: T[],
  dateField: keyof T,
): Map<string, number> {
  const seen = new Map<string, Set<number>>()
  for (const r of rows) {
    const v = r[dateField] as unknown as string
    if (!v) continue
    const k = dayKey(v)
    if (!seen.has(k)) seen.set(k, new Set())
    seen.get(k)!.add(r.tg_id)
  }
  const m = new Map<string, number>()
  for (const [k, s] of seen.entries()) m.set(k, s.size)
  return m
}

async function fetchTotalsRange(from: string, to: string) {
  // Все запросы параллельно. Из-за лимита PostgREST (1000 строк по умолчанию)
  // явно ставим .limit(50000) — для дашборда хватит.
  const LIMIT = 50000

  const [
    botUsersRes,
    eventsRes,
    deliveriesRes,
    eventsLogRes,
    spinsRes,
  ] = await Promise.all([
    supabaseAdmin.from('bot_users')
      .select('tg_id, first_seen_at, source')
      .gte('first_seen_at', from).lt('first_seen_at', to).limit(LIMIT),
    supabaseAdmin.from('bot_events')
      .select('tg_id, event_type, created_at')
      .gte('created_at', from).lt('created_at', to)
      .in('event_type', ['command:/start', 'link_click', 'mini_app_open', 'message'])
      .limit(LIMIT),
    supabaseAdmin.from('message_deliveries')
      .select('tg_id, template_key, sent_at, delivered')
      .like('template_key', 'l_sales%')
      .eq('delivered', true)
      .gte('sent_at', from).lt('sent_at', to).limit(LIMIT),
    supabaseAdmin.from('events_log')
      .select('tg_id, event_type, created_at')
      .in('event_type', ['tribute_new_subscription', 'tribute_cancelled', 'tribute_renewed'])
      .gte('created_at', from).lt('created_at', to).limit(LIMIT),
    supabaseAdmin.from('wheel_spins')
      .select('tg_id, created_at')
      .gte('created_at', from).lt('created_at', to).limit(LIMIT),
  ])

  return {
    botUsers: (botUsersRes.data ?? []) as { tg_id: number; first_seen_at: string; source: string | null }[],
    events:   (eventsRes.data ?? []) as { tg_id: number; event_type: string; created_at: string }[],
    sales:    (deliveriesRes.data ?? []) as { tg_id: number; template_key: string; sent_at: string; delivered: boolean }[],
    eventsLog:(eventsLogRes.data ?? []) as { tg_id: number; event_type: string; created_at: string }[],
    spins:    (spinsRes.data ?? []) as { tg_id: number; created_at: string }[],
  }
}

async function buildTotalsAndDays(from: string, to: string): Promise<{ totals: Totals; byDay: DayPoint[] }> {
  const data = await fetchTotalsRange(from, to)

  const startsByDay   = countByDay(data.events.filter(e => e.event_type === 'command:/start'), 'created_at')
  const dmByDay       = countByDay(data.events.filter(e => e.event_type === 'message'),         'created_at')
  const clicksByDay   = uniqByDay(data.events.filter(e => e.event_type === 'link_click'),       'created_at')
  const miniByDay     = uniqByDay(data.events.filter(e => e.event_type === 'mini_app_open'),    'created_at')
  const newUsersByDay = countByDay(data.botUsers, 'first_seen_at')
  const salesByDay    = countByDay(data.sales,    'sent_at')
  const paysByDay     = countByDay(data.eventsLog.filter(e => e.event_type === 'tribute_new_subscription'), 'created_at')
  const cancByDay     = countByDay(data.eventsLog.filter(e => e.event_type === 'tribute_cancelled'),        'created_at')
  const spinsByDay    = countByDay(data.spins, 'created_at')

  const days = enumerateDays(from, to)
  const byDay: DayPoint[] = days.map(d => ({
    date: d,
    new_users:     newUsersByDay.get(d) ?? 0,
    starts:        startsByDay.get(d)   ?? 0,
    sales_sent:    salesByDay.get(d)    ?? 0,
    clicks:        clicksByDay.get(d)   ?? 0,
    payments:      paysByDay.get(d)     ?? 0,
    cancellations: cancByDay.get(d)     ?? 0,
    miniapp_opens: miniByDay.get(d)     ?? 0,
    dm_messages:   dmByDay.get(d)       ?? 0,
    wheel_spins:   spinsByDay.get(d)    ?? 0,
  }))

  // Тоталы по периоду — суммируем by_day, сходится с totals.
  const sum = (k: keyof DayPoint) => byDay.reduce((s, d) => s + (d[k] as number), 0)
  const totals: Totals = {
    new_users:     sum('new_users'),
    starts:        sum('starts'),
    sales_sent:    sum('sales_sent'),
    clicks:        sum('clicks'),
    payments:      sum('payments'),
    cancellations: sum('cancellations'),
    miniapp_opens: sum('miniapp_opens'),
    dm_messages:   sum('dm_messages'),
    wheel_spins:   sum('wheel_spins'),
    net_growth: sum('payments') - sum('cancellations'),
  }

  return { totals, byDay }
}

async function buildSources(from: string, to: string): Promise<SourceRow[]> {
  const LIMIT = 50000

  // Аудитория, пришедшая в этот период — в разрезе источника.
  const { data: usersRaw } = await supabaseAdmin
    .from('bot_users')
    .select('tg_id, source')
    .gte('first_seen_at', from).lt('first_seen_at', to).limit(LIMIT)
  const users = (usersRaw ?? []) as { tg_id: number; source: string | null }[]

  // Группируем по источнику.
  const bySource = new Map<string, Set<number>>()
  for (const u of users) {
    const key = (u.source && SOURCES.includes(u.source as SourceKey)) ? u.source : 'unknown'
    if (!bySource.has(key)) bySource.set(key, new Set())
    bySource.get(key)!.add(u.tg_id)
  }

  const allTgIds = users.map(u => u.tg_id)
  if (!allTgIds.length) {
    return SOURCES.map(s => ({ source: s, came: 0, got_sales: 0, clicked: 0, paid: 0, ctr_pct: 0, conv_pct: 0 }))
  }

  // Среди этих юзеров — кому отправляли sales, кто кликал, кто оплатил.
  // Берём ВСЕ их события (не ограничиваем периодом — следим за их жизненным
  // циклом целиком, иначе оплата за 31-й день не считалась бы для 30-дневного среза).
  const [salesRes, clicksRes, paysRes] = await Promise.all([
    supabaseAdmin.from('message_deliveries')
      .select('tg_id, template_key, delivered')
      .like('template_key', 'l_sales%')
      .eq('delivered', true)
      .in('tg_id', allTgIds).limit(LIMIT),
    supabaseAdmin.from('bot_events')
      .select('tg_id, event_type')
      .eq('event_type', 'link_click')
      .in('tg_id', allTgIds).limit(LIMIT),
    supabaseAdmin.from('events_log')
      .select('tg_id, event_type')
      .eq('event_type', 'tribute_new_subscription')
      .in('tg_id', allTgIds).limit(LIMIT),
  ])

  const salesUsers  = new Set<number>((salesRes.data  ?? []).map(r => r.tg_id))
  const clickUsers  = new Set<number>((clicksRes.data ?? []).map(r => r.tg_id))
  const paidUsers   = new Set<number>((paysRes.data   ?? []).map(r => r.tg_id))

  const allKeys: (SourceKey | 'unknown')[] = [...SOURCES, 'unknown']
  const rows: SourceRow[] = allKeys.map(src => {
    const tgs = bySource.get(src) ?? new Set<number>()
    const came = tgs.size
    let got_sales = 0, clicked = 0, paid = 0
    for (const t of tgs) {
      if (salesUsers.has(t)) got_sales++
      if (clickUsers.has(t)) clicked++
      if (paidUsers.has(t))  paid++
    }
    return {
      source: src,
      came, got_sales, clicked, paid,
      ctr_pct:  got_sales ? (clicked / got_sales) * 100 : 0,
      conv_pct: came      ? (paid    / came)      * 100 : 0,
    }
  })
  // unknown показываем только если он не пустой — не маячим строкой с нулями.
  return rows.filter(r => r.source !== 'unknown' || r.came > 0)
}

async function buildRetention(): Promise<Retention> {
  const now = Date.now()
  const day = 24 * 3600_000
  const ranges: Array<{ key: 'day_30' | 'day_60' | 'day_90'; min: number; max: number | null }> = [
    { key: 'day_30', min: 30, max: 60 },
    { key: 'day_60', min: 60, max: 90 },
    { key: 'day_90', min: 90, max: null },
  ]

  const out: Retention = {
    day_30_pct: 0, day_60_pct: 0, day_90_pct: 0,
    cohort_30: 0, cohort_60: 0, cohort_90: 0,
  }

  for (const r of ranges) {
    const upperISO = new Date(now - r.min * day).toISOString()
    const lowerISO = r.max ? new Date(now - r.max * day).toISOString() : null

    let q = supabaseAdmin
      .from('members')
      .select('status, joined_at')
      .lte('joined_at', upperISO)
    if (lowerISO) q = q.gte('joined_at', lowerISO)

    const { data } = await q.limit(50000)
    const rows = (data ?? []) as { status: string; joined_at: string }[]
    const total = rows.length
    const active = rows.filter(x => x.status === 'active').length
    const pct = total ? (active / total) * 100 : 0

    if (r.key === 'day_30') { out.day_30_pct = pct; out.cohort_30 = total }
    if (r.key === 'day_60') { out.day_60_pct = pct; out.cohort_60 = total }
    if (r.key === 'day_90') { out.day_90_pct = pct; out.cohort_90 = total }
  }

  return out
}

// Главный загрузчик. from/to — ISO datetime, [from, to).
export async function loadStats(from: string, to: string): Promise<StatsBundle> {
  const days = daysBetween(from, to)
  const prevTo = from
  const prevFrom = new Date(Date.parse(from) - days * 24 * 3600_000).toISOString()

  const [main, prev, sources, retention] = await Promise.all([
    buildTotalsAndDays(from, to),
    buildTotalsAndDays(prevFrom, prevTo),
    buildSources(from, to),
    buildRetention(),
  ])

  // Конверсии: считаем по уникальным юзерам, чтобы избежать перекоса от
  // повторных доставок (несколько sales одному юзеру → не должно надувать %).
  // Берём те же raw-данные что и тоталы, но считаем уникумов.
  const data = await fetchTotalsRange(from, to)
  const uniqueGotSales = new Set(data.sales.map(s => s.tg_id))
  const uniqueClicked  = new Set(data.events.filter(e => e.event_type === 'link_click').map(e => e.tg_id))
  const uniquePaid     = new Set(data.eventsLog.filter(e => e.event_type === 'tribute_new_subscription').map(e => e.tg_id))

  const conversion: Conversion = {
    start_to_payment_pct: main.totals.new_users
      ? (uniquePaid.size / main.totals.new_users) * 100 : 0,
    sales_to_click_pct: uniqueGotSales.size
      ? (uniqueClicked.size / uniqueGotSales.size) * 100 : 0,
    click_to_payment_pct: uniqueClicked.size
      ? (uniquePaid.size / uniqueClicked.size) * 100 : 0,
  }

  return {
    range: { from, to, days },
    totals: main.totals,
    prev_totals: prev.totals,
    conversion,
    by_day: main.byDay,
    by_source: sources,
    retention,
  }
}
