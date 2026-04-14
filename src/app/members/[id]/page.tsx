import { notFound } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { getMemories } from '@/lib/mem0'
import { RANK_CONFIG } from '@/lib/ranks'
import type { MemberRank } from '@/lib/types'

export const revalidate = 60

export default async function MemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [{ data: member }, { data: events }, { data: pointsLog }, { data: activity }] =
    await Promise.all([
      supabase.from('members').select('*').eq('id', id).single(),
      supabase.from('events_log').select('*').eq('member_id', id).order('triggered_at', { ascending: false }).limit(20),
      supabase.from('points_log').select('*').eq('member_id', id).order('created_at', { ascending: false }).limit(20),
      supabase.from('activity_log').select('*').eq('member_id', id).order('week_start', { ascending: false }).limit(8),
    ])

  if (!member) notFound()

  const memories = await getMemories(String(member.tg_id))
  const rank = RANK_CONFIG[member.rank as MemberRank]

  return (
    <div className="max-w-4xl">
      <Link href="/" className="text-sm text-gray-500 hover:text-white mb-6 inline-block">
        ← Назад
      </Link>

      {/* Header */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              {member.tg_first_name || member.tg_username || String(member.tg_id)}
              {member.tg_last_name && ` ${member.tg_last_name}`}
            </h1>
            {member.tg_username && (
              <div className="text-gray-400 mt-0.5">@{member.tg_username}</div>
            )}
            <div className={`mt-2 font-medium ${rank.color}`}>
              {rank.emoji} {rank.label}
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{member.points.toLocaleString()}</div>
            <div className="text-gray-500 text-sm">баллов</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-800 text-sm">
          <div>
            <div className="text-gray-500">Вступил</div>
            <div>{new Date(member.joined_at).toLocaleDateString('ru')}</div>
          </div>
          <div>
            <div className="text-gray-500">Последняя активность</div>
            <div>{member.last_active ? new Date(member.last_active).toLocaleDateString('ru') : '—'}</div>
          </div>
          <div>
            <div className="text-gray-500">Статус</div>
            <div className={member.status === 'active' ? 'text-green-400' : 'text-red-400'}>
              {member.status === 'active' ? 'Активен' : 'Вышел'}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Weekly activity */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="font-semibold mb-4">Активность по неделям</h2>
          {(activity || []).length === 0 ? (
            <p className="text-gray-500 text-sm">Нет данных</p>
          ) : (
            <div className="space-y-2">
              {(activity || []).map((row) => (
                <div key={row.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">{row.week_start}</span>
                  <span className="font-mono">{row.message_count} сообщ.</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Points log */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="font-semibold mb-4">История баллов</h2>
          {(pointsLog || []).length === 0 ? (
            <p className="text-gray-500 text-sm">Нет данных</p>
          ) : (
            <div className="space-y-2">
              {(pointsLog || []).map((row) => (
                <div key={row.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">{row.reason}</span>
                  <span className="text-green-400 font-mono">+{row.points}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Mem0 memories */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="font-semibold mb-4">Память (Mem0)</h2>
          {!memories?.results?.length ? (
            <p className="text-gray-500 text-sm">Память пуста</p>
          ) : (
            <div className="space-y-3">
              {memories.results.slice(0, 5).map((m: { id: string; memory: string }) => (
                <div key={m.id} className="text-sm text-gray-300 border-l-2 border-indigo-600 pl-3">
                  {m.memory}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Events log */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="font-semibold mb-4">Триггеры</h2>
          {(events || []).length === 0 ? (
            <p className="text-gray-500 text-sm">Нет событий</p>
          ) : (
            <div className="space-y-2">
              {(events || []).map((e) => (
                <div key={e.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-400 font-mono">{e.event_type}</span>
                  <span className="text-gray-600 text-xs">
                    {new Date(e.triggered_at).toLocaleDateString('ru')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
