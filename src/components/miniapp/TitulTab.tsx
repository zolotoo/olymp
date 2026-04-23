'use client'
import { useEffect, useState } from 'react'
import { useTelegram, tgFetch } from './TelegramProvider'
import { RANK_CONFIG } from '@/lib/ranks'
import type { MemberRank } from '@/lib/types'

const RANK_ORDER: MemberRank[] = ['newcomer', 'member', 'active', 'champion', 'legend']

interface ProfileResponse {
  isMember?: boolean
  points?: number
  rank?: MemberRank
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

  const points = data?.points ?? 0
  const currentRank = data?.rank ?? 'newcomer'
  const currentIdx = RANK_ORDER.indexOf(currentRank)

  const nextRank = RANK_ORDER[currentIdx + 1]
  const nextCfg = nextRank ? RANK_CONFIG[nextRank] : null
  const pointsToNext = nextCfg ? Math.max(0, nextCfg.minPoints - points) : 0

  // Layout: zig-zag path with one milestone per rank, bottom (Адепт) → top (Бог).
  // SVG viewBox 360×640. Milestones placed along a gentle S-curve.
  const MILESTONES = RANK_ORDER.map((rank, i) => {
    const cfg = RANK_CONFIG[rank]
    const y = 580 - i * 130
    const x = i % 2 === 0 ? 100 : 260
    return { rank, cfg, x, y, reached: i <= currentIdx, isCurrent: i === currentIdx }
  })

  // Build a smooth path through all milestones for the tropa.
  const pathD = MILESTONES.map((m, i) => {
    if (i === 0) return `M ${m.x} ${m.y}`
    const prev = MILESTONES[i - 1]
    const midY = (prev.y + m.y) / 2
    return `C ${prev.x} ${midY}, ${m.x} ${midY}, ${m.x} ${m.y}`
  }).join(' ')

  const activeMilestone = selected
    ? MILESTONES.find(m => m.rank === selected)!
    : MILESTONES[currentIdx]

  return (
    <div className="max-w-xl mx-auto px-4 pb-8">
      <div className="text-center mb-4">
        <div
          className="text-xs font-semibold uppercase mb-2 inline-block rounded-full px-3 py-1"
          style={{
            color: RANK_CONFIG[currentRank].color,
            letterSpacing: '0.8px',
            background: `${RANK_CONFIG[currentRank].color}14`,
            border: `1px solid ${RANK_CONFIG[currentRank].color}28`,
          }}
        >
          твой титул · {RANK_CONFIG[currentRank].label}
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold mb-1 mt-3" style={{ color: '#1C1C1E', letterSpacing: '-1.2px', lineHeight: 1 }}>
          Путь на Олимп
        </h1>
        <p className="text-sm" style={{ color: 'rgba(28,28,30,0.55)' }}>
          {nextCfg
            ? `До титула ${nextCfg.label} осталось ${pointsToNext} фантиков`
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
              <stop offset="0%" stopColor={RANK_CONFIG[currentRank].color} />
              <stop offset="100%" stopColor="#C7C7CC" />
            </linearGradient>
          </defs>

          {/* Mountain silhouette */}
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

          {/* Path (tropa) */}
          <path
            d={pathD}
            fill="none"
            stroke="rgba(28,28,30,0.25)"
            strokeWidth="3"
            strokeDasharray="6 6"
            strokeLinecap="round"
          />

          {/* Reached portion overlay */}
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

          {/* Milestones */}
          {MILESTONES.map((m) => {
            const isActive = m.rank === activeMilestone.rank
            const r = m.isCurrent ? 18 : 13
            return (
              <g
                key={m.rank}
                onClick={() => setSelected(m.rank)}
                style={{ cursor: 'pointer' }}
              >
                {m.isCurrent && (
                  <circle cx={m.x} cy={m.y} r={r + 8} fill={m.cfg.color} opacity="0.18">
                    <animate attributeName="r" values={`${r + 4};${r + 12};${r + 4}`} dur="2.4s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.28;0.08;0.28" dur="2.4s" repeatCount="indefinite" />
                  </circle>
                )}
                <circle
                  cx={m.x}
                  cy={m.y}
                  r={r}
                  fill={m.reached ? m.cfg.color : '#FFFFFF'}
                  stroke={isActive ? '#1C1C1E' : m.reached ? m.cfg.color : 'rgba(28,28,30,0.25)'}
                  strokeWidth={isActive ? 3 : 2}
                />
                {m.reached && (
                  <text x={m.x} y={m.y + 4} textAnchor="middle" fontSize="12" fontWeight="800" fill="#FFFFFF">
                    ✓
                  </text>
                )}
                {/* Label bubble */}
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

      {/* Detail card for selected/current milestone */}
      <div
        className="rounded-2xl p-5 mt-4"
        style={{
          background: 'rgba(255,255,255,0.72)',
          backdropFilter: 'blur(24px) saturate(160%)',
          WebkitBackdropFilter: 'blur(24px) saturate(160%)',
          border: `1px solid ${activeMilestone.cfg.color}28`,
          boxShadow: '0 8px 24px rgba(0,0,0,0.06)',
        }}
      >
        <div className="flex items-baseline justify-between mb-1">
          <div className="text-lg font-bold" style={{ color: '#1C1C1E', letterSpacing: '-0.4px' }}>
            {activeMilestone.cfg.label}
          </div>
          <div className="text-xs font-semibold" style={{ color: activeMilestone.cfg.color }}>
            {(() => {
              const i = RANK_ORDER.indexOf(activeMilestone.rank)
              const nxt = RANK_ORDER[i + 1] ? RANK_CONFIG[RANK_ORDER[i + 1]] : null
              return nxt
                ? `${activeMilestone.cfg.minPoints}–${nxt.minPoints - 1} фантиков`
                : `${activeMilestone.cfg.minPoints}+ фантиков`
            })()}
          </div>
        </div>
        <div className="text-sm" style={{ color: 'rgba(28,28,30,0.60)', lineHeight: 1.55 }}>
          {activeMilestone.isCurrent
            ? `У тебя ${points} фантиков. ${nextCfg ? `Следующий титул — ${nextCfg.label}, до него ${pointsToNext}.` : 'Высший титул достигнут.'}`
            : activeMilestone.reached
              ? 'Этот титул уже получен.'
              : `Нужно набрать ${activeMilestone.cfg.minPoints - points} фантиков, чтобы получить.`}
        </div>
      </div>

      <div className="mt-4 rounded-2xl p-4" style={{ background: 'rgba(10,132,255,0.06)', border: '1px solid rgba(10,132,255,0.14)' }}>
        <div className="text-xs font-semibold uppercase mb-2" style={{ color: '#0A84FF', letterSpacing: '0.6px' }}>
          Как получить фантики
        </div>
        <ul className="text-xs" style={{ color: 'rgba(28,28,30,0.70)', lineHeight: 1.8 }}>
          <li>+1 за реакцию на чужое сообщение</li>
          <li>+3 за реакцию на твоё сообщение</li>
          <li>+5 за участие в опросе</li>
          <li>Колесо — фантики выпадают случайно</li>
        </ul>
      </div>
    </div>
  )
}
