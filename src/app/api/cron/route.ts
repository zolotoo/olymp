import { NextRequest, NextResponse } from 'next/server'
import { checkInactiveMembers, checkWeeklyActiveMembers, checkWeekMilestones } from '@/lib/triggers'

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results = await Promise.allSettled([
    checkInactiveMembers(),
    checkWeeklyActiveMembers(),
    checkWeekMilestones(),
  ])

  const summary = results.map((r, i) => ({
    job: ['inactive', 'active_bonus', 'milestones'][i],
    status: r.status,
    error: r.status === 'rejected' ? String(r.reason) : undefined,
  }))

  return NextResponse.json({ ok: true, ran_at: new Date().toISOString(), jobs: summary })
}
