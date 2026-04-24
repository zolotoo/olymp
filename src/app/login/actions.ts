'use server'

import { redirect } from 'next/navigation'
import { requestLoginCode, verifyLoginCode, logoutCurrentAdmin } from '@/lib/admin-auth'

export type LoginState =
  | { stage: 'username'; error?: string }
  | { stage: 'code'; username: string; error?: string }

export async function requestCodeAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get('username') || '').trim()
  if (!username) return { stage: 'username', error: 'Введи @username' }

  const r = await requestLoginCode(username)
  if (!r.ok) {
    if (r.error === 'rate_limited') {
      return { stage: 'username', error: 'Слишком много попыток. Подожди час.' }
    }
    if (r.error === 'send_failed') {
      return { stage: 'username', error: 'Не удалось отправить код. Проверь, что бот запущен и ADMIN_TG_ID настроен.' }
    }
    return { stage: 'username', error: 'Ошибка. Попробуй ещё раз.' }
  }
  return { stage: 'code', username }
}

export async function verifyCodeAction(prev: LoginState, formData: FormData): Promise<LoginState> {
  if (prev.stage !== 'code') return { stage: 'username', error: 'Начни заново.' }
  const code = String(formData.get('code') || '').trim()
  if (!/^\d{6}$/.test(code)) {
    return { stage: 'code', username: prev.username, error: 'Код — 6 цифр.' }
  }
  const r = await verifyLoginCode(code)
  if (!r.ok) {
    const map: Record<string, string> = {
      no_active_code: 'Код истёк или не запрашивался. Запроси новый.',
      too_many_attempts: 'Слишком много попыток. Запроси новый код.',
      wrong_code: 'Неверный код.',
      invalid_format: 'Код — 6 цифр.',
      admin_not_configured: 'ADMIN_TG_ID не настроен на сервере.',
    }
    return { stage: 'code', username: prev.username, error: map[r.error] || 'Ошибка.' }
  }
  redirect('/')
}

export async function backToUsernameAction(): Promise<LoginState> {
  return { stage: 'username' }
}

export async function logoutAction(): Promise<void> {
  await logoutCurrentAdmin()
  redirect('/login')
}
