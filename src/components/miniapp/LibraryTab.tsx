'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { tgFetch, useTelegram } from './TelegramProvider'

interface LibItem {
  message_id: number
  title: string
  preview: string
  sent_at: string
  has_media: boolean
  media_kind: string | null
  is_featured: boolean
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
const NEW_KIND = '__new__'

// Цвета фона для Featured-карточек по kind. Apple-style градиенты.
const KIND_GRADIENT: Record<string, string> = {
  practice: 'linear-gradient(135deg, #5E5CE6 0%, #BF5AF2 100%)',
  guides:   'linear-gradient(135deg, #0A84FF 0%, #5AC8FA 100%)',
  streams:  'linear-gradient(135deg, #FF375F 0%, #FF9F0A 100%)',
  free:     'linear-gradient(135deg, #34C759 0%, #30D158 100%)',
  trends:   'linear-gradient(135deg, #FF9500 0%, #FFD60A 100%)',
  rules:    'linear-gradient(135deg, #8E8E93 0%, #636366 100%)',
  results:  'linear-gradient(135deg, #FF2D55 0%, #FF375F 100%)',
}

const KIND_CHIP_LABELS: Record<string, string> = {
  guides: 'Гайды',
}

interface Props {
  initialKind?: string | null
  initialMsgId?: number | null
}

export default function LibraryTab({ initialKind, initialMsgId }: Props = {}) {
  const { initData, ready, isTelegram } = useTelegram()
  const [topics, setTopics] = useState<LibTopic[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeKind, setActiveKind] = useState<string | null>(initialKind ?? null)
  const [highlightMsg, setHighlightMsg] = useState<number | null>(initialMsgId ?? null)
  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map())

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

  // После загрузки данных, если был deeplink на конкретный msg — скроллим
  // к нему и подсвечиваем 2 секунды.
  useEffect(() => {
    if (!topics || !highlightMsg) return
    const node = cardRefs.current.get(highlightMsg)
    if (!node) return
    node.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const t = window.setTimeout(() => setHighlightMsg(null), 2200)
    return () => window.clearTimeout(t)
  }, [topics, highlightMsg])

  // Сплющенные элементы тащат с собой chat_id из родительского топика —
  // иначе клик-трекер записывает события с chat_id=0 и аналитика бесполезна.
  type FlatItem = LibItem & { kind: string; chat_id: number; topicTitle: string; topicEmoji: string | null }

