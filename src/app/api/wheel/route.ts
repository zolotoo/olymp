import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

function currentMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// GET /api/wheel?tg_id=XXX — check if user can spin this month
export async function GET(req: NextRequest) {
  const tgId = req.nextUrl.searchParams.get('tg_id')
  if (!tgId) return NextResponse.json({ canSpin: true })

  const month = currentMonth()
  const { data } = await supabaseAdmin
    .from('wheel_spins')
    .select('id, prize_leaves')
    .eq('tg_id', tgId)
    .eq('month', month)
    .maybeSingle()

  return NextResponse.json({ canSpin: !data, spin: data ?? null })
}

// POST /api/wheel — record a spin result
export async function POST(req: NextRequest) {
  const { tg_id, prize_leaves } = await req.json()
  if (!tg_id || prize_leaves == null) {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 })
  }

  const month = currentMonth()

  // Check if already spun this month
  const { data: existing } = await supabaseAdmin
    .from('wheel_spins')
    .select('id')
    .eq('tg_id', tg_id)
    .eq('month', month)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'already_spun' }, { status: 409 })
  }

  const { error } = await supabaseAdmin.from('wheel_spins').insert({
    tg_id,
    month,
    prize_leaves,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Award leaves to the member
  const { data: member } = await supabaseAdmin
    .from('members')
    .select('id, points, rank')
    .eq('tg_id', tg_id)
    .maybeSingle()

  if (member) {
    const { getRank } = await import('@/lib/ranks')
    const newPoints = member.points + prize_leaves
    const newRank = getRank(newPoints)
    await supabaseAdmin
      .from('members')
      .update({ points: newPoints, rank: newRank })
      .eq('id', member.id)
    await supabaseAdmin.from('points_log').insert({
      member_id: member.id,
      tg_id,
      points: prize_leaves,
      reason: 'wheel_spin',
    })
  }

  return NextResponse.json({ ok: true, month, prize_leaves })
}
