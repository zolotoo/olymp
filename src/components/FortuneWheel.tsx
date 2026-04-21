'use client'
import { useState, useEffect } from 'react'

// ─── Segments ─────────────────────────────────────────────────────────────────
// neverDrop: true — сектор виден на колесе, но не выпадает в этом месяце
interface Segment {
  label: string
  emoji: string
  color: string
  colorDeep: string
  prize: string
  explanation: string
  leaves?: number       // если это листики
  neverDrop?: boolean   // «подкручено» — не выпадает
  weight?: number       // вес для случайного выбора (только у eligible)
}

const SEGMENTS: Segment[] = [
  {
    label: '10 🍃',
    emoji: '🍃',
    color: '#0A84FF', colorDeep: '#0066CC',
    prize: '10 листиков',
    leaves: 10,
    weight: 40,
    explanation: 'Листики, внутренняя валюта AI Олимпа. Идут в зачёт ранга и дают бонусы: консультации от Сергея, групповые созвоны, секретные уроки.',
  },
  {
    label: 'Гайд',
    emoji: '📘',
    color: '#BF5AF2', colorDeep: '#8E3BC9',
    prize: 'Закрытый гайд',
    neverDrop: true,
    explanation: 'Закрытый авторский гайд по AI-инструментам. Появится в будущих месяцах.',
  },
  {
    label: '20 🍃',
    emoji: '🍃',
    color: '#30D158', colorDeep: '#1FA544',
    prize: '20 листиков',
    leaves: 20,
    weight: 35,
    explanation: 'Листики, внутренняя валюта AI Олимпа. Идут в зачёт ранга и дают бонусы: консультации от Сергея, групповые созвоны, секретные уроки.',
  },
  {
    label: 'Секрет',
    emoji: '🔒',
    color: '#FF375F', colorDeep: '#C82747',
    prize: 'Секретный контент',
    neverDrop: true,
    explanation: 'Доступ к закрытым материалам клуба. Появится в будущих месяцах.',
  },
  {
    label: '50 🍃',
    emoji: '🍃',
    color: '#FF9500', colorDeep: '#CC7600',
    prize: '50 листиков',
    leaves: 50,
    weight: 20,
    explanation: 'Листики, внутренняя валюта AI Олимпа. Большой выигрыш, ты близко к новому рангу!',
  },
  {
    label: 'VeoSee',
    emoji: '🎁',
    color: '#40C8E0', colorDeep: '#2691A3',
    prize: 'Промокод VeoSeeBot',
    neverDrop: true,
    explanation: 'Эксклюзивный промокод от наших партнёров VeoSeeBot, доступ к дополнительным AI-инструментам. Появится в будущих месяцах.',
  },
  {
    label: '15 🍃',
    emoji: '🍃',
    color: '#5E5CE6', colorDeep: '#3C3AB8',
    prize: '15 листиков',
    leaves: 15,
    weight: 5,
    explanation: 'Листики, внутренняя валюта AI Олимпа. Идут в зачёт ранга и дают бонусы: консультации от Сергея, групповые созвоны, секретные уроки.',
  },
  {
    label: 'Скидка',
    emoji: '🎟️',
    color: '#FFD60A', colorDeep: '#CC9A00',
    prize: 'Скидка 50% на месяц',
    neverDrop: true,
    explanation: 'Скидка 50% на продление подписки в AI Олимп. Появится в будущих месяцах.',
  },
]

// Только eligible сектора (с весом, не подкручены)
const ELIGIBLE = SEGMENTS
  .map((s, i) => ({ s, i }))
  .filter(({ s }) => !s.neverDrop && s.weight !== undefined)

const ELIGIBLE_TOTAL = ELIGIBLE.reduce((sum, { s }) => sum + (s.weight ?? 0), 0)

function pickEligibleIndex(): number {
  let rand = Math.random() * ELIGIBLE_TOTAL
  for (const { s, i } of ELIGIBLE) {
    rand -= s.weight ?? 0
    if (rand <= 0) return i
  }
  return ELIGIBLE[0].i
}

const LEAVES_EXPLANATION =
  'Листики 🍃, внутренняя валюта AI Олимпа. Идут в зачёт ранга и дают разные бонусы: ' +
  'консультации от Сергея, групповые созвоны, секретные уроки. ' +
  'Зарабатывай их за реакции, голосования и еженедельный бонус. ' +
  'Чем больше листиков, тем выше ранг: Адепт → Герой → Чемпион Олимпа → Полубог → Бог.'

