'use client'
import { useEffect, useState } from 'react'
import { TelegramProvider, useTelegram, tgFetch } from '@/components/miniapp/TelegramProvider'
import WheelTab from '@/components/miniapp/WheelTab'
import ProfileTab from '@/components/miniapp/ProfileTab'
import TitulTab from '@/components/miniapp/TitulTab'
import LeaderboardTab from '@/components/miniapp/LeaderboardTab'
import KioskTab from '@/components/miniapp/KioskTab'
import LibraryTab from '@/components/miniapp/LibraryTab'

type Tab = 'wheel' | 'titul' | 'leaderboard' | 'profile' | 'kiosk' | 'library'

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
    <div style={{ paddingTop: 12, paddingBottom: 96 }}>
      {tab === 'wheel' && <WheelTab onSpinComplete={() => setProfileReload(k => k + 1)} />}
      {tab === 'titul' && <TitulTab reloadKey={profileReload} />}
      {tab === 'leaderboard' && <LeaderboardTab reloadKey={profileReload} />}
      {tab === 'kiosk' && <KioskTab reloadKey={profileReload} onPurchase={() => setProfileReload(k => k + 1)} />}
      {tab === 'library' && <LibraryTab />}
      {tab === 'profile' && <ProfileTab reloadKey={profileReload} />}

      {/*
        Liquid Glass tab bar в духе iOS 26: плавающая «пилюля», оторванная от
        нижней грани и зажатая по бокам. Полупрозрачный фон + сильный blur +
        boost saturation создаёт эффект матового стекла. Активная вкладка
        выделяется лёгким акцентным фоном, без цветного эмодзи — только текст.
        Без иконок: 6 коротких подписей помещаются в одну линию, а отсутствие
        пиктограмм снимает «детский» вид и даёт чище акцент.
      */}
      <nav
        style={{
          position: 'fixed',
          left: '50%',
          bottom: 'calc(env(safe-area-inset-bottom) + 12px)',
          transform: 'translateX(-50%)',
          width: 'calc(100% - 16px)',
          maxWidth: 460,
          display: 'flex',
          padding: 4,
          background: 'rgba(255,255,255,0.62)',
          backdropFilter: 'blur(36px) saturate(180%)',
          WebkitBackdropFilter: 'blur(36px) saturate(180%)',
          border: '0.5px solid rgba(255,255,255,0.65)',
          borderRadius: 999,
          boxShadow:
            '0 14px 40px rgba(0,0,0,0.14), ' +
            '0 4px 12px rgba(0,0,0,0.08), ' +
            'inset 0 1px 0 rgba(255,255,255,0.85)',
          zIndex: 30,
        }}
      >
        {(['titul', 'library', 'leaderboard', 'kiosk', 'wheel', 'profile'] as Tab[]).map(t => {
          const active = tab === t
          const label = t === 'wheel' ? 'Колесо'
            : t === 'titul' ? 'Титул'
            : t === 'leaderboard' ? 'Топ'
            : t === 'kiosk' ? 'Киоск'
            : t === 'library' ? 'Знания'
            : 'Профиль'
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-1 flex items-center justify-center transition-all active:scale-[0.94]"
              style={{
                padding: '11px 0',
                background: active ? '#FFFFFF' : 'transparent',
                border: 'none',
                borderRadius: 999,
                cursor: 'pointer',
                color: active ? '#0A84FF' : 'rgba(28,28,30,0.62)',
                fontSize: 13,
                fontWeight: active ? 700 : 500,
                letterSpacing: '-0.2px',
                boxShadow: active ? '0 2px 8px rgba(10,132,255,0.18), 0 1px 2px rgba(0,0,0,0.06)' : 'none',
                transition: 'background 0.18s ease, color 0.18s ease, box-shadow 0.18s ease',
              }}
            >
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
