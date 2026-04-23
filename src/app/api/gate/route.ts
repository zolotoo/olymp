import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthedUser } from '@/lib/telegram-auth'
import { getChatMember } from '@/lib/telegram'
import { trackBotInteraction, setBotUserChannelMember } from '@/lib/bot-tracking'

// GET /api/gate — returns whether the user may use the full Mini App.
// Rule: membership = row in `members` with status='active'. If absent but the
// user is currently in the Telegram channel, auto-insert and treat as member
// (catches admins / early members who never went through /start).
export async function GET(req: NextRequest) {
  const initData = req.headers.get('x-telegram-init-data')
  const user = getAuthedUser(initData)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const tgId = user.id

  const { data: member } = await supabaseAdmin
    .from('members')
    .select('id, status')
    .eq('tg_id', tgId)
    .maybeSingle()

  if (member && member.status === 'active') {
    setBotUserChannelMember(tgId, true).catch(() => {})
    return NextResponse.json({ allowed: true, reason: 'member' })
  }

  // Fallback: check Telegram channel membership directly.
  const channelId = process.env.TELEGRAM_CHANNEL_ID
  let isChannelMember = false
  if (channelId) {
    try {
      const res = await getChatMember(channelId, tgId)
      const status = res?.result?.status as string | undefined
      isChannelMember = ['member', 'administrator', 'creator'].includes(status ?? '')
    } catch {
      // ignore — treat as not-member
    }
  }

  setBotUserChannelMember(tgId, isChannelMember).catch(() => {})

  if (isChannelMember) {
    // Auto-register the user as a club member.
    if (!member) {
      await supabaseAdmin.from('members').insert({
        tg_id: tgId,
        tg_username: user.username ?? null,
        tg_first_name: user.first_name ?? null,
        tg_last_name: user.last_name ?? null,
        status: 'active',
        rank: 'newcomer',
        points: 0,
      })
    } else {
      await supabaseAdmin.from('members').update({ status: 'active' }).eq('id', member.id)
    }
    trackBotInteraction({ user, eventType: 'auto_registered_via_mini_app' }).catch(() => {})
    return NextResponse.json({ allowed: true, reason: 'auto_registered' })
  }

  return NextResponse.json({
    allowed: false,
    reason: 'not_in_channel',
    botUrl: process.env.NEXT_PUBLIC_BOT_URL ?? null,
  })
}
