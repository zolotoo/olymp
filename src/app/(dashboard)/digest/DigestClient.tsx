'use client'
import { useEffect, useState, useTransition } from 'react'

interface DigestItem {
  message_id: number
  chat_id: number
  thread_id: number | null
  kind: string
  title_override: string | null
  is_featured: boolean
  text: string | null
  sent_at: string | null
}

interface DigestSection {
  kind: string
  topic_title: string
  topic_emoji: string | null
  items: DigestItem[]
  total: number
}

interface DigestPreview {
  week_start: string
  week_end: string
  total_published: number
  featured: DigestItem[]
  sections: DigestSection[]
  text_md: string
}

interface SavedDigest {
  week_start: string
  intro_md: string | null
  outro_md: string | null
  status: 'draft' | 'sent'
  sent_to_channel: boolean
  sent_to_dm: boolean
  sent_at: string | null
}

interface Resp {
  preview: DigestPreview
  saved: SavedDigest | null
  text_final: string
  cta_url: string
}

export default function DigestClient() {
  const [data, setData] = useState<Resp | null>(null)
  const [intro, setIntro] = useState('')
  const [outro, setOutro] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [lastResult, setLastResult] = useState<string | null>(null)

  const reload = () => {
    fetch('/api/digest').then(r => r.json()).then((d: Resp & { error?: string }) => {
      if (d.error) { setError(d.error); return }
      setError(null); setData(d)
      setIntro(d.saved?.intro_md ?? '')
      setOutro(d.saved?.outro_md ?? '')
    }).catch(() => setError('Сеть недоступна'))
  }
  useEffect(() => { reload() }, [])

  const save = (extra?: Partial<{ intro_md: string; outro_md: string }>) => {
    if (!data) return
    startTransition(async () => {
      const res = await fetch('/api/digest', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          week_start: data.preview.week_start,
          intro_md: extra?.intro_md ?? intro,
          outro_md: extra?.outro_md ?? outro,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        alert('Ошибка сохранения: ' + (d.error ?? res.statusText))
        return
      }
      reload()
    })
  }

  const send = (target: 'channel' | 'dm' | 'both') => {
    if (!data) return
    if (data.preview.total_published === 0) {
      alert('Нечего отправлять — за неделю не было опубликованных постов.')
      return
    }
    const targetLabel = target === 'channel' ? 'в канал' : target === 'dm' ? 'в личку всем участникам' : 'в канал и в личку'
    if (!confirm(`Отправить дайджест ${targetLabel}?`)) return

    startTransition(async () => {
      const res = await fetch('/api/digest', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ week_start: data.preview.week_start, target }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert('Ошибка: ' + (d.error ?? res.statusText))
        return
      }
      const parts: string[] = []
      if (d.channel) parts.push('канал ✅')
      if (d.dm_broadcast_id) parts.push(`DM черновик #${d.dm_broadcast_id} запущен`)
      if (d.errors?.length) parts.push('ошибки: ' + d.errors.join('; '))
      setLastResult(parts.join(' · '))
      reload()
    })
  }

  if (error) return <div className="p-6 rounded-xl" style={{ background: '#FFEEEE', color: '#FF3B30' }}>{error}</div>
  if (!data) return <div className="text-center text-sm p-8" style={{ color: 'rgba(28,28,30,0.45)' }}>Загружаем…</div>

  const sentBadge = data.saved?.status === 'sent'

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold mb-1" style={{ color: '#1C1C1E', letterSpacing: '-1px' }}>
            Дайджест
          </h1>
          <p className="text-sm" style={{ color: 'rgba(28,28,30,0.55)' }}>
            Неделя {fmtDate(data.preview.week_start)} – {fmtDate(data.preview.week_end)}
            {' · '}
            опубликовано {data.preview.total_published}
            {data.preview.featured.length > 0 && ` · 🔥 ${data.preview.featured.length}`}
          </p>
        </div>
        {sentBadge && (
          <div className="text-xs px-3 py-1.5 rounded-full" style={{ background: '#E8F5E9', color: '#2E7D32', fontWeight: 600 }}>
            Отправлено {fmtDateTime(data.saved!.sent_at)}
            {data.saved!.sent_to_channel && ' · канал'}
            {data.saved!.sent_to_dm && ' · DM'}
          </div>
        )}
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)' }}>
        <div className="rounded-2xl p-5" style={{ background: '#FFFFFF', border: '1px solid rgba(28,28,30,0.08)' }}>
          <h2 className="text-sm font-bold mb-3" style={{ color: 'rgba(28,28,30,0.6)' }}>ШАБЛОН</h2>

          <Label>Вступление (заменяет первую строку шаблона)</Label>
          <textarea
            value={intro}
            onChange={e => setIntro(e.target.value)}
            rows={2}
            placeholder="📚 Что вышло в Олимпе на этой неделе:"
            style={inputStyle}
          />

          <Label>Хвост (добавляется в конец)</Label>
          <textarea
            value={outro}
            onChange={e => setOutro(e.target.value)}
            rows={3}
            placeholder="Подписывайтесь, ставьте лайки, делитесь с друзьями…"
            style={inputStyle}
          />

          <button
            onClick={() => save()}
            disabled={isPending}
            className="mt-3 px-4 py-2 rounded-full text-sm font-semibold"
            style={{ background: '#fff', border: '1px solid rgba(28,28,30,0.15)', color: '#1C1C1E', cursor: 'pointer' }}
          >
            💾 Сохранить шаблон
          </button>
        </div>

        <div className="rounded-2xl p-5" style={{ background: '#FFFFFF', border: '1px solid rgba(28,28,30,0.08)' }}>
          <h2 className="text-sm font-bold mb-3" style={{ color: 'rgba(28,28,30,0.6)' }}>ПРЕВЬЮ</h2>
          <pre
            className="text-sm whitespace-pre-wrap"
            style={{ color: '#1C1C1E', lineHeight: 1.55, fontFamily: 'inherit', margin: 0 }}
          >
            {data.text_final}
          </pre>
          <div className="mt-3 text-xs px-2 py-1 rounded inline-block" style={{ background: '#F5F5F7', color: 'rgba(28,28,30,0.6)' }}>
            CTA → {data.cta_url}
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl p-5" style={{ background: '#FFFFFF', border: '1px solid rgba(28,28,30,0.08)' }}>
        <h2 className="text-sm font-bold mb-3" style={{ color: 'rgba(28,28,30,0.6)' }}>ОТПРАВКА</h2>
        <div className="flex flex-wrap gap-2">
          <Btn onClick={() => send('channel')} disabled={isPending}>📢 Только в канал</Btn>
          <Btn onClick={() => send('dm')} disabled={isPending}>✉️ Только в DM</Btn>
          <Btn onClick={() => send('both')} disabled={isPending} primary>🚀 В канал + DM</Btn>
        </div>
        {lastResult && (
          <div className="mt-3 text-xs" style={{ color: 'rgba(28,28,30,0.7)' }}>{lastResult}</div>
        )}
        <p className="mt-3 text-xs" style={{ color: 'rgba(28,28,30,0.45)' }}>
          В канал — отправляется сразу. В DM — создаётся broadcasts-черновик и сразу запускается
          рассылка через стандартный механизм. Если хочешь только подготовить, без отправки —
          сначала сохрани шаблон, потом перейди в /broadcasts.
        </p>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid rgba(28,28,30,0.12)',
  color: '#1C1C1E',
  padding: '8px 10px',
  borderRadius: 10,
  width: '100%',
  fontSize: 14,
  marginBottom: 8,
  fontFamily: 'inherit',
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-xs mb-1 mt-2" style={{ color: 'rgba(28,28,30,0.6)', fontWeight: 600 }}>{children}</div>
}

function Btn({ children, onClick, disabled, primary }: {
  children: React.ReactNode; onClick: () => void; disabled?: boolean; primary?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-4 py-2 rounded-full text-sm font-semibold"
      style={{
        background: primary ? '#0A84FF' : '#fff',
        color: primary ? '#fff' : '#1C1C1E',
        border: primary ? '1px solid #0A84FF' : '1px solid rgba(28,28,30,0.15)',
        cursor: 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  )
}

function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('ru', { day: 'numeric', month: 'short' })
}
function fmtDateTime(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}