// 1 попытка в месяц — localStorage
function getMonthKey() {
  const d = new Date()
  return `olymp_wheel_${d.getFullYear()}_${d.getMonth()}`
}
function checkCanSpin() {
  try { return !localStorage.getItem(getMonthKey()) } catch { return true }
}
function recordSpinUsed() {
  try { localStorage.setItem(getMonthKey(), '1') } catch { /* */ }
}

// SVG helpers
const SEG_COUNT = SEGMENTS.length
const SEG_ANGLE = 360 / SEG_COUNT
const R = 200
const CX = 210
const CY = 210

const polar = (angleDeg: number, radius: number) => {
  const rad = (angleDeg - 90) * Math.PI / 180
  return { x: CX + radius * Math.cos(rad), y: CY + radius * Math.sin(rad) }
}
const arcPath = (start: number, end: number) => {
  const p1 = polar(start, R)
  const p2 = polar(end, R)
  const large = end - start > 180 ? 1 : 0
  return `M ${CX} ${CY} L ${p1.x} ${p1.y} A ${R} ${R} 0 ${large} 1 ${p2.x} ${p2.y} Z`
}

export default function FortuneWheel() {
  const [rotation, setRotation]       = useState(0)
  const [spinning, setSpinning]       = useState(false)
  const [result, setResult]           = useState<Segment | null>(null)
  const [canSpin, setCanSpin]         = useState(true)
  const [showExplanation, setShowExp] = useState(false)
  const [expanded, setExpanded]       = useState<number | null>(null)

  useEffect(() => { setCanSpin(checkCanSpin()) }, [])

  const spin = () => {
    if (spinning || !canSpin) return
    setSpinning(true)
    setResult(null)
    setShowExp(false)

    const winIdx = pickEligibleIndex()
    const midAngle = winIdx * SEG_ANGLE + SEG_ANGLE / 2
    const target = (360 - midAngle) % 360
    const turns = 9 + Math.floor(Math.random() * 4)
    const currentBase = rotation - (rotation % 360)
    setRotation(currentBase + turns * 360 + target)

    setTimeout(() => {
      setResult(SEGMENTS[winIdx])
      setSpinning(false)
      setCanSpin(false)
      recordSpinUsed()
    }, 8200)
  }

  return (
    <div className="max-w-xl mx-auto">
      {/* Header */}
      <div className="text-center mb-6">
        <div
          className="text-xs font-semibold uppercase mb-2 inline-block rounded-full px-3 py-1"
          style={{ color: '#0A84FF', letterSpacing: '0.8px', background: 'rgba(10,132,255,0.10)', border: '1px solid rgba(10,132,255,0.18)' }}
        >
          {canSpin ? 'попытка в этом месяце доступна' : 'попытка использована в этом месяце'}
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold mb-2 mt-3" style={{ color: '#1C1C1E', letterSpacing: '-1.4px', lineHeight: 1 }}>
          Крути колесо!
        </h1>
        <p className="text-sm sm:text-base" style={{ color: 'rgba(28,28,30,0.55)', letterSpacing: '-0.2px' }}>
          1 попытка в месяц, крути и получай приз
        </p>
      </div>

      {/* Wheel */}
      <div style={{ perspective: '1400px', marginBottom: 28 }}>
        <div style={{ transform: 'rotateX(20deg)', transformStyle: 'preserve-3d', position: 'relative', width: '100%', maxWidth: 500, margin: '0 auto' }}>
          <div style={{ position: 'absolute', bottom: '4%', left: '10%', right: '10%', height: 30, background: 'radial-gradient(ellipse at center, rgba(10,132,255,0.35) 0%, rgba(10,132,255,0) 70%)', filter: 'blur(20px)', zIndex: -1 }} />

          {/* Pointer */}
          <div style={{ position: 'absolute', top: -4, left: '50%', transform: 'translateX(-50%) translateZ(30px)', zIndex: 10, filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.25))' }}>
            <svg width="36" height="44" viewBox="0 0 36 44">
              <defs>
                <linearGradient id="pointerGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FFFFFF" />
                  <stop offset="60%" stopColor="#F2F2F7" />
                  <stop offset="100%" stopColor="#C7C7CC" />
                </linearGradient>
              </defs>
              <path d="M 18 40 L 4 10 Q 4 2 18 2 Q 32 2 32 10 Z" fill="url(#pointerGrad)" stroke="#1C1C1E" strokeWidth="1.5" strokeLinejoin="round" />
              <circle cx="18" cy="12" r="3" fill="#1C1C1E" />
            </svg>
          </div>

          {/* Wheel SVG */}
          <svg
            viewBox="0 0 420 420"
            style={{
              width: '100%', display: 'block',
              transform: `rotate(${rotation}deg)`,
              transition: spinning ? 'transform 8s cubic-bezier(0.12, 0.82, 0.14, 1)' : 'none',
              filter: 'drop-shadow(0 24px 50px rgba(10,132,255,0.22)) drop-shadow(0 12px 20px rgba(0,0,0,0.14))',
            }}
          >
            <defs>
              {SEGMENTS.map((s, i) => (
                <radialGradient key={i} id={`grad-${i}`} cx="0.5" cy="0.5" r="0.85">
                  <stop offset="0%" stopColor={s.color} />
                  <stop offset="100%" stopColor={s.colorDeep} />
                </radialGradient>
              ))}
              <radialGradient id="rimGrad" cx="0.5" cy="0.5" r="0.5">
                <stop offset="85%" stopColor="#FFFFFF" stopOpacity="0" />
                <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.6" />
              </radialGradient>
              <radialGradient id="hubGrad" cx="0.35" cy="0.35" r="0.9">
                <stop offset="0%" stopColor="#FFFFFF" />
                <stop offset="45%" stopColor="#F2F2F7" />
                <stop offset="100%" stopColor="#AEAEB2" />
              </radialGradient>
              <radialGradient id="hubInner" cx="0.35" cy="0.35" r="0.9">
                <stop offset="0%" stopColor="#48484A" />
                <stop offset="100%" stopColor="#1C1C1E" />
              </radialGradient>
            </defs>

            <circle cx={CX} cy={CY} r={R + 12} fill="#FFFFFF" />
            <circle cx={CX} cy={CY} r={R + 12} fill="url(#rimGrad)" />
            <circle cx={CX} cy={CY} r={R + 10} fill="none" stroke="rgba(28,28,30,0.12)" strokeWidth="1" />

            {SEGMENTS.map((s, i) => {
              const start = i * SEG_ANGLE
              const end = (i + 1) * SEG_ANGLE
              const mid = start + SEG_ANGLE / 2
              const textPos = polar(mid, R * 0.62)
              return (
                <g key={i}>
                  <path d={arcPath(start, end)} fill={`url(#grad-${i})`} stroke="rgba(255,255,255,0.45)" strokeWidth="2" />
                  <text
                    x={textPos.x} y={textPos.y}
                    fill="#FFFFFF" fontSize="17" fontWeight="800"
                    textAnchor="middle" dominantBaseline="middle"
                    transform={`rotate(${mid}, ${textPos.x}, ${textPos.y})`}
                    style={{ letterSpacing: '-0.5px', userSelect: 'none' }}
                  >
                    {s.label}
                  </text>
                </g>
              )
            })}

            <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
            <circle cx={CX} cy={CY} r="42" fill="url(#hubGrad)" />
            <circle cx={CX} cy={CY} r="42" fill="none" stroke="rgba(28,28,30,0.20)" strokeWidth="1.5" />
            <circle cx={CX} cy={CY} r="28" fill="url(#hubInner)" />
            <circle cx={CX - 6} cy={CY - 8} r="5" fill="rgba(255,255,255,0.35)" />
          </svg>
        </div>
      </div>

      {/* Spin button */}
      <div className="flex justify-center mb-8">
        <button
          onClick={spin}
          disabled={spinning || !canSpin}
          className="rounded-full px-10 py-4 text-base font-semibold transition-all active:scale-[0.97]"
          style={{
            background: (!canSpin || spinning) ? 'rgba(28,28,30,0.06)' : '#1C1C1E',
            color: (!canSpin || spinning) ? 'rgba(28,28,30,0.35)' : '#FFFFFF',
            minWidth: 240,
            boxShadow: (!canSpin || spinning) ? 'none' : '0 10px 30px rgba(28,28,30,0.22), 0 2px 6px rgba(28,28,30,0.10)',
            cursor: (!canSpin || spinning) ? 'not-allowed' : 'pointer',
            letterSpacing: '-0.3px',
            border: '1px solid rgba(28,28,30,0.08)',
          }}
        >
          {spinning ? 'Крутится...' : canSpin ? 'Крутить колесо' : 'Попытка использована'}
        </button>
      </div>

      {/* Prize list */}
      <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.66)', backdropFilter: 'blur(28px) saturate(160%)', WebkitBackdropFilter: 'blur(28px) saturate(160%)', border: '1px solid rgba(255,255,255,0.52)', boxShadow: '0 8px 32px rgba(0,0,0,0.10)' }}>
        <div className="text-xs font-semibold uppercase mb-3" style={{ color: 'rgba(28,28,30,0.45)', letterSpacing: '0.7px' }}>
          Возможные призы
        </div>
        <div className="flex flex-col gap-2">
          {SEGMENTS.map((s, i) => {
            const isOpen = expanded === i
            return (
              <div key={i}>
                <button
                  onClick={() => setExpanded(isOpen ? null : i)}
                  className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-all"
                  style={{
                    background: s.neverDrop ? 'rgba(142,142,147,0.06)' : `${s.color}10`,
                    border: `1px solid ${s.neverDrop ? 'rgba(142,142,147,0.18)' : s.color + '28'}`,
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ fontSize: 18, flexShrink: 0 }}>{s.emoji}</span>
                  <span
                    className="flex-1 text-sm font-medium truncate"
                    style={{ color: s.neverDrop ? 'rgba(28,28,30,0.42)' : '#1C1C1E', letterSpacing: '-0.2px' }}
                  >
                    {s.prize}
                  </span>
                  <span style={{ fontSize: 11, color: 'rgba(28,28,30,0.30)', flexShrink: 0 }}>{isOpen ? '▲' : '▼'}</span>
                </button>
                {isOpen && (
                  <div className="rounded-xl px-3 py-2.5 mt-1 text-xs" style={{ background: s.neverDrop ? 'rgba(142,142,147,0.04)' : `${s.color}08`, border: `1px solid ${s.neverDrop ? 'rgba(142,142,147,0.10)' : s.color + '18'}`, color: 'rgba(28,28,30,0.60)', lineHeight: 1.65, letterSpacing: '-0.1px' }}>
                    {s.explanation}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Result modal */}
      {result && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.40)', backdropFilter: 'blur(10px)' }} onClick={() => setResult(null)}>
          <div
            className="rounded-3xl p-8 text-center wheel-pop"
            style={{ background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(40px) saturate(180%)', border: '1px solid rgba(255,255,255,0.80)', boxShadow: `0 28px 80px rgba(0,0,0,0.28), 0 8px 32px ${result.color}33`, maxWidth: 420, width: '100%' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: 64, lineHeight: 1, marginBottom: 12 }}>🎉</div>
            <h2 className="text-2xl font-bold mb-1" style={{ color: '#1C1C1E', letterSpacing: '-0.8px' }}>Поздравляем!</h2>
            <p className="text-sm mb-5" style={{ color: 'rgba(28,28,30,0.55)', letterSpacing: '-0.15px' }}>Ты выиграл приз</p>

            <div className="rounded-2xl px-5 py-5 mb-4" style={{ background: `linear-gradient(135deg, ${result.color}1A 0%, ${result.color}0A 100%)`, border: `1px solid ${result.color}33` }}>
              <div style={{ fontSize: 36, marginBottom: 4 }}>🍃</div>
              <div className="text-2xl font-bold" style={{ color: result.color, letterSpacing: '-0.5px' }}>
                {result.leaves} листиков
              </div>
            </div>

            <button
              onClick={() => setShowExp(v => !v)}
              className="w-full rounded-xl py-2.5 text-sm font-medium mb-4 transition-all"
              style={{ background: showExplanation ? 'rgba(10,132,255,0.08)' : 'transparent', border: '1px solid rgba(10,132,255,0.20)', color: '#0A84FF', cursor: 'pointer', letterSpacing: '-0.15px' }}
            >
              {showExplanation ? '▲ Скрыть' : '▼ Что такое листики?'}
            </button>
            {showExplanation && (
              <div className="rounded-xl px-4 py-3 mb-4 text-left text-xs" style={{ background: 'rgba(10,132,255,0.05)', border: '1px solid rgba(10,132,255,0.12)', color: 'rgba(28,28,30,0.70)', lineHeight: 1.65, letterSpacing: '-0.1px' }}>
                {LEAVES_EXPLANATION}
              </div>
            )}

            <button onClick={() => setResult(null)} className="w-full rounded-full py-3 text-sm font-semibold" style={{ background: 'rgba(28,28,30,0.08)', color: '#1C1C1E' }}>
              Закрыть
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
