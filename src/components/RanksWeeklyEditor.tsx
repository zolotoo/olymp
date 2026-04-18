'use client'
import { useState, useEffect } from 'react'

const SEGMENTS = [
  { key: 'dead',   label: 'Мертвяки' },
  { key: 'silent', label: 'Молчуны' },
  { key: 'medium', label: 'Середняки' },
  { key: 'active', label: 'Активные' },
]

const DEFAULTS: Record<number, Record<string, string>> = {
  1: {
    dead:   'Ни одного сообщения — всё ок? Дарим бонус',
    silent: 'Вот как получить первые листики',
    medium: 'До следующего ранга осталось X листиков',
    active: 'Ты в топе — вот твой бейдж',
  },
  2: {
    dead:   'Вопрос про ожидания + дайджест',
    silent: 'Напоминание про листики + дайджест',
    medium: 'Тизер следующей недели + дайджест',
    active: 'Закрытый контент / ранний доступ',
  },
  3: {
    dead:   'Ещё не поздно — двойные листики прямо сейчас',
    silent: 'Напоминание о колесе месяца',
    medium: 'Итоги листиков за 3 недели',
    active: 'Топ таблицы лидеров + поздравление',
  },
  4: {
    dead:   'Подписка через 7 дней. Отписка = блок на 6 месяцев',
    silent: 'Предупреждение о продлении + расписание следующего месяца',
    medium: 'Итоги месяца + ранг + что ждёт дальше',
    active: 'Личная благодарность + анонс следующего месяца',
  },
}

type MsgMap = Record<string, { content: string; label?: string; type?: string }>

interface EditState {
  week: number
  seg: string
  draft: string
}

const glass = {
  background: 'rgba(255,255,255,0.66)',
  backdropFilter: 'blur(28px) saturate(160%)',
  WebkitBackdropFilter: 'blur(28px) saturate(160%)',
  border: '1px solid rgba(255,255,255,0.52)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.07)',
} as const

export default function RanksWeeklyEditor() {
  const [messages, setMessages] = useState<MsgMap>({})
  const [editing, setEditing] = useState<EditState | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/messages').then(r => r.json()).then(setMessages)
  }, [])

  const getMsg = (week: number, seg: string) => {
    const key = `weekly_w${week}_${seg}`
    return messages[key]?.content ?? DEFAULTS[week][seg] ?? ''
  }

  const hasCustom = (week: number, seg: string) => {
    const key = `weekly_w${week}_${seg}`
    return !!messages[key]
  }

  const openEdit = (week: number, seg: string) => {
    setEditing({ week, seg, draft: getMsg(week, seg) })
  }

  const handleSave = async () => {
    if (!editing) return
    setSaving(true)
    const key = `weekly_w${editing.week}_${editing.seg}`
    const label = `Неделя ${editing.week} — ${SEGMENTS.find(s => s.key === editing.seg)?.label}`
    await fetch('/api/messages', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, content: editing.draft, label, type: 'message' }),
    })
    setMessages(prev => ({
      ...prev,
      [key]: { content: editing.draft, label, type: 'message' },
    }))
    setSaving(false)
    setEditing(null)
  }

  return (
    <>
      <div className="rounded-2xl p-6" style={glass}>
        <h2 className="text-base font-bold mb-2" style={{ color: '#1C1C1E', letterSpacing: '-0.4px' }}>
          Еженедельные касания по сегментам
        </h2>
        <p className="text-sm mb-5" style={{ color: 'rgba(28,28,30,0.55)', letterSpacing: '-0.2px' }}>
          Каждую неделю каждый участник получает 3 сообщения: кружок + дайджест + персональное по сегменту.{' '}
          <span style={{ color: '#0A84FF' }}>Нажмите на сообщение чтобы открыть / отредактировать.</span>
        </p>

        {/* Segments legend */}
        <div className="flex flex-wrap gap-2 mb-5">
          {SEGMENTS.map(s => (
            <div key={s.key} className="rounded-xl px-3 py-2" style={{ background: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.48)' }}>
              <div className="text-xs font-semibold" style={{ color: '#1C1C1E', letterSpacing: '-0.2px' }}>{s.label}</div>
              <div className="text-xs mt-0.5" style={{ color: 'rgba(28,28,30,0.50)' }}>
                {s.key === 'dead' && 'Ни одного сообщения за неделю'}
                {s.key === 'silent' && 'Менее 3 сообщений за неделю'}
                {s.key === 'medium' && '3–9 сообщений за неделю'}
                {s.key === 'active' && '10+ сообщений за неделю'}
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          {([1, 2, 3, 4] as const).map(week => (
            <div key={week} className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.45)' }}>
              <div className="px-4 py-2.5" style={{ background: 'rgba(28,28,30,0.06)' }}>
                <span className="text-xs font-semibold uppercase" style={{ color: 'rgba(28,28,30,0.50)', letterSpacing: '0.5px' }}>
                  Неделя {week}{week === 4 ? ' — перед продлением' : ''}
                </span>
              </div>
              <div className="divide-y" style={{ borderColor: 'rgba(28,28,30,0.06)' }}>
                {SEGMENTS.map(s => (
                  <button
                    key={s.key}
                    onClick={() => openEdit(week, s.key)}
                    className="w-full px-4 py-2.5 flex gap-4 text-left transition-colors hover:bg-white/30"
                  >
                    <span className="text-xs font-medium w-20 shrink-0 mt-0.5" style={{ color: 'rgba(28,28,30,0.45)' }}>
                      {s.label}
                    </span>
                    <span className="text-sm flex-1" style={{ color: '#1C1C1E', letterSpacing: '-0.15px', lineHeight: 1.4 }}>
                      {getMsg(week, s.key)}
                    </span>
                    {hasCustom(week, s.key) && (
                      <span className="text-xs shrink-0 mt-0.5" style={{ color: '#0A84FF' }}>✏️</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Edit Modal */}
      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(6px)' }}
          onClick={e => { if (e.target === e.currentTarget) setEditing(null) }}
        >
          <div
            className="w-full max-w-lg rounded-3xl p-6"
            style={{
              background: 'rgba(255,255,255,0.92)',
              backdropFilter: 'blur(40px) saturate(180%)',
              border: '1px solid rgba(255,255,255,0.75)',
              boxShadow: '0 24px 64px rgba(0,0,0,0.20)',
            }}
          >
            <div className="mb-1 text-xs font-semibold uppercase" style={{ color: 'rgba(28,28,30,0.45)', letterSpacing: '0.7px' }}>
              Неделя {editing.week} · {SEGMENTS.find(s => s.key === editing.seg)?.label}
            </div>
            <h3 className="text-lg font-bold mb-4" style={{ color: '#1C1C1E', letterSpacing: '-0.5px' }}>
              Персональное сообщение
            </h3>

            <textarea
              className="w-full rounded-2xl px-4 py-3 text-sm resize-none outline-none"
              style={{
                background: 'rgba(28,28,30,0.05)',
                border: '1px solid rgba(28,28,30,0.10)',
                color: '#1C1C1E',
                lineHeight: 1.6,
                minHeight: 140,
              }}
              value={editing.draft}
              onChange={e => setEditing(prev => prev ? { ...prev, draft: e.target.value } : null)}
              placeholder="Введите текст сообщения..."
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
                onClick={() => setEditing(null)}
                className="flex-1 rounded-2xl py-2.5 text-sm font-semibold"
                style={{ background: 'rgba(28,28,30,0.08)', color: '#1C1C1E' }}
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
