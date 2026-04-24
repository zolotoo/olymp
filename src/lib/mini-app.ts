import { setUserWebAppMenuButton, resetUserMenuButton } from './telegram'

export function miniAppUrl(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://aiolymp.vercel.app'
  // Cache-bust: Turbopack на каждом деплое переименовывает JS-чанки и старые
  // 404-ятся. Telegram WebView кэширует HTML — без ?v Мини-аппа ломается
  // после деплоя («This page couldn't load»). SHA меняется на каждом деплое →
  // URL меняется → кэш обходится.
  const v = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) || 'dev'
  return `${base.replace(/\/$/, '')}/app?v=${v}`
}

// Give this user the personal "AI Олимп" Mini App button. Safe-swallows errors.
export async function enableMiniAppButton(tgId: number): Promise<void> {
  try {
    await setUserWebAppMenuButton(tgId, miniAppUrl(), 'AI Олимп')
  } catch (e) {
    console.error('enableMiniAppButton failed:', e)
  }
}

export async function disableMiniAppButton(tgId: number): Promise<void> {
  try {
    await resetUserMenuButton(tgId)
  } catch (e) {
    console.error('disableMiniAppButton failed:', e)
  }
}
