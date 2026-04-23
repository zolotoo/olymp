import { NextRequest, NextResponse } from 'next/server'
import { getAuthedUser } from '@/lib/telegram-auth'
import { trackBotInteraction } from '@/lib/bot-tracking'

export async function POST(req: NextRequest) {
  const initData = req.headers.get('x-telegram-init-data')
  const user = getAuthedUser(initData)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  await trackBotInteraction({
    user: { id: user.id, username: user.username, first_name: user.first_name, last_name: user.last_name },
    eventType: 'mini_app_open',
  })

  return NextResponse.json({ ok: true })
}
