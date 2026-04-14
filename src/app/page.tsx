import { supabase } from '@/lib/supabase'
import StatsCards from '@/components/StatsCards'
import MembersTable from '@/components/MembersTable'
import type { MemberWithActivity } from '@/lib/types'

function getWeekStart(): string {
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(now)
  monday.setDate(diff)
  monday.setHours(0, 0, 0, 0)
  return monday.toISOString().split('T')[0]
}

export const revalidate = 60 // refresh every minute

export default async function DashboardPage() {
  const weekStart = getWeekStart()

  const [{ data: members }, { data: weekActivity }, { data: totalActivity }] = await Promise.all([
    supabase.from('members').select('*').order('points', { ascending: false }),
    supabase.from('activity_log').select('tg_id, message_count').gte('week_start', weekStart),
    supabase.from('activity_log').select('tg_id, message_count'),
  ])

  // Aggregate activity
  const weekMap = new Map<number, number>()
  for (const row of weekActivity || []) {
    weekMap.set(row.tg_id, (weekMap.get(row.tg_id) || 0) + row.message_count)
  }
  const totalMap = new Map<number, number>()
  for (const row of totalActivity || []) {
    totalMap.set(row.tg_id, (totalMap.get(row.tg_id) || 0) + row.message_count)
  }

  const enriched: MemberWithActivity[] = (members || []).map((m) => ({
    ...m,
    messages_this_week: weekMap.get(m.tg_id) || 0,
    total_messages: totalMap.get(m.tg_id) || 0,
  }))

  const totalCount = enriched.length
  const activeThisWeek = enriched.filter((m) => (weekMap.get(m.tg_id) || 0) > 0).length
  const atRisk = enriched.filter((m) => {
    if (m.status !== 'active') return false
    if (!m.last_active) return true
    return Date.now() - new Date(m.last_active).getTime() > 7 * 24 * 60 * 60 * 1000
  }).length
  const newThisMonth = enriched.filter((m) => {
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

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <MembersTable members={enriched} />
      </div>
    </div>
  )
}
