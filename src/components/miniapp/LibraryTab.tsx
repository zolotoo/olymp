'use client'
import { useEffect, useState } from 'react'
import { tgFetch, useTelegram } from './TelegramProvider'

interface LibItem {
  message_id: number
  title: string
  preview: string
  sent_at: string
  has_media: boolean
  media_kind: string | null
  link: string
}

interface LibTopic {
  kind: string
  title: string
  emoji: string | null
  thread_id: number
  chat_id: number
  items: LibItem[]
}

const ACCENT = '#0A84FF'

export default function LibraryTab() {
  const { initData, ready, isTelegram } = useTelegram()
  const [topics, setTopics] = useState<LibTopic[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeKind, setActiveKind] = useState<string | null>(null)

  useEffect(() => {
    if (!ready || !isTelegram) return
    let cancelled = false
    tgFetch('/api/library', initData)
      .then(r => r.json())
      .then(d => {
        if (cancelled) return
        if (d.error) setError(d.error)
        else setTopics(d.topics ?? [])
      })
      .catch(() => { if (!cancelled) setError('Сеть недоступна') })
    return () => { cancelled = true }
  }, [ready, isTelegram, initData])

  const openTg = (link: string) => {
    if (window.Telegram?.WebApp?.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink(link)
    } else {
      window.open(link, '_blank')
    }
  }

  if (error) return <div className="text-center text-sm p-8" style={{ color: '#FF3B30' }}>{error}</div>
  if (!topics) return <div className="text-center text-sm p-8" style={{ color: 'rgba(28,28,30,0.45)' }}>Загружаем библиотеку…</div>

  if (topics.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12 text-center">
        <div className="rounded-3xl p-8" style={{ background: '#FFFFFF', border: '1px solid rgba(28,28,30,0.08)' }}>
          <div style={{ fontSize: 56, marginBottom: 12 }}>📚</div>
          <h2 className="text-xl font-bold mb-2" style={{ color: '#1C1C1E', letterSpacing: '-0.5px' }}>
            Библиотека пока пустая
          </h2>
          <p className="text-sm" style={{ color: 'rgba(28,28,30,0.55)', lineHeight: 1.55 }}>
            Админ ещё не добавил ветки группы в библиотеку. Загляни через пару дней.
          </p>
        </div>
      </div>
    )
  }

  const visible = activeKind ? topics.filter(t => t.kind === activeKind) : topics

  return (
    <div className="max-w-xl mx-auto px-4 pb-8">
      <div className="text-center mb-5">
        <h1 className="text-3xl font-bold mb-1" style={{ color: '#1C1C1E', letterSpacing: '-1px' }}>
          Библиотека
        </h1>
        <p className="text-sm" style={{ color: 'rgba(28,28,30,0.55)' }}>
          Уроки, гайды и кейсы из веток клуба
        </p>
      </div>

      {/* Фильтр-чипы по kind */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        <FilterChip active={activeKind === null} onClick={() => setActiveKind(null)}>Все</FilterChip>
        {topics.map(t => (
          <FilterChip key={t.kind} active={activeKind === t.kind} onClick={() => setActiveKind(t.kind)}>
            {t.emoji ? <span style={{ marginRight: 4 }}>{t.emoji}</span> : null}{t.title}
          </FilterChip>
        ))}
      </div>

      {visible.map(topic => (
        <section key={topic.thread_id} className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            {topic.emoji && <span style={{ fontSize: 22 }}>{topic.emoji}</span>}
            <h2 className="text-lg font-bold" style={{ color: '#1C1C1E', letterSpacing: '-0.4px' }}>
              {topic.title}
            </h2>
          </div>

          {topic.items.length === 0 ? (
            <div className="text-xs px-3 py-2" style={{ color: 'rgba(28,28,30,0.45)' }}>
              Пока нет постов в этой ветке.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {topic.items.map(item => (
                <div
                  key={item.message_id}
                  className="rounded-2xl p-4"
                  style={{ background: '#FFFFFF', border: '1px solid rgba(28,28,30,0.06)' }}
                >
                  <div className="flex items-start gap-2 mb-1">
                    <h3 className="text-sm font-semibold flex-1" style={{ color: '#1C1C1E', letterSpacing: '-0.2px', lineHeight: 1.35 }}>
                      {item.title}
                    </h3>
                  </div>
                  {item.preview && (
                    <p className="text-xs mb-3" style={{ color: 'rgba(28,28,30,0.60)', lineHeight: 1.55 }}>
                      {item.preview}{item.preview.length >= 200 ? '…' : ''}
                    </p>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: 'rgba(28,28,30,0.40)' }}>
                      {formatDate(item.sent_at)}
                    </span>
                    <button
                      onClick={() => openTg(item.link)}
                      className="rounded-full px-3 py-1.5 text-xs font-semibold active:scale-[0.97]"
                      style={{ background: ACCENT, color: '#fff', border: 'none', cursor: 'pointer' }}
                    >
                      Открыть в Telegram →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  )
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap"
      style={{
        background: active ? ACCENT : '#FFFFFF',
        color: active ? '#fff' : '#1C1C1E',
        border: active ? `1px solid ${ACCENT}` : '1px solid rgba(28,28,30,0.10)',
        cursor: 'pointer',
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  )
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (days === 0) return 'сегодня'
  if (days === 1) return 'вчера'
  if (days < 7) return `${days} дн. назад`
  return d.toLocaleDateString('ru', { day: 'numeric', month: 'short' })
}