  // Featured: всё что is_featured=true, отсортированное по дате DESC, top 3.
  // Карусель не зависит от выбранного фильтра.
  const featured = useMemo<FlatItem[]>(() => {
    if (!topics) return []
    const all: FlatItem[] = []
    for (const t of topics) for (const it of t.items) {
      if (it.is_featured) all.push({ ...it, kind: t.kind, chat_id: t.chat_id, topicTitle: t.title, topicEmoji: t.emoji })
    }
    all.sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime())
    return all.slice(0, 3)
  }, [topics])

  // «Новое 7д» — все посты за последние 7 дней (по sent_at), все kind вместе.
  const newItems = useMemo<FlatItem[]>(() => {
    if (!topics) return []
    const cutoff = Date.now() - 7 * 86_400_000
    const all: FlatItem[] = []
    for (const t of topics) for (const it of t.items) {
      if (new Date(it.sent_at).getTime() >= cutoff) {
        all.push({ ...it, kind: t.kind, chat_id: t.chat_id, topicTitle: t.title, topicEmoji: t.emoji })
      }
    }
    all.sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime())
    return all
  }, [topics])

  const openTg = (item: { link: string; message_id: number; kind: string; chat_id: number }) => {
    // Fire-and-forget трекинг клика. Не ждём ответ — UX важнее.
    void fetch('/api/library/click', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-telegram-init-data': initData || '' },
      body: JSON.stringify({ chat_id: item.chat_id, message_id: item.message_id, kind: item.kind }),
    }).catch(() => {})
    if (window.Telegram?.WebApp?.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink(item.link)
    } else {
      window.open(item.link, '_blank')
    }
  }

  if (error) return <div className="text-center text-sm p-8" style={{ color: '#FF3B30' }}>{error}</div>
  if (!topics) return <div className="text-center text-sm p-8" style={{ color: 'rgba(28,28,30,0.45)' }}>Загружаем библиотеку…</div>

  if (topics.length === 0 || topics.every(t => t.items.length === 0)) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12 text-center">
        <div className="rounded-3xl p-8" style={{ background: '#FFFFFF', border: '1px solid rgba(28,28,30,0.08)' }}>
          <div style={{ fontSize: 56, marginBottom: 12 }}>📚</div>
          <h2 className="text-xl font-bold mb-2" style={{ color: '#1C1C1E', letterSpacing: '-0.5px' }}>
            Библиотека пока пустая
          </h2>
          <p className="text-sm" style={{ color: 'rgba(28,28,30,0.55)', lineHeight: 1.55 }}>
            Скоро тут появятся уроки, гайды и кейсы. Загляни через пару дней.
          </p>
        </div>
      </div>
    )
  }

  // Видимое содержимое: либо «новое», либо обычная разбивка по топикам с фильтром.
  const showNew = activeKind === NEW_KIND
  const visibleTopics = activeKind && activeKind !== NEW_KIND
    ? topics.filter(t => t.kind === activeKind)
    : topics

  return (
    <div className="max-w-xl mx-auto px-4 pb-8">
      <div className="text-center mb-4">
        <h1 className="text-3xl font-bold mb-1" style={{ color: '#1C1C1E', letterSpacing: '-1px' }}>
          Библиотека
        </h1>
        <p className="text-sm" style={{ color: 'rgba(28,28,30,0.55)' }}>
          Уроки, гайды и кейсы из веток клуба
        </p>
      </div>

      {/* Featured-карусель: горизонтальная лента 1-3 карточек */}
      {featured.length > 0 && (
        <div
          className="flex gap-3 mb-4 overflow-x-auto pb-2 -mx-4 px-4"
          style={{ scrollbarWidth: 'none', scrollSnapType: 'x mandatory' }}
        >
          {featured.map(f => (
            <FeaturedCard
              key={f.message_id}
              item={f}
              onOpen={() => openTg({ link: f.link, message_id: f.message_id, kind: f.kind, chat_id: f.chat_id })}
            />
          ))}
        </div>
      )}

      {/* Чипы фильтра — «Все», «🆕 Новое», далее по kind */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        <FilterChip active={activeKind === null} onClick={() => setActiveKind(null)}>Все</FilterChip>
        {newItems.length > 0 && (
          <FilterChip active={activeKind === NEW_KIND} onClick={() => setActiveKind(NEW_KIND)}>
            🆕 Новое <span style={{ opacity: 0.7, marginLeft: 4 }}>{newItems.length}</span>
          </FilterChip>
        )}
        {dedupByKind(topics).map(t => (
          <FilterChip key={t.kind} active={activeKind === t.kind} onClick={() => setActiveKind(t.kind)}>
            {t.emoji ? <span style={{ marginRight: 4 }}>{t.emoji}</span> : null}{kindChipLabel(t.kind, t.title)}
          </FilterChip>
        ))}
      </div>

      {showNew ? (
        <section className="mb-6">
          <h2 className="text-lg font-bold mb-2" style={{ color: '#1C1C1E', letterSpacing: '-0.4px' }}>
            🆕 За последние 7 дней
          </h2>
          {newItems.length === 0 ? (
            <div className="text-xs px-3 py-2" style={{ color: 'rgba(28,28,30,0.45)' }}>
              Пока тихо. Возвращайся через день.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {newItems.map(it => (
                <ItemCard
                  key={it.message_id}
                  item={it}
                  topicEmoji={it.topicEmoji ?? undefined}
                  topicTitle={it.topicTitle}
                  highlight={highlightMsg === it.message_id}
                  cardRef={el => { if (el) cardRefs.current.set(it.message_id, el) }}
                  onOpen={() => openTg({ link: it.link, message_id: it.message_id, kind: it.kind, chat_id: it.chat_id })}
                />
              ))}
            </div>
          )}
        </section>
      ) : (
        visibleTopics.map(topic => (
          <section key={`${topic.chat_id}:${topic.thread_id}`} className="mb-6">
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
                  <ItemCard
                    key={item.message_id}
                    item={{ ...item, kind: topic.kind }}
                    highlight={highlightMsg === item.message_id}
                    cardRef={el => { if (el) cardRefs.current.set(item.message_id, el) }}
                    onOpen={() => openTg({ link: item.link, message_id: item.message_id, kind: topic.kind, chat_id: topic.chat_id })}
                  />
                ))}
              </div>
            )}
          </section>
        ))
      )}
    </div>
  )
}

