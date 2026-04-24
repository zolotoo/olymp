import 'server-only'
import { createHash, randomBytes } from 'crypto'
import { cookies, headers } from 'next/headers'
import { supabaseAdmin } from './supabase'
import { sendMessage } from './telegram'

const COOKIE_NAME = 'admin_session'
const SESSION_TTL_DAYS = 30
const CODE_TTL_MINUTES = 10
const MAX_CODE_ATTEMPTS = 5
const MAX_CODES_PER_HOUR = 6

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex')
}

function genCode(): string {
  // 6-digit zero-padded
  return String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0')
}

function getAdminTgId(): number | null {
  const v = process.env.ADMIN_TG_ID
  if (!v) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function getAdminUsername(): string {
  return (process.env.ADMIN_USERNAME || 'sergeyzolotykh').toLowerCase()
}

function normalizeUsername(input: string): string {
  return input.trim().replace(/^@/, '').toLowerCase()
}

async function clientMeta() {
  const h = await headers()
  return {
    ip: h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || null,
    ua: h.get('user-agent')?.slice(0, 200) || null,
  }
}

export async function requestLoginCode(rawUsername: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const username = normalizeUsername(rawUsername)
  const adminUsername = getAdminUsername()
  const adminTgId = getAdminTgId()

  if (!adminTgId) {
    console.error('ADMIN_TG_ID is not set')
    return { ok: false, error: 'admin_not_configured' }
  }

  // Constant-ish behaviour: always pretend success on bad username so we
  // don't leak which usernames are admin. Just don't actually send/store.
  if (username !== adminUsername) {
    await new Promise((r) => setTimeout(r, 400 + Math.random() * 400))
    return { ok: true }
  }

  const { ip, ua } = await clientMeta()

  // Rate limit: count recent codes for this tg_id
  const sinceIso = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count } = await supabaseAdmin
    .from('admin_login_codes')
    .select('id', { count: 'exact', head: true })
    .eq('tg_id', adminTgId)
    .gte('created_at', sinceIso)
  if ((count ?? 0) >= MAX_CODES_PER_HOUR) {
    return { ok: false, error: 'rate_limited' }
  }

  const code = genCode()
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000).toISOString()

  await supabaseAdmin.from('admin_login_codes').insert({
    tg_id: adminTgId,
    code_hash: sha256(code),
    expires_at: expiresAt,
    ip,
    user_agent: ua,
  })

  const text =
    `🔐 <b>Код для входа в админ-панель</b>\n\n` +
    `<code>${code}</code>\n\n` +
    `Действует ${CODE_TTL_MINUTES} мин.${ip ? `\nIP: ${ip}` : ''}` +
    `\n\nЕсли это не ты — проигнорируй и сообщи об инциденте.`
  const res = await sendMessage(adminTgId, text)
  if (!res?.ok) {
    console.error('Failed to send login code:', res)
    return { ok: false, error: 'send_failed' }
  }
  return { ok: true }
}

export async function verifyLoginCode(rawCode: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const code = rawCode.trim()
  const adminTgId = getAdminTgId()
  if (!adminTgId) return { ok: false, error: 'admin_not_configured' }
  if (!/^\d{6}$/.test(code)) return { ok: false, error: 'invalid_format' }

  // Latest non-expired, non-used code for this tg_id
  const nowIso = new Date().toISOString()
  const { data: row } = await supabaseAdmin
    .from('admin_login_codes')
    .select('id, code_hash, attempts, used, expires_at')
    .eq('tg_id', adminTgId)
    .eq('used', false)
    .gt('expires_at', nowIso)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!row) return { ok: false, error: 'no_active_code' }
  if (row.attempts >= MAX_CODE_ATTEMPTS) return { ok: false, error: 'too_many_attempts' }

  if (sha256(code) !== row.code_hash) {
    await supabaseAdmin
      .from('admin_login_codes')
      .update({ attempts: row.attempts + 1 })
      .eq('id', row.id)
    return { ok: false, error: 'wrong_code' }
  }

  // Mark used
  await supabaseAdmin
    .from('admin_login_codes')
    .update({ used: true })
    .eq('id', row.id)

  // Create session
  const token = randomBytes(32).toString('base64url')
  const tokenHash = sha256(token)
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000)
  const { ip, ua } = await clientMeta()

  await supabaseAdmin.from('admin_sessions').insert({
    token_hash: tokenHash,
    tg_id: adminTgId,
    expires_at: expiresAt.toISOString(),
    ip,
    user_agent: ua,
  })

  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: expiresAt,
    path: '/',
  })

  return { ok: true }
}

export async function getCurrentAdminTgId(): Promise<number | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null
  const tokenHash = sha256(token)
  const { data } = await supabaseAdmin
    .from('admin_sessions')
    .select('tg_id, expires_at, revoked')
    .eq('token_hash', tokenHash)
    .maybeSingle()
  if (!data) return null
  if (data.revoked) return null
  if (new Date(data.expires_at).getTime() < Date.now()) return null
  // Best-effort touch (not awaited)
  supabaseAdmin
    .from('admin_sessions')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('token_hash', tokenHash)
    .then(() => {}, () => {})
  return data.tg_id
}

export async function logoutCurrentAdmin(): Promise<void> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (token) {
    const tokenHash = sha256(token)
    await supabaseAdmin
      .from('admin_sessions')
      .update({ revoked: true })
      .eq('token_hash', tokenHash)
  }
  cookieStore.delete(COOKIE_NAME)
}

export const ADMIN_COOKIE_NAME = COOKIE_NAME
