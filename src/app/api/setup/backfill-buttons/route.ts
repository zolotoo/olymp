import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { miniAppUrl } from '@/lib/mini-app'

// GET /api/setup/backfill-buttons?secret=YOUR_CRON_SECRET
// One-shot: give every active member the personal "AI Олимп" Mini App button.
// Safe to re-run — Telegram just overwrites the same per-chat menu button.
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = miniAppUrl()
  const token = process.env.TELEGRAM_BOT_TOKEN

  const { data: members, error } = await supabaseAdmin
    .from('members')
    .select('tg_id')
    .eq('status', 'active')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let ok = 0
  let failed = 0
  const failures: Array<{ tg_id: number; tg_error: string }> = []

  for (const m of members ?? []) {
    if (!m.tg_id) continue
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/setChatMenuButton`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: m.tg_id,
          menu_button: { type: 'web_app', text: 'AI Олимп', web_app: { url } },
        }),
      })
      const json = await res.json()
      if (json.ok) {
        ok++
      } else {
        failed++
        failures.push({ tg_id: m.tg_id, tg_error: json.description ?? 'unknown' })
      }
    } catch (e) {
      failed++
      failures.push({ tg_id: m.tg_id, tg_error: String(e) })
    }
  }

  return NextResponse.json({ url, total: members?.length ?? 0, ok, failed, failures })
}
