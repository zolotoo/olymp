'use client'
import { useRef } from 'react'

interface Props {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  minHeight?: number
}

const FORMATS = [
  { label: 'Ж',  tag: 'b',           title: 'Жирный',         style: { fontWeight: 700 } },
  { label: 'К',  tag: 'i',           title: 'Курсив',         style: { fontStyle: 'italic' } },
  { label: 'П',  tag: 'u',           title: 'Подчёркнутый',   style: { textDecoration: 'underline' } },
  { label: 'З',  tag: 's',           title: 'Зачёркнутый',    style: { textDecoration: 'line-through' } },
  { label: '>',  tag: 'blockquote',  title: 'Цитата',         style: {} },
  { label: '<>', tag: 'code',        title: 'Код (моно)',      style: { fontFamily: 'monospace', fontSize: '0.9em' } },
  { label: '||', tag: 'tg-spoiler',  title: 'Спойлер',        style: {} },
] as const

function toPreview(html: string): string {
  // Replace tg-spoiler with a styled span for preview
  return html.replace(
    /<tg-spoiler>([\s\S]*?)<\/tg-spoiler>/g,
    '<span class="tg-spoiler-preview">$1</span>'
  )
}

export default function TelegramEditor({ value, onChange, placeholder, minHeight = 140 }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)

  const wrap = (tag: string) => {
    const el = ref.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const selected = value.slice(start, end)
    const open = `<${tag}>`
    const close = `</${tag}>`
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
      {value.trim() && (
        <div className="mt-3">
          <div
            className="text-xs font-semibold uppercase mb-1.5"
            style={{ color: 'rgba(28,28,30,0.38)', letterSpacing: '0.5px' }}
          >
            Превью в Telegram
          </div>
          <div
            className="tg-preview rounded-2xl px-4 py-3 text-sm"
            style={{
              background: 'rgba(255,255,255,0.80)',
              border: '1px solid rgba(10,132,255,0.15)',
              color: '#1C1C1E',
              lineHeight: 1.65,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              boxShadow: '0 2px 8px rgba(10,132,255,0.06)',
            }}
            dangerouslySetInnerHTML={{ __html: toPreview(value) }}
          />
        </div>
      )}
    </div>
  )
}