function FeaturedCard({ item, onOpen }: {
  item: LibItem & { kind: string; topicTitle: string }
  onOpen: () => void
}) {
  const bg = KIND_GRADIENT[item.kind] ?? 'linear-gradient(135deg, #0A84FF 0%, #5AC8FA 100%)'
  return (
    <button
      onClick={onOpen}
      className="rounded-3xl text-left active:scale-[0.98] transition-transform"
      style={{
        flexShrink: 0,
        scrollSnapAlign: 'start',
        width: '78%',
        minWidth: 260,
        height: 132,
        padding: '16px 18px',
        background: bg,
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        color: '#fff',
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.85, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
        🔥 Топ недели
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.25, letterSpacing: '-0.4px' }}>
        {item.title.slice(0, 80)}
      </div>
      <div style={{ fontSize: 11, opacity: 0.85 }}>
        {item.topicTitle} · {formatDate(item.sent_at)}
      </div>
    </button>
  )
}

function ItemCard({ item, topicEmoji, topicTitle, highlight, cardRef, onOpen }: {
  item: LibItem & { kind: string }
  topicEmoji?: string
  topicTitle?: string
  highlight: boolean
  cardRef: (el: HTMLDivElement | null) => void
  onOpen: () => void
}) {
  return (
    <div
      ref={cardRef}
      className="rounded-2xl p-4"
      style={{
        background: highlight ? '#FFF8E1' : '#FFFFFF',
        border: highlight ? '1px solid #FFD60A' : '1px solid rgba(28,28,30,0.06)',
        transition: 'background 0.4s, border-color 0.4s',
      }}
    >
      {(topicTitle || item.is_featured) && (
        <div className="flex items-center gap-2 mb-1 text-xs" style={{ color: 'rgba(28,28,30,0.55)' }}>
          {topicEmoji && <span>{topicEmoji}</span>}
          {topicTitle && <span style={{ fontWeight: 600 }}>{topicTitle}</span>}
          {item.is_featured && <span style={{ color: '#FF9500', fontWeight: 600 }}>🔥 Featured</span>}
        </div>
      )}
      <h3 className="text-sm font-semibold mb-1" style={{ color: '#1C1C1E', letterSpacing: '-0.2px', lineHeight: 1.35 }}>
        {item.title}
      </h3>
      {item.preview && (
        <p className="text-xs mb-3" style={{ color: 'rgba(28,28,30,0.60)', lineHeight: 1.55 }}>
          {item.preview}{item.preview.length >= 200 ? '…' : ''}
        </p>
      )}
      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ color: 'rgba(28,28,30,0.40)' }}>{formatDate(item.sent_at)}</span>
        <button
          onClick={onOpen}
          className="rounded-full px-3 py-1.5 text-xs font-semibold active:scale-[0.97]"
          style={{ background: ACCENT, color: '#fff', border: 'none', cursor: 'pointer' }}
        >
          Открыть в Telegram →
        </button>
      </div>
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

function dedupByKind(topics: LibTopic[]): LibTopic[] {
  const seen = new Set<string>()
  const out: LibTopic[] = []
  for (const t of topics) {
    if (seen.has(t.kind)) continue
    seen.add(t.kind)
    out.push(t)
  }
  return out
}

function kindChipLabel(kind: string, fallback: string): string {
  return KIND_CHIP_LABELS[kind] ?? fallback
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
