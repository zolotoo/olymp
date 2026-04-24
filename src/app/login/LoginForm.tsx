'use client'

import { useActionState, useState } from 'react'
import { requestCodeAction, verifyCodeAction, backToUsernameAction, type LoginState } from './actions'

const card = {
  background: 'rgba(255,255,255,0.78)',
  backdropFilter: 'blur(28px) saturate(160%)',
  WebkitBackdropFilter: 'blur(28px) saturate(160%)',
  border: '1px solid rgba(255,255,255,0.55)',
  boxShadow: '0 12px 40px rgba(0,0,0,0.10), 0 4px 12px rgba(0,0,0,0.06)',
}

const initial: LoginState = { stage: 'username' }

export default function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(
    async (prev, fd) => {
      if (prev.stage === 'username') return await requestCodeAction(prev, fd)
      return await verifyCodeAction(prev, fd)
    },
    initial,
  )
  const [, backAction, backPending] = useActionState<LoginState, FormData>(
    async () => await backToUsernameAction(),
    initial,
  )
  const [showResent, setShowResent] = useState(false)

  return (
    <div className="rounded-2xl p-8 w-full max-w-md" style={card}>
      <h1 className="text-2xl font-bold mb-1" style={{ color: '#1C1C1E', letterSpacing: '-0.5px' }}>
        AI Олимп · Админка
      </h1>
      <p className="text-sm mb-6" style={{ color: 'rgba(28,28,30,0.55)' }}>
        Доступ только по @username + код в Telegram
      </p>

      <form action={action} className="space-y-3">
        {state.stage === 'username' ? (
          <>
            <label className="block text-xs font-semibold uppercase tracking-wide" style={{ color: 'rgba(28,28,30,0.5)' }}>
              Telegram username
            </label>
            <input
              name="username"
              autoFocus
              autoComplete="off"
              placeholder="@sergeyzolotykh"
              className="w-full px-4 py-3 rounded-xl text-base outline-none"
              style={{
                background: '#fff',
                border: '1px solid rgba(28,28,30,0.12)',
                color: '#1C1C1E',
              }}
            />
            <button
              type="submit"
              disabled={pending}
              className="w-full px-4 py-3 rounded-xl text-base font-semibold transition-opacity disabled:opacity-50"
              style={{ background: '#0A84FF', color: '#fff' }}
            >
              {pending ? 'Отправка кода…' : 'Получить код'}
            </button>
            {state.error && (
              <p className="text-sm" style={{ color: '#FF3B30' }}>{state.error}</p>
            )}
          </>
        ) : (
          <>
            <p className="text-sm" style={{ color: 'rgba(28,28,30,0.7)' }}>
              Код отправлен в Telegram <b>@{state.username}</b>. Введи 6 цифр ниже.
            </p>
            <label className="block text-xs font-semibold uppercase tracking-wide" style={{ color: 'rgba(28,28,30,0.5)' }}>
              Код из бота
            </label>
            <input
              name="code"
              autoFocus
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              placeholder="••••••"
              className="w-full px-4 py-3 rounded-xl text-2xl font-mono tracking-widest text-center outline-none"
              style={{
                background: '#fff',
                border: '1px solid rgba(28,28,30,0.12)',
                color: '#1C1C1E',
              }}
            />
            <button
              type="submit"
              disabled={pending}
              className="w-full px-4 py-3 rounded-xl text-base font-semibold transition-opacity disabled:opacity-50"
              style={{ background: '#0A84FF', color: '#fff' }}
            >
              {pending ? 'Проверка…' : 'Войти'}
            </button>
            {state.error && (
              <p className="text-sm" style={{ color: '#FF3B30' }}>{state.error}</p>
            )}
            <div className="flex items-center justify-between mt-2 text-sm">
              <button
                type="button"
                onClick={() => {
                  // Trigger back action by submitting hidden form
                  const fd = new FormData()
                  backAction(fd)
                }}
                disabled={backPending}
                style={{ color: '#0A84FF', background: 'transparent', border: 'none', cursor: 'pointer' }}
              >
                ← Сменить username
              </button>
              <ResendButton username={state.username} onResent={() => setShowResent(true)} />
            </div>
            {showResent && (
              <p className="text-xs" style={{ color: '#30D158' }}>Новый код отправлен.</p>
            )}
          </>
        )}
      </form>
    </div>
  )
}

function ResendButton({ username, onResent }: { username: string; onResent: () => void }) {
  const [pending, setPending] = useState(false)
  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true)
        const fd = new FormData()
        fd.set('username', username)
        await requestCodeAction({ stage: 'username' }, fd)
        setPending(false)
        onResent()
      }}
      style={{ color: '#0A84FF', background: 'transparent', border: 'none', cursor: 'pointer' }}
    >
      {pending ? 'Отправка…' : 'Отправить ещё раз'}
    </button>
  )
}
