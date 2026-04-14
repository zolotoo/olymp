import { supabase } from '@/lib/supabase'
import StatsCards from '@/components/StatsCards'
import MembersTable from '@/components/MembersTable'
import type { MemberWithActivity } from '@/lib/types'

function getWeekStart(): string {
  const now = new Date()
  const day = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - day + (day === 0 ? -6 : 1))
  monday.setHours(0, 0, 0, 0)
  return monday.toISOString().split('T')[0]
}

export const revalidate = 60

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; q?: string }>
}) {
  const { filter, q } = await searchParams
  const weekStart = getWeekStart()

  const [{ data: members }, { data: weekActivity }, { data: totalActivity }] = await Promise.all([
    supabase.from('members').select('*').order('points', { ascending: false }),
    supabase.from('activity_log').select('tg_id, message_count').gte('week_start', weekStart),
    supabase.from('activity_log').select('tg_id, message_count'),
  ])

  const weekMap = new Map<number, number>()
  for (const row of weekActivity || []) {
    weekMap.set(row.tg_id, (weekMap.get(row.tg_id) || 0) + row.message_count)
  }
  const totalMap = new Map<number, number>()
  for (const row of totalActivity || []) {
    totalMap.set(row.tg_id, (totalMap.get(row.tg_id) || 0) + row.message_count)
  }

  let enriched: MemberWithActivity[] = (members || []).map((m) => ({
    ...m,
    messages_this_week: weekMap.get(m.tg_id) || 0,
    total_messages: totalMap.get(m.tg_id) || 0,
  }))

  // Filter
  if (filter === 'risk') {
    enriched = enriched.filter((m) => {
      if (m.status !== 'active') return false
      if (!m.last_active) return true
      return Date.now() - new Date(m.last_active).getTime() > 7 * 24 * 60 * 60 * 1000
    })
  } else if (filter === 'active') {
    enriched = enriched.filter((m) => (weekMap.get(m.tg_id) || 0) > 0)
  } else if (filter === 'churned') {
    enriched = enriched.filter((m) => m.status === 'churned')
  }

  // Search
  if (q) {
    const query = q.toLowerCase()
    enriched = enriched.filter(
      (m) =>
        m.tg_first_name?.toLowerCase().includes(query) ||
        m.tg_last_name?.toLowerCase().includes(query) ||
        m.tg_username?.toLowerCase().includes(query) ||
        String(m.tg_id).includes(query)
    )
  }

  const all = (members || []).map((m) => ({
    ...m,
    messages_this_week: weekMap.get(m.tg_id) || 0,
    total_messages: totalMap.get(m.tg_id) || 0,
  }))

  const totalCount = all.length
  const activeThisWeek = all.filter((m) => (weekMap.get(m.tg_id) || 0) > 0).length
  const atRisk = all.filter((m) => {
    if (m.status !== 'active') return false
    if (!m.last_active) return true
    return Date.now() - new Date(m.last_active).getTime() > 7 * 24 * 60 * 60 * 1000
  }).length
  const newThisMonth = all.filter((m) => {
    const monthAgo = new Date()
    monthAgo.setMonth(monthAgo.getMonth() - 1)
    return new Date(m.joined_at) > monthAgo
  }).length

  const stats = [
    { label: 'Всего участников', value: totalCount },
    { label: 'Активны на неделе', value: activeThisWeek, color: 'text-green-400' },
    { label: 'Под риском (7д+)', value: atRisk, color: atRisk > 0 ? 'text-yellow-400' : 'text-white' },
    { label: 'Новых за месяц', value: newThisMonth, color: 'text-indigo-400' },
  ]

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">Участники клуба</h1>
        <p className="text-gray-500 text-sm">Обновляется каждую минуту</p>
      </div>

      <StatsCards stats={stats} />

      {/* Filters + Search */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex gap-2 flex-wrap">
          {[
            { key: undefined, label: 'Все' },
            { key: 'active', label: `Активные (${activeThisWeek})` },
            { key: 'risk', label: `Риск (${atRisk})` },
            { key: 'churned', label: 'Вышедшие' },
          ].map(({ key, label }) => (
            <a
              key={label}
              href={key ? `/?filter=${key}` : '/'}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                filter === key || (!filter && !key)
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              {label}
            </a>
          ))}
        </div>

        <form method="get" className="flex gap-2">
          {filter && <input type="hidden" name="filter" value={filter} />}
          <input
            name="q"
            defaultValue={q}
            placeholder="Поиск по имени или @username..."
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 w-64"
          />
        </form>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <MembersTable members={enriched} />
      </div>
    </div>
  )
}
