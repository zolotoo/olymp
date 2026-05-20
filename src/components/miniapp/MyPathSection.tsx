'use client'
import { useEffect, useState } from 'react'
import { tgFetch, useTelegram } from './TelegramProvider'

// «Мой путь» — один экран анкеты + рекомендации.
//
// Шаги:
//   1) DM-вопрос про цель (приходит в Телеграм через 1ч после approve)
//   2) Этот экран: уровень + что хочешь забрать + почему вступил + над чем работаешь
//
// Если анкета уже пройдена — показываем рекомендации, без перепрохождения
// (старые ответы не имеют новых полей, повторное прохождение усложняет UX).

interface OptionLevel { id: string; label: string }
interface OptionLookingFor { id: string; emoji: string; label: string }
interface PathMetaItem { emoji: string; label: string; description: string }

interface PracticeItem {
  message_id: number
  title: string
  preview: string
  link: string
  has_media: boolean
}

interface ApiResponse {
  state: {
    goal: string | null
    goal_custom: string | null
    level: string | null
    looking_for: string[]
    looking_for_text: string | null
    motivation: string | null
    working_on: string | null
  }
  progress: {
    dm_step1_done: boolean
    mini_app_done: boolean
    points_awarded_step1: number
    points_awarded_full: number
  }
  options: {
    levels: OptionLevel[]
    lookingFor: OptionLookingFor[]
  }
  limits: {
    motivation: number
    workingOn: number
    lookingForText: number
  }
  recommendations: { kind: string; score: number }[] | null
  pathMeta: Record<string, PathMetaItem>
}

const ACCENT = '#2D5BFF'

