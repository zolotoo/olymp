'use client'
import { useEffect, useMemo, useState } from 'react'
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

const ACCENT = '#0A84FF'

export default function MyPathSection({ onComplete }: { onComplete?: () => void }) {
  const { initData } = useTelegram()
  const [data, setData] = useState<ApiResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [justFinalized, setJustFinalized] = useState(false)

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

  if (error) return <div className="text-sm" style={{ color: '#FF3B30' }}>{error}</div>
  if (!data) return <div className="text-sm" style={{ color: 'rgba(28,28,30,0.45)' }}>Загружаем «Мой путь»…</div>

  // ─── Финал после finalize ─────────────────────────────────────────────────
  if ((justFinalized && isDone) || (isDone && !open)) {
    return (
      <div className="rounded-2xl p-5" style={{ background: '#FFFFFF', border: '1px solid rgba(28,28,30,0.06)' }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-xs font-semibold uppercase mb-0.5" style={{ color: 'rgba(28,28,30,0.45)', letterSpacing: '0.6px' }}>
              Мой путь
            </div>
            <div className="text-base font-semibold" style={{ color: '#1C1C1E', letterSpacing: '-0.3px' }}>
              {justFinalized ? '+10 фантиков твои' : 'Анкета пройдена'}
            </div>
          </div>
          <span style={{ fontSize: 28 }}>🗺</span>
        </div>
        <RecommendationsView data={data} />
      </div>
    )
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

function RecommendationsView({ data }: { data: ApiResponse }) {
  const recs = useMemo(() => data.recommendations ?? [], [data])
  if (!recs.length) {
    return <div className="text-sm" style={{ color: 'rgba(28,28,30,0.55)' }}>Рекомендации появятся после анкеты.</div>
  }
  const medals = ['🥇', '🥈', '🥉']
  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs font-semibold uppercase mb-1" style={{ color: 'rgba(28,28,30,0.45)', letterSpacing: '0.6px' }}>
        Куда лучше идти в клубе
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
