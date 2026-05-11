'use client'

import { useActionState } from 'react'
import { saveDraftAction, type SaveDraftState } from './actions'

interface Props {
  id: string
  title: string
  text: string
  ctaUrl: string | null
  ctaLabel: string | null
  ctaUrl2: string | null
  ctaLabel2: string | null
}

const initial: SaveDraftState = {}

export default function DraftEditor(p: Props) {
  const [state, formAction, pending] = useActionState(saveDraftAction, initial)

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="id" value={p.id} />

      <Field label="Название (внутреннее)">
        <input
          name="title"
          defaultValue={p.title}
          required
          maxLength={200}
          className="w-full rounded-xl px-3 py-2 text-sm"
          style={inputStyle}
        />
      </Field>

      <Field label="Текст рассылки" hint="HTML и плейсхолдеры {name}, {username}.">
        <textarea
          name="text"
          defaultValue={p.text}
          required
          rows={10}
          className="w-full rounded-xl px-3 py-2 text-sm font-mono"
          style={inputStyle}
        />
      </Field>

      {p.ctaUrl && (
        <Field label="Кнопка 1: «Открыть в приложении»" hint={p.ctaUrl}>
          <input
            name="cta_label"
            defaultValue={p.ctaLabel ?? ''}
            placeholder="Открыть в приложении"
            maxLength={64}
            className="w-full rounded-xl px-3 py-2 text-sm"
            style={inputStyle}
          />
        </Field>
      )}

      {p.ctaUrl2 && (
        <Field label="Кнопка 2: «Открыть в чате»" hint={p.ctaUrl2}>
          <input
            name="cta_label_2"
            defaultValue={p.ctaLabel2 ?? ''}
            placeholder="Открыть в чате"
            maxLength={64}
            className="w-full rounded-xl px-3 py-2 text-sm"
            style={inputStyle}
          />
        </Field>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
          style={{ background: '#1C1C1E', color: '#fff' }}
        >
          {pending ? 'Сохраняю…' : 'Сохранить'}
        </button>
        {state.saved && <span className="text-xs" style={{ color: '#30D158' }}>✓ Сохранено</span>}
        {state.error && <span className="text-xs" style={{ color: '#FF3B30' }}>{state.error}</span>}
      </div>
    </form>
  )
}

const inputStyle: React.CSSProperties = {
  background: '#FFFFFF',
  border: '1px solid rgba(28,28,30,0.12)',
  color: '#1C1C1E',
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs font-semibold mb-1.5" style={{ color: 'rgba(28,28,30,0.7)' }}>{label}</div>
      {children}
      {hint && <div className="text-[11px] mt-1 font-mono" style={{ color: 'rgba(28,28,30,0.45)' }}>{hint}</div>}
    </label>
  )
}
