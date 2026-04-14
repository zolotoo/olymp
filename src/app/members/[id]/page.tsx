import { notFound } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { getMemories } from '@/lib/mem0'
import { RANK_CONFIG } from '@/lib/ranks'
import type { MemberRank } from '@/lib/types'
import ActivityChart from '@/components/ActivityChart'

export const revalidate = 60

export default async function MemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [
    { data: member },
    { data: events },
    { data: pointsLog },
    { data: activity },
    { data: allActivity },
  ] = await Promise.all([
    supabase.from('members').select('*').eq('id', id).single(),
    supabase.from('events_log').select('*').eq('member_id', id).order('triggered_at', { ascending: false }).limit(50),
    supabase.from('points_log').select('*').eq('member_id', id).order('created_at', { ascending: false }).limit(50),
    supabase.from('activity_log').select('*').eq('member_id', id).order('week_start', { ascending: false }).limit(12),
    supabase.from('activity_log').select('message_count').eq('member_id', id),
  ])

  if (!member) notFound()

  const memories = await getMemories(String(member.tg_id))
  const rank = RANK_CONFIG[member.rank as MemberRank]

  const totalMessages = (allActivity || []).reduce((s, r) => s + r.message_count, 0)
  const daysSinceJoin = Math.floor((Date.now() - new Date(member.joined_at).getTime()) / (1000 * 60 * 60 * 24))

  const pointsByReason = (pointsLog || []).reduce((acc: Record<string, number>, r) => {
    acc[r.reason] = (acc[r.reason] || 0) + r.points
    return acc
  }, {})

  const reasonLabels: Record<string, string> = {
    message: 'За сообщения',
    reaction_given: 'За реакции',
    reaction_received: 'Реакции на посты',
    weekly_active_bonus: 'Бонус активности',
  }

  return (
    <div className="max-w-5xl">
      <Link href="/" className="text-sm text-gray-500 hover:text-white mb-6 inline-flex items-center gap-1">
        ← Все участники
      </Link>

      {/* Header */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold">
              {member.tg_first_name || member.tg_username || String(member.tg_id)}
              {member.tg_last_name && ` ${member.tg_last_name}`}
            </h1>
            {member.tg_username && (
              <a
                href={`https://t.me/${member.tg_username}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-400 hover:text-indigo-300 transition-colors mt-0.5 inline-block"
              >
                @{member.tg_username}
              </a>
            )}
            <div className={`mt-2 text-lg font-semibold ${rank.color}`}>
              {rank.emoji} {rank.label}
            </div>
          </div>
          <div className="text-right">
            <div className="text-4xl font-bold">{member.points.toLocaleString()}</div>
            <div className="text-gray-500 text-sm">баллов</div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-800">
          <Stat label="Вступил" value={new Date(member.joined_at).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' })} />
          <Stat label="Дней в клубе" value={daysSinceJoin} />
          <Stat label="Всего сообщений" value={totalMessages} />
          <Stat
            label="Последняя активность"
            value={member.last_active ? new Date(member.last_active).toLocaleDateString('ru') : 'никогда'}
            highlight={!member.last_active || Date.now() - new Date(member.last_active).getTime() > 7 * 24 * 60 * 60 * 1000}
          />
        </div>
      </div>

      {/* Activity chart */}
      {(activity || []).length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
          <h2 className="font-semibold mb-4">Активность по неделям</h2>
          <ActivityChart data={(activity || []).slice().reverse()} />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Mem0 memory */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="font-semibold mb-4">Память участника</h2>
          {!(memories?.results?.length) ? (
            <p className="text-gray-500 text-sm">Память пока пуста — накапливается по мере активности</p>
          ) : (
            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {memories.results.map((m: { id: string; memory: string; created_at?: string }) => (
                <div key={m.id} className="text-sm text-gray-300 border-l-2 border-indigo-600 pl-3 py-0.5">
                  {m.memory}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Points breakdown */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="font-semibold mb-4">Откуда баллы</h2>
          {Object.keys(pointsByReason).length === 0 ? (
            <p className="text-gray-500 text-sm">Нет данных</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(pointsByReason).map(([reason, pts]) => (
                <div key={reason} className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">{reasonLabels[reason] || reason}</span>
                  <div className="flex items-center gap-2">
                    <div
                      className="h-1.5 bg-indigo-600 rounded-full"
                      style={{ width: `${Math.min((pts / member.points) * 120, 120)}px` }}
                    />
                    <span className="text-sm font-mono text-white w-12 text-right">{pts}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Events / triggers */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="font-semibold mb-4">История триггеров</h2>
          {(events || []).length === 0 ? (
            <p className="text-gray-500 text-sm">Нет событий</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {(events || []).map((e) => (
                <div key={e.id} className="flex items-start justify-between gap-2 text-sm">
                  <span className="font-mono text-gray-300">{e.event_type}</span>
                  <span className="text-gray-600 text-xs whitespace-nowrap">
                    {new Date(e.triggered_at).toLocaleDateString('ru', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Raw weekly table */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="font-semibold mb-4">Сообщения по неделям</h2>
          {(activity || []).length === 0 ? (
            <p className="text-gray-500 text-sm">Нет данных</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {(activity || []).map((row) => (
                <div key={row.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">неделя с {row.week_start}</span>
                  <div className="flex items-center gap-2">
                    <div
                      className="h-1.5 bg-green-600 rounded-full"
                      style={{ width: `${Math.min(row.message_count * 3, 80)}px` }}
                    />
                    <span className="font-mono w-8 text-right">{row.message_count}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div>
      <div className="text-gray-500 text-xs mb-0.5">{label}</div>
      <div className={`text-sm font-medium ${highlight ? 'text-yellow-400' : 'text-white'}`}>{value}</div>
    </div>
  )
}
