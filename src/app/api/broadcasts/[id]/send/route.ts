import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendTracked } from '@/lib/send-tracked'
import { resolveAudience, type AudienceKind, type AudienceFilter } from '@/lib/audience-resolver'
import { getCurrentAdminTgId } from '@/lib/admin-auth'
import type { InlineUrlButton } from '@/lib/telegram'

interface BroadcastRow {
  id: string
  title: string
  text: string
  audience: AudienceKind
  audience_filter: AudienceFilter | null
  cta_url: string | null
  cta_label: string | null
  cta_url_2: string | null
  cta_label_2: string | null
  status: string
}

function renderText(tpl: string, t: { tg_first_name: string | null; tg_username: string | null }): string {
  const name = t.tg_first_name || t.tg_username || 'друг'
  return tpl.replace(/\{name\}/g, name).replace(/\{username\}/g, t.tg_username || '')
}

function buildButtons(b: BroadcastRow): InlineUrlButton[] | null {
  const out: InlineUrlButton[] = []
  if (b.cta_url) out.push({ label: b.cta_label || 'Открыть в приложении', url: b.cta_url })
  if (b.cta_url_2) out.push({ label: b.cta_label_2 || 'Открыть в чате', url: b.cta_url_2 })
  return out.length ? out : null
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  // Auth: either admin session OR internal trigger header
  const internalSecret = req.headers.get('x-internal-trigger')
  const isInternal = internalSecret && internalSecret === process.env.CRON_SECRET
  if (!isInternal) {
    const tg = await getCurrentAdminTgId()
    if (!tg) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { id } = await ctx.params
  const { data: broadcast } = await supabaseAdmin
    .from('broadcasts')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (!broadcast) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const b = broadcast as BroadcastRow
  if (b.status === 'sending' || b.status === 'sent') {
    return NextResponse.json({ error: 'already_processed', status: b.status }, { status: 409 })
  }

  const targets = await resolveAudience(b.audience, b.audience_filter)

  await supabaseAdmin
    .from('broadcasts')
    .update({
      status: 'sending',
      started_at: new Date().toISOString(),
      total_targeted: targets.length,
    })
    .eq('id', id)

  let delivered = 0
  let failed = 0

  const buttons = buildButtons(b)

  // Telegram bot rate: ~30 messages/sec to different users. Throttle conservatively.
  for (const t of targets) {
    const body = renderText(b.text, t)
    const res = await sendTracked(t.tg_id, body, {
      campaign: `broadcast:${b.id}`,
      broadcastId: b.id,
      buttons,
    })
    if (res?.ok) delivered++; else failed++
    // ~25 msgs/sec
    await new Promise((r) => setTimeout(r, 40))
  }

  await supabaseAdmin
    .from('broadcasts')
    .update({
      status: 'sent',
      finished_at: new Date().toISOString(),
      total_delivered: delivered,
      total_failed: failed,
    })
    .eq('id', id)

  return NextResponse.json({ ok: true, targeted: targets.length, delivered, failed })
}
