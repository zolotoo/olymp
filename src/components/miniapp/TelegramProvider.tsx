'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

interface TgUser {
  id: number
  first_name?: string
  last_name?: string
  username?: string
  photo_url?: string
}

interface TgContextValue {
  initData: string | null
  user: TgUser | null
  ready: boolean
  isTelegram: boolean
}

const TgContext = createContext<TgContextValue>({
  initData: null,
  user: null,
  ready: false,
  isTelegram: false,
})

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string
        initDataUnsafe: { user?: TgUser }
        ready: () => void
        expand: () => void
        close: () => void
        openTelegramLink?: (url: string) => void
        MainButton: {
          text: string
          show: () => void
          hide: () => void
          setText: (s: string) => void
          onClick: (fn: () => void) => void
          offClick: (fn: () => void) => void
          enable: () => void
          disable: () => void
        }
        HapticFeedback?: {
          impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void
          notificationOccurred: (type: 'error' | 'success' | 'warning') => void
        }
        themeParams?: Record<string, string>
        colorScheme?: 'light' | 'dark'
      }
    }
  }
}

export function TelegramProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TgContextValue>({
    initData: null,
    user: null,
    ready: false,
    isTelegram: false,
  })

  useEffect(() => {
    const tg = window.Telegram?.WebApp
    if (!tg) {
      setState({ initData: null, user: null, ready: true, isTelegram: false })
      return
    }
    tg.ready()
    tg.expand()
    const initData = tg.initData || null
    setState({
      initData,
      user: tg.initDataUnsafe?.user ?? null,
      ready: true,
      isTelegram: Boolean(initData),
    })
    if (initData) {
      fetch('/api/analytics/mini-app-open', {
        method: 'POST',
        headers: { 'X-Telegram-Init-Data': initData },
      }).catch(() => {})
    }
  }, [])

  return <TgContext.Provider value={state}>{children}</TgContext.Provider>
}

export function useTelegram() {
  return useContext(TgContext)
}

export async function tgFetch(url: string, initData: string | null, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  if (initData) headers.set('X-Telegram-Init-Data', initData)
  return fetch(url, { ...init, headers })
}
