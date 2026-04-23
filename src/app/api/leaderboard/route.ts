import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthedUser } from '@/lib/telegram-auth'

export async function GET(req: NextRequest) {
  const initData = req.headers.get('x-telegram-init-data')
  const user = getAuthedUser(initData)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('members')
    .select('tg_id, tg_username, tg_first_name, rank, points, photo_url')
    .eq('status', 'active')
    .order('points', { ascending: false })
    .limit(1000)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    me: user.id,
    members: (data ?? []).map(m => ({
      tg_id: m.tg_id,
      name: m.tg_first_name || m.tg_username || 'Гость',
      username: m.tg_username,
      photo_url: m.photo_url ?? null,
      rank: m.rank,
      points: m.points ?? 0,
    })),
  })
}
