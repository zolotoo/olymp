'use client'
import { useEffect, useMemo, useState } from 'react'
import { tgFetch, useTelegram } from './TelegramProvider'

// «Мой путь» = адаптивная анкета (4 шага) + рекомендации (top-3 направлений).
// Рендерится внутри ProfileTab. Если онбординг уже пройден — показывает только
// рекомендации + кнопку «Перепройти». Если не начат — показывает большую CTA.
//
// Состояние держим локально на клиенте, на сервер шлём после каждого шага
// (сервер всё равно хранит partial state и пересчитывает рекомендации).

interface OptionGoal { id: string; emoji: string; label: string }
interface OptionLevel { id: string; label: string }
interface OptionSkill { id: string; label: string }
interface OptionHours { id: string; label: string }
interface OptionBiz { id: string; label: string }
interface PathMetaItem { emoji: string; label: string; description: string }

interface ApiResponse {
  state: {
    goal: string | null
    goal_custom: string | null
    level: string | null
    skills: string[]
    hours: string | null
    has_business: string | null
  }
  progress: {
    dm_step1_done: boolean
    mini_app_done: boolean
    points_awarded_step1: number
    points_awarded_full: number
  }
  options: {
    goals: OptionGoal[]
    levels: OptionLevel[]
    skills: OptionSkill[]
    hours: readonly OptionHours[] | OptionHours[]
    biz: readonly OptionBiz[] | OptionBiz[]
  }
  recommendations: { kind: string; score: number }[] | null
  pathMeta: Record<string, PathMetaItem>
}

const ACCENT = '#0A84FF'

