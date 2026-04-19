'use client'
import { useState, useEffect } from 'react'
import TelegramEditor from './TelegramEditor'

export interface OnJoinItem {
  key: string
  label: string
  type: 'message' | 'video' | 'action'
  defaultContent?: string
}

interface Props {
  rankColor: string
  items: OnJoinItem[]
}

type MsgMap = Record<string, { content: string; video_url?: string; label?: string; type?: string }>

const TYPE_LABEL: Record<string, string> = {
  video:   '🎥 Кружок (Video Note)',
  message: '💬 Сообщение',
  action:  '⚡ Действие',
}

export default function RanksOnJoinList({ rankColor, items }: Props) {
  const [messages, setMessages] = useState<MsgMap>({})
  const [selected, setSelected] = useState<OnJoinItem | null>(null)
  const [editing, setEditing] = useState(false)
  const [draftContent, setDraftContent] = useState('')
  const [draftUrl, setDraftUrl] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/messages').then(r => r.json()).then(setMessages)
  }, [])

  const getContent = (item: OnJoinItem) => messages[item.key]?.content ?? item.defaultContent ?? ''
  const getUrl = (item: OnJoinItem) => messages[item.key]?.video_url ?? ''
  const hasCustom = (item: OnJoinItem) => !!messages[item.key]

  const openItem = (item: OnJoinItem) => {
    setSelected(item)
    setEditing(false)
    setDraftContent(getContent(item))
    setDraftUrl(getUrl(item))
  }

  const handleSave = async () => {
    if (!selected) return
    setSaving(true)
    await fetch('/api/messages', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: selected.key,
        content: draftContent,
        video_url: selected.type === 'video' ? draftUrl : null,
        label: selected.label,
        type: selected.type,
      }),
    })
    setMessages(prev => ({
      ...prev,
      [selected.key]: {
        content: draftContent,
        video_url: selected.type === 'video' ? draftUrl : undefined,
        label: selected.label,
        type: selected.type,
      },
    }))
    setSaving(false)
    setEditing(false)
  }

  const close = () => { setSelected(null); setEditing(false) }

  return (
    <>
      <ul className="space-y-1.5">
        {items.map(item => (
          <li key={item.key}>
            <button
              onClick={() => openItem(item)}
              className="w-full flex items-start gap-2 text-left rounded-xl px-2 py-1 -mx-2 transition-colors hover:bg-white/40"
            >
              <span className="shrink-0 mt-[3px]" style={{ color: rankColor }}>—</span>
              <span className="text-sm flex-1" style={{ color: '#1C1C1E', letterSpacing: '-0.15px', lineHeight: 1.45 }}>
                {item.label}
                {item.type === 'video' && <span style={{ marginLeft: 4 }}>🎥</span>}
              </span>
              {hasCustom(item) && (
                <span className="text-xs shrink-0 mt-[3px]" style={{ color: '#0A84FF' }}>✏️</span>
              )}
            </button>
          </li>
        ))}
      </ul>

      {/* Modal overlay */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(6px)' }}
          onClick={e => { if (e.target === e.currentTarget) close() }}
        >
          <div
            className="w-full max-w-lg rounded-3xl p-6"
            style={{
              background: 'rgba(255,255,255,0.92)',
              backdropFilter: 'blur(40px) saturate(180%)',
              border: '1px solid rgba(255,255,255,0.75)',
              boxShadow: '0 24px 64px rgba(0,0,0,0.22)',
            }}
          >
            {/* Header */}
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: rankColor }} />
              <span className="text-xs font-semibold uppercase" style={{ color: 'rgba(28,28,30,0.45)', letterSpacing: '0.7px' }}>
                {TYPE_LABEL[selected.type]}
              </span>
            </div>
            <h3 className="text-lg font-bold mb-4" style={{ color: '#1C1C1E', letterSpacing: '-0.5px' }}>
              {selected.label}
            </h3>

            {!editing ? (
              /* ── View mode ── */
              <>
                {selected.type === 'video' && (
                  <div className="mb-3">
                    <div className="text-xs font-medium mb-1" style={{ color: 'rgba(28,28,30,0.45)' }}>
                      Ссылка на кружок (file_id или URL)
                    </div>
                    <div
                      className="rounded-xl px-4 py-2.5 text-sm font-mono break-all"
                      style={{ background: 'rgba(28,28,30,0.05)', color: getUrl(selected) ? '#1C1C1E' : '#AEAEB2' }}
                    >
                      {getUrl(selected) || '— не указана —'}
                    </div>
                  </div>
                )}
                {/* Content preview with HTML rendering */}
                {getContent(selected) ? (
                  <div
                    className="tg-preview rounded-xl px-4 py-3 text-sm"
                    style={{
                      background: 'rgba(255,255,255,0.80)',
                      border: '1px solid rgba(10,132,255,0.15)',
                      color: '#1C1C1E',
                      lineHeight: 1.65,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      minHeight: 60,
                    }}
                    dangerouslySetInnerHTML={{
                      __html: getContent(selected).replace(
                        /<tg-spoiler>([\s\S]*?)<\/tg-spoiler>/g,
                        '<span class="tg-spoiler-preview">$1</span>'
                      ),
                    }}
                  />
                ) : (
                  <div
                    className="rounded-xl px-4 py-3 text-sm"
                    style={{ background: 'rgba(28,28,30,0.05)', color: '#AEAEB2', lineHeight: 1.65, minHeight: 60 }}
                  >
                    {selected.type === 'action' ? '— системное действие, текст не нужен —' : '— текст не задан —'}
                  </div>
                )}

                <div className="flex gap-2 mt-4">
                  {selected.type !== 'action' && (
                    <button
                      onClick={() => setEditing(true)}
                      className="flex-1 rounded-2xl py-2.5 text-sm font-semibold"
                      style={{ background: '#0A84FF', color: '#FFFFFF' }}
                    >
                      ✏️ Редактировать
                    </button>
                  )}
                  <button
                    onClick={close}
                    className="flex-1 rounded-2xl py-2.5 text-sm font-semibold"
                    style={{ background: 'rgba(28,28,30,0.08)', color: '#1C1C1E' }}
                  >
                    Закрыть
                  </button>
                </div>
              </>
            ) : (
              /* ── Edit mode ── */
              <>
                {selected.type === 'video' && (
                  <div className="mb-3">
                    <div className="text-xs font-medium mb-1" style={{ color: 'rgba(28,28,30,0.45)' }}>
                      Ссылка на кружок (file_id или URL)
                    </div>
                    <input
                      className="w-full rounded-xl px-4 py-2.5 text-sm outline-none font-mono"
                      style={{
                        background: 'rgba(28,28,30,0.05)',
                        border: '1px solid rgba(28,28,30,0.12)',
                        color: '#1C1C1E',
                      }}
                      value={draftUrl}
                      onChange={e => setDraftUrl(e.target.value)}
                      placeholder="https://... или file_id"
                    />
                  </div>
                )}
                <TelegramEditor
                  value={draftContent}
                  onChange={setDraftContent}
                  placeholder={selected.type === 'video' ? 'Подпись к кружку (необязательно)...' : 'Введите текст сообщения...'}
                  minHeight={selected.type === 'video' ? 90 : 130}
                />
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 rounded-2xl py-2.5 text-sm font-semibold transition-opacity"
                    style={{ background: '#0A84FF', color: '#FFFFFF', opacity: saving ? 0.6 : 1 }}
                  >
                    {saving ? 'Сохраняю...' : 'Сохранить'}
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    className="flex-1 rounded-2xl py-2.5 text-sm font-semibold"
                    style={{ background: 'rgba(28,28,30,0.08)', color: '#1C1C1E' }}
                  >
                    Отмена
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
