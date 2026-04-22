'use client'
import { useState } from 'react'
import { TelegramProvider, useTelegram } from '@/components/miniapp/TelegramProvider'
import WheelTab from '@/components/miniapp/WheelTab'
import ProfileTab from '@/components/miniapp/ProfileTab'

type Tab = 'wheel' | 'profile'

function Shell() {
  const { ready, isTelegram } = useTelegram()
  const [tab, setTab] = useState<Tab>('wheel')
  const [profileReload, setProfileReload] = useState(0)

  if (!ready) {
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

  return (
    <div style={{ paddingTop: 12, paddingBottom: 80 }}>
      {tab === 'wheel' && <WheelTab onSpinComplete={() => setProfileReload(k => k + 1)} />}
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
        {(['wheel', 'profile'] as Tab[]).map(t => {
          const active = tab === t
          const label = t === 'wheel' ? 'Рулетка' : 'Профиль'
          const emoji = t === 'wheel' ? '🎰' : '👤'
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
