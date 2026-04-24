'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SendDraftButton({ broadcastId }: { broadcastId: string }) {
  const [pending, setPending] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const router = useRouter()

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          if (!confirm('Отправить рассылку? Действие необратимо.')) return
          setPending(true)
          setErr(null)
          try {
            const res = await fetch(`/api/broadcasts/${broadcastId}/send`, { method: 'POST' })
            if (!res.ok) {
              const j = await res.json().catch(() => ({}))
              setErr(j.error || `HTTP ${res.status}`)
            } else {
              router.refresh()
            }
          } catch (e) {
            setErr(e instanceof Error ? e.message : 'error')
          } finally {
            setPending(false)
          }
        }}
        className="px-5 py-3 rounded-xl text-sm font-semibold disabled:opacity-50"
        style={{ background: '#0A84FF', color: '#fff' }}
      >
        {pending ? 'Отправка…' : 'Отправить сейчас'}
      </button>
      {err && <p className="text-xs mt-2" style={{ color: '#FF3B30' }}>{err}</p>}
    </div>
  )
}
