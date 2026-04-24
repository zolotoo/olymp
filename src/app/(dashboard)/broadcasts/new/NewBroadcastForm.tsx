'use client'

import { useActionState, useState } from 'react'
import { previewAudienceAction, createBroadcastAction, type CreateState } from './actions'
import { AUDIENCE_LABELS, type AudienceKind } from '@/lib/audience-resolver'

const card = {
  background: 'rgba(255,255,255,0.78)',
  backdropFilter: 'blur(28px) saturate(160%)',
  WebkitBackdropFilter: 'blur(28px) saturate(160%)',
  border: '1px solid rgba(255,255,255,0.55)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
}

const inputStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid rgba(28,28,30,0.12)',
  color: '#1C1C1E',
  padding: '10px 12px',
  borderRadius: 10,
  width: '100%',
  fontSize: 14,
}

export default function NewBroadcastForm() {
  const [audience, setAudience] = useState<AudienceKind>('members_active')
  const [text, setText] = useState('')
  const [tgIds, setTgIds] = useState('')
  const [previewState, previewAction, previewPending] = useActionState<CreateState, FormData>(
    previewAudienceAction,
    {},
  )
  const [createState, createAction, createPending] = useActionState<CreateState, FormData>(
    createBroadcastAction,
    {},
  )

  return (
    <div className="rounded-2xl p-6" style={card}>
      <form action={createAction} className="space-y-5">
        <div>
          <Label>Название (только для тебя)</Label>
          <input name="title" required maxLength={120} placeholder="Скидка для непокупавших, апрель" style={inputStyle} />
        </div>

        <div>
          <Label>Аудитория</Label>
          <select
            name="audience"
            value={audience}
            onChange={(e) => setAudience(e.target.value as AudienceKind)}
            style={inputStyle}
          >
            {(Object.keys(AUDIENCE_LABELS) as AudienceKind[]).map((k) => (
              <option key={k} value={k}>{AUDIENCE_LABELS[k]}</option>
            ))}
          </select>
        </div>

        {audience === 'custom_tg_ids' && (
          <div>
            <Label>Список tg_id (через запятую или с новой строки)</Label>
            <textarea
              name="tg_ids"
              value={tgIds}
              onChange={(e) => setTgIds(e.target.value)}
              rows={3}
              placeholder="123456, 234567, 345678"
              style={{ ...inputStyle, fontFamily: 'ui-monospace, monospace' }}
            />
          </div>
        )}

        <div className="flex items-end gap-2">
          <button
            type="button"
            disabled={previewPending}
            onClick={() => {
              const fd = new FormData()
              fd.set('audience', audience)
              fd.set('tg_ids', tgIds)
              previewAction(fd)
            }}
            className="px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: 'rgba(10,132,255,0.12)', color: '#0A84FF' }}
          >
            {previewPending ? 'Считаем…' : 'Предпросмотр аудитории'}
          </button>
          {previewState.preview && (
            <span className="text-sm" style={{ color: 'rgba(28,28,30,0.7)' }}>
              <b>{previewState.preview.count}</b> получателей
              {previewState.preview.sample.length > 0 && (
                <span style={{ color: 'rgba(28,28,30,0.45)', fontSize: 12 }}>
                  {' '}· {previewState.preview.sample.join(', ')}
                  {previewState.preview.count > previewState.preview.sample.length ? '…' : ''}
                </span>
              )}
            </span>
          )}
        </div>

        <div>
          <Label>Текст сообщения (HTML, плейсхолдер {'{name}'})</Label>
          <textarea
            name="text"
            required
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            placeholder="Привет, {name}! Это специальное предложение..."
            style={{ ...inputStyle, fontFamily: 'inherit' }}
          />
          <div className="text-xs mt-1" style={{ color: 'rgba(28,28,30,0.4)' }}>
            Поддерживаются HTML-теги Telegram: &lt;b&gt; &lt;i&gt; &lt;u&gt; &lt;a href&gt; &lt;code&gt;.
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>CTA-ссылка (опционально)</Label>
            <input
              name="cta_url"
              type="url"
              placeholder="https://tribute.tg/..."
              style={inputStyle}
            />
            <div className="text-xs mt-1" style={{ color: 'rgba(28,28,30,0.4)' }}>
              Будет обёрнута через click-tracker.
            </div>
          </div>
          <div>
            <Label>Текст кнопки</Label>
            <input
              name="cta_label"
              placeholder="Получить скидку"
              maxLength={64}
              style={inputStyle}
            />
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            name="send_now"
            value="1"
            disabled={createPending}
            className="px-5 py-3 rounded-xl text-sm font-semibold"
            style={{ background: '#0A84FF', color: '#fff' }}
          >
            {createPending ? 'Отправляем…' : 'Создать и отправить'}
          </button>
          <button
            type="submit"
            name="send_now"
            value="0"
            disabled={createPending}
            className="px-5 py-3 rounded-xl text-sm font-semibold"
            style={{ background: 'rgba(28,28,30,0.06)', color: '#1C1C1E' }}
          >
            Сохранить как черновик
          </button>
        </div>
        {createState.error && (
          <p className="text-sm" style={{ color: '#FF3B30' }}>{createState.error}</p>
        )}
      </form>
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-semibold uppercase mb-1" style={{ letterSpacing: '0.5px', color: 'rgba(28,28,30,0.5)' }}>
      {children}
    </div>
  )
}
