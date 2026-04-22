import { NextRequest, NextResponse } from 'next/server'
import { setWebhook, setChatMenuButton, setMyCommands } from '@/lib/telegram'

// GET /api/setup?secret=YOUR_CRON_SECRET
// Registers the Telegram webhook + Mini App menu button for this deployment.
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const host = req.headers.get('host') || req.nextUrl.host
  const protocol = host.includes('localhost') ? 'http' : 'https'
  const webhookUrl = `${protocol}://${host}/api/webhook`
  const miniAppUrl = `${protocol}://${host}/app`

  const webhook = await setWebhook(webhookUrl)
  const menu = await setChatMenuButton(miniAppUrl, 'AI Олимп')
  const commands = await setMyCommands([
    { command: 'app', description: 'Открыть AI Олимп' },
  ])

  return NextResponse.json({ webhookUrl, miniAppUrl, webhook, menu, commands })
}
