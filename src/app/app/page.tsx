'use client'
import { useEffect, useState } from 'react'
import { TelegramProvider, useTelegram, tgFetch } from '@/components/miniapp/TelegramProvider'
import WheelTab from '@/components/miniapp/WheelTab'
import ProfileTab from '@/components/miniapp/ProfileTab'
import TitulTab from '@/components/miniapp/TitulTab'
import LeaderboardTab from '@/components/miniapp/LeaderboardTab'
import KioskTab from '@/components/miniapp/KioskTab'

type Tab = 'wheel' | 'titul' | 'leaderboard' | 'profile' | 'kiosk'

function Shell() {
  const { ready, isTelegram, initData } = useTelegram()
  const [tab, setTab] = useState<Tab>('titul')
  const [profileReload, setProfileReload] = useState(0)
  const [gate, setGate] = useState<{ allowed: boolean; reason?: string } | null>(null)

  useEffect(() => {
    if (!ready || !isTelegram) return
    let cancelled = false
    tgFetch('/api/gate', initData)
      .then(r => r.json())
      .then(d => { if (!cancelled) setGate(d) })
      .catch(() => { if (!cancelled) setGate({ allowed: false, reason: 'network_error' }) })
    return () => { cancelled = true }
  }, [ready, isTelegram, initData])

  if (!ready || (isTelegram && !gate)) {
    return <div className="text-center text-sm p-10" style={{ color: 'rgba(28,28,30,0.45)' }}>Загрузка…</div>
  }

  if (!isTelegram) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="rounded-3xl p-8" style={{ background: '#FFFFFF', border: '1px solid rgba(28,28,30,0.08)' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📱</div>
          <h2 className="text-xl font-bold mb-2" style={{ color: '#1C1C1E' }}>Откройте в Telegram</h2>
          <p className="text-sm" style={{ color: 'rgba(28,28,30,0.55)', lineHeight: 1.55 }}>
            Эта страница работает только как мини-приложение внутри Telegram. Запустите её через бота @AI_Olymp_bot.
          </p>
        </div>
      </div>
    )
  }

  if (!gate?.allowed) {
    return (
      <div className="max-w-md mx-auto px-4 py-12 text-center">
        <div className="rounded-3xl p-8" style={{ background: '#FFFFFF', border: '1px solid rgba(28,28,30,0.08)' }}>
          <div style={{ fontSize: 56, marginBottom: 12 }}>🔒</div>
          <h2 className="text-2xl font-bold mb-2" style={{ color: '#1C1C1E', letterSpacing: '-0.5px' }}>
            Только для членов клуба
          </h2>
          <p className="text-sm mb-5" style={{ color: 'rgba(28,28,30,0.55)', lineHeight: 1.55 }}>
            Чтобы крутить Колесо удачи, копить фантики и расти в титулах — вступай в AI Олимп.
          </p>
          <button
            onClick={() => window.Telegram?.WebApp?.close()}
            className="w-full rounded-full py-3 text-sm font-semibold"
            style={{ background: '#0A84FF', color: '#fff', border: 'none', cursor: 'pointer' }}
          >
            Написать боту
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ paddingTop: 12, paddingBottom: 80 }}>
      {tab === 'wheel' && <WheelTab onSpinComplete={() => setProfileReload(k => k + 1)} />}
      {tab === 'titul' && <TitulTab reloadKey={profileReload} />}
      {tab === 'leaderboard' && <LeaderboardTab reloadKey={profileReload} />}
      {tab === 'kiosk' && <KioskTab reloadKey={profileReload} onPurchase={() => setProfileReload(k => k + 1)} />}
      {tab === 'profile' && <ProfileTab reloadKey={profileReload} />}

      <nav
        style={{
          position: 'fixed',
          bottom: 0, left: 0, right: 0,
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(24px) saturate(160%)',
          WebkitBackdropFilter: 'blur(24px) saturate(160%)',
          borderTop: '1px solid rgba(28,28,30,0.08)',
          display: 'flex',
          paddingBottom: 'env(safe-area-inset-bottom)',
          zIndex: 30,
        }}
      >
        {(['titul', 'leaderboard', 'kiosk', 'wheel', 'profile'] as Tab[]).map(t => {
          const active = tab === t
          const label = t === 'wheel' ? 'Колесо' : t === 'titul' ? 'Титул' : t === 'leaderboard' ? 'Топ' : t === 'kiosk' ? 'Киоск' : 'Профиль'
          const emoji = t === 'wheel' ? '🎡' : t === 'titul' ? '🏔' : t === 'leaderboard' ? '🏆' : t === 'kiosk' ? '🛍' : '👤'
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-1 flex flex-col items-center justify-center gap-1"
              style={{
                padding: '10px 0 12px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: active ? '#0A84FF' : 'rgba(28,28,30,0.55)',
                fontSize: 11,
                fontWeight: active ? 700 : 500,
                letterSpacing: '-0.1px',
              }}
            >
              <span style={{ fontSize: 22, lineHeight: 1 }}>{emoji}</span>
              {label}
            </button>
          )
        })}
      </nav>
    </div>
  )
}

export default function AppPage() {
  return (
    <TelegramProvider>
      <Shell />
    </TelegramProvider>
  )
}
