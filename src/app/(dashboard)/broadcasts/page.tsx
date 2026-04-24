import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase'
import { AUDIENCE_LABELS, type AudienceKind } from '@/lib/audience-resolver'

export const metadata = { title: 'Рассылки · AI Олимп' }
export const dynamic = 'force-dynamic'

interface Broadcast {
  id: string
  title: string
  audience: AudienceKind
  status: string
  created_at: string
  total_targeted: number
  total_delivered: number
  total_failed: number
}

export default async function BroadcastsPage() {
  const { data: broadcasts } = await supabaseAdmin
    .from('broadcasts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)

  const list = (broadcasts as Broadcast[] | null) ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-1" style={{ color: '#1C1C1E', letterSpacing: '-0.8px' }}>
            Рассылки
          </h1>
          <p className="text-sm" style={{ color: 'rgba(28,28,30,0.55)' }}>
            Сообщения по когортам с per-recipient логированием. Доставки → карточка пользователя.
          </p>
        </div>
        <Link
          href="/broadcasts/new"
          className="px-4 py-2 rounded-xl text-sm font-semibold"
          style={{ background: '#0A84FF', color: '#fff' }}
        >
          + Новая рассылка
        </Link>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid rgba(28,28,30,0.08)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'rgba(28,28,30,0.03)' }}>
              <Th>Название</Th>
              <Th>Аудитория</Th>
              <Th>Статус</Th>
              <Th className="text-right">Цель / Доставлено / Ошибки</Th>
              <Th>Создана</Th>
            </tr>
          </thead>
          <tbody>
            {list.map((b) => (
              <tr key={b.id} style={{ borderTop: '1px solid rgba(28,28,30,0.06)' }}>
                <Td>
                  <Link href={`/broadcasts/${b.id}`} className="block">
                    <div style={{ fontWeight: 500, color: '#1C1C1E' }}>{b.title}</div>
                  </Link>
                </Td>
                <Td style={{ color: 'rgba(28,28,30,0.7)' }}>{AUDIENCE_LABELS[b.audience] || b.audience}</Td>
                <Td>
                  <StatusBadge status={b.status} />
                </Td>
                <Td className="text-right" style={{ fontFamily: 'ui-monospace, monospace' }}>
                  <span>{b.total_targeted}</span>
                  <span style={{ color: '#30D158' }}> · {b.total_delivered}</span>
                  {b.total_failed > 0 && <span style={{ color: '#FF3B30' }}> · {b.total_failed}</span>}
                </Td>
                <Td style={{ color: 'rgba(28,28,30,0.55)' }}>
                  {new Date(b.created_at).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && (
          <div className="text-center py-10 text-sm" style={{ color: 'rgba(28,28,30,0.45)' }}>
            Рассылок пока нет
          </div>
        )}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: string; label: string }> = {
    draft: { color: '#8E8E93', label: 'черновик' },
    sending: { color: '#FF9500', label: 'отправляется' },
    sent: { color: '#30D158', label: 'отправлено' },
    failed: { color: '#FF3B30', label: 'ошибка' },
  }
  const m = map[status] ?? { color: '#8E8E93', label: status }
  return (
    <span style={{
      display: 'inline-block', padding: '3px 8px', borderRadius: 8,
      background: `${m.color}18`, color: m.color, fontSize: 11, fontWeight: 600,
    }}>
      {m.label}
    </span>
  )
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={className}
      style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'rgba(28,28,30,0.55)' }}
    >
      {children}
    </th>
  )
}
function Td({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return <td className={className} style={{ padding: '12px 14px', ...style }}>{children}</td>
}
