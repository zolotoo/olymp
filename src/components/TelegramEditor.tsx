'use client'
import { useRef } from 'react'

interface Props {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  minHeight?: number
  buttons?: { label: string; url: string }[]
}

const FORMATS = [
  { label: 'Ж',  tag: 'b',           title: 'Жирный',         style: { fontWeight: 700 } },
  { label: 'К',  tag: 'i',           title: 'Курсив',         style: { fontStyle: 'italic' } },
  { label: 'П',  tag: 'u',           title: 'Подчёркнутый',   style: { textDecoration: 'underline' } },
  { label: 'З',  tag: 's',           title: 'Зачёркнутый',    style: { textDecoration: 'line-through' } },
  { label: '>',  tag: 'blockquote',     title: 'Цитата',                    style: {} },
  { label: '>▾', tag: 'blockquote-exp', title: 'Сворачиваемая цитата',      style: {} },
  { label: '<>', tag: 'code',           title: 'Код (моно)',                style: { fontFamily: 'monospace', fontSize: '0.9em' } },
  { label: '||', tag: 'tg-spoiler',     title: 'Спойлер',                   style: {} },
] as const

function toPreview(html: string): string {
  return html
    .replace(
      /<tg-spoiler>([\s\S]*?)<\/tg-spoiler>/g,
      '<span class="tg-spoiler-preview">$1</span>'
    )
    .replace(
      /<blockquote expandable>([\s\S]*?)<\/blockquote>/g,
      '<blockquote class="tg-quote-expandable">$1<span class="tg-quote-toggle">▾ развернуть</span></blockquote>'
    )
}

export default function TelegramEditor({ value, onChange, placeholder, minHeight = 140, buttons }: Props) {
  const previewButtons = (buttons || []).filter(b => b.label.trim() && b.url.trim())
  const ref = useRef<HTMLTextAreaElement>(null)

  const wrap = (tag: string) => {
    const el = ref.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const selected = value.slice(start, end)
    const isExpQuote = tag === 'blockquote-exp'
    const open = isExpQuote ? '<blockquote expandable>' : `<${tag}>`
    const close = isExpQuote ? '</blockquote>' : `</${tag}>`
    const newVal = value.slice(0, start) + open + selected + close + value.slice(end)
    onChange(newVal)
    requestAnimationFrame(() => {
      el.focus()
      const cur = start + open.length
      el.setSelectionRange(cur, cur + selected.length)
    })
  }

  return (
    <div>
      {/* Formatting toolbar */}
      <div
        className="flex flex-wrap gap-1.5 px-3 py-2 rounded-xl mb-2"
        style={{ background: 'rgba(10,132,255,0.06)', border: '1px solid rgba(10,132,255,0.12)' }}
      >
        {FORMATS.map(f => (
          <button
            key={f.tag}
            type="button"
            title={f.title}
            onMouseDown={e => { e.preventDefault(); wrap(f.tag) }}
            className="rounded-lg px-2.5 py-1 text-xs font-semibold transition-all hover:scale-105 active:scale-95"
            style={{
              background: 'rgba(255,255,255,0.85)',
              color: '#0A84FF',
              border: '1px solid rgba(10,132,255,0.18)',
              minWidth: 28,
              ...f.style,
            }}
          >
            {f.label}
          </button>
        ))}
        <span
          className="text-xs ml-1 self-center"
          style={{ color: 'rgba(10,132,255,0.55)' }}
        >
          Выделите текст и нажмите кнопку
        </span>
      </div>

      {/* Textarea */}
      <textarea
        ref={ref}
        className="w-full rounded-2xl px-4 py-3 text-sm resize-none outline-none"
        style={{
          background: 'rgba(28,28,30,0.05)',
          border: '1px solid rgba(28,28,30,0.10)',
          color: '#1C1C1E',
          lineHeight: 1.65,
          minHeight,
          fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
          fontSize: 13,
        }}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
      />

      {/* Telegram preview */}
      {(value.trim() || previewButtons.length > 0) && (
        <div className="mt-3">
          <div
            className="text-xs font-semibold uppercase mb-1.5"
            style={{ color: 'rgba(28,28,30,0.38)', letterSpacing: '0.5px' }}
          >
            Превью в Telegram
          </div>
          <div
            style={{
              background: 'rgba(255,255,255,0.80)',
              border: '1px solid rgba(10,132,255,0.15)',
              borderRadius: 16,
              padding: '12px 14px',
              boxShadow: '0 2px 8px rgba(10,132,255,0.06)',
            }}
          >
            {value.trim() && (
              <div
                className="tg-preview text-sm"
                style={{
                  color: '#1C1C1E',
                  lineHeight: 1.65,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
                dangerouslySetInnerHTML={{ __html: toPreview(value) }}
              />
            )}
            {previewButtons.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: value.trim() ? 10 : 0 }}>
                {previewButtons.map((b, i) => (
                  <div key={i} style={{ padding: '8px 12px', background: 'rgba(10,132,255,0.10)', border: '1px solid rgba(10,132,255,0.20)', borderRadius: 10, fontSize: 13, fontWeight: 500, color: '#0A84FF', textAlign: 'center', wordBreak: 'break-word' }}>
                    {b.label || <span style={{ opacity: 0.45 }}>(без названия)</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
