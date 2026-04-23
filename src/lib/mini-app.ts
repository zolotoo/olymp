import { setUserWebAppMenuButton, resetUserMenuButton } from './telegram'

export function miniAppUrl(): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://aiolymp.vercel.app')
  return `${base.replace(/\/$/, '')}/app`
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
