import { NextRequest, NextResponse } from 'next/server'
import { setWebhook, setDefaultMenuButtonToCommands, setMyCommands } from '@/lib/telegram'

// GET /api/setup?secret=YOUR_CRON_SECRET
// Registers the Telegram webhook + resets the global menu button to the
// commands list. The Mini App button is set per-user after they join the
// club (see webhook handlers). This means non-members see the commands
// menu, while members get the "AI Олимп" Mini App button.
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const host = req.headers.get('host') || req.nextUrl.host
  const protocol = host.includes('localhost') ? 'http' : 'https'
  const webhookUrl = `${protocol}://${host}/api/webhook`

  const webhook = await setWebhook(webhookUrl)
  const menu = await setDefaultMenuButtonToCommands()
  const commands = await setMyCommands([
    { command: 'start', description: 'Начать' },
  ])

  return NextResponse.json({ webhookUrl, webhook, menu, commands })
}
