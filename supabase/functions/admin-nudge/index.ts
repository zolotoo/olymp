// Supabase Edge Function: admin-nudge
// Запускается pg_cron'ом пн/ср/пт в 19:00 МСК. Отправляет админу личное сообщение
// с напоминанием закинуть что-нибудь интересное в общий чат.
// Идемпотентность — через PK admin_nudges.sent_date (один пинок в сутки).

// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? ''
const ADMIN_TG_ID = Deno.env.get('TELEGRAM_ADMIN_TG_ID') ?? Deno.env.get('TELEGRAM_ADMIN_CHAT_ID') ?? ''
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''

function todayMskDate(): string {
  // YYYY-MM-DD в таймзоне Europe/Moscow
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow',
    year: 'numeric', month: '2-digit', day: '2-digit',
  })
  return fmt.format(new Date())
}

async function sendMessage(chatId: string | number, text: string) {
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
  return { ok: !!data.ok, message_id: data.result?.message_id, raw: data }
}

Deno.serve(async (req: Request) => {
  if (CRON_SECRET) {
    const provided = req.headers.get('x-cron-secret') || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (provided !== CRON_SECRET) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 })
    }
  }

  if (!BOT_TOKEN) {
    return new Response(JSON.stringify({ error: 'TELEGRAM_BOT_TOKEN not set' }), { status: 500 })
  }
  if (!ADMIN_TG_ID) {
    return new Response(JSON.stringify({ error: 'TELEGRAM_ADMIN_TG_ID not set' }), { status: 500 })
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
  const today = todayMskDate()

  // Идемпотентность: уже слали сегодня?
  const { data: existing } = await supabase
    .from('admin_nudges')
    .select('sent_date')
    .eq('sent_date', today)
    .maybeSingle()
  if (existing) {
    return new Response(JSON.stringify({ ok: true, skipped: 'already_sent_today', date: today }))
  }

  // Пул фраз
  const { data: poolRow } = await supabase
    .from('bot_messages')
    .select('content')
    .eq('key', 'admin_nudge_pool')
    .maybeSingle()

  const raw = (poolRow?.content ?? '').trim()
  const variants = raw
    .split(/\n---\n/)
    .map(s => s.trim())
    .filter(Boolean)

  if (variants.length === 0) {
    return new Response(JSON.stringify({ error: 'admin_nudge_pool is empty' }), { status: 500 })
  }

  const idx = Math.floor(Math.random() * variants.length)
  const text = variants[idx]

  const result = await sendMessage(ADMIN_TG_ID, text)
  if (!result.ok) {
    return new Response(JSON.stringify({ error: 'send_failed', raw: result.raw }), { status: 500 })
  }

  await supabase.from('admin_nudges').insert({
    sent_date: today,
    tg_id: Number(ADMIN_TG_ID),
    message_id: result.message_id ?? null,
    variant_idx: idx,
  })

  return new Response(
    JSON.stringify({ ok: true, date: today, variant_idx: idx, message_id: result.message_id }),
    { headers: { 'Content-Type': 'application/json' } },
  )
})
