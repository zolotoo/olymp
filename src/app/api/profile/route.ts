import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthedUser } from '@/lib/telegram-auth'
import { RANK_CONFIG, RANK_ORDER, loadTitles } from '@/lib/ranks'

export async function GET(req: NextRequest) {
  const initData = req.headers.get('x-telegram-init-data')
  const user = getAuthedUser(initData)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const tgId = user.id

  const { data: member } = await supabaseAdmin
    .from('members')
    .select('id, tg_id, tg_username, tg_first_name, rank, points, joined_at, status, photo_url, subscription_count')
    .eq('tg_id', tgId)
    .maybeSingle()

  // Opportunistically refresh photo_url / name from Telegram initData on each visit.
  if (member && (user.photo_url !== member.photo_url || user.first_name !== member.tg_first_name || user.username !== member.tg_username)) {
    await supabaseAdmin
      .from('members')
      .update({
        photo_url: user.photo_url ?? null,
        tg_first_name: user.first_name ?? member.tg_first_name,
        tg_username: user.username ?? member.tg_username,
      })
      .eq('id', member.id)
  }

  // If not a club member yet — return a stub so the Mini App can show a join CTA.
  if (!member) {
    return NextResponse.json({
      isMember: false,
      user: { id: tgId, first_name: user.first_name, username: user.username, photo_url: user.photo_url },
    })
  }

  // Leaderboard position among active members (by points desc)
  const { count: ahead } = await supabaseAdmin
    .from('members')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active')
    .gt('points', member.points)

  const { count: total } = await supabaseAdmin
    .from('members')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active')

  const position = (ahead ?? 0) + 1

  const { data: spins } = await supabaseAdmin
    .from('wheel_spins')
    .select('month, prize_leaves, created_at')
    .eq('tg_id', tgId)
    .order('created_at', { ascending: false })
    .limit(12)

  const rankInfo = RANK_CONFIG[member.rank as keyof typeof RANK_CONFIG] ?? RANK_CONFIG.newcomer

  // Все титулы с бонусами — для UI «текущий + следующий».
  const titles = await loadTitles()
  const titleList = RANK_ORDER.map(r => ({
    rank: r,
    label: titles[r].label,
    color: titles[r].color,
    month: titles[r].month,
    bonusPoints: titles[r].bonus_points,
    perks: titles[r].perks,
  }))

  return NextResponse.json({
    isMember: true,
    user: { id: tgId, first_name: user.first_name, username: user.username, photo_url: user.photo_url },
    member: {
      rank: member.rank,
      rankLabel: rankInfo.label,
      rankColor: rankInfo.color,
      points: member.points,
      joined_at: member.joined_at,
      status: member.status,
      subscriptionCount: member.subscription_count ?? 1,
    },
    titles: titleList,
    leaderboard: { position, total: total ?? 0 },
    spins: spins ?? [],
  })
}