export default function MyPathSection({ onComplete }: { onComplete?: () => void }) {
  const { initData } = useTelegram()
  const [data, setData] = useState<ApiResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [justFinalized, setJustFinalized] = useState(false)
  const [practiceItems, setPracticeItems] = useState<PracticeItem[]>([])

  // Локальные значения формы — синхронизируются с сервером по «Готово».
  const [level, setLevel] = useState<string | null>(null)
  const [lookingFor, setLookingFor] = useState<Set<string>>(new Set())
  const [motivation, setMotivation] = useState('')
  const [workingOn, setWorkingOn] = useState('')

  const load = async () => {
    try {
      const r = await tgFetch('/api/onboarding', initData)
      const d = await r.json()
      if (d.error) { setError(d.error); return }
      const apiData = d as ApiResponse
      setData(apiData)
      setLevel(apiData.state.level)
      setLookingFor(new Set(apiData.state.looking_for ?? []))
      setMotivation(apiData.state.motivation ?? '')
      setWorkingOn(apiData.state.working_on ?? '')
    } catch {
      setError('Сеть недоступна')
    }
  }

  useEffect(() => { load() /* eslint-disable-next-line */ }, [initData])

  // Лучшие практикумы для секции «Лучшие практикумы про …» в hero.
  // tg_topics.kind='practice' — отдельная ветка с курируемыми практикумами,
  // path_kinds — массив-тегов на library_items, заполняет Сергей в админке.
  //
  // Стратегия: сначала тащим отфильтровано по top-1 направлению. Если по тегу
  // ничего не размечено — фолбэк на нефильтрованный kind=practice (так hero
  // не пустует на ранней фазе, пока админ ещё не успел затегать).
  useEffect(() => {
    if (!data || practiceItems.length) return
    const top = data.recommendations?.[0]?.kind
    const fetchPractice = async () => {
      const tryFetch = async (path: string): Promise<PracticeItem[]> => {
        const r = await tgFetch(path, initData)
        const d = await r.json()
        const topic = (d.topics ?? []).find((t: { kind: string }) => t.kind === 'practice')
        return (topic?.items as PracticeItem[] | undefined)?.slice(0, 3) ?? []
      }
      try {
        let items: PracticeItem[] = []
        if (top) {
          items = await tryFetch(`/api/library?kind=practice&path_kind=${encodeURIComponent(top)}`)
        }
        if (!items.length) {
          items = await tryFetch('/api/library?kind=practice')
        }
        if (items.length) setPracticeItems(items)
      } catch {
        // Тишина — практикумы nice-to-have, hero рисуется и без них.
      }
    }
    fetchPractice()
    // eslint-disable-next-line
  }, [data?.progress.mini_app_done, data?.recommendations])

  const isDone = !!data?.progress.mini_app_done
  const canFinalize = !!level && lookingFor.size > 0 && motivation.trim().length > 0

  const submit = async () => {
    if (!canFinalize || saving) return
    setSaving(true)
    try {
      const r = await tgFetch('/api/onboarding', initData, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level,
          looking_for: Array.from(lookingFor),
          motivation: motivation.trim(),
          working_on: workingOn.trim() || null,
          finalize: true,
        }),
      })
      const d = await r.json()
      if (d.ok) {
        await load()
        if (d.finalized) {
          // Закрываем форму и переходим в hero. Делаем это безусловно при
          // финализации — даже если pointsAwarded=0 (юзер уже финализировался
          // раньше), он всё равно должен видеть свой путь, не висящую анкету.
          setOpen(false)
          if (d.pointsAwarded > 0) {
            setJustFinalized(true)
            window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success')
            onComplete?.()
          }
        }
      } else {
        // Server-side reasons: level_required / looking_for_required / motivation_required.
        // Сообщение жёлтое внутри карточки, юзер видит что не так и докрутит.
        setError(reasonText(d.error))
      }
    } catch {
      setError('Сеть недоступна')
    } finally {
      setSaving(false)
    }
  }

  if (error && !data) return <div className="text-sm" style={{ color: '#E5484D' }}>{error}</div>
  if (!data) return <div className="text-sm" style={{ color: 'rgba(28,28,30,0.45)' }}>Загружаем «Мой путь»…</div>

  // ─── Финал после finalize ─────────────────────────────────────────────────
  // Показываем hero и для свежезавершённой анкеты (justFinalized=true), и для
  // ранее завершённой (isDone && !open). Контент одинаковый — баннер успеха
  // плюс «куда идти» плюс практикумы.
  if ((justFinalized && isDone) || (isDone && !open)) {
    return <FinishedHero data={data} practice={practiceItems} justFinalized={justFinalized} />
  }

  // ─── Idle: ещё не начинали ─────────────────────────────────────────────────
  if (!open) {
    return (
      <div className="rounded-2xl p-5" style={{ background: '#FFFFFF', border: '1px solid rgba(28,28,30,0.06)' }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-xs font-semibold uppercase mb-0.5" style={{ color: 'rgba(28,28,30,0.45)', letterSpacing: '0.6px' }}>
              Мой путь
            </div>
            <div className="text-base font-semibold" style={{ color: '#1C1C1E', letterSpacing: '-0.3px' }}>
              Заполни анкету и забери +10
            </div>
          </div>
          <span style={{ fontSize: 28 }}>🧭</span>
        </div>
        <p className="text-sm mb-4" style={{ color: 'rgba(28,28,30,0.60)', lineHeight: 1.55 }}>
          Один экран, пара минут. По итогам подскажем, куда лучше идти в клубе,
          и откроем бонусную крутку Колеса удачи.
        </p>
        <button
          onClick={() => setOpen(true)}
          className="w-full rounded-full py-3 text-sm font-semibold active:scale-[0.98] transition-transform"
          style={{ background: ACCENT, color: '#fff', border: 'none', cursor: 'pointer' }}
        >
          Начать анкету · +10 фантиков
        </button>
      </div>
    )
  }

  // ─── Сама анкета ─────────────────────────────────────────────────────────
  const motivationCount = motivation.length
  const workingOnCount = workingOn.length

  return (
    <div className="rounded-2xl p-5" style={{ background: '#FFFFFF', border: '1px solid rgba(28,28,30,0.06)' }}>
      <div className="flex items-center justify-between mb-1">
        <div className="text-xs font-semibold uppercase" style={{ color: ACCENT, letterSpacing: '0.7px' }}>
          Знакомство
        </div>
        <button onClick={() => setOpen(false)} className="text-xs" style={{ color: 'rgba(28,28,30,0.50)', background: 'none', border: 'none', cursor: 'pointer' }}>
          ← назад
        </button>
      </div>
      <h3 className="text-lg font-bold mb-1" style={{ color: '#1C1C1E', letterSpacing: '-0.4px' }}>Расскажи о себе</h3>
      <p className="text-xs mb-5" style={{ color: 'rgba(28,28,30,0.55)', lineHeight: 1.55 }}>
        Чем подробнее ответишь, тем точнее подскажем, куда лучше идти в клубе. Видит только Сергей.
      </p>

      {/* Уровень */}
      <div className="mb-5">
        <div className="text-xs font-semibold uppercase mb-2" style={{ color: 'rgba(28,28,30,0.45)', letterSpacing: '0.6px' }}>
          Твой уровень в AI
        </div>
        <div className="flex flex-wrap gap-2">
          {data.options.levels.map(l => {
            const active = level === l.id
            return (
              <button
                key={l.id}
                onClick={() => setLevel(l.id)}
                className="rounded-full px-3 py-2 text-xs font-medium transition-all active:scale-[0.97]"
                style={{
                  background: active ? ACCENT : 'rgba(28,28,30,0.06)',
                  color: active ? '#fff' : '#1C1C1E',
                  border: active ? `1px solid ${ACCENT}` : '1px solid rgba(28,28,30,0.10)',
                  cursor: 'pointer',
                }}
              >
                {l.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Что хочешь забрать */}
      <div className="mb-5">
        <div className="text-xs font-semibold uppercase mb-2" style={{ color: 'rgba(28,28,30,0.45)', letterSpacing: '0.6px' }}>
          Что хочешь забрать из клуба?
        </div>
        <div className="flex flex-col gap-2">
          {data.options.lookingFor.map(o => {
            const active = lookingFor.has(o.id)
            return (
              <button
                key={o.id}
                onClick={() => {
                  const next = new Set(lookingFor)
                  if (next.has(o.id)) next.delete(o.id); else next.add(o.id)
                  setLookingFor(next)
                }}
                className="w-full rounded-2xl px-4 py-3 text-left text-sm font-medium transition-all active:scale-[0.98]"
                style={{
                  background: active ? `${ACCENT}14` : '#F2F2F7',
                  color: '#1C1C1E',
                  border: active ? `1.5px solid ${ACCENT}` : '1px solid rgba(28,28,30,0.06)',
                  letterSpacing: '-0.2px',
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: 18, marginRight: 8 }}>{o.emoji}</span>{o.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Почему вступил */}
      <div className="mb-5">
        <div className="text-xs font-semibold uppercase mb-2" style={{ color: 'rgba(28,28,30,0.45)', letterSpacing: '0.6px' }}>
          Почему вступил? Что зацепило?
        </div>
        <textarea
          value={motivation}
          onChange={e => setMotivation(e.target.value.slice(0, data.limits.motivation))}
          placeholder="увидел рилс / друг позвал / запускаю проект…"
          rows={3}
          className="w-full rounded-xl p-3 text-sm"
          style={{ background: 'rgba(10,132,255,0.06)', border: '1px solid rgba(10,132,255,0.20)', color: '#1C1C1E', resize: 'none', outline: 'none' }}
        />
        <div className="text-right text-xs mt-1" style={{ color: 'rgba(28,28,30,0.40)' }}>
          {motivationCount} / {data.limits.motivation}
        </div>
      </div>

      {/* Над чем работаешь */}
      <div className="mb-5">
        <div className="text-xs font-semibold uppercase mb-2" style={{ color: 'rgba(28,28,30,0.45)', letterSpacing: '0.6px' }}>
          Над чем работаешь сейчас? <span style={{ color: 'rgba(28,28,30,0.35)', textTransform: 'none', letterSpacing: 0 }}>(опц)</span>
        </div>
        <textarea
          value={workingOn}
          onChange={e => setWorkingOn(e.target.value.slice(0, data.limits.workingOn))}
          placeholder="запускаю агентство по AI-видео…"
          rows={3}
          className="w-full rounded-xl p-3 text-sm"
          style={{ background: 'rgba(28,28,30,0.04)', border: '1px solid rgba(28,28,30,0.10)', color: '#1C1C1E', resize: 'none', outline: 'none' }}
        />
        <div className="text-right text-xs mt-1" style={{ color: 'rgba(28,28,30,0.40)' }}>
          {workingOnCount} / {data.limits.workingOn}
        </div>
      </div>

      {error && (
        <div className="rounded-xl px-3 py-2 mb-3 text-xs"
             style={{ background: 'rgba(229,72,77,0.08)', color: '#E5484D', border: '1px solid rgba(229,72,77,0.20)' }}>
          {error}
        </div>
      )}

      <button
        onClick={submit}
        disabled={!canFinalize || saving}
        className="w-full rounded-full py-3 text-sm font-semibold"
        style={{
          background: canFinalize ? ACCENT : 'rgba(28,28,30,0.08)',
          color: canFinalize ? '#fff' : 'rgba(28,28,30,0.35)',
          border: 'none',
          cursor: canFinalize ? 'pointer' : 'not-allowed',
        }}
      >
        {saving ? 'Сохраняем…' : 'Готово · +10 фантиков'}
      </button>
    </div>
  )
}

// ─── Hero после finalize ─────────────────────────────────────────────────────
function FinishedHero({
  data, practice, justFinalized,
}: {
  data: ApiResponse
  practice: PracticeItem[]
  justFinalized: boolean
}) {
  const recs = data.recommendations ?? []
  const top = recs[0]
  const rest = recs.slice(1, 3)
  const topMeta = top ? data.pathMeta[top.kind] : null
  const topLabel = topMeta?.label ?? 'твой путь'

  return (
    <div className="rounded-2xl p-5" style={{ background: '#FFFFFF', border: '1px solid rgba(28,28,30,0.06)' }}>
      {/* Hero: 🎉 + +10 фантиков */}
      <div className="text-center mb-5">
        <div style={{ fontSize: 56, lineHeight: 1, marginBottom: 8 }}>🎉</div>
        <div className="text-xl font-bold mb-1" style={{ color: '#1C1C1E', letterSpacing: '-0.5px' }}>
          {justFinalized ? '+10 фантиков твои!' : 'Анкета пройдена'}
        </div>
        <div className="text-sm" style={{ color: 'rgba(28,28,30,0.55)', lineHeight: 1.5 }}>
          {justFinalized
            ? 'И бонусную крутку Колеса дали. Удачи!'
            : 'Колесо удачи открыто, можно крутить.'}
        </div>
      </div>

      {/* Top-1 path как hero-карточка */}
      {topMeta && top && (
        <div className="rounded-2xl p-4 mb-3" style={{ background: `${ACCENT}10`, border: `1.5px solid ${ACCENT}40` }}>
          <div className="text-xs font-semibold uppercase mb-2" style={{ color: ACCENT, letterSpacing: '0.7px' }}>
            Твой путь в клубе
          </div>
          <div className="flex items-center gap-2 mb-1.5">
            <span style={{ fontSize: 28 }}>{topMeta.emoji}</span>
            <span className="text-lg font-bold flex-1" style={{ color: '#1C1C1E', letterSpacing: '-0.3px' }}>
              {topMeta.label}
            </span>
            <span className="text-xs font-bold" style={{ color: ACCENT }}>{top.score}%</span>
          </div>
          <div className="text-sm" style={{ color: 'rgba(28,28,30,0.65)', lineHeight: 1.5 }}>
            {topMeta.description}
          </div>
        </div>
      )}

      {/* Практикумы по теме */}
      {practice.length > 0 && (
        <div className="mb-4">
          <div className="text-xs font-semibold uppercase mb-2" style={{ color: 'rgba(28,28,30,0.45)', letterSpacing: '0.6px' }}>
            Лучшие практикумы про {topLabel.toLowerCase()}
          </div>
          <div className="flex flex-col gap-2">
            {practice.map(p => (
              <a
                key={p.message_id}
                href={p.link}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl p-3 text-left active:scale-[0.99] transition-transform"
                style={{ background: '#F2F2F7', border: '1px solid rgba(28,28,30,0.06)', textDecoration: 'none' }}
              >
                <div className="text-sm font-semibold mb-0.5" style={{ color: '#1C1C1E', letterSpacing: '-0.2px' }}>
                  {p.has_media ? '🎥 ' : ''}{p.title}
                </div>
                {p.preview && (
                  <div className="text-xs" style={{ color: 'rgba(28,28,30,0.55)', lineHeight: 1.45 }}>
                    {p.preview}
                  </div>
                )}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Прочие подходящие — мелким списком */}
      {rest.length > 0 && (
        <div className="mb-1">
          <div className="text-xs font-semibold uppercase mb-2" style={{ color: 'rgba(28,28,30,0.45)', letterSpacing: '0.6px' }}>
            Ещё подходит
          </div>
          <div className="flex flex-col gap-1.5">
            {rest.map(r => {
              const meta = data.pathMeta[r.kind]
              if (!meta) return null
              return (
                <div key={r.kind} className="flex items-center gap-2 px-1">
                  <span style={{ fontSize: 16 }}>{meta.emoji}</span>
                  <span className="text-sm flex-1" style={{ color: 'rgba(28,28,30,0.75)' }}>{meta.label}</span>
                  <span className="text-xs" style={{ color: 'rgba(28,28,30,0.45)' }}>{r.score}%</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// Маппинг server-side ошибок в человеческий текст для показа в форме.
function reasonText(code: string): string {
  if (code === 'level_required')        return 'Выбери уровень в AI'
  if (code === 'looking_for_required')  return 'Отметь хотя бы один пункт «Что хочешь забрать»'
  if (code === 'motivation_required')   return 'Заполни «Почему вступил»'
  return code || 'Не удалось сохранить'
}

