'use client'

import { useState } from 'react'

export default function SummaryButton({ memberId }: { memberId: string }) {
  const [summary, setSummary] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  async function fetchSummary() {
    setLoading(true)
    setOpen(true)
    try {
      const res = await fetch(`/api/member-summary/${memberId}`)
      const data = await res.json()
      setSummary(data.summary || data.error || 'Ошибка')
    } catch {
      setSummary('Не удалось загрузить резюме')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={fetchSummary}
        className="text-sm px-4 py-1.5 rounded-xl font-medium transition-opacity hover:opacity-80"
        style={{ background: '#0A84FF', color: '#FFFFFF' }}
      >
        ✨ Краткое резюме
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(8px)' }}
          onClick={() => setOpen(false)}
        >
          <div
            className="rounded-2xl p-6 max-w-lg w-full"
            style={{
              background: 'rgba(255,255,255,0.95)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.8)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold" style={{ color: '#1D1D1F' }}>✨ Резюме участника</h3>
              <button
                onClick={() => setOpen(false)}
                className="text-xl leading-none w-7 h-7 rounded-full flex items-center justify-center transition-colors"
                style={{ color: '#AEAEB2', background: '#F2F2F7' }}
              >
                ×
              </button>
            </div>
            {loading ? (
              <div className="text-sm" style={{ color: '#AEAEB2' }}>Генерирую резюме...</div>
            ) : (
              <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: '#1D1D1F' }}>{summary}</p>
            )}
          </div>
        </div>
      )}
    </>
  )
}
