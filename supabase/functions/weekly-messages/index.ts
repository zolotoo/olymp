// Supabase Edge Function: weekly-messages
// Запускается раз в сутки pg_cron'ом. Проходится по активным участникам,
// шлёт сообщение если прошло 7/14/21/28 дней с joined_at и ещё не слали.
// Идемпотентность — через таблицу weekly_sends (tg_id, week_num).
//
// Тексты берутся из bot_messages[weekly_week{N}] (редактируется в /flow),
// в них подставляются переменные {name}, {points}, {current_title},
// {next_title}, {next_perks}, {days_to_renewal}.

// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? ''
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''

// Окно отправки для каждой недели: чтобы не потерять человека,
// если функция день простоит. От 7 до 13 — шлём week1, и т.д.
const WEEK_TRIGGERS: Array<{ n: 1 | 2 | 3 | 4; min: number; max: number }> = [
  { n: 1, min: 7,  max: 14 },
  { n: 2, min: 14, max: 21 },
  { n: 3, min: 21, max: 28 },
  { n: 4, min: 28, max: 35 },
]

const SUB_DAYS = 30

type Member = {
  id: string
  tg_id: number
  tg_first_name: string | null
  tg_username: string | null
  joined_at: string
  points: number
  rank: string
}

type Title = {
  rank: string
  month: number
  label: string
  perks: string[]
}

function renderVars(tpl: string, vars: Record<string, string | number>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => {
    const v = vars[k]
    return v === undefined || v === null ? '' : String(v)
  })
}

async function sendMessage(chatId: number, text: string): Promise<{ ok: boolean; message_id?: number }> {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  })
  const data = await res.json().catch(() => ({}))
  return { ok: !!data.ok, message_id: data.result?.message_id }
}

Deno.serve(async (req: Request) => {
  // Защита: pg_cron зовёт с секретом, чтобы случайным HTTP-запросом нельзя было триггерить.
  if (CRON_SECRET) {
    const provided = req.headers.get('x-cron-secret') || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (provided !== CRON_SECRET) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 })
    }
  }

  if (!BOT_TOKEN) {
    return new Response(JSON.stringify({ error: 'TELEGRAM_BOT_TOKEN not set' }), { status: 500 })
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

  // 1. Активные участники
  const { data: membersRaw, error: memberErr } = await supabase
    .from('members')
    .select('id, tg_id, tg_first_name, tg_username, joined_at, points, rank')
    .eq('status', 'active')
  if (memberErr) {
    return new Response(JSON.stringify({ error: memberErr.message }), { status: 500 })
  }
  const members = (membersRaw ?? []) as Member[]

  // 2. Титулы
  const { data: titlesRaw } = await supabase
    .from('titles')
    .select('rank, month, label, perks')
    .order('month', { ascending: true })
  const titles = (titlesRaw ?? []) as Title[]
  const titleByRank = Object.fromEntries(titles.map(t => [t.rank, t])) as Record<string, Title>
  const titleByMonth = Object.fromEntries(titles.map(t => [t.month, t])) as Record<number, Title>

  // 3. Тексты
  const { data: textsRaw } = await supabase
    .from('bot_messages')
    .select('key, content')
    .in('key', ['weekly_week1', 'weekly_week2', 'weekly_week3', 'weekly_week4'])
  const textByKey = Object.fromEntries((textsRaw ?? []).map(r => [r.key, r.content || ''])) as Record<string, string>

  // 4. Уже отправленные (чтобы не слать повторно)
  const tgIds = members.map(m => m.tg_id)
  const { data: sentRaw } = await supabase
    .from('weekly_sends')
    .select('tg_id, week_num')
    .in('tg_id', tgIds.length ? tgIds : [0])
  const sentSet = new Set((sentRaw ?? []).map(r => `${r.tg_id}:${r.week_num}`))

  const now = Date.now()
  const report: Array<{ tg_id: number; week_num: number; ok: boolean; reason?: string }> = []

  for (const m of members) {
    const joined = new Date(m.joined_at).getTime()
    if (!Number.isFinite(joined)) continue
    const daysInClub = (now - joined) / (1000 * 60 * 60 * 24)

    // Ищем, в какую неделю попадает — и ещё не отправлено.
    const trig = WEEK_TRIGGERS.find(t => daysInClub >= t.min && daysInClub < t.max && !sentSet.has(`${m.tg_id}:${t.n}`))
    if (!trig) continue

    const tpl = textByKey[`weekly_week${trig.n}`]
    if (!tpl) {
      report.push({ tg_id: m.tg_id, week_num: trig.n, ok: false, reason: 'no_template' })
      continue
    }

    // Переменные
    const curTitle = titleByRank[m.rank] ?? titles[0]
    const nextTitle = titleByMonth[(curTitle?.month ?? 1) + 1] ?? null
    const nextPerks = nextTitle
      ? nextTitle.perks.map(p => `• ${p}`).join('\n')
      : 'Ты уже достиг высшего титула'
    const daysToRenewal = Math.max(0, Math.ceil(SUB_DAYS - daysInClub))

    const vars: Record<string, string | number> = {
      name: m.tg_first_name || m.tg_username || 'друг',
      points: m.points ?? 0,
      current_title: curTitle?.label ?? '',
      next_title: nextTitle?.label ?? '',
      next_perks: nextPerks,
      days_to_renewal: daysToRenewal,
    }

    const text = renderVars(tpl, vars)
    const result = await sendMessage(m.tg_id, text)

    if (result.ok) {
      await supabase.from('weekly_sends').insert({
        tg_id: m.tg_id,
        week_num: trig.n,
        message_id: result.message_id ?? null,
      })
      await supabase.from('events_log').insert({
        member_id: m.id,
        tg_id: m.tg_id,
        event_type: 'weekly_message_sent',
        metadata: { week_num: trig.n, days_in_club: Math.floor(daysInClub) },
      })
    }

    report.push({ tg_id: m.tg_id, week_num: trig.n, ok: result.ok, reason: result.ok ? undefined : 'send_failed' })
  }

  return new Response(
    JSON.stringify({ ok: true, processed: report.length, report }),
    { headers: { 'Content-Type': 'application/json' } },
  )
})