export default function MyPathSection({ onComplete }: { onComplete?: () => void }) {
  const { initData } = useTelegram()
  const [data, setData] = useState<ApiResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<number>(0) // 0 = idle/done, 1..4 = steps, 5 = result
  const [saving, setSaving] = useState(false)
  const [showCustom, setShowCustom] = useState(false)
  const [customText, setCustomText] = useState('')
  const [justFinalized, setJustFinalized] = useState(false)

  const load = async () => {
    try {
      const r = await tgFetch('/api/onboarding', initData)
      const d = await r.json()
      if (d.error) { setError(d.error); return }
      setData(d as ApiResponse)
      if ((d as ApiResponse).progress.mini_app_done) setStep(0)
    } catch {
      setError('Сеть недоступна')
    }
  }

  useEffect(() => { load() /* eslint-disable-next-line */ }, [initData])

  const post = async (patch: Record<string, unknown>) => {
    setSaving(true)
    try {
      const r = await tgFetch('/api/onboarding', initData, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const d = await r.json()
      if (d.ok) {
        // Перечитаем из API, чтобы options обновились (level/skill зависят от goal)
        await load()
        if (d.finalized && d.pointsAwarded > 0) {
          setJustFinalized(true)
          window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success')
          onComplete?.()
        }
      } else {
        setError(d.error || 'Не удалось сохранить')
      }
    } catch {
      setError('Сеть недоступна')
    } finally {
      setSaving(false)
    }
  }

  const goal = data?.state.goal
  const skillsSel = useMemo(() => new Set(data?.state.skills ?? []), [data])
  const isDone = !!data?.progress.mini_app_done

  if (error) return <div className="text-sm" style={{ color: '#FF3B30' }}>{error}</div>
  if (!data) return <div className="text-sm" style={{ color: 'rgba(28,28,30,0.45)' }}>Загружаем «Мой путь»…</div>

  // ─── Idle (свернуто) ──────────────────────────────────────────────────────
  if (step === 0) {
    return (
      <div className="rounded-2xl p-5" style={{ background: '#FFFFFF', border: '1px solid rgba(28,28,30,0.06)' }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-xs font-semibold uppercase mb-0.5" style={{ color: 'rgba(28,28,30,0.45)', letterSpacing: '0.6px' }}>
              Мой путь
            </div>
            <div className="text-base font-semibold" style={{ color: '#1C1C1E', letterSpacing: '-0.3px' }}>
              {isDone ? 'Анкета пройдена' : 'Заполни анкету и забери +10'}
            </div>
          </div>
          <span style={{ fontSize: 28 }}>{isDone ? '🗺' : '🧭'}</span>
        </div>

        {isDone ? (
          <>
            <RecommendationsView data={data} />
            <button
              onClick={() => setStep(1)}
              className="w-full rounded-full py-2.5 mt-3 text-sm font-medium"
              style={{ background: 'rgba(28,28,30,0.06)', color: '#1C1C1E', border: 'none', cursor: 'pointer' }}
            >
              Перепройти анкету
            </button>
          </>
        ) : (
          <>
            <p className="text-sm mb-4" style={{ color: 'rgba(28,28,30,0.60)', lineHeight: 1.55 }}>
              4 коротких вопроса. По итогам — твой персональный рейтинг направлений
              в AI: где тебе лучше расти и что делать дальше.
            </p>
            <button
              onClick={() => setStep(1)}
              className="w-full rounded-full py-3 text-sm font-semibold active:scale-[0.98] transition-transform"
              style={{ background: ACCENT, color: '#fff', border: 'none', cursor: 'pointer' }}
            >
              Начать анкету · +10 фантиков
            </button>
          </>
        )}
      </div>
    )
  }

  // ─── Финальный экран после завершения ─────────────────────────────────────
  if (step === 5 || (justFinalized && isDone)) {
    return (
      <div className="rounded-2xl p-5" style={{ background: '#FFFFFF', border: '1px solid rgba(28,28,30,0.06)' }}>
        <div className="text-center mb-4">
          <div style={{ fontSize: 48, marginBottom: 8 }}>🎉</div>
          <div className="text-lg font-bold mb-1" style={{ color: '#1C1C1E', letterSpacing: '-0.4px' }}>
            +10 фантиков твои
          </div>
          <div className="text-sm" style={{ color: 'rgba(28,28,30,0.55)', lineHeight: 1.55 }}>
            И открыли бонусную попытку Колеса удачи.
          </div>
        </div>
        <RecommendationsView data={data} />
        <button
          onClick={() => { setStep(0); setJustFinalized(false) }}
          className="w-full rounded-full py-2.5 mt-4 text-sm font-medium"
          style={{ background: 'rgba(28,28,30,0.06)', color: '#1C1C1E', border: 'none', cursor: 'pointer' }}
        >
          Закрыть
        </button>
      </div>
    )
  }

  // ─── Шаги анкеты ──────────────────────────────────────────────────────────
  const StepShell = ({ title, sub, children, canBack = true }: { title: string; sub?: string; children: React.ReactNode; canBack?: boolean }) => (
    <div className="rounded-2xl p-5" style={{ background: '#FFFFFF', border: '1px solid rgba(28,28,30,0.06)' }}>
      <div className="flex items-center justify-between mb-1">
        <div className="text-xs font-semibold uppercase" style={{ color: ACCENT, letterSpacing: '0.7px' }}>
          Шаг {step} из 4
        </div>
        {canBack && (
          <button onClick={() => setStep(s => Math.max(0, s - 1))} className="text-xs" style={{ color: 'rgba(28,28,30,0.50)', background: 'none', border: 'none', cursor: 'pointer' }}>
            ← назад
          </button>
        )}
      </div>
      <h3 className="text-lg font-bold mb-1" style={{ color: '#1C1C1E', letterSpacing: '-0.4px' }}>{title}</h3>
      {sub && <p className="text-xs mb-4" style={{ color: 'rgba(28,28,30,0.55)', lineHeight: 1.55 }}>{sub}</p>}
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  )

  if (step === 1) {
    return (
      <StepShell
        title="Что ты хочешь от AI Олимп?"
        sub="Главная цель — её можно поменять потом."
        canBack={false}
      >
        {data.options.goals.map(g => (
          <ChipBig
            key={g.id}
            active={goal === g.id}
            onClick={async () => {
              setShowCustom(false)
              await post({ goal: g.id, goal_custom: null })
              setStep(2)
            }}
          >
            <span style={{ fontSize: 18, marginRight: 8 }}>{g.emoji}</span>{g.label}
          </ChipBig>
        ))}
        <ChipBig
          active={goal === 'custom'}
          onClick={() => { setShowCustom(true); setCustomText(data.state.goal_custom || '') }}
        >
          <span style={{ fontSize: 18, marginRight: 8 }}>✍️</span>Свой вариант
        </ChipBig>

        {showCustom && (
          <div className="mt-2">
            <textarea
              value={customText}
              onChange={e => setCustomText(e.target.value.slice(0, 500))}
              placeholder="Расскажи своими словами 1–3 предложения…"
              rows={3}
              className="w-full rounded-xl p-3 text-sm"
              style={{ background: 'rgba(10,132,255,0.06)', border: '1px solid rgba(10,132,255,0.20)', color: '#1C1C1E', resize: 'none', outline: 'none' }}
            />
            <button
              onClick={async () => {
                if (!customText.trim()) return
                await post({ goal: 'custom', goal_custom: customText.trim() })
                setStep(2)
              }}
              disabled={!customText.trim() || saving}
              className="w-full rounded-full py-2.5 mt-2 text-sm font-semibold"
              style={{ background: customText.trim() ? ACCENT : 'rgba(28,28,30,0.08)', color: customText.trim() ? '#fff' : 'rgba(28,28,30,0.35)', border: 'none', cursor: customText.trim() ? 'pointer' : 'not-allowed' }}
            >
              Дальше →
            </button>
          </div>
        )}
      </StepShell>
    )
  }

  if (step === 2) {
    const levels = data.options.levels
    return (
      <StepShell title="Какой у тебя уровень?" sub="По выбранной цели — точнее подскажем что делать.">
        {levels.map(l => (
          <ChipBig
            key={l.id}
            active={data.state.level === l.id}
            onClick={async () => { await post({ level: l.id }); setStep(3) }}
          >
            {l.label}
          </ChipBig>
        ))}
      </StepShell>
    )
  }

  if (step === 3) {
    const skillsList = data.options.skills
    const toggle = (id: string) => {
      const next = new Set(skillsSel)
      if (next.has(id)) next.delete(id); else next.add(id)
      post({ skills: Array.from(next) })
    }
    return (
      <StepShell title="Что уже умеешь?" sub="Можно несколько. Если ничего — переходи дальше.">
        <div className="flex flex-wrap gap-2 mb-3">
          {skillsList.map(s => {
            const active = skillsSel.has(s.id)
            return (
              <button
                key={s.id}
                onClick={() => toggle(s.id)}
                className="rounded-full px-3 py-2 text-xs font-medium transition-all active:scale-[0.97]"
                style={{
                  background: active ? ACCENT : 'rgba(28,28,30,0.06)',
                  color: active ? '#fff' : '#1C1C1E',
                  border: active ? `1px solid ${ACCENT}` : '1px solid rgba(28,28,30,0.10)',
                  cursor: 'pointer',
                }}
              >
                {s.label}
              </button>
            )
          })}
        </div>
        <button
          onClick={() => setStep(4)}
          disabled={saving}
          className="w-full rounded-full py-3 text-sm font-semibold"
          style={{ background: ACCENT, color: '#fff', border: 'none', cursor: 'pointer' }}
        >
          Дальше →
        </button>
      </StepShell>
    )
  }

  if (step === 4) {
    const hours = data.options.hours
    const biz = data.options.biz
    const canFinish = !!data.state.hours && !!data.state.has_business
    return (
      <StepShell title="Сколько готов вкладывать?" sub="И есть ли действующий бизнес/проект.">
        <div className="text-xs font-semibold uppercase mb-1" style={{ color: 'rgba(28,28,30,0.45)', letterSpacing: '0.6px' }}>Часы в неделю</div>
        {hours.map(h => (
          <ChipBig
            key={h.id}
            active={data.state.hours === h.id}
            onClick={() => post({ hours: h.id })}
          >
            {h.label}
          </ChipBig>
        ))}
        <div className="text-xs font-semibold uppercase mt-3 mb-1" style={{ color: 'rgba(28,28,30,0.45)', letterSpacing: '0.6px' }}>Есть бизнес/проект?</div>
        {biz.map(b => (
          <ChipBig
            key={b.id}
            active={data.state.has_business === b.id}
            onClick={() => post({ has_business: b.id })}
          >
            {b.label}
          </ChipBig>
        ))}
        <button
          onClick={async () => {
            await post({ finalize: true })
            setStep(5)
          }}
          disabled={!canFinish || saving}
          className="w-full rounded-full py-3 mt-3 text-sm font-semibold"
          style={{
            background: canFinish ? ACCENT : 'rgba(28,28,30,0.08)',
            color: canFinish ? '#fff' : 'rgba(28,28,30,0.35)',
            border: 'none',
            cursor: canFinish ? 'pointer' : 'not-allowed',
          }}
        >
          {saving ? 'Сохраняем…' : 'Завершить · +10 фантиков'}
        </button>
      </StepShell>
    )
  }

  return null
}

function ChipBig({
  active, children, onClick,
}: {
  active: boolean
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="w-full rounded-2xl px-4 py-3 text-left text-sm font-medium transition-all active:scale-[0.98]"
      style={{
        background: active ? `${ACCENT}14` : '#F2F2F7',
        color: '#1C1C1E',
        border: active ? `1.5px solid ${ACCENT}` : '1px solid rgba(28,28,30,0.06)',
        letterSpacing: '-0.2px',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}

function RecommendationsView({ data }: { data: ApiResponse }) {
  const recs = data.recommendations ?? []
  if (!recs.length) {
    return <div className="text-sm" style={{ color: 'rgba(28,28,30,0.55)' }}>Рекомендации появятся после анкеты.</div>
  }
  const medals = ['🥇', '🥈', '🥉']
  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs font-semibold uppercase mb-1" style={{ color: 'rgba(28,28,30,0.45)', letterSpacing: '0.6px' }}>
        Топ направлений для тебя
      </div>
      {recs.map((r, i) => {
        const meta = data.pathMeta[r.kind]
        if (!meta) return null
        return (
          <div key={r.kind} className="rounded-2xl p-3" style={{ background: '#F2F2F7', border: '1px solid rgba(28,28,30,0.06)' }}>
            <div className="flex items-center gap-2 mb-1">
              <span style={{ fontSize: 22 }}>{medals[i]}</span>
              <span style={{ fontSize: 22 }}>{meta.emoji}</span>
              <span className="text-sm font-semibold flex-1" style={{ color: '#1C1C1E', letterSpacing: '-0.2px' }}>
                {meta.label}
              </span>
              <span className="text-xs font-semibold" style={{ color: ACCENT }}>
                {r.score}%
              </span>
            </div>
            <div className="text-xs" style={{ color: 'rgba(28,28,30,0.60)', lineHeight: 1.55 }}>
              {meta.description}
            </div>
          </div>
        )
      })}
    </div>
  )
}
