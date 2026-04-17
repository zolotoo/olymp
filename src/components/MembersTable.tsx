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
      <div className="text-center py-16" style={{ color: '#AEAEB2' }}>
        Участники появятся здесь после вступления в канал
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left" style={{ borderBottom: '1px solid #E5E5EA' }}>
            {['Участник', 'Ранг', 'Листики 🍃', 'За неделю', 'Всего', 'Активность', 'Статус'].map((h, i) => (
              <th
                key={h}
                className={`pb-3 font-medium text-xs${i >= 2 ? ' text-right' : ''}`}
                style={{ color: '#6E6E73', letterSpacing: '0.3px', textTransform: 'uppercase' }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {members.map((m) => {
            const rank = RANK_CONFIG[m.rank]
            const isAtRisk = !m.last_active ||
              Date.now() - new Date(m.last_active).getTime() > 7 * 24 * 60 * 60 * 1000

            return (
              <tr
                key={m.id}
                className="member-row"
                style={{ borderBottom: '1px solid #F2F2F7' }}
              >
                <td className="py-3">
                  <Link href={`/members/${m.id}`} className="hover:underline transition-colors">
                    <div className="font-medium" style={{ color: '#1D1D1F' }}>
                      {m.tg_first_name || m.tg_username || String(m.tg_id)}
                    </div>
                    {m.tg_username && (
                      <div className="text-xs" style={{ color: '#0A84FF' }}>@{m.tg_username}</div>
                    )}
                  </Link>
                </td>
                <td className="py-3">
                  <span className="text-sm font-medium" style={{ color: rank.color }}>
                    {rank.emoji} {rank.label}
                  </span>
                </td>
                <td className="py-3 text-right font-mono font-semibold" style={{ color: '#1D1D1F' }}>
                  {m.points.toLocaleString()}
                </td>
                <td className="py-3 text-right">
                  <span style={{ color: m.messages_this_week > 0 ? '#30D158' : '#C7C7CC' }}>
                    {m.messages_this_week}
                  </span>
                </td>
                <td className="py-3 text-right" style={{ color: '#6E6E73' }}>{m.total_messages}</td>
                <td className="py-3 text-right text-xs" style={{ color: '#AEAEB2' }}>{daysSince(m.last_active)}</td>
                <td className="py-3 text-right">
                  {m.status === 'churned' ? (
                    <StatusChip label="вышел" bg="rgba(255,59,48,0.1)" color="#FF3B30" />
                  ) : isAtRisk ? (
                    <StatusChip label="риск" bg="rgba(255,149,0,0.1)" color="#FF9500" />
                  ) : (
                    <StatusChip label="активен" bg="rgba(48,209,88,0.1)" color="#30D158" />
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

function StatusChip({ label, bg, color }: { label: string; bg: string; color: string }) {
  return (
    <span
      className="text-xs px-2.5 py-1 rounded-full font-medium"
      style={{ background: bg, color }}
    >
      {label}
    </span>
  )
}
