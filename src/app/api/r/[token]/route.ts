import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// GET /api/r/[token] — redirect + log click.
// Usage: wrap outgoing bot links like `https://<host>/api/r/abc123`.
// On click: look up target_url in click_tokens, bump counter, log bot_event, redirect.
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!token) return NextResponse.json({ error: 'missing token' }, { status: 400 })

  const { data } = await supabaseAdmin
    .from('click_tokens')
    .select('token, target_url, campaign, tg_id, clicks')
    .eq('token', token)
    .maybeSingle()

  if (!data) return NextResponse.json({ error: 'unknown token' }, { status: 404 })

  const now = new Date().toISOString()
  await supabaseAdmin
    .from('click_tokens')
    .update({ clicks: (data.clicks ?? 0) + 1, last_click_at: now })
    .eq('token', token)

  if (data.tg_id) {
    await supabaseAdmin.from('bot_events').insert({
      tg_id: data.tg_id,
      event_type: 'link_click',
      payload: { token, campaign: data.campaign, target_url: data.target_url },
    })
  }

  return NextResponse.redirect(data.target_url, 302)
}
