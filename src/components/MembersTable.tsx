import Link from 'next/link'
import type { MemberWithActivity } from '@/lib/types'
import { RANK_CONFIG } from '@/lib/ranks'

function daysSince(date: string | null): string {
  if (!date) return 'никогда'
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24))
  if (diff === 0) return 'сегодня'
  if (diff === 1) return 'вчера'
  return `${diff}д назад`
}

export default function MembersTable({ members }: { members: MemberWithActivity[] }) {
  if (members.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500">
        Участники появятся здесь после вступления в канал
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-400 border-b border-gray-800">
            <th className="pb-3 font-medium">Участник</th>
            <th className="pb-3 font-medium">Ранг</th>
            <th className="pb-3 font-medium text-right">Баллы</th>
            <th className="pb-3 font-medium text-right">За неделю</th>
            <th className="pb-3 font-medium text-right">Всего</th>
            <th className="pb-3 font-medium text-right">Активность</th>
            <th className="pb-3 font-medium text-right">Статус</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800/50">
          {members.map((m) => {
            const rank = RANK_CONFIG[m.rank]
            const isAtRisk = !m.last_active ||
              Date.now() - new Date(m.last_active).getTime() > 7 * 24 * 60 * 60 * 1000

            return (
              <tr key={m.id} className="hover:bg-gray-900/50 transition-colors">
                <td className="py-3">
                  <Link href={`/members/${m.id}`} className="hover:text-indigo-400 transition-colors">
                    <div className="font-medium">{m.tg_first_name || m.tg_username || String(m.tg_id)}</div>
                    {m.tg_username && (
                      <div className="text-gray-500 text-xs">@{m.tg_username}</div>
                    )}
                  </Link>
                </td>
                <td className="py-3">
                  <span className={`${rank.color} font-medium`}>
                    {rank.emoji} {rank.label}
                  </span>
                </td>
                <td className="py-3 text-right font-mono">{m.points.toLocaleString()}</td>
                <td className="py-3 text-right">
                  <span className={m.messages_this_week > 0 ? 'text-green-400' : 'text-gray-600'}>
                    {m.messages_this_week}
                  </span>
                </td>
                <td className="py-3 text-right text-gray-400">{m.total_messages}</td>
                <td className="py-3 text-right text-gray-400 text-xs">{daysSince(m.last_active)}</td>
                <td className="py-3 text-right">
                  {m.status === 'churned' ? (
                    <span className="text-xs bg-red-900/40 text-red-400 px-2 py-0.5 rounded-full">вышел</span>
                  ) : isAtRisk ? (
                    <span className="text-xs bg-yellow-900/40 text-yellow-400 px-2 py-0.5 rounded-full">риск</span>
                  ) : (
                    <span className="text-xs bg-green-900/40 text-green-400 px-2 py-0.5 rounded-full">активен</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
