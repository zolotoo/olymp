import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthedUser } from '@/lib/telegram-auth'

function authed(req: NextRequest): number | null {
  const initData = req.headers.get('x-telegram-init-data')
  const user = getAuthedUser(initData)
  return user?.id ?? null
}

const FIRST_SPIN_DELAY_DAYS = 7

// Lazy-grant the 7-day welcome spin if eligible. Returns the possibly-updated member row.
async function maybeGrantFirstWeekSpin(member: {
  id: string
  tg_id: number
  joined_at: string
  status: string
  spins_available: number
  first_week_spin_granted: boolean
}) {
  if (member.first_week_spin_granted) return member
  if (member.status !== 'active') return member
  const joined = new Date(member.joined_at).getTime()
  const ageDays = (Date.now() - joined) / (1000 * 60 * 60 * 24)
  if (ageDays < FIRST_SPIN_DELAY_DAYS) return member

  const { data: updated } = await supabaseAdmin
    .from('members')
    .update({
      spins_available: member.spins_available + 1,
      first_week_spin_granted: true,
    })
    .eq('id', member.id)
    .select('id, tg_id, joined_at, status, spins_available, first_week_spin_granted')
    .single()

  if (updated) {
    await supabaseAdmin.from('events_log').insert({
      member_id: member.id,
      tg_id: member.tg_id,
      event_type: 'spin_credit_granted',
      metadata: { reason: 'first_week' },
    })
  }

  return updated ?? member
}

// GET /api/wheel — status: credits, last spin, reason if none available.
export async function GET(req: NextRequest) {
  const tgId = authed(req)
  if (!tgId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: memberRaw } = await supabaseAdmin
    .from('members')
    .select('id, tg_id, joined_at, status, spins_available, first_week_spin_granted')
    .eq('tg_id', tgId)
    .maybeSingle()

  if (!memberRaw) {
    return NextResponse.json({
      canSpin: false,
      spinsAvailable: 0,
      reason: 'not_member',
      lastSpin: null,
    })
  }

  const member = await maybeGrantFirstWeekSpin(memberRaw)

  const { data: lastSpin } = await supabaseAdmin
    .from('wheel_spins')
    .select('id, prize_leaves, created_at')
    .eq('tg_id', tgId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let reason: string | null = null
  let nextSpinAt: string | null = null
  if (member.spins_available <= 0) {
    if (!member.first_week_spin_granted) {
      reason = 'first_week_pending'
      const joined = new Date(member.joined_at).getTime()
      nextSpinAt = new Date(joined + FIRST_SPIN_DELAY_DAYS * 24 * 60 * 60 * 1000).toISOString()
    } else {
      reason = 'awaiting_renewal'
    }
  }

  return NextResponse.json({
    canSpin: member.spins_available > 0,
    spinsAvailable: member.spins_available,
    reason,
    nextSpinAt,
    lastSpin,
  })
}

// POST /api/wheel — consume a credit and record a spin. Server picks the prize.
export async function POST(req: NextRequest) {
  const tgId = authed(req)
  if (!tgId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: memberRaw } = await supabaseAdmin
    .from('members')
    .select('id, tg_id, joined_at, status, points, rank, spins_available, first_week_spin_granted')
    .eq('tg_id', tgId)
    .maybeSingle()

  if (!memberRaw) return NextResponse.json({ error: 'not_member' }, { status: 403 })

  const member = await maybeGrantFirstWeekSpin({
    id: memberRaw.id,
    tg_id: memberRaw.tg_id,
    joined_at: memberRaw.joined_at,
    status: memberRaw.status,
    spins_available: memberRaw.spins_available,
    first_week_spin_granted: memberRaw.first_week_spin_granted,
  })

  if (member.spins_available <= 0) {
    return NextResponse.json({ error: 'no_credit' }, { status: 409 })
  }

  const { pickWheelPrizeFromDb } = await import('@/lib/wheel-prizes-server')
  const pick = await pickWheelPrizeFromDb()
  if (!pick) return NextResponse.json({ error: 'no_prizes_configured' }, { status: 500 })

  const { error: insErr } = await supabaseAdmin.from('wheel_spins').insert({
    tg_id: tgId,
    month: new Date().toISOString().slice(0, 7),
    prize_leaves: pick.leaves,
  })
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })

  const newPoints = memberRaw.points + pick.leaves

  await supabaseAdmin
    .from('members')
    .update({
      points: newPoints,
      spins_available: member.spins_available - 1,
    })
    .eq('id', memberRaw.id)

  if (pick.leaves > 0) {
    await supabaseAdmin.from('points_log').insert({
      member_id: memberRaw.id,
      tg_id: tgId,
      points: pick.leaves,
      reason: 'wheel_spin',
    })
  }

  if (pick.reward) {
    await supabaseAdmin.from('events_log').insert({
      member_id: memberRaw.id,
      tg_id: tgId,
      event_type: 'wheel_reward_won',
      metadata: { key: pick.key, prize: pick.prize },
    })
  }

  return NextResponse.json({
    ok: true,
    segmentIndex: pick.segmentIndex,
    leaves: pick.leaves,
    prize: pick.prize,
    reward: pick.reward,
    spinsAvailable: member.spins_available - 1,
  })
}
