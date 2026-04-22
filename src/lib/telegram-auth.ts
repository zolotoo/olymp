import crypto from 'crypto'

export interface TelegramUser {
  id: number
  first_name?: string
  last_name?: string
  username?: string
  language_code?: string
  photo_url?: string
}

export interface ValidatedInitData {
  user: TelegramUser
  auth_date: number
  query_id?: string
  start_param?: string
}

const MAX_AGE_SECONDS = 24 * 60 * 60 // 24h

/**
 * Validate Telegram Mini App initData.
 * Docs: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function validateInitData(initData: string, botToken: string): ValidatedInitData | null {
  if (!initData || !botToken) return null

  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  if (!hash) return null
  params.delete('hash')

  const pairs: [string, string][] = []
  params.forEach((value, key) => { pairs.push([key, value]) })
  const dataCheckString = pairs
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest()
  const computed = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

  if (computed !== hash) return null

  const authDate = Number(params.get('auth_date'))
  if (!authDate || Date.now() / 1000 - authDate > MAX_AGE_SECONDS) return null

  const userRaw = params.get('user')
  if (!userRaw) return null

  let user: TelegramUser
  try {
    user = JSON.parse(userRaw) as TelegramUser
  } catch {
    return null
  }
  if (!user?.id) return null

  return {
    user,
    auth_date: authDate,
    query_id: params.get('query_id') ?? undefined,
    start_param: params.get('start_param') ?? undefined,
  }
}

/**
 * Extract & validate initData from an incoming request.
 * Expects header `X-Telegram-Init-Data` (preferred) or body field `initData`.
 */
export function getAuthedUser(initData: string | null): TelegramUser | null {
  if (!initData) return null
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return null
  const result = validateInitData(initData, token)
  return result?.user ?? null
}
