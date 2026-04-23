import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { enableMiniAppButton } from '@/lib/mini-app'

// GET /api/setup/backfill-buttons?secret=YOUR_CRON_SECRET
// One-shot: give every active member the personal "AI Олимп" Mini App button.
// Safe to re-run — Telegram just overwrites the same per-chat menu button.
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: members, error } = await supabaseAdmin
    .from('members')
    .select('tg_id')
    .eq('status', 'active')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let ok = 0
  let failed = 0
  for (const m of members ?? []) {
    if (!m.tg_id) continue
    try {
      await enableMiniAppButton(m.tg_id)
      ok++
    } catch {
      failed++
    }
  }

  return NextResponse.json({ total: members?.length ?? 0, ok, failed })
}
