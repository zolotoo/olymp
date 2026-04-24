import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// GET /api/r/[token] — redirect + log click.
// Usage: wrap outgoing bot links like `https://<host>/api/r/abc123`.
// On click: look up target_url in click_tokens, bump counter, log bot_event,
// mark engagement on the latest delivery for this user, redirect.
//
// We filter out Telegram's link-preview prefetcher so previews don't count
// as real clicks.

const PREFETCHER_UA_RE = /TelegramBot|facebookexternalhit|Slackbot-LinkExpanding|TwitterBot|Discordbot|LinkedInBot|Googlebot|bingbot|preview/i

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!token) return NextResponse.json({ error: 'missing token' }, { status: 400 })

  const { data } = await supabaseAdmin
    .from('click_tokens')
    .select('token, target_url, campaign, tg_id, clicks')
    .eq('token', token)
    .maybeSingle()

  if (!data) return NextResponse.json({ error: 'unknown token' }, { status: 404 })

  const ua = req.headers.get('user-agent') || ''
  const isPrefetcher = PREFETCHER_UA_RE.test(ua)

  if (!isPrefetcher) {
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

      // Engagement for last deliveries to this user (latest 7 days, not yet engaged)
      try {
        await supabaseAdmin
          .from('message_deliveries')
          .update({ engaged_at: now, engagement_kind: 'click' })
          .eq('tg_id', data.tg_id)
          .is('engaged_at', null)
          .gte('sent_at', new Date(Date.now() - 7 * 86400000).toISOString())
      } catch { /* best-effort */ }
    }
  }

  return NextResponse.redirect(data.target_url, 302)
}
