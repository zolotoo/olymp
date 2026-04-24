'use client'
import { useEffect, useState } from 'react'
import { useTelegram, tgFetch } from './TelegramProvider'
import type { MemberRank } from '@/lib/types'

const RANK_ORDER: MemberRank[] = ['newcomer', 'member', 'active', 'champion', 'legend']

interface TitleInfo {
  rank: MemberRank
  label: string
  color: string
  month: number
  bonusPoints: number
  perks: string[]
}

interface ProfileResponse {
  isMember?: boolean
  member?: {
    rank: MemberRank
    points: number
    subscriptionCount: number
    joined_at?: string
  }
  titles?: TitleInfo[]
}

function daysWord(n: number) {
  const mod100 = n % 100
  const mod10 = n % 10
  if (mod100 >= 11 && mod100 <= 14) return 'дней'
  if (mod10 === 1) return 'день'
  if (mod10 >= 2 && mod10 <= 4) return 'дня'
  return 'дней'
}

export default function TitulTab({ reloadKey = 0 }: { reloadKey?: number }) {
  const { initData, ready, isTelegram } = useTelegram()
  const [data, setData] = useState<ProfileResponse | null>(null)
  const [selected, setSelected] = useState<MemberRank | null>(null)

  useEffect(() => {
    if (!ready || !isTelegram) return
    let cancelled = false
    tgFetch('/api/profile', initData)
      .then(r => r.json())
      .then(d => { if (!cancelled) setData(d) })
      .catch(() => { if (!cancelled) setData({ isMember: false }) })
    return () => { cancelled = true }
  }, [ready, isTelegram, initData, reloadKey])

  const points = data?.member?.points ?? 0
  const subCount = data?.member?.subscriptionCount ?? 1
  const joinedAt = data?.member?.joined_at ? new Date(data.member.joined_at) : null
  const currentRank: MemberRank = data?.member?.rank ?? 'newcomer'
  const currentIdx = RANK_ORDER.indexOf(currentRank)
  const titles = data?.titles ?? []
  const byRank: Record<string, TitleInfo> = {}
  for (const t of titles) byRank[t.rank] = t

  const cur = byRank[currentRank]
  const next = RANK_ORDER[currentIdx + 1] ? byRank[RANK_ORDER[currentIdx + 1]] : null
  const laterTitles = RANK_ORDER.slice(currentIdx + 2).map(r => byRank[r]).filter(Boolean)

  // Время до следующего титула отсчитывается от joined_at + subscription_count * 30 дней
  // (очередное продление Tribute → +1 к subscription_count → новый титул).
  const nextRenewal = joinedAt ? new Date(joinedAt.getTime() + subCount * 30 * 86400000) : null
  const daysLeft = nextRenewal
    ? Math.max(0, Math.ceil((nextRenewal.getTime() - Date.now()) / 86400000))
    : null
  const timeUntilNext = next
    ? daysLeft != null
      ? daysLeft === 0
        ? 'сегодня'
        : `через ${daysLeft} ${daysWord(daysLeft)}`
      : `через ${Math.max(0, next.month - subCount)} мес.`
    : ''

  const MILESTONES = RANK_ORDER.map((rank, i) => {
    const cfg = byRank[rank] ?? { label: rank, color: '#8E8E93', month: i + 1, bonusPoints: 0, perks: [], rank }
    const y = 580 - i * 130
    const x = i % 2 === 0 ? 100 : 260
    return { rank, cfg, x, y, reached: i <= currentIdx, isCurrent: i === currentIdx }
  })

  const pathD = MILESTONES.map((m, i) => {
    if (i === 0) return `M ${m.x} ${m.y}`
    const prev = MILESTONES[i - 1]
    const midY = (prev.y + m.y) / 2
    return `C ${prev.x} ${midY}, ${m.x} ${midY}, ${m.x} ${m.y}`
  }).join(' ')

  const activeMilestone = selected
    ? MILESTONES.find(m => m.rank === selected)!
    : MILESTONES[currentIdx]

  const activeCfg = activeMilestone.cfg

  return (
    <div className="max-w-xl mx-auto px-4 pb-8">
      <div className="text-center mb-4">
        <div
          className="text-xs font-semibold uppercase mb-2 inline-block rounded-full px-3 py-1"
          style={{
            color: cur?.color ?? '#8E8E93',
            letterSpacing: '0.8px',
            background: `${cur?.color ?? '#8E8E93'}14`,
            border: `1px solid ${cur?.color ?? '#8E8E93'}28`,
          }}
        >
          твой титул · {cur?.label ?? 'Адепт'}
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold mb-1 mt-3" style={{ color: '#1C1C1E', letterSpacing: '-1.2px', lineHeight: 1 }}>
          Путь на Олимп
        </h1>
        <p className="text-sm" style={{ color: 'rgba(28,28,30,0.55)' }}>
          {next
            ? `Следующий титул — ${next.label}, ${timeUntilNext}`
            : 'Ты достиг высшего титула'}
        </p>
      </div>

      <div className="rounded-3xl overflow-hidden" style={{
        background: 'linear-gradient(180deg, #E8F4FF 0%, #F5FBFF 60%, #FFFFFF 100%)',
        border: '1px solid rgba(10,132,255,0.10)',
        boxShadow: '0 8px 32px rgba(10,132,255,0.08)',
      }}>
        <svg viewBox="0 0 360 640" style={{ width: '100%', display: 'block' }}>
          <defs>
            <linearGradient id="mtn" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#C4DFF3" />
              <stop offset="100%" stopColor="#E8F4FF" stopOpacity="0.2" />
            </linearGradient>
            <linearGradient id="pathGrad" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor={cur?.color ?? '#8E8E93'} />
              <stop offset="100%" stopColor="#C7C7CC" />
            </linearGradient>
          </defs>

          <path
            d="M 0 640 L 0 400 L 60 320 L 120 380 L 180 240 L 240 340 L 300 280 L 360 360 L 360 640 Z"
            fill="url(#mtn)"
            opacity="0.8"
          />
          <path
            d="M 0 640 L 0 520 L 70 460 L 140 500 L 210 420 L 280 480 L 360 440 L 360 640 Z"
            fill="#D4E8F8"
            opacity="0.75"
          />

          <path d={pathD} fill="none" stroke="rgba(28,28,30,0.25)" strokeWidth="3" strokeDasharray="6 6" strokeLinecap="round" />

          {currentIdx > 0 && (
            <path
              d={MILESTONES.slice(0, currentIdx + 1).map((m, i) => {
                if (i === 0) return `M ${m.x} ${m.y}`
                const prev = MILESTONES[i - 1]
                const midY = (prev.y + m.y) / 2
                return `C ${prev.x} ${midY}, ${m.x} ${midY}, ${m.x} ${m.y}`
              }).join(' ')}
              fill="none"
              stroke="url(#pathGrad)"
              strokeWidth="4"
              strokeLinecap="round"
            />
          )}

          {MILESTONES.map((m) => {
            const isActive = m.rank === activeMilestone.rank
            const r = m.isCurrent ? 18 : 13
            return (
              <g key={m.rank} onClick={() => setSelected(m.rank)} style={{ cursor: 'pointer' }}>
                {m.isCurrent && (
                  <circle cx={m.x} cy={m.y} r={r + 8} fill={m.cfg.color} opacity="0.18">
                    <animate attributeName="r" values={`${r + 4};${r + 12};${r + 4}`} dur="2.4s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.28;0.08;0.28" dur="2.4s" repeatCount="indefinite" />
                  </circle>
                )}
                <circle
                  cx={m.x} cy={m.y} r={r}
                  fill={m.reached ? m.cfg.color : '#FFFFFF'}
                  stroke={isActive ? '#1C1C1E' : m.reached ? m.cfg.color : 'rgba(28,28,30,0.25)'}
                  strokeWidth={isActive ? 3 : 2}
                />
                {m.reached && (
                  <text x={m.x} y={m.y + 4} textAnchor="middle" fontSize="12" fontWeight="800" fill="#FFFFFF">✓</text>
                )}
                <g transform={`translate(${m.x < 180 ? m.x + 28 : m.x - 28}, ${m.y})`}>
                  <rect
                    x={m.x < 180 ? 0 : -108}
                    y={-14}
                    width="108"
                    height="28"
                    rx="14"
                    fill={m.reached ? '#FFFFFF' : 'rgba(255,255,255,0.75)'}
                    stroke={m.reached ? m.cfg.color : 'rgba(28,28,30,0.12)'}
                    strokeWidth="1"
                  />
                  <text
                    x={m.x < 180 ? 54 : -54}
                    y="5"
                    textAnchor="middle"
                    fontSize="12"
                    fontWeight="700"
                    fill={m.reached ? m.cfg.color : 'rgba(28,28,30,0.55)'}
                    style={{ letterSpacing: '-0.2px' }}
                  >
                    {m.cfg.label}
                  </text>
                </g>
              </g>
            )
          })}
        </svg>
      </div>

      {/* Current title card with perks */}
      <div
        className="rounded-2xl p-5 mt-4"
        style={{
          background: 'rgba(255,255,255,0.80)',
          backdropFilter: 'blur(24px) saturate(160%)',
          WebkitBackdropFilter: 'blur(24px) saturate(160%)',
          border: `1px solid ${activeCfg.color}28`,
          boxShadow: '0 8px 24px rgba(0,0,0,0.06)',
        }}
      >
        <div className="flex items-baseline justify-between mb-2">
          <div className="text-lg font-bold" style={{ color: '#1C1C1E', letterSpacing: '-0.4px' }}>
            {activeCfg.label}
          </div>
          <div className="text-xs font-semibold" style={{ color: activeCfg.color }}>
            {activeCfg.month}-й месяц
          </div>
        </div>
        {activeCfg.perks && activeCfg.perks.length > 0 ? (
          <ul className="text-sm" style={{ color: 'rgba(28,28,30,0.72)', lineHeight: 1.55 }}>
            {activeCfg.perks.map((perk, i) => (
              <li key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                <span style={{ color: activeCfg.color, fontWeight: 700 }}>•</span>
                <span>{perk}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-sm" style={{ color: 'rgba(28,28,30,0.55)' }}>
            Стартовый титул. Следующий — через месяц подписки.
          </div>
        )}
      </div>

      {/* Next title preview */}
      {next && (
        <div className="rounded-2xl p-5 mt-3" style={{ background: `linear-gradient(135deg, ${next.color}10 0%, ${next.color}04 100%)`, border: `1px solid ${next.color}28` }}>
          <div className="text-xs font-semibold uppercase mb-2" style={{ color: next.color, letterSpacing: '0.6px' }}>
            Следующий титул · {timeUntilNext}
          </div>
          <div className="text-base font-bold mb-2" style={{ color: '#1C1C1E', letterSpacing: '-0.3px' }}>
            {next.label}
          </div>
          {next.perks.length > 0 && (
            <ul className="text-sm" style={{ color: 'rgba(28,28,30,0.72)', lineHeight: 1.55 }}>
              {next.perks.map((perk, i) => (
                <li key={i} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                  <span style={{ color: next.color, fontWeight: 700 }}>+</span>
                  <span>{perk}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Future titles — collapsed */}
      {laterTitles.map((t) => {
        const isOpen = selected === t.rank
        return (
          <div
            key={t.rank}
            className="rounded-2xl mt-2 overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.66)', border: `1px solid ${t.color}20` }}
          >
            <button
              onClick={() => setSelected(isOpen ? null : t.rank)}
              className="w-full flex items-center justify-between px-5 py-3 text-left"
              style={{ cursor: 'pointer' }}
            >
              <div className="flex items-center gap-3">
                <div style={{ width: 8, height: 8, borderRadius: 4, background: t.color }} />
                <span className="text-sm font-semibold" style={{ color: '#1C1C1E', letterSpacing: '-0.3px' }}>
                  {t.label}
                </span>
                <span className="text-xs" style={{ color: 'rgba(28,28,30,0.45)' }}>
                  {t.month}-й месяц
                </span>
              </div>
              <span style={{ fontSize: 11, color: 'rgba(28,28,30,0.35)' }}>{isOpen ? '▲' : '▼'}</span>
            </button>
            {isOpen && t.perks.length > 0 && (
              <ul className="text-sm px-5 pb-4" style={{ color: 'rgba(28,28,30,0.72)', lineHeight: 1.55 }}>
                {t.perks.map((perk, i) => (
                  <li key={i} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                    <span style={{ color: t.color, fontWeight: 700 }}>+</span>
                    <span>{perk}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })}

      <div className="mt-4 rounded-2xl p-4" style={{ background: 'rgba(10,132,255,0.06)', border: '1px solid rgba(10,132,255,0.14)' }}>
        <div className="text-xs font-semibold uppercase mb-2" style={{ color: '#0A84FF', letterSpacing: '0.6px' }}>
          Как получить фантики
        </div>
        <ul className="text-xs" style={{ color: 'rgba(28,28,30,0.70)', lineHeight: 1.8 }}>
          <li>+3 за реакцию на твоё сообщение</li>
          <li>+5 за участие в опросе</li>
          <li>+10 за каждое продление подписки</li>
          <li>Также фантики могут выпасть в Колесе удачи</li>
        </ul>
        <div className="text-xs mt-2" style={{ color: 'rgba(28,28,30,0.55)' }}>
          У тебя сейчас <b style={{ color: '#1C1C1E' }}>{points}</b> фантиков.
        </div>
      </div>

      <div className="mt-3 rounded-2xl p-4" style={{ background: 'rgba(255,149,0,0.06)', border: '1px solid rgba(255,149,0,0.16)' }}>
        <div className="text-xs font-semibold uppercase mb-2" style={{ color: '#FF9500', letterSpacing: '0.6px' }}>
          Что купить в Киоске
        </div>
        <ul className="text-xs" style={{ color: 'rgba(28,28,30,0.70)', lineHeight: 1.8 }}>
          <li>Доп. попытку в Колесе</li>
          <li>Промокоды от партнёров</li>
          <li>Личный разбор и консультацию с Сергеем</li>
          <li>Закрытые гайды и эксклюзивный контент</li>
        </ul>
      </div>
    </div>
  )
}
