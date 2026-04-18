import { notFound } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { getMemories } from '@/lib/mem0'
import { RANK_CONFIG } from '@/lib/ranks'
import type { MemberRank } from '@/lib/types'
import ActivityChart from '@/components/ActivityChart'
import SummaryButton from '@/components/SummaryButton'

export const revalidate = 60

const card = {
  background: 'rgba(255,255,255,0.70)',
  backdropFilter: 'blur(28px) saturate(160%)',
  WebkitBackdropFilter: 'blur(28px) saturate(160%)',
  border: '1px solid rgba(255,255,255,0.55)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)',
}

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
    message: 'За сообщения (+1 🍃)',
    reaction_given: 'За реакцию (+1 🍃)',
    reaction_received: 'Реакции на посты (+3 🍃)',
    poll_vote: 'За голосование (+5 🍃)',
    weekly_active_bonus: 'Бонус активности',
    subscription_renewal: 'Продление подписки',
  }

  return (
    <div className="max-w-5xl">
      {/* Back + Summary */}
      <div className="flex items-center justify-between mb-6">
        <Link
          href="/"
          className="text-sm font-medium inline-flex items-center gap-1 transition-opacity hover:opacity-70"
          style={{ color: '#0A84FF' }}
        >
          ← Все участники
        </Link>
        <SummaryButton memberId={id} />
      </div>

      {/* Header card */}
      <div className="rounded-2xl p-6 mb-5" style={card}>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#1D1D1F', letterSpacing: '-0.4px' }}>
              {member.tg_first_name || member.tg_username || String(member.tg_id)}
              {member.tg_last_name && ` ${member.tg_last_name}`}
            </h1>
            {member.tg_username && (
              <a
                href={`https://t.me/${member.tg_username}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium transition-opacity hover:opacity-70 mt-0.5 inline-block"
                style={{ color: '#0A84FF' }}
              >
                @{member.tg_username}
              </a>
            )}
            <div className="mt-2 text-base font-semibold" style={{ color: rank.color }}>
              {rank.emoji} {rank.label}
            </div>
          </div>
          <div className="text-right">
            <div className="text-4xl font-bold" style={{ color: '#1D1D1F', letterSpacing: '-1px' }}>
              {member.points.toLocaleString()}
            </div>
            <div className="text-sm mt-0.5" style={{ color: '#6E6E73' }}>листиков 🍃</div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5 pt-5" style={{ borderTop: '1px solid rgba(28,28,30,0.08)' }}>
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
        <div className="rounded-2xl p-6 mb-5" style={card}>
          <h2 className="font-semibold mb-4" style={{ color: '#1D1D1F' }}>Активность по неделям</h2>
          <ActivityChart data={(activity || []).slice().reverse()} />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Mem0 memory */}
        <div className="rounded-2xl p-6" style={card}>
          <h2 className="font-semibold mb-4" style={{ color: '#1D1D1F' }}>Память участника</h2>
          {!(memories?.results?.length) ? (
            <p className="text-sm" style={{ color: '#AEAEB2' }}>Память пока пуста — накапливается по мере активности</p>
          ) : (
            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {memories.results.map((m: { id: string; memory: string; created_at?: string }) => (
                <div
                  key={m.id}
                  className="text-sm pl-3 py-0.5"
                  style={{ color: '#1C1C1E', borderLeft: '2px solid rgba(10,132,255,0.5)', paddingLeft: 10 }}
                >
                  {m.memory}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Points breakdown */}
        <div className="rounded-2xl p-6" style={card}>
          <h2 className="font-semibold mb-4" style={{ color: '#1D1D1F' }}>Откуда листики 🍃</h2>
          {Object.keys(pointsByReason).length === 0 ? (
            <p className="text-sm" style={{ color: '#AEAEB2' }}>Нет данных</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(pointsByReason).map(([reason, pts]) => (
                <div key={reason} className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: '#6E6E73' }}>{reasonLabels[reason] || reason}</span>
                  <div className="flex items-center gap-2">
                    <div
                      className="h-1.5 rounded-full"
                      style={{
                        background: '#0A84FF',
                        width: `${Math.min((pts / member.points) * 120, 120)}px`,
                      }}
                    />
                    <span className="text-sm font-mono w-12 text-right" style={{ color: '#1D1D1F' }}>{pts}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Events / triggers */}
        <div className="rounded-2xl p-6" style={card}>
          <h2 className="font-semibold mb-4" style={{ color: '#1D1D1F' }}>История триггеров</h2>
          {(events || []).length === 0 ? (
            <p className="text-sm" style={{ color: '#AEAEB2' }}>Нет событий</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {(events || []).map((e) => (
                <div key={e.id} className="flex items-start justify-between gap-2 text-sm">
                  <span className="font-mono" style={{ color: '#1D1D1F' }}>{e.event_type}</span>
                  <span className="text-xs whitespace-nowrap" style={{ color: '#AEAEB2' }}>
                    {new Date(e.triggered_at).toLocaleDateString('ru', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Raw weekly table */}
        <div className="rounded-2xl p-6" style={card}>
          <h2 className="font-semibold mb-4" style={{ color: '#1D1D1F' }}>Сообщения по неделям</h2>
          {(activity || []).length === 0 ? (
            <p className="text-sm" style={{ color: '#AEAEB2' }}>Нет данных</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {(activity || []).map((row) => (
                <div key={row.id} className="flex items-center justify-between text-sm">
                  <span style={{ color: '#6E6E73' }}>неделя с {row.week_start}</span>
                  <div className="flex items-center gap-2">
                    <div
                      className="h-1.5 rounded-full"
                      style={{ background: '#30D158', width: `${Math.min(row.message_count * 3, 80)}px` }}
                    />
                    <span className="font-mono w-8 text-right" style={{ color: '#1D1D1F' }}>{row.message_count}</span>
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
      <div className="text-xs mb-0.5" style={{ color: '#AEAEB2' }}>{label}</div>
      <div className="text-sm font-medium" style={{ color: highlight ? '#FF9500' : '#1D1D1F' }}>{value}</div>
    </div>
  )
}
