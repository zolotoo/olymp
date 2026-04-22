'use client'
import { useEffect, useState } from 'react'
import { useTelegram, tgFetch } from './TelegramProvider'

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
    return <div className="text-center text-sm p-8" style={{ color: '#FF3B30' }}>{error}</div>
  }
  if (!data) {
    return <div className="text-center text-sm p-8" style={{ color: 'rgba(28,28,30,0.45)' }}>Загружаем профиль…</div>
  }

  const displayName = [data.user.first_name, data.user.username && `@${data.user.username}`].filter(Boolean).join(' ')

  if (!data.isMember) {
    return (
      <div className="max-w-xl mx-auto px-4 py-8 text-center">
        <div className="rounded-3xl p-8" style={{ background: '#FFFFFF', border: '1px solid rgba(28,28,30,0.08)' }}>
          <div style={{ fontSize: 56, marginBottom: 12 }}>👋</div>
          <h2 className="text-2xl font-bold mb-2" style={{ color: '#1C1C1E', letterSpacing: '-0.6px' }}>
            Привет, {displayName || 'друг'}!
          </h2>
          <p className="text-sm" style={{ color: 'rgba(28,28,30,0.55)', lineHeight: 1.55 }}>
            Ты ещё не в клубе AI Олимп. Чтобы открыть рулетку, ранги и фантики — вступай в клуб через бота.
          </p>
        </div>
      </div>
    )
  }

  const m = data.member!
  const lb = data.leaderboard!

  return (
    <div className="max-w-xl mx-auto px-4 pb-8 space-y-4">
      <div
        className="rounded-3xl p-6 text-center"
        style={{ background: `linear-gradient(135deg, ${m.rankColor}1A 0%, ${m.rankColor}05 100%)`, border: `1px solid ${m.rankColor}33` }}
      >
        {data.user.photo_url ? (
          <img
            src={data.user.photo_url}
            alt=""
            width={80} height={80}
            className="rounded-full mx-auto mb-3"
            style={{ border: `3px solid ${m.rankColor}`, objectFit: 'cover' }}
          />
        ) : (
          <div
            className="rounded-full mx-auto mb-3 flex items-center justify-center text-2xl font-bold"
            style={{ width: 80, height: 80, background: m.rankColor, color: '#fff' }}
          >
            {(data.user.first_name || '?').charAt(0).toUpperCase()}
          </div>
        )}
        <div className="text-lg font-semibold" style={{ color: '#1C1C1E', letterSpacing: '-0.3px' }}>
          {displayName || 'AI Олимпиец'}
        </div>
        <div
          className="inline-block mt-2 rounded-full px-3 py-1 text-xs font-semibold uppercase"
          style={{ background: `${m.rankColor}20`, color: m.rankColor, letterSpacing: '0.6px' }}
        >
          {m.rankLabel}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl p-4" style={{ background: '#FFFFFF', border: '1px solid rgba(28,28,30,0.06)' }}>
          <div className="text-xs font-semibold uppercase mb-1" style={{ color: 'rgba(28,28,30,0.45)', letterSpacing: '0.6px' }}>
            Фантики
          </div>
          <div className="text-2xl font-bold" style={{ color: '#1C1C1E', letterSpacing: '-0.4px' }}>
            {m.points} 🍃
          </div>
        </div>
        <div className="rounded-2xl p-4" style={{ background: '#FFFFFF', border: '1px solid rgba(28,28,30,0.06)' }}>
          <div className="text-xs font-semibold uppercase mb-1" style={{ color: 'rgba(28,28,30,0.45)', letterSpacing: '0.6px' }}>
            Место в рейтинге
          </div>
          <div className="text-2xl font-bold" style={{ color: '#1C1C1E', letterSpacing: '-0.4px' }}>
            {lb.position}<span className="text-base font-medium" style={{ color: 'rgba(28,28,30,0.45)' }}> / {lb.total}</span>
          </div>
        </div>
      </div>

      <div className="rounded-2xl p-5" style={{ background: '#FFFFFF', border: '1px solid rgba(28,28,30,0.06)' }}>
        <div className="text-xs font-semibold uppercase mb-3" style={{ color: 'rgba(28,28,30,0.45)', letterSpacing: '0.7px' }}>
          История спинов
        </div>
        {data.spins && data.spins.length > 0 ? (
          <div className="flex flex-col gap-2">
            {data.spins.map((s, i) => (
              <div key={i} className="flex items-center justify-between rounded-xl px-3 py-2.5" style={{ background: 'rgba(10,132,255,0.06)', border: '1px solid rgba(10,132,255,0.12)' }}>
                <div className="text-sm font-medium" style={{ color: '#1C1C1E' }}>{formatMonth(s.month)}</div>
                <div className="text-sm font-semibold" style={{ color: '#0A84FF' }}>+{s.prize_leaves} 🍃</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-center py-4" style={{ color: 'rgba(28,28,30,0.45)' }}>
            Ещё не крутил колесо
          </div>
        )}
      </div>
    </div>
  )
}
