import Link from 'next/link'
import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'
import { AUDIENCE_LABELS } from '@/lib/audience-resolver'
import SendDraftButton from './SendDraftButton'

export const dynamic = 'force-dynamic'

interface BroadcastRow {
  id: string
  title: string
  text: string
  audience: string
  cta_url: string | null
  cta_label: string | null
  status: string
  created_at: string
  started_at: string | null
  finished_at: string | null
  total_targeted: number
  total_delivered: number
  total_failed: number
}

interface DeliveryRow {
  id: string
  tg_id: number
  delivered: boolean
  error_text: string | null
  sent_at: string
  engaged_at: string | null
  engagement_kind: string | null
}

const card = {
  background: 'rgba(255,255,255,0.78)',
  backdropFilter: 'blur(28px) saturate(160%)',
  WebkitBackdropFilter: 'blur(28px) saturate(160%)',
  border: '1px solid rgba(255,255,255,0.55)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
}

export default async function BroadcastDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [{ data: broadcast }, { data: deliveries }] = await Promise.all([
    supabaseAdmin.from('broadcasts').select('*').eq('id', id).maybeSingle(),
    supabaseAdmin
      .from('message_deliveries')
      .select('id, tg_id, delivered, error_text, sent_at, engaged_at, engagement_kind')
      .eq('broadcast_id', id)
      .order('sent_at', { ascending: false })
      .limit(500),
  ])
  if (!broadcast) notFound()
  const b = broadcast as BroadcastRow
  const d = (deliveries as DeliveryRow[] | null) ?? []
  const engagedCount = d.filter((x) => x.engaged_at).length

  return (
    <div className="space-y-5 max-w-4xl">
      <Link href="/broadcasts" className="text-sm font-medium" style={{ color: '#0A84FF' }}>
        ← Все рассылки
      </Link>

      <div className="rounded-2xl p-6" style={card}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold mb-1" style={{ color: '#1C1C1E', letterSpacing: '-0.5px' }}>
              {b.title}
            </h1>
            <div className="text-sm" style={{ color: 'rgba(28,28,30,0.6)' }}>
              {AUDIENCE_LABELS[b.audience as keyof typeof AUDIENCE_LABELS] || b.audience}
            </div>
            <div className="text-xs mt-1" style={{ color: 'rgba(28,28,30,0.45)' }}>
              Статус: <b>{b.status}</b> · создана {new Date(b.created_at).toLocaleString('ru-RU')}
            </div>
          </div>
          {b.status === 'draft' && <SendDraftButton broadcastId={b.id} />}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5 pt-5" style={{ borderTop: '1px solid rgba(28,28,30,0.08)' }}>
          <Stat label="Цель" value={b.total_targeted} />
          <Stat label="Доставлено" value={b.total_delivered} color="#30D158" />
          <Stat label="Ошибки" value={b.total_failed} color={b.total_failed > 0 ? '#FF3B30' : undefined} />
          <Stat
            label="Engagement"
            value={`${engagedCount} (${b.total_delivered ? Math.round((engagedCount / b.total_delivered) * 100) : 0}%)`}
            color="#0A84FF"
          />
        </div>
      </div>

      <div className="rounded-2xl p-6" style={card}>
        <h2 className="font-semibold mb-3" style={{ color: '#1C1C1E' }}>Текст</h2>
        <div className="text-sm whitespace-pre-wrap p-4 rounded-xl" style={{ background: 'rgba(28,28,30,0.04)', color: '#1C1C1E' }}>
          {b.text}
        </div>
        {b.cta_url && (
          <div className="mt-3 text-sm" style={{ color: 'rgba(28,28,30,0.7)' }}>
            CTA: <span className="font-mono">{b.cta_label || 'кнопка'}</span> → <span className="font-mono">{b.cta_url}</span>
          </div>
        )}
      </div>

      <div className="rounded-2xl p-6" style={card}>
        <h2 className="font-semibold mb-3" style={{ color: '#1C1C1E' }}>
          Доставки · {d.length}
        </h2>
        {d.length === 0 ? (
          <p className="text-sm" style={{ color: '#AEAEB2' }}>Пока пусто</p>
        ) : (
          <div className="space-y-1.5 max-h-[60vh] overflow-y-auto pr-1">
            {d.map((row) => (
              <div key={row.id} className="flex items-center justify-between gap-2 text-sm">
                <Link href={`/audience/${row.tg_id}`} className="font-mono text-xs" style={{ color: '#0A84FF' }}>
                  {row.tg_id}
                </Link>
                <div className="flex items-center gap-2">
                  {row.delivered ? (
                    <span style={{ color: '#30D158', fontSize: 11 }}>✓ доставлено</span>
                  ) : (
                    <span style={{ color: '#FF3B30', fontSize: 11 }}>✗ {row.error_text?.slice(0, 50)}</span>
                  )}
                  {row.engaged_at && (
                    <span style={{ color: '#0A84FF', fontSize: 11 }}>
                      · {row.engagement_kind}
                    </span>
                  )}
                  <span className="text-xs" style={{ color: '#AEAEB2' }}>
                    {new Date(row.sent_at).toLocaleString('ru', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div>
      <div className="text-xs mb-0.5 font-semibold uppercase" style={{ letterSpacing: '0.6px', color: 'rgba(28,28,30,0.45)' }}>
        {label}
      </div>
      <div className="text-2xl font-bold" style={{ color: color || '#1C1C1E', letterSpacing: '-0.5px' }}>
        {value}
      </div>
    </div>
  )
}
