'use client'
import { useEffect, useState } from 'react'
import { useTelegram, tgFetch } from './TelegramProvider'
import MyPathSection from './MyPathSection'

interface ProfileData {
  isMember: boolean
  user: { id: number; first_name?: string; username?: string; photo_url?: string }
  member?: {
    rank: string
    rankLabel: string
    rankColor: string
    points: number
    joined_at: string
    status: string
  }
  leaderboard?: { position: number; total: number }
  spins?: { month: string; prize_leaves: number; created_at: string }[]
}

function formatMonth(ym: string): string {
  const months = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь']
  const [y, m] = ym.split('-').map(Number)
  if (!y || !m) return ym
  return `${months[m - 1]} ${y}`
}

export default function ProfileTab({ reloadKey }: { reloadKey?: number }) {
  const { initData, isTelegram, ready } = useTelegram()
  const [data, setData] = useState<ProfileData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!ready) return
    if (!isTelegram) {
      setError('Открой через Telegram')
      return
    }
    let cancelled = false
    tgFetch('/api/profile', initData)
      .then(r => r.json())
      .then(d => { if (!cancelled) { if (d.error) setError(d.error); else setData(d) } })
      .catch(() => { if (!cancelled) setError('Сеть недоступна') })
    return () => { cancelled = true }
  }, [ready, isTelegram, initData, reloadKey])

  if (error) {
    return <div className="text-center text-sm p-8" style={{ color: '#E5484D' }}>{error}</div>
  }
  if (!data) {
    return <div className="text-center text-sm p-8 dk-muted-2">Загружаем профиль…</div>
  }

  const displayName = [data.user.first_name, data.user.username && `@${data.user.username}`].filter(Boolean).join(' ')

  if (!data.isMember) {
    return (
      <div className="max-w-xl mx-auto px-4 py-8 text-center">
        <div className="dk-card-mini p-8 relative" style={{ overflow: 'visible' }}>
          <span className="dk-bubble dk-bubble-brand dk-sticker-tilt-r" style={{ position: 'absolute', top: -14, right: 16 }}>
            🏔️ AI Олимп
          </span>
          <div style={{ fontSize: 64, marginBottom: 14 }}>👋</div>
          <h2 className="dk-mini-title mb-2">Привет, {data.user.first_name || 'друг'}!</h2>
          <p className="text-sm dk-muted" style={{ lineHeight: 1.55 }}>
            Ты ещё не в клубе AI Олимп. Чтобы открыть Колесо удачи, титулы и фантики — вступай в клуб через бота.
          </p>
        </div>
      </div>
    )
  }

  const m = data.member!
  const lb = data.leaderboard!

  return (
    <div className="max-w-xl mx-auto px-4 pb-8 space-y-3">
      <div
        className="dk-card-mini p-6 text-center relative"
        style={{
          background: `linear-gradient(180deg, ${m.rankColor}1A 0%, #FFFFFF 65%)`,
          borderColor: `${m.rankColor}33`,
          overflow: 'visible',
        }}
      >
        <span
          className="dk-leaves-badge dk-sticker-tilt-r"
          style={{ position: 'absolute', top: 14, right: 14 }}
        >
          🍃 +{m.points}
        </span>
        {data.user.photo_url ? (
          <img
            src={data.user.photo_url}
            alt=""
            width={88} height={88}
            className="rounded-full mx-auto mb-3"
            style={{ border: `4px solid #FFFFFF`, boxShadow: `0 8px 24px ${m.rankColor}44`, objectFit: 'cover' }}
          />
        ) : (
          <div
            className="rounded-full mx-auto mb-3 flex items-center justify-center text-3xl font-extrabold"
            style={{ width: 88, height: 88, background: m.rankColor, color: '#fff', boxShadow: `0 8px 24px ${m.rankColor}44` }}
          >
            {(data.user.first_name || '?').charAt(0).toUpperCase()}
          </div>
        )}
        <div className="dk-mini-title" style={{ fontSize: 26, letterSpacing: '-0.8px' }}>
          {data.user.first_name || 'AI Олимпиец'}
        </div>
        {data.user.username && (
          <div className="text-sm mt-1" style={{ color: 'var(--dk-brand)', fontWeight: 500 }}>
            @{data.user.username}
          </div>
        )}
        <div
          className="dk-pill mt-3"
          style={{ display: 'inline-flex', background: `${m.rankColor}1A`, color: m.rankColor }}
        >
          {m.rankLabel}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="dk-card-mini p-4">
          <div className="text-[11px] font-bold uppercase mb-1 dk-muted-2" style={{ letterSpacing: '0.6px' }}>
            🍃 Фантики
          </div>
          <div className="text-3xl font-extrabold" style={{ color: 'var(--dk-text-1)', letterSpacing: '-0.8px', lineHeight: 1 }}>
            {m.points}
          </div>
        </div>
        <div className="dk-card-mini p-4">
          <div className="text-[11px] font-bold uppercase mb-1 dk-muted-2" style={{ letterSpacing: '0.6px' }}>
            🏆 Место
          </div>
          <div className="text-3xl font-extrabold" style={{ color: 'var(--dk-text-1)', letterSpacing: '-0.8px', lineHeight: 1 }}>
            {lb.position}<span className="text-lg font-semibold dk-muted-2"> / {lb.total}</span>
          </div>
        </div>
      </div>

      <MyPathSection />

      <div className="dk-card-mini p-5">
        <div className="text-xs font-bold uppercase mb-3 dk-muted-2" style={{ letterSpacing: '0.7px' }}>
          🎡 История спинов
        </div>
        {data.spins && data.spins.length > 0 ? (
          <div className="flex flex-col gap-2">
            {data.spins.map((s, i) => (
              <div key={i} className="flex items-center justify-between rounded-xl px-3 py-2.5" style={{ background: 'var(--dk-brand-soft)' }}>
                <div className="text-sm font-medium" style={{ color: 'var(--dk-text-1)' }}>{formatMonth(s.month)}</div>
                <div className="text-sm font-bold" style={{ color: 'var(--dk-brand)' }}>+{s.prize_leaves} 🍃</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-center py-4 dk-muted-2">
            Ещё не крутил колесо
          </div>
        )}
      </div>
    </div>
  )
}
