'use client'
import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

// useEffect импортирован выше — используется в Card для синка title.

type Status = 'pending' | 'published' | 'rejected'

interface Item {
  id: number
  chat_id: number
  message_id: number
  thread_id: number | null
  kind: string
  status: Status
  title_override: string | null
  is_featured: boolean
  approved_at: string | null
  created_at: string
  text: string | null
  has_media: boolean
  media_kind: string | null
  sent_at: string | null
  topic_title: string
  topic_emoji: string | null
}

interface Resp {
  items: Item[]
  counts: { pending: number; published: number; rejected: number }
}

const STATUS_LABEL: Record<Status, string> = {
  pending: 'На разборе',
  published: 'Опубликовано',
  rejected: 'Скрыто',
}

function deriveTitle(it: Item): string {
  if (it.title_override?.trim()) return it.title_override
  const t = (it.text ?? '').trim()
  const firstLine = t.split(/\n+/).map(s => s.trim()).find(Boolean) ?? ''
  return firstLine.slice(0, 120) || 'Пост без текста'
}

function deepLink(chatId: number, threadId: number | null, messageId: number): string {
  const shortId = String(Math.abs(chatId)).startsWith('100')
    ? Math.abs(chatId) - 1_000_000_000_000
    : Math.abs(chatId)
  return threadId
    ? `https://t.me/c/${shortId}/${threadId}/${messageId}`
    : `https://t.me/c/${shortId}/${messageId}`
}

function daysAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const d = Math.floor(ms / 86_400_000)
  if (d === 0) return 'сегодня'
  if (d === 1) return 'вчера'
  if (d < 7) return `${d} дн. назад`
  return new Date(iso).toLocaleDateString('ru', { day: 'numeric', month: 'short' })
}

