'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import type { StatsBundle, DayPoint, SourceKey } from '@/lib/stats'

interface Props {
  stats: StatsBundle
  currentPeriod: number | null     // 7 | 30 | 90 | null (если выбран конкретный день)
  singleDay: string | null         // YYYY-MM-DD если зашли в режим одного дня
}

const SOURCE_LABEL: Record<SourceKey | 'unknown', string> = {
  main:    'MAIN (база)',
  hochy:   'ХОЧУ',
  promts:  'ПРОМТЫ',
  claude:  'КЛОД',
  unknown: 'без источника',
}

const glassCard = {
  background: 'rgba(255,255,255,0.72)',
  backdropFilter: 'blur(28px) saturate(160%)',
  WebkitBackdropFilter: 'blur(28px) saturate(160%)',
  border: '1px solid rgba(255,255,255,0.55)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.10)',
} as const

function formatDelta(curr: number, prev: number): { text: string; positive: boolean | null } {
  if (prev === 0) return { text: curr === 0 ? '—' : '+∞', positive: curr > 0 ? true : null }
  const delta = ((curr - prev) / prev) * 100
  const sign = delta > 0 ? '+' : ''
  return { text: `${sign}${delta.toFixed(1)}%`, positive: delta > 0 ? true : delta < 0 ? false : null }
}

