'use client'
import { useEffect, useMemo, useState } from 'react'
import { useTelegram, tgFetch } from './TelegramProvider'
import { RANK_CONFIG } from '@/lib/ranks'
import type { MemberRank } from '@/lib/types'

const RANK_ORDER: MemberRank[] = ['newcomer', 'member', 'active', 'champion', 'legend']

interface LeaderMember {
  tg_id: number
  name: string
  username: string | null
  photo_url: string | null
  rank: MemberRank
  points: number
}

interface LeaderboardResponse {
  me: number
  members: LeaderMember[]
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map(p => p[0]?.toUpperCase() ?? '').join('') || '?'
}

function avatarColor(id: number) {
  const palette = ['#0A84FF', '#BF5AF2', '#FF9500', '#34C759', '#FF2D55', '#5AC8FA', '#FFD60A', '#FF453A']
  return palette[Math.abs(id) % palette.length]
}

function Avatar({ member }: { member: LeaderMember }) {
  const [broken, setBroken] = useState(false)
  const showImg = member.photo_url && !broken
  return (
    <div style={{
      width: 40, height: 40, borderRadius: '50%',
      background: avatarColor(member.tg_id),
      color: '#fff', fontWeight: 700, fontSize: 14,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, overflow: 'hidden',
    }}>
      {showImg ? (
        <img
          src={member.photo_url!}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : initials(member.name)}
    </div>
  )
}

function formatRange(idx: number) {
  const cur = RANK_CONFIG[RANK_ORDER[idx]]
  // Титулы теперь не по фантикам, а по месяцу подписки.
  return `${cur.month}-й месяц в клубе`
}

function Trophy({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 200 220" width="160" height="176" style={{ filter: 'drop-shadow(0 12px 24px rgba(0,0,0,0.28))' }}>
      <defs>
        <linearGradient id="cupBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
          <stop offset="45%" stopColor={color} />
          <stop offset="100%" stopColor="#1C1C1E" stopOpacity="0.85" />
        </linearGradient>
        <linearGradient id="cupShine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Handles */}
      <path d="M 52 60 C 20 60, 14 110, 58 118" fill="none" stroke="url(#cupBody)" strokeWidth="10" strokeLinecap="round" />
      <path d="M 148 60 C 180 60, 186 110, 142 118" fill="none" stroke="url(#cupBody)" strokeWidth="10" strokeLinecap="round" />
      {/* Cup body */}
      <path
        d="M 50 40 L 150 40 L 144 110 C 144 140, 120 150, 100 150 C 80 150, 56 140, 56 110 Z"
        fill="url(#cupBody)"
        stroke="rgba(0,0,0,0.12)"
        strokeWidth="1"
      />
      {/* Shine */}
      <path
        d="M 66 52 L 134 52 L 130 102 C 130 124, 116 132, 100 132 C 84 132, 70 124, 70 102 Z"
        fill="url(#cupShine)"
        opacity="0.45"
      />
      {/* Stem */}
      <rect x="92" y="150" width="16" height="22" fill="url(#cupBody)" />
      {/* Base */}
      <rect x="62" y="172" width="76" height="14" rx="3" fill="url(#cupBody)" />
      <rect x="54" y="186" width="92" height="10" rx="2" fill="url(#cupBody)" />
      {/* Sparkles */}
      <g fill="#FFFFFF" opacity="0.85">
        <circle cx="36" cy="30" r="2.5" />
        <circle cx="172" cy="24" r="2" />
        <circle cx="164" cy="54" r="1.5" />
        <circle cx="30" cy="76" r="1.5" />
      </g>
    </svg>
  )
}

export default function LeaderboardTab({ reloadKey = 0 }: { reloadKey?: number }) {
  const { initData, ready, isTelegram } = useTelegram()
  const [data, setData] = useState<LeaderboardResponse | null>(null)
  const [idx, setIdx] = useState<number | null>(null)

  useEffect(() => {
    if (!ready || !isTelegram) return
    let cancelled = false
    tgFetch('/api/leaderboard', initData)
      .then(r => r.json())
      .then((d: LeaderboardResponse) => {
        if (cancelled) return
        setData(d)
        if (idx === null) {
          const mine = d.members.find(m => m.tg_id === d.me)
          const start = mine ? RANK_ORDER.indexOf(mine.rank) : 0
          setIdx(start >= 0 ? start : 0)
        }
      })
      .catch(() => { if (!cancelled) setData({ me: 0, members: [] }) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, isTelegram, initData, reloadKey])

  const currentRank = idx !== null ? RANK_ORDER[idx] : 'newcomer'
  const cfg = RANK_CONFIG[currentRank]

  const inRank = useMemo(() => {
    if (!data) return []
    return data.members
      .filter(m => m.rank === currentRank)
      .sort((a, b) => b.points - a.points)
  }, [data, currentRank])

  const prev = () => setIdx(i => (i === null ? 0 : Math.max(0, i - 1)))
  const next = () => setIdx(i => (i === null ? 0 : Math.min(RANK_ORDER.length - 1, i + 1)))

  const meId = data?.me ?? 0

  return (
    <div className="max-w-xl mx-auto pb-8">
      {/* Hero: cup + rank */}
      <div
        className="mx-4 rounded-3xl overflow-hidden relative"
        style={{
          background: `linear-gradient(180deg, ${cfg.color} 0%, ${cfg.color}D0 50%, ${cfg.color}80 100%)`,
          boxShadow: `0 12px 40px ${cfg.color}40`,
          paddingTop: 24,
          paddingBottom: 28,
        }}
      >
        <button
          onClick={prev}
          disabled={idx === 0}
          aria-label="Предыдущий титул"
          style={{
            position: 'absolute', left: 10, top: '42%', transform: 'translateY(-50%)',
            width: 36, height: 36, borderRadius: '50%',
            background: 'rgba(255,255,255,0.22)', color: '#fff', border: 'none',
            fontSize: 20, fontWeight: 700, cursor: idx === 0 ? 'default' : 'pointer',
            opacity: idx === 0 ? 0.35 : 1,
            backdropFilter: 'blur(12px)',
          }}
        >‹</button>
        <button
          onClick={next}
          disabled={idx === RANK_ORDER.length - 1}
          aria-label="Следующий титул"
          style={{
            position: 'absolute', right: 10, top: '42%', transform: 'translateY(-50%)',
            width: 36, height: 36, borderRadius: '50%',
            background: 'rgba(255,255,255,0.22)', color: '#fff', border: 'none',
            fontSize: 20, fontWeight: 700, cursor: idx === RANK_ORDER.length - 1 ? 'default' : 'pointer',
            opacity: idx === RANK_ORDER.length - 1 ? 0.35 : 1,
            backdropFilter: 'blur(12px)',
          }}
        >›</button>

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Trophy color={cfg.color} />
        </div>
        <h1
          className="text-center font-bold mt-3"
          style={{ color: '#fff', fontSize: 34, letterSpacing: '-1px', lineHeight: 1.05 }}
        >
          {cfg.label}
        </h1>
        <div className="text-center mt-2" style={{ color: 'rgba(255,255,255,0.82)', fontSize: 14 }}>
          {idx !== null && formatRange(idx)}
        </div>
        {/* Dots */}
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 16 }}>
          {RANK_ORDER.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === idx ? 20 : 6,
                height: 6,
                borderRadius: 3,
                background: i === idx ? '#fff' : 'rgba(255,255,255,0.4)',
                transition: 'width 0.2s',
              }}
            />
          ))}
        </div>
      </div>

      {/* List */}
      <div className="mx-4 mt-4 rounded-3xl overflow-hidden" style={{
        background: '#FFFFFF',
        border: '1px solid rgba(28,28,30,0.08)',
      }}>
        <div style={{
          padding: '14px 18px',
          borderBottom: '1px solid rgba(28,28,30,0.06)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        }}>
          <div className="text-xs font-semibold uppercase" style={{ color: cfg.color, letterSpacing: '0.6px' }}>
            Лидеры титула
          </div>
          <div className="text-xs" style={{ color: 'rgba(28,28,30,0.45)' }}>
            {inRank.length} {inRank.length === 1 ? 'участник' : 'участников'}
          </div>
        </div>

        {!data && (
          <div className="text-center text-sm py-10" style={{ color: 'rgba(28,28,30,0.45)' }}>Загрузка…</div>
        )}

        {data && inRank.length === 0 && (
          <div className="text-center text-sm py-10 px-6" style={{ color: 'rgba(28,28,30,0.55)', lineHeight: 1.5 }}>
            Пока никто не достиг титула «{cfg.label}». Будь первым.
          </div>
        )}

        {inRank.map((m, i) => {
          const isMe = m.tg_id === meId
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null
          return (
            <div
              key={m.tg_id}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 18px',
                borderBottom: i === inRank.length - 1 ? 'none' : '1px solid rgba(28,28,30,0.05)',
                background: isMe ? `${cfg.color}10` : 'transparent',
              }}
            >
              <div style={{
                width: 28, textAlign: 'center',
                fontSize: medal ? 20 : 13,
                fontWeight: 700,
                color: 'rgba(28,28,30,0.45)',
              }}>
                {medal ?? i + 1}
              </div>
              <Avatar member={m} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="font-semibold truncate" style={{ color: '#1C1C1E', fontSize: 15, letterSpacing: '-0.2px' }}>
                  {m.name}{isMe && <span style={{ color: cfg.color, fontWeight: 600 }}> · ты</span>}
                </div>
                <div className="text-xs truncate" style={{ color: 'rgba(28,28,30,0.5)' }}>
                  🍬 {m.points.toLocaleString('ru-RU')} фантиков
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mx-4 mt-4 rounded-2xl p-4" style={{
        background: 'rgba(10,132,255,0.06)',
        border: '1px solid rgba(10,132,255,0.14)',
      }}>
        <div className="text-xs font-semibold uppercase mb-2" style={{ color: '#0A84FF', letterSpacing: '0.6px' }}>
          Как устроен топ
        </div>
        <ul className="text-xs" style={{ color: 'rgba(28,28,30,0.70)', lineHeight: 1.75 }}>
          <li>Каждому титулу — свой кубок и своя таблица.</li>
          <li>Титул повышается каждый месяц подписки: 1-й месяц — Адепт, 2-й — Герой и т.д.</li>
          <li>Внутри титула места распределяются по фантикам: больше — выше.</li>
          <li>Листай стрелками ‹ › — увидишь топ любого титула, от Адепта до Бога.</li>
        </ul>
      </div>
    </div>
  )
}
