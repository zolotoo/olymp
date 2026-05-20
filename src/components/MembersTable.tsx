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
      <div className="text-center py-16 dk-muted-2">
        Участники появятся здесь после вступления в канал
      </div>
    )
  }

  const tierFor = (n: number) => {
    if (n === 0) return { label: 'мертвяк', bg: 'rgba(229,72,77,0.10)',  color: '#E5484D' }
    if (n < 3)   return { label: 'тихий',   bg: 'rgba(245,158,11,0.12)', color: '#B45309' }
    if (n < 10)  return { label: 'живой',   bg: 'var(--dk-brand-soft)',  color: 'var(--dk-brand-ink)' }
    return          { label: 'активный',    bg: 'rgba(16,185,129,0.12)', color: '#047857' }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ borderBottom: '1px solid var(--dk-border-strong)' }}>
            {['Участник', 'Титул', 'Фантики', 'За неделю', 'Всего', 'Активность', 'Статус'].map((h, i) => (
              <th
                key={h}
                className={`pb-3 font-bold text-xs${i >= 2 ? ' text-right' : ''}`}
                style={{ color: 'var(--dk-text-3)', letterSpacing: '0.5px', textTransform: 'uppercase' }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {members.map((m) => {
            const rank = RANK_CONFIG[m.rank]
            const tier = tierFor(m.messages_this_week)

            return (
              <tr
                key={m.id}
                className="member-row"
                style={{ borderBottom: '1px solid var(--dk-border)' }}
              >
                <td className="py-3">
                  <Link href={`/members/${m.id}`} className="hover:opacity-70 transition-opacity">
                    <div className="font-semibold" style={{ color: 'var(--dk-text-1)', letterSpacing: '-0.3px' }}>
                      {m.tg_first_name || m.tg_username || String(m.tg_id)}
                    </div>
                    {m.tg_username && (
                      <div className="text-xs mt-0.5" style={{ color: 'var(--dk-brand)', letterSpacing: '-0.1px', fontWeight: 500 }}>
                        @{m.tg_username}
                      </div>
                    )}
                  </Link>
                </td>
                <td className="py-3">
                  <span className="text-sm font-medium" style={{ color: rank.color, letterSpacing: '-0.2px' }}>
                    {rank.emoji} {rank.label}
                  </span>
                </td>
                <td className="py-3 text-right font-mono font-bold" style={{ color: 'var(--dk-text-1)', letterSpacing: '-0.5px' }}>
                  {m.points.toLocaleString()}
                </td>
                <td className="py-3 text-right">
                  <span style={{ color: m.messages_this_week > 0 ? '#047857' : 'var(--dk-text-3)', fontWeight: m.messages_this_week > 0 ? 600 : 400 }}>
                    {m.messages_this_week}
                  </span>
                </td>
                <td className="py-3 text-right dk-muted">{m.total_messages}</td>
                <td className="py-3 text-right text-xs dk-muted-2">{daysSince(m.last_active)}</td>
                <td className="py-3 text-right">
                  {m.status === 'churned' ? (
                    <StatusChip label="вышел" bg="rgba(15,23,42,0.06)" color="#64748B" />
                  ) : (
                    <StatusChip label={tier.label} bg={tier.bg} color={tier.color} />
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
    <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background: bg, color }}>
      {label}
    </span>
  )
}