function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`
}

function fmtDate(d: string): string {
  const date = new Date(d + 'T00:00:00.000Z')
  return date.toLocaleDateString('ru', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

export default function StatsClient({ stats, currentPeriod, singleDay }: Props) {
  const router = useRouter()
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  const setPeriod = (p: number) => router.push(`/stats?period=${p}`)
  const goToDay = (d: string) => router.push(`/stats?from=${d}&to=${d}`)
  const backToPeriod = () => router.push(`/stats?period=30`)

  // KPI карточки
  const t = stats.totals
  const p = stats.prev_totals
  const conv = stats.conversion
  const ret = stats.retention

  interface Kpi { label: string; value: number; prev: number; isPct?: boolean }
  const kpis: Kpi[] = [
    { label: 'Новые в боте',  value: t.new_users,                prev: p.new_users },
    { label: 'Оплат',         value: t.payments,                 prev: p.payments },
    { label: 'Конверсия',     value: conv.start_to_payment_pct,  prev: prevConv(p), isPct: true },
    { label: 'Чистый рост',   value: t.net_growth,               prev: p.net_growth },
  ]

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div className="rounded-3xl px-6 py-5" style={glassCard}>
          <div className="text-xs font-semibold uppercase mb-2" style={{ color: 'rgba(28,28,30,0.42)', letterSpacing: '0.8px' }}>
            Аналитика
          </div>
          <h1 className="text-3xl font-bold" style={{ color: '#1C1C1E', letterSpacing: '-1px', lineHeight: 1.1 }}>
            Статистика
          </h1>
          <p className="text-sm mt-1" style={{ color: 'rgba(28,28,30,0.50)', letterSpacing: '-0.2px' }}>
            {singleDay
              ? <>Один день: <b>{fmtDate(singleDay)}</b> · <button onClick={backToPeriod} style={{ color: '#0A84FF', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>← к периоду</button></>
              : `Период: ${stats.range.days} ${stats.range.days === 1 ? 'день' : 'дней'} · клик по дню в графике откроет детали`}
          </p>
        </div>

        {/* Period switch */}
        {!singleDay && (
          <div className="rounded-3xl px-2 py-2" style={glassCard}>
            <div style={{ display: 'flex', gap: 4 }}>
              {[7, 30, 90].map(d => (
                <button key={d} onClick={() => setPeriod(d)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 16,
                    fontSize: 13.5, fontWeight: 600,
                    border: 'none', cursor: 'pointer',
                    background: currentPeriod === d ? '#0A84FF' : 'transparent',
                    color: currentPeriod === d ? '#FFF' : 'rgba(28,28,30,0.65)',
                    transition: 'background 0.12s, color 0.12s',
                  }}>
                  {d} дней
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 20 }}>
        {kpis.map(k => {
          const delta = formatDelta(k.value, k.prev)
          const deltaColor = delta.positive === true ? '#1C8A3C' : delta.positive === false ? '#FF453A' : 'rgba(28,28,30,0.45)'
          return (
            <div key={k.label} className="rounded-3xl px-5 py-4" style={glassCard}>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'rgba(28,28,30,0.50)' }}>
                {k.label}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 6 }}>
                <span style={{ fontSize: 32, fontWeight: 700, color: '#1C1C1E', letterSpacing: '-1px', lineHeight: 1 }}>
                  {k.isPct ? fmtPct(k.value) : k.value.toLocaleString('ru')}
                </span>
                {!singleDay && (
                  <span style={{ fontSize: 12, fontWeight: 600, color: deltaColor }}>
                    {delta.text}
                  </span>
                )}
              </div>
              {!singleDay && (
                <div style={{ fontSize: 11, color: 'rgba(28,28,30,0.42)', marginTop: 4 }}>
                  пред. период: {k.isPct ? fmtPct(k.prev) : k.prev.toLocaleString('ru')}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Secondary row: воронка + retention */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, marginBottom: 20 }}>
        <div className="rounded-3xl px-5 py-4" style={glassCard}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'rgba(28,28,30,0.50)', marginBottom: 12 }}>
            Воронка продаж
          </div>
          <FunnelStep label="Получили sales" value={t.sales_sent} pct={null} />
          <FunnelStep label="Кликнули по кнопке" value={t.clicks} pct={conv.sales_to_click_pct} />
          <FunnelStep label="Оплатили" value={t.payments} pct={conv.click_to_payment_pct} last />
        </div>

        <div className="rounded-3xl px-5 py-4" style={glassCard}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'rgba(28,28,30,0.50)', marginBottom: 12 }}>
            Retention (когорты)
          </div>
          <RetentionRow label="Через 30 дней" pct={ret.day_30_pct} cohort={ret.cohort_30} />
          <RetentionRow label="Через 60 дней" pct={ret.day_60_pct} cohort={ret.cohort_60} />
          <RetentionRow label="Через 90+ дней" pct={ret.day_90_pct} cohort={ret.cohort_90} />
          <div style={{ fontSize: 11, color: 'rgba(28,28,30,0.42)', marginTop: 8 }}>
            % оставшихся active в когорте «вступили N дней назад»
          </div>
        </div>

        <div className="rounded-3xl px-5 py-4" style={glassCard}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'rgba(28,28,30,0.50)', marginBottom: 12 }}>
            Активность
          </div>
          <SmallStat label="Открытия мини-апп"   value={t.miniapp_opens} />
          <SmallStat label="Спинов колеса"        value={t.wheel_spins} />
          <SmallStat label="DM-сообщений (вход.)" value={t.dm_messages} />
          <SmallStat label="Отписок"              value={t.cancellations} negative />
        </div>
      </div>

      {/* Daily chart */}
      {!singleDay && stats.by_day.length > 1 && (
        <div className="rounded-3xl px-5 py-4 mb-5" style={glassCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'rgba(28,28,30,0.50)' }}>
              По дням · клик откроет детали
            </div>
          </div>
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={stats.by_day} onClick={(e) => {
                const day = (e?.activePayload?.[0]?.payload as DayPoint | undefined)?.date
                if (day) goToDay(day)
              }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'rgba(28,28,30,0.55)' }}
                  tickFormatter={fmtDate} />
                <YAxis tick={{ fontSize: 11, fill: 'rgba(28,28,30,0.55)' }} />
                <Tooltip
                  contentStyle={{ background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12, fontSize: 12 }}
                  labelFormatter={(label: string) => fmtDate(label)}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="new_users"  name="Новые"     fill="#0A84FF" />
                <Bar dataKey="sales_sent" name="Sales"     fill="#FF9500" />
                <Bar dataKey="clicks"     name="Клики"     fill="#BF5AF2" />
                <Bar dataKey="payments"   name="Оплаты"    fill="#34C759" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Daily table — drill-down */}
      <div className="rounded-3xl mb-5" style={{ ...glassCard, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px 8px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'rgba(28,28,30,0.50)' }}>
            Подневная таблица
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                {['Дата', 'Новые', '/start', 'Sales', 'Клики', 'Оплат', 'Отпис.', 'Мини-апп', 'DM', 'Колесо'].map(h => (
                  <th key={h} style={{ textAlign: h === 'Дата' ? 'left' : 'right', padding: '10px 14px', fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'rgba(28,28,30,0.50)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...stats.by_day].reverse().map(d => {
                const isExpanded = expandedRow === d.date
                return (
                  <tr key={d.date}
                    onClick={() => setExpandedRow(isExpanded ? null : d.date)}
                    onDoubleClick={() => goToDay(d.date)}
                    style={{
                      borderBottom: '1px solid rgba(0,0,0,0.04)',
                      cursor: 'pointer',
                      background: isExpanded ? 'rgba(10,132,255,0.04)' : 'transparent',
                    }}
                    title="Клик — подсветить, двойной клик — открыть только этот день">
                    <td style={{ padding: '8px 14px', fontWeight: 500, color: '#1C1C1E' }}>{fmtDate(d.date)}</td>
                    <Cell n={d.new_users} accent="#0A84FF" />
                    <Cell n={d.starts} />
                    <Cell n={d.sales_sent} />
                    <Cell n={d.clicks} accent="#BF5AF2" />
                    <Cell n={d.payments} accent="#34C759" />
                    <Cell n={d.cancellations} accent={d.cancellations ? '#FF453A' : undefined} />
                    <Cell n={d.miniapp_opens} />
                    <Cell n={d.dm_messages} />
                    <Cell n={d.wheel_spins} />
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sources */}
      <div className="rounded-3xl mb-5" style={{ ...glassCard, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px 8px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'rgba(28,28,30,0.50)' }}>
            Источники · {stats.range.days === 1 ? 'за день' : `за ${stats.range.days} дней`}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(28,28,30,0.42)', marginTop: 4 }}>
            Клики/оплаты считаются по всему жизненному циклу юзера, не ограничиваясь периодом
          </div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
              {['Источник', 'Пришло', 'Sales', 'Клики', 'CTR', 'Оплат', 'Конверсия'].map((h, i) => (
                <th key={h} style={{ textAlign: i === 0 ? 'left' : 'right', padding: '10px 14px', fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'rgba(28,28,30,0.50)' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {stats.by_source.map(r => (
              <tr key={r.source} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                <td style={{ padding: '10px 14px', fontWeight: 600, color: '#1C1C1E' }}>{SOURCE_LABEL[r.source]}</td>
                <Cell n={r.came} accent="#0A84FF" />
                <Cell n={r.got_sales} />
                <Cell n={r.clicked} accent="#BF5AF2" />
                <td style={{ padding: '10px 14px', textAlign: 'right', color: 'rgba(28,28,30,0.65)' }}>{fmtPct(r.ctr_pct)}</td>
                <Cell n={r.paid} accent="#34C759" />
                <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: r.conv_pct >= 10 ? '#1C8A3C' : '#1C1C1E' }}>{fmtPct(r.conv_pct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Cell({ n, accent }: { n: number; accent?: string }) {
  return (
    <td style={{ padding: '10px 14px', textAlign: 'right', color: n > 0 ? (accent || '#1C1C1E') : 'rgba(28,28,30,0.30)', fontWeight: n > 0 ? 600 : 400 }}>
      {n > 0 ? n.toLocaleString('ru') : '—'}
    </td>
  )
}

function FunnelStep({ label, value, pct, last }: { label: string; value: number; pct: number | null; last?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: last ? 'none' : '1px solid rgba(0,0,0,0.05)' }}>
      <span style={{ color: 'rgba(28,28,30,0.65)', fontSize: 13 }}>{label}</span>
      <span style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
        {pct !== null && pct > 0 && (
          <span style={{ fontSize: 11, color: 'rgba(28,28,30,0.45)' }}>{fmtPct(pct)}</span>
        )}
        <span style={{ fontWeight: 700, color: '#1C1C1E', fontSize: 16 }}>{value.toLocaleString('ru')}</span>
      </span>
    </div>
  )
}

function RetentionRow({ label, pct, cohort }: { label: string; pct: number; cohort: number }) {
  const color = pct >= 60 ? '#1C8A3C' : pct >= 30 ? '#FF9500' : '#FF453A'
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 12.5, color: 'rgba(28,28,30,0.65)' }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color }}>
          {fmtPct(pct)} <span style={{ fontWeight: 400, fontSize: 11, color: 'rgba(28,28,30,0.40)' }}>(n={cohort})</span>
        </span>
      </div>
      <div style={{ height: 4, background: 'rgba(0,0,0,0.06)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: color, transition: 'width 0.3s' }} />
      </div>
    </div>
  )
}

function SmallStat({ label, value, negative }: { label: string; value: number; negative?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
      <span style={{ color: 'rgba(28,28,30,0.65)', fontSize: 13 }}>{label}</span>
      <span style={{ fontWeight: 600, color: negative && value > 0 ? '#FF453A' : '#1C1C1E', fontSize: 14 }}>
        {value.toLocaleString('ru')}
      </span>
    </div>
  )
}

// helper для вычисления prev-конверсии (нужен %)
function prevConv(prev: { new_users: number; payments: number }): number {
  return prev.new_users ? (prev.payments / prev.new_users) * 100 : 0
}
