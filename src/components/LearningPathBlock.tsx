'use client'

import { useEffect, useState } from 'react'

const card = {
  background: 'rgba(255,255,255,0.70)',
  backdropFilter: 'blur(28px) saturate(160%)',
  WebkitBackdropFilter: 'blur(28px) saturate(160%)',
  border: '1px solid rgba(255,255,255,0.55)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)',
}

type Item = {
  id: number
  chat_id: number
  message_id: number
  kind: string
  title: string
  is_featured: boolean
  score: number
  reasons: string[]
  miniapp_url: string
  chat_url: string
}

type Response = {
  tg_id: number
  recommended_paths: string[]
  top_kinds: string[]
  onboarding: { goal: string | null; level: string | null } | null
  items: Item[]
}

const KIND_LABEL: Record<string, string> = {
  trends: 'тренды',
  practice: 'практика',
  guides: 'гайды',
  streams: 'эфиры',
  results: 'результаты',
  rules: 'правила',
  free: 'бесплатное',
}

export default function LearningPathBlock({ tgId }: { tgId: number }) {
  const [data, setData] = useState<Response | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/learning-path/${tgId}`)
      .then((r) => r.json())
      .then((d: Response) => { if (!cancelled) setData(d) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [tgId])

  return (
    <div className="rounded-2xl p-6 mb-5" style={card}>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="font-semibold" style={{ color: '#1D1D1F' }}>🗺 Карта уроков</h2>
        {data && (data.recommended_paths.length > 0 || data.top_kinds.length > 0) && (
          <div className="text-xs" style={{ color: '#8E8E93' }}>
            {data.recommended_paths.length > 0 && (
              <span>путь: <b style={{ color: '#1D1D1F' }}>{data.recommended_paths.join(', ')}</b></span>
            )}
            {data.recommended_paths.length > 0 && data.top_kinds.length > 0 && <span> · </span>}
            {data.top_kinds.length > 0 && (
              <span>интересы: <b style={{ color: '#1D1D1F' }}>{data.top_kinds.map((k) => KIND_LABEL[k] || k).join(', ')}</b></span>
            )}
          </div>
        )}
      </div>

      {loading && <div className="text-sm" style={{ color: '#AEAEB2' }}>Подбираю уроки…</div>}

      {!loading && data && data.items.length === 0 && (
        <div className="text-sm" style={{ color: '#8E8E93' }}>
          Нет подходящих непросмотренных уроков. Либо юзер уже всё открыл, либо в библиотеке мало
          размеченных постов под его направление.
        </div>
      )}

      {!loading && data && data.items.length > 0 && (
        <ol className="space-y-2">
          {data.items.map((it, idx) => (
            <li
              key={it.id}
              className="rounded-xl px-3 py-2 flex items-start gap-3"
              style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(28,28,30,0.06)' }}
            >
              <div
                className="text-xs font-bold rounded-full flex items-center justify-center shrink-0"
                style={{
                  width: 24, height: 24,
                  background: idx < 3 ? '#0A84FF' : 'rgba(28,28,30,0.08)',
                  color: idx < 3 ? '#fff' : '#6E6E73',
                }}
              >
                {idx + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className="text-[10px] font-bold uppercase tracking-wide"
                    style={{
                      padding: '2px 7px',
                      borderRadius: 50,
                      background: 'rgba(10,132,255,0.10)',
                      color: '#0A84FF',
                    }}
                  >
                    {KIND_LABEL[it.kind] || it.kind}
                  </span>
                  {it.is_featured && (
                    <span className="text-[10px] font-bold" style={{ color: '#FF9F0A' }}>★ featured</span>
                  )}
                  <span className="text-[10px]" style={{ color: '#AEAEB2' }}>
                    скор {it.score} · {it.reasons.join(', ')}
                  </span>
                </div>
                <div className="text-sm mt-1" style={{ color: '#1D1D1F' }}>{it.title}</div>
                <div className="flex gap-3 mt-1">
                  <a
                    href={it.miniapp_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium"
                    style={{ color: '#0A84FF' }}
                  >
                    в приложении →
                  </a>
                  <a
                    href={it.chat_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium"
                    style={{ color: '#0A84FF' }}
                  >
                    в чате →
                  </a>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
