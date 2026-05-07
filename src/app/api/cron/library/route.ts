import { NextRequest, NextResponse } from 'next/server'
import { nudgeAdminBacklogIfNeeded, nudgeStaleFeatured, notifyDigestReady } from '@/lib/library-notify'

// /api/cron/library — пинги админу про библиотеку. Запускается по расписанию
// Vercel Cron (см. vercel.json):
//   - пн 10:00 МСК (07:00 UTC) — основной нудж по очереди
//   - чт 12:00 МСК (09:00 UTC) — страховочный нудж
// Функции внутри сами проверяют идемпотентность (один нудж в день) и
// условия (есть ли что присылать). Так что cron можно дёргать чаще без вреда.

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const job = url.searchParams.get('job') ?? 'all'

  const results: Record<string, unknown> = {}

  if (job === 'all' || job === 'backlog') {
    results.backlog = await nudgeAdminBacklogIfNeeded()
  }
  if (job === 'all' || job === 'featured') {
    results.featured = await nudgeStaleFeatured()
  }
  if (job === 'all' || job === 'digest_ready') {
    results.digest_ready = await notifyDigestReady()
  }

  return NextResponse.json({ ok: true, ran_at: new Date().toISOString(), results })
}
