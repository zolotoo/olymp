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

// Читаем deeplink-параметры из window.location.search:
//   ?tab=library&kind=guides&msg=348
// Telegram пробрасывает их при открытии CTA-кнопки с url: https://...
// в свой in-app браузер. Для start_param-режима (когда мини-апп открывается
// из меню бота) — пока не используем, добавим если будет нужно.
function readDeeplink(): { tab: Tab | null; kind: string | null; msg: number | null } {
  if (typeof window === 'undefined') return { tab: null, kind: null, msg: null }
  const sp = new URLSearchParams(window.location.search)
  const t = sp.get('tab')
  const allowed: Tab[] = ['wheel', 'titul', 'leaderboard', 'profile', 'kiosk', 'library']
  return {
    tab: allowed.includes(t as Tab) ? (t as Tab) : null,
    kind: sp.get('kind'),
    msg: Number(sp.get('msg')) || null,
  }
}

function Shell() {
  const { ready, isTelegram, initData } = useTelegram()
  const initial = readDeeplink()
  const [tab, setTab] = useState<Tab>(initial.tab ?? 'titul')
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
    return <div className="text-center text-sm p-10 dk-muted-2">Загрузка…</div>
  }

  if (!isTelegram) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="dk-card-mini p-8">
          <div style={{ fontSize: 56, marginBottom: 14 }}>📱</div>
          <h2 className="dk-mini-title mb-2" style={{ fontSize: 26, letterSpacing: '-0.8px' }}>Откройте в Telegram</h2>
          <p className="text-sm dk-muted" style={{ lineHeight: 1.55 }}>
            Эта страница работает только как мини-приложение внутри Telegram. Запустите её через бота @AI_Olymp_bot.
          </p>
        </div>
      </div>
    )
  }

  if (!gate?.allowed) {
    return (
      <div className="max-w-md mx-auto px-4 py-12 text-center">
        <div className="dk-card-mini p-8 relative" style={{ overflow: 'visible' }}>
          <span className="dk-bubble dk-sticker-tilt-l" style={{ position: 'absolute', top: -14, left: 16 }}>
            ☁️ Олимп
          </span>
          <span className="dk-bubble dk-bubble-brand dk-sticker-tilt-r" style={{ position: 'absolute', top: -14, right: 16 }}>
            Just do it ✨
          </span>
          <div style={{ fontSize: 64, marginBottom: 14 }}>🔒</div>
          <h2 className="dk-mini-title mb-2">Только для клуба</h2>
          <p className="text-sm dk-muted mb-6" style={{ lineHeight: 1.55 }}>
            Чтобы крутить Колесо удачи, копить фантики и расти в титулах — вступай в AI Олимп.
          </p>
          <button
            onClick={() => window.Telegram?.WebApp?.close()}
            className="dk-btn-primary w-full"
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
      {tab === 'library' && <LibraryTab initialKind={initial.kind} initialMsgId={initial.msg} />}
      {tab === 'profile' && <ProfileTab reloadKey={profileReload} />}

      {/*
        Drinkit-style tab bar: плавающая белая пилюля с мягкой тенью. Активная
        вкладка — заливка brand-blue. Эмодзи появляется ТОЛЬКО у активного таба
        слева от подписи (Drinkit-фишка с цветными стикерами-акцентами).
      */}
      <nav
        style={{
          position: 'fixed',
          left: '50%',
          bottom: 'calc(env(safe-area-inset-bottom) + 12px)',
          transform: 'translateX(-50%)',
          width: 'calc(100% - 16px)',
          maxWidth: 480,
          display: 'flex',
          padding: 5,
          background: '#FFFFFF',
          border: '1px solid var(--dk-border)',
          borderRadius: 999,
          boxShadow: '0 8px 28px rgba(15,23,42,0.12), 0 2px 6px rgba(15,23,42,0.06)',
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
          const emoji = t === 'wheel' ? '🎡'
            : t === 'titul' ? '⛰️'
            : t === 'leaderboard' ? '🏆'
            : t === 'kiosk' ? '🛍️'
            : t === 'library' ? '📚'
            : '👤'
          return (
            <button
              key={t}
              onClick={() => {
                window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.('light')
                setTab(t)
              }}
              className="flex-1 flex items-center justify-center gap-1 transition-all active:scale-[0.94]"
              style={{
                padding: '10px 0',
                background: active ? 'var(--dk-brand)' : 'transparent',
                border: 'none',
                borderRadius: 999,
                cursor: 'pointer',
                color: active ? '#FFFFFF' : 'var(--dk-text-2)',
                fontSize: 13,
                fontWeight: active ? 700 : 500,
                letterSpacing: '-0.2px',
                boxShadow: active ? '0 4px 14px rgba(45,91,255,0.32)' : 'none',
                transition: 'background 0.18s ease, color 0.18s ease, box-shadow 0.18s ease',
              }}
            >
              {active && <span style={{ fontSize: 14, lineHeight: 1 }}>{emoji}</span>}
              <span>{label}</span>
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
