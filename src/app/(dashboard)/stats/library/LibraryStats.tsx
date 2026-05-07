'use client'
import { useEffect, useState } from 'react'

interface ByKind {
  kind: string
  title: string
  emoji: string | null
  published: number
  clicks: number
}

interface TopPost {
  message_id: number
  chat_id: number
  kind: string
  title: string
  clicks: number
  is_featured: boolean
}

interface StatsResp {
  days: number
  by_kind: ByKind[]
  top_posts: TopPost[]
  totals: { published: number; clicks: number; unique_clickers: number }
  queue: { pending: number; oldest_days: number }
}

const RANGES = [
  { days: 7, label: '7 дней' },
  { days: 30, label: '30 дней' },
  { days: 90, label: '90 дней' },
]

export default function LibraryStats() {
  const [days, setDays] = useState(7)
  const [data, setData] = useState<StatsResp | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setData(null)
    fetch(`/api/stats/library?days=${days}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error)
        else { setError(null); setData(d) }
      })
      .catch(() => setError('Сеть недоступна'))
  }, [days])

  if (error) return <div className="p-4 rounded-xl" style={{ background: '#FFEEEE', color: '#FF3B30' }}>{error}</div>

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold mb-1" style={{ color: '#1C1C1E', letterSpacing: '-1px' }}>
            Статистика библиотеки
          </h1>
          <p className="text-sm" style={{ color: 'rgba(28,28,30,0.55)' }}>
            Какие ветки живые, какие глохнут.
          </p>
        </div>
        <div className="flex gap-1 rounded-full p-1" style={{ background: '#F5F5F7' }}>
          {RANGES.map(r => (
            <button
              key={r.days}
              onClick={() => setDays(r.days)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{
                background: days === r.days ? '#fff' : 'transparent',
                color: days === r.days ? '#1C1C1E' : 'rgba(28,28,30,0.6)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {!data ? (
        <div className="text-center text-sm p-8" style={{ color: 'rgba(28,28,30,0.45)' }}>Загружаем…</div>
      ) : (
        <>
          <div className="grid gap-3 mb-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
            <Stat label="Опубликовано" value={data.totals.published} />
            <Stat label="Кликов в TG" value={data.totals.clicks} />
            <Stat label="Уникальных читателей" value={data.totals.unique_clickers} />
            <Stat
              label="Очередь модерации"
              value={data.queue.pending}
              accent={data.queue.oldest_days > 7 ? '#FF9500' : data.queue.pending > 0 ? '#0A84FF' : undefined}
              hint={data.queue.pending > 0 ? `старшему ${data.queue.oldest_days} дн.` : undefined}
            />
          </div>

          <Card>
            <h2 className="text-sm font-bold mb-3" style={{ color: 'rgba(28,28,30,0.6)' }}>ПО РАЗДЕЛАМ</h2>
            {data.by_kind.length === 0 ? (
              <div className="text-sm" style={{ color: 'rgba(28,28,30,0.5)' }}>Пока нет данных.</div>
            ) : (
              <div className="flex flex-col gap-2">
                {data.by_kind.map(k => <KindBar key={k.kind} k={k} maxClicks={Math.max(...data.by_kind.map(x => x.clicks), 1)} />)}
              </div>
            )}
          </Card>

          <Card>
            <h2 className="text-sm font-bold mb-3" style={{ color: 'rgba(28,28,30,0.6)' }}>ТОП ПО КЛИКАМ</h2>
            {data.top_posts.length === 0 ? (
              <div className="text-sm" style={{ color: 'rgba(28,28,30,0.5)' }}>Никто пока не открывал посты в TG из мини-аппа.</div>
            ) : (
              <ol className="flex flex-col gap-2">
                {data.top_posts.map((p, i) => (
                  <li key={`${p.chat_id}:${p.message_id}`} className="flex items-baseline gap-3">
                    <span style={{ color: 'rgba(28,28,30,0.4)', fontWeight: 700, width: 18, fontSize: 12 }}>{i + 1}.</span>
                    <span style={{ color: '#1C1C1E', fontWeight: 600, flex: 1 }}>
                      {p.is_featured && <span style={{ marginRight: 6 }}>🔥</span>}
                      {p.title}
                    </span>
                    <span style={{ color: 'rgba(28,28,30,0.6)', fontSize: 13, fontWeight: 600 }}>{p.clicks}</span>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </>
      )}
    </div>
  )
}

function Stat({ label, value, hint, accent }: { label: string; value: number; hint?: string; accent?: string }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: '#FFFFFF', border: '1px solid rgba(28,28,30,0.08)' }}>
      <div className="text-xs mb-1" style={{ color: 'rgba(28,28,30,0.6)' }}>{label}</div>
      <div className="text-2xl font-bold" style={{ color: accent ?? '#1C1C1E', letterSpacing: '-0.5px' }}>{value}</div>
      {hint && <div className="text-xs" style={{ color: 'rgba(28,28,30,0.5)' }}>{hint}</div>}
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-5 mb-4" style={{ background: '#FFFFFF', border: '1px solid rgba(28,28,30,0.08)' }}>
      {children}
    </div>
  )
}

function KindBar({ k, maxClicks }: { k: ByKind; maxClicks: number }) {
  const w = maxClicks > 0 ? (k.clicks / maxClicks) * 100 : 0
  return (
    <div className="flex items-center gap-3">
      <div style={{ width: 140, fontSize: 13, color: '#1C1C1E', fontWeight: 600 }}>
        {k.emoji && <span style={{ marginRight: 4 }}>{k.emoji}</span>}
        {k.title}
      </div>
      <div style={{ flex: 1, height: 18, borderRadius: 9, background: '#F5F5F7', position: 'relative', overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${w}%`,
          background: 'linear-gradient(90deg, #0A84FF 0%, #5AC8FA 100%)',
          borderRadius: 9,
          transition: 'width 0.3s',
        }} />
      </div>
      <div style={{ width: 80, textAlign: 'right', fontSize: 12, color: 'rgba(28,28,30,0.7)' }}>
        <span style={{ fontWeight: 600 }}>{k.published}</span> постов · <span style={{ fontWeight: 600 }}>{k.clicks}</span> 👆
      </div>
    </div>
  )
}
