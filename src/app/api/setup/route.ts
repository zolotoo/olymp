import { NextRequest, NextResponse } from 'next/server'
import { setWebhook } from '@/lib/telegram'

// GET /api/setup?secret=YOUR_CRON_SECRET
// Registers the Telegram webhook pointing to this deployment
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const host = req.headers.get('host') || req.nextUrl.host
  const protocol = host.includes('localhost') ? 'http' : 'https'
  const webhookUrl = `${protocol}://${host}/api/webhook`

  const result = await setWebhook(webhookUrl)
  return NextResponse.json({ webhookUrl, result })
}