export default function LibraryAdmin() {
  const router = useRouter()
  const [status, setStatus] = useState<Status>('pending')
  const [data, setData] = useState<Resp | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const reload = (s: Status = status) => {
    fetch(`/api/library/items?status=${s}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error)
        else { setError(null); setData(d) }
      })
      .catch(() => setError('Сеть недоступна'))
  }
  useEffect(() => { reload(status) }, [status])

  const act = (id: number, action: string, title?: string) => {
    startTransition(async () => {
      const res = await fetch('/api/library/items', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, action, title }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        alert('Ошибка: ' + (d.error ?? res.statusText))
        return
      }
      reload(status)
    })
  }

  // Создаёт broadcast-черновик и ведёт админа на страницу рассылки.
  // Сама отправка — там, после ревью.
  const notify = (id: number) => {
    startTransition(async () => {
      const res = await fetch('/api/library/items/notify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok || !d.broadcast_id) {
        alert('Ошибка: ' + (d.error ?? res.statusText))
        return
      }
      router.push(`/broadcasts/${d.broadcast_id}`)
    })
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-1" style={{ color: '#1C1C1E', letterSpacing: '-1px' }}>
          Библиотека
        </h1>
        <p className="text-sm" style={{ color: 'rgba(28,28,30,0.55)' }}>
          Модерация постов из веток клуба перед публикацией в мини-апп.
        </p>
      </div>

      <div className="flex gap-2 mb-6">
        {(['pending', 'published', 'rejected'] as Status[]).map(s => {
          const c = data?.counts[s] ?? 0
          const active = status === s
          return (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className="rounded-full px-4 py-2 text-sm font-semibold"
              style={{
                background: active ? '#0A84FF' : '#FFFFFF',
                color: active ? '#fff' : '#1C1C1E',
                border: active ? '1px solid #0A84FF' : '1px solid rgba(28,28,30,0.10)',
                cursor: 'pointer',
              }}
            >
              {STATUS_LABEL[s]} <span style={{ opacity: 0.7 }}>{c}</span>
            </button>
          )
        })}
      </div>

      {error && <div className="p-4 mb-4 rounded-xl" style={{ background: '#FFEEEE', color: '#FF3B30' }}>{error}</div>}

      {!data ? (
        <div className="text-center text-sm p-8" style={{ color: 'rgba(28,28,30,0.45)' }}>Загружаем…</div>
      ) : data.items.length === 0 ? (
        <div className="text-center text-sm p-12 rounded-2xl" style={{ background: '#FFFFFF', border: '1px solid rgba(28,28,30,0.06)', color: 'rgba(28,28,30,0.55)' }}>
          {status === 'pending' && 'Очередь пустая 🎉 Все посты разобраны.'}
          {status === 'published' && 'Пока ничего не опубликовано.'}
          {status === 'rejected' && 'Скрытых постов нет.'}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {data.items.map(it => (
            <Card key={it.id} item={it} status={status} onAct={act} onNotify={notify} disabled={isPending} />
          ))}
        </div>
      )}
    </div>
  )
}

function Card({ item, status, onAct, onNotify, disabled }: {
  item: Item; status: Status
  onAct: (id: number, action: string, title?: string) => void
  onNotify: (id: number) => void
  disabled: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(deriveTitle(item))

  // Когда родитель перезагружает данные после PATCH, item меняется,
  // но React переиспользует Card-инстанс по key=item.id и useState
  // не реинициализирует state. Без этого синка title в редакторе
  // оставался бы старым после ручной правки.
  useEffect(() => { setTitle(deriveTitle(item)) }, [item.title_override, item.text])

  const saveTitle = () => {
    onAct(item.id, 'title', title)
    setEditing(false)
  }

  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: '#FFFFFF', border: '1px solid rgba(28,28,30,0.08)' }}
    >
      <div className="flex items-center gap-2 text-xs mb-2" style={{ color: 'rgba(28,28,30,0.55)' }}>
        {item.topic_emoji && <span>{item.topic_emoji}</span>}
        <span style={{ fontWeight: 600 }}>{item.topic_title}</span>
        <span>·</span>
        <span>{item.sent_at ? daysAgo(item.sent_at) : '—'}</span>
        {item.is_featured && (
          <>
            <span>·</span>
            <span style={{ color: '#FF9500', fontWeight: 600 }}>🔥 Featured</span>
          </>
        )}
      </div>

      {editing ? (
        <div className="mb-3">
          <textarea
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full p-2 rounded-lg border text-base font-semibold"
            style={{ borderColor: 'rgba(28,28,30,0.15)', minHeight: 60 }}
          />
          <div className="flex gap-2 mt-2">
            <button onClick={saveTitle} className="px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{ background: '#0A84FF', color: '#fff', border: 'none', cursor: 'pointer' }}>
              Сохранить
            </button>
            <button onClick={() => { setTitle(deriveTitle(item)); setEditing(false) }}
              className="px-3 py-1.5 rounded-full text-xs"
              style={{ background: '#fff', border: '1px solid rgba(28,28,30,0.15)', cursor: 'pointer' }}>
              Отмена
            </button>
          </div>
        </div>
      ) : (
        <h3
          onClick={() => setEditing(true)}
          className="text-base font-semibold mb-2 cursor-text"
          style={{ color: '#1C1C1E', letterSpacing: '-0.3px', lineHeight: 1.35 }}
          title="Кликни, чтобы поменять заголовок"
        >
          {deriveTitle(item)} <span style={{ opacity: 0.4, fontSize: 12 }}>✏️</span>
        </h3>
      )}

      {item.text && (
        <p className="text-sm mb-3 whitespace-pre-wrap" style={{ color: 'rgba(28,28,30,0.7)', lineHeight: 1.5 }}>
          {item.text.length > 400 ? item.text.slice(0, 400) + '…' : item.text}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {status === 'pending' && (
          <>
            <Btn onClick={() => onAct(item.id, 'approve')} primary disabled={disabled}>✅ Опубликовать</Btn>
            <Btn onClick={() => onAct(item.id, 'approve_featured')} disabled={disabled}>🔥 Опубликовать + Featured</Btn>
            <Btn onClick={() => onAct(item.id, 'reject')} danger disabled={disabled}>❌ Скрыть</Btn>
          </>
        )}
        {status === 'published' && (
          <>
            <Btn onClick={() => onNotify(item.id)} primary disabled={disabled}>✉️ Уведомить участников</Btn>
            {item.is_featured
              ? <Btn onClick={() => onAct(item.id, 'unfeature')} disabled={disabled}>Убрать из Featured</Btn>
              : <Btn onClick={() => onAct(item.id, 'feature')} disabled={disabled}>🔥 В Featured</Btn>}
            <Btn onClick={() => onAct(item.id, 'unpublish')} disabled={disabled}>↩︎ Вернуть на разбор</Btn>
            <Btn onClick={() => onAct(item.id, 'reject')} danger disabled={disabled}>❌ Скрыть</Btn>
          </>
        )}
        {status === 'rejected' && (
          <Btn onClick={() => onAct(item.id, 'approve')} primary disabled={disabled}>↺ Восстановить</Btn>
        )}
        <a
          href={deepLink(item.chat_id, item.thread_id, item.message_id)}
          target="_blank"
          rel="noreferrer"
          className="px-3 py-1.5 rounded-full text-xs font-medium"
          style={{ background: '#fff', color: '#1C1C1E', border: '1px solid rgba(28,28,30,0.15)', textDecoration: 'none' }}
        >
          → В Telegram
        </a>
      </div>
    </div>
  )
}

function Btn({ children, onClick, disabled, primary, danger }: {
  children: React.ReactNode; onClick: () => void; disabled?: boolean; primary?: boolean; danger?: boolean
}) {
  const bg = primary ? '#0A84FF' : danger ? '#FFEFEF' : '#FFFFFF'
  const fg = primary ? '#fff' : danger ? '#FF3B30' : '#1C1C1E'
  const border = primary ? '#0A84FF' : danger ? '#FFC8C8' : 'rgba(28,28,30,0.15)'
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-3 py-1.5 rounded-full text-xs font-semibold"
      style={{ background: bg, color: fg, border: `1px solid ${border}`, cursor: 'pointer', opacity: disabled ? 0.5 : 1 }}
    >
      {children}
    </button>
  )
}
