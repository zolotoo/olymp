import { loadStats } from '@/lib/stats'
import StatsClient from './StatsClient'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>
}

// Период по умолчанию — 30 дней. Можно переопределить:
//  ?period=7|30|90  — последние N дней
//  ?from=YYYY-MM-DD&to=YYYY-MM-DD — произвольный диапазон (включая один день)
function resolveRange(sp: { period?: string; from?: string; to?: string }): { from: string; to: string } {
  const now = new Date()
  // Верхняя граница — начало завтрашнего UTC-дня, чтобы текущий день полностью входил.
  const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
  const to = tomorrow.toISOString()

  if (sp.from && sp.to) {
    // Один день: ?from=2026-04-30&to=2026-04-30 — расширим to до следующего дня.
    const fromDate = new Date(sp.from + 'T00:00:00.000Z')
    const toDate = new Date(sp.to + 'T00:00:00.000Z')
    toDate.setUTCDate(toDate.getUTCDate() + 1)
    return { from: fromDate.toISOString(), to: toDate.toISOString() }
  }

  const period = parseInt(sp.period || '30', 10)
  const days = [7, 30, 90].includes(period) ? period : 30
  const from = new Date(tomorrow)
  from.setUTCDate(from.getUTCDate() - days)
  return { from: from.toISOString(), to }
}

export default async function StatsPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const { from, to } = resolveRange(sp)
  const stats = await loadStats(from, to)
  const isSingleDay = !!(sp.from && sp.to && sp.from === sp.to)

  return (
    <StatsClient
      stats={stats}
      currentPeriod={isSingleDay ? null : (sp.period ? parseInt(sp.period, 10) : 30)}
      singleDay={isSingleDay ? sp.from! : null}
    />
  )
}
