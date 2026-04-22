import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthedUser } from '@/lib/telegram-auth'

function currentMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function authed(req: NextRequest): number | null {
  const initData = req.headers.get('x-telegram-init-data')
  const user = getAuthedUser(initData)
  return user?.id ?? null
}

// GET /api/wheel — check if the authed user can spin this month
export async function GET(req: NextRequest) {
  const tgId = authed(req)
  if (!tgId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const month = currentMonth()
  const { data } = await supabaseAdmin
    .from('wheel_spins')
    .select('id, prize_leaves, created_at')
    .eq('tg_id', tgId)
    .eq('month', month)
    .maybeSingle()

  return NextResponse.json({ canSpin: !data, spin: data ?? null })
}

// POST /api/wheel — record a spin. Server picks the prize (trustless).
export async function POST(req: NextRequest) {
  const tgId = authed(req)
  if (!tgId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const month = currentMonth()

  const { data: existing } = await supabaseAdmin
    .from('wheel_spins')
    .select('id')
    .eq('tg_id', tgId)
    .eq('month', month)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'already_spun' }, { status: 409 })
  }

  // Server-side prize selection — client cannot forge the outcome.
  const { pickWheelPrize } = await import('@/lib/wheel-prizes')
  const { segmentIndex, leaves } = pickWheelPrize()

  const { error } = await supabaseAdmin.from('wheel_spins').insert({
    tg_id: tgId,
    month,
    prize_leaves: leaves,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: member } = await supabaseAdmin
    .from('members')
    .select('id, points, rank')
    .eq('tg_id', tgId)
    .maybeSingle()

  if (member) {
    const { getRank } = await import('@/lib/ranks')
    const newPoints = member.points + leaves
    const newRank = getRank(newPoints)
    await supabaseAdmin
      .from('members')
      .update({ points: newPoints, rank: newRank })
      .eq('id', member.id)
    await supabaseAdmin.from('points_log').insert({
      member_id: member.id,
      tg_id: tgId,
      points: leaves,
      reason: 'wheel_spin',
    })
  }

  return NextResponse.json({ ok: true, month, segmentIndex, leaves })
}
