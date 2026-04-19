'use client'
import { useState } from 'react'

interface Segment {
  label: string
  color: string
  colorDeep: string
  prize: string
  emoji: string
  isMiss?: boolean
}

// 8 сегментов — призы месяца «Приветственный» в наших цветах
const SEGMENTS: Segment[] = [
  { label: '100 🍃', emoji: '🍃', color: '#0A84FF', colorDeep: '#0066CC', prize: '100 листиков' },
  { label: 'Гайд',   emoji: '📘', color: '#BF5AF2', colorDeep: '#8E3BC9', prize: 'Закрытый гайд' },
  { label: '200 🍃', emoji: '🍃', color: '#30D158', colorDeep: '#1FA544', prize: '200 листиков' },
  { label: 'Мимо',   emoji: '🎯', color: '#8E8E93', colorDeep: '#636366', prize: 'Мимо', isMiss: true },
  { label: '100 🍃', emoji: '🍃', color: '#5E5CE6', colorDeep: '#3C3AB8', prize: '100 листиков' },
  { label: 'Секрет', emoji: '🔒', color: '#FF375F', colorDeep: '#C82747', prize: 'Секретный контент' },
  { label: '300 🍃', emoji: '🍃', color: '#FF9500', colorDeep: '#CC7600', prize: '300 листиков' },
  { label: 'Гайд',   emoji: '📘', color: '#40C8E0', colorDeep: '#2691A3', prize: 'Закрытый гайд' },
]

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
  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState<Segment | null>(null)
  const [spinsLeft, setSpinsLeft] = useState(3)

  const spin = () => {
    if (spinning || spinsLeft <= 0) return
    setSpinning(true)
    setResult(null)

    const winIdx = Math.floor(Math.random() * SEG_COUNT)
    // Стрелка сверху (angle = 0). Середина сегмента i = i*SEG_ANGLE + SEG_ANGLE/2.
    // Чтобы середина оказалась наверху, повернуть колесо на -midAngle (mod 360).
    const midAngle = winIdx * SEG_ANGLE + SEG_ANGLE / 2
    const target = (360 - midAngle) % 360
    const turns = 5 + Math.floor(Math.random() * 3)   // 5–7 полных оборотов
    const currentBase = rotation - (rotation % 360)
    const newRotation = currentBase + turns * 360 + target
    setRotation(newRotation)

    setTimeout(() => {
      setResult(SEGMENTS[winIdx])
      setSpinning(false)
      setSpinsLeft(n => n - 1)
    }, 5200)
  }

  const reset = () => {
    setSpinsLeft(3)
    setResult(null)
    setRotation(0)
  }

  return (
    <div className="max-w-xl mx-auto">
      {/* Header */}
      <div className="text-center mb-6">
        <div
          className="text-xs font-semibold uppercase mb-2 inline-block rounded-full px-3 py-1"
          style={{
            color: '#0A84FF',
            letterSpacing: '0.8px',
            background: 'rgba(10,132,255,0.10)',
            border: '1px solid rgba(10,132,255,0.18)',
          }}
        >
          {spinsLeft > 0 ? `осталось попыток · ${spinsLeft}` : 'попытки закончились'}
        </div>
        <h1
          className="text-4xl sm:text-5xl font-bold mb-2 mt-3"
          style={{ color: '#1C1C1E', letterSpacing: '-1.4px', lineHeight: 1 }}
        >
          Крути колесо!
        </h1>
        <p className="text-sm sm:text-base" style={{ color: 'rgba(28,28,30,0.55)', letterSpacing: '-0.2px' }}>
          Нажми кнопку и получи случайный приз месяца
        </p>
      </div>

      {/* Wheel — 3D perspective wrapper */}
      <div style={{ perspective: '1400px', marginBottom: 28 }}>
        <div
          style={{
            transform: 'rotateX(20deg)',
            transformStyle: 'preserve-3d',
            position: 'relative',
            width: '100%',
            maxWidth: 500,
            margin: '0 auto',
          }}
        >
          {/* Подложка-тень под колесом */}
          <div
            style={{
              position: 'absolute',
              bottom: '4%',
              left: '10%',
              right: '10%',
              height: 30,
              background: 'radial-gradient(ellipse at center, rgba(10,132,255,0.35) 0%, rgba(10,132,255,0) 70%)',
              filter: 'blur(20px)',
              zIndex: -1,
            }}
          />

          {/* Pointer (стрелка сверху) */}
          <div
            style={{
              position: 'absolute',
              top: -4,
              left: '50%',
              transform: 'translateX(-50%) translateZ(30px)',
              zIndex: 10,
              filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.25))',
            }}
          >
            <svg width="36" height="44" viewBox="0 0 36 44">
              <defs>
                <linearGradient id="pointerGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FFFFFF" />
                  <stop offset="60%" stopColor="#F2F2F7" />
                  <stop offset="100%" stopColor="#C7C7CC" />
                </linearGradient>
              </defs>
              <path
                d="M 18 40 L 4 10 Q 4 2 18 2 Q 32 2 32 10 Z"
                fill="url(#pointerGrad)"
                stroke="#1C1C1E"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <circle cx="18" cy="12" r="3" fill="#1C1C1E" />
            </svg>
          </div>

          {/* Wheel SVG */}
          <svg
            viewBox="0 0 420 420"
            style={{
              width: '100%',
              display: 'block',
              transform: `rotate(${rotation}deg)`,
              transition: spinning ? 'transform 5s cubic-bezier(0.22, 0.9, 0.28, 1)' : 'none',
              filter:
                'drop-shadow(0 24px 50px rgba(10,132,255,0.22)) drop-shadow(0 12px 20px rgba(0,0,0,0.14))',
            }}
          >
            <defs>
              {SEGMENTS.map((s, i) => (
                <radialGradient key={`g-${i}`} id={`grad-${i}`} cx="0.5" cy="0.5" r="0.85">
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

            {/* Внешнее кольцо */}
            <circle cx={CX} cy={CY} r={R + 12} fill="#FFFFFF" />
            <circle cx={CX} cy={CY} r={R + 12} fill="url(#rimGrad)" />
            <circle
              cx={CX}
              cy={CY}
              r={R + 10}
              fill="none"
              stroke="rgba(28,28,30,0.12)"
              strokeWidth="1"
            />

            {/* Сегменты */}
            {SEGMENTS.map((s, i) => {
              const start = i * SEG_ANGLE
              const end = (i + 1) * SEG_ANGLE
              const mid = start + SEG_ANGLE / 2
              const textPos = polar(mid, R * 0.62)
              return (
                <g key={`seg-${i}`}>
                  <path
                    d={arcPath(start, end)}
                    fill={`url(#grad-${i})`}
                    stroke="rgba(255,255,255,0.45)"
                    strokeWidth="2"
                  />
                  <text
                    x={textPos.x}
                    y={textPos.y}
                    fill="#FFFFFF"
                    fontSize="20"
                    fontWeight="800"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    transform={`rotate(${mid}, ${textPos.x}, ${textPos.y})`}
                    style={{ letterSpacing: '-0.5px', userSelect: 'none' }}
                  >
                    {s.label}
                  </text>
                </g>
              )
            })}

            {/* Блики на сегментах (иллюзия 3D объёма) */}
            <circle
              cx={CX}
              cy={CY}
              r={R}
              fill="none"
              stroke="rgba(255,255,255,0.25)"
              strokeWidth="1"
            />

            {/* Центральная втулка */}
            <circle cx={CX} cy={CY} r="42" fill="url(#hubGrad)" />
            <circle
              cx={CX}
              cy={CY}
              r="42"
              fill="none"
              stroke="rgba(28,28,30,0.20)"
              strokeWidth="1.5"
            />
            <circle cx={CX} cy={CY} r="28" fill="url(#hubInner)" />
            <circle cx={CX - 6} cy={CY - 8} r="5" fill="rgba(255,255,255,0.35)" />
          </svg>
        </div>
      </div>

      {/* Spin button */}
      <div className="flex justify-center mb-8">
        {spinsLeft > 0 ? (
          <button
            onClick={spin}
            disabled={spinning}
            className="rounded-full px-10 py-4 text-base font-bold transition-all active:scale-95"
            style={{
              background: spinning
                ? 'rgba(10,132,255,0.30)'
                : 'linear-gradient(135deg, #0A84FF 0%, #5E5CE6 50%, #BF5AF2 100%)',
              color: '#FFFFFF',
              minWidth: 240,
              boxShadow: spinning
                ? 'none'
                : '0 12px 32px rgba(10,132,255,0.40), 0 4px 12px rgba(191,90,242,0.20)',
              cursor: spinning ? 'not-allowed' : 'pointer',
              letterSpacing: '-0.3px',
              border: 'none',
            }}
          >
            {spinning ? '⏳ Крутится...' : '🎰 Крутить колесо'}
          </button>
        ) : (
          <button
            onClick={reset}
            className="rounded-full px-8 py-3.5 text-base font-semibold transition-all active:scale-95"
            style={{
              background: 'rgba(28,28,30,0.08)',
              color: '#1C1C1E',
              minWidth: 220,
              cursor: 'pointer',
              border: '1px solid rgba(28,28,30,0.10)',
              letterSpacing: '-0.3px',
            }}
          >
            ↺ Сбросить
          </button>
        )}
      </div>

      {/* Prize list */}
      <div
        className="rounded-2xl p-5"
        style={{
          background: 'rgba(255,255,255,0.66)',
          backdropFilter: 'blur(28px) saturate(160%)',
          WebkitBackdropFilter: 'blur(28px) saturate(160%)',
          border: '1px solid rgba(255,255,255,0.52)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)',
        }}
      >
        <div
          className="text-xs font-semibold uppercase mb-3"
          style={{ color: 'rgba(28,28,30,0.45)', letterSpacing: '0.7px' }}
        >
          Возможные призы
        </div>
        <div className="grid grid-cols-2 gap-2">
          {SEGMENTS.map((s, i) => (
            <div
              key={i}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2"
              style={{
                background: `linear-gradient(135deg, ${s.color}14 0%, ${s.color}08 100%)`,
                border: `1px solid ${s.color}22`,
              }}
            >
              <span style={{ fontSize: 18 }}>{s.emoji}</span>
              <span
                className="text-sm font-medium truncate"
                style={{
                  color: s.isMiss ? 'rgba(28,28,30,0.45)' : '#1C1C1E',
                  letterSpacing: '-0.2px',
                }}
              >
                {s.prize}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Result modal */}
      {result && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.40)', backdropFilter: 'blur(10px)' }}
          onClick={() => setResult(null)}
        >
          <div
            className="rounded-3xl p-8 text-center wheel-pop"
            style={{
              background: 'rgba(255,255,255,0.96)',
              backdropFilter: 'blur(40px) saturate(180%)',
              border: '1px solid rgba(255,255,255,0.80)',
              boxShadow: `0 28px 80px rgba(0,0,0,0.28), 0 8px 32px ${result.color}33`,
              maxWidth: 420,
              width: '100%',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: 64, lineHeight: 1, marginBottom: 12 }}>
              {result.isMiss ? '😔' : '🎉'}
            </div>
            <h2
              className="text-2xl font-bold mb-1"
              style={{ color: '#1C1C1E', letterSpacing: '-0.8px' }}
            >
              {result.isMiss ? 'Увы, мимо!' : 'Поздравляем!'}
            </h2>
            <p
              className="text-sm mb-5"
              style={{ color: 'rgba(28,28,30,0.55)', letterSpacing: '-0.15px' }}
            >
              {result.isMiss ? 'В следующий раз точно повезёт' : 'Ты выиграл приз'}
            </p>

            {!result.isMiss && (
              <div
                className="rounded-2xl px-5 py-5 mb-5"
                style={{
                  background: `linear-gradient(135deg, ${result.color}1A 0%, ${result.color}0A 100%)`,
                  border: `1px solid ${result.color}33`,
                }}
              >
                <div style={{ fontSize: 32, marginBottom: 4 }}>{result.emoji}</div>
                <div
                  className="text-xl font-bold"
                  style={{ color: result.color, letterSpacing: '-0.5px' }}
                >
                  {result.prize}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              {spinsLeft > 0 && (
                <button
                  onClick={() => { setResult(null); setTimeout(spin, 150) }}
                  className="flex-1 rounded-full py-3 text-sm font-bold"
                  style={{
                    background: 'linear-gradient(135deg, #0A84FF 0%, #5E5CE6 100%)',
                    color: '#FFFFFF',
                    boxShadow: '0 6px 16px rgba(10,132,255,0.30)',
                  }}
                >
                  Ещё раз · {spinsLeft}
                </button>
              )}
              <button
                onClick={() => setResult(null)}
                className="flex-1 rounded-full py-3 text-sm font-semibold"
                style={{ background: 'rgba(28,28,30,0.08)', color: '#1C1C1E' }}
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
