'use client'
import { useEffect, useMemo, useState } from 'react'
import { useTelegram, tgFetch } from './TelegramProvider'
import type { Segment } from '@/lib/wheel-prizes'
import { LEAVES_EXPLANATION_FALLBACK } from '@/lib/wheel-prizes'

const R = 200
const CX = 210
const CY = 210

const polar = (angleDeg: number, radius: number) => {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: CX + radius * Math.cos(rad), y: CY + radius * Math.sin(rad) }
}
const arcPath = (start: number, end: number) => {
  const p1 = polar(start, R)
  const p2 = polar(end, R)
  const large = end - start > 180 ? 1 : 0
  return `M ${CX} ${CY} L ${p1.x} ${p1.y} A ${R} ${R} 0 ${large} 1 ${p2.x} ${p2.y} Z`
}

export default function WheelTab({ onSpinComplete }: { onSpinComplete?: () => void }) {
  const { initData, isTelegram, ready } = useTelegram()
  const [segments, setSegments] = useState<Segment[] | null>(null)
  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState<(Segment & { leaves: number }) | null>(null)
  const [canSpin, setCanSpin] = useState<boolean | null>(null)
  const [spinsAvailable, setSpinsAvailable] = useState<number>(0)
  const [reason, setReason] = useState<string | null>(null)
  const [nextSpinAt, setNextSpinAt] = useState<string | null>(null)
  const [prevPrize, setPrevPrize] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showExplanation, setShowExp] = useState(false)
  const [expanded, setExpanded] = useState<number | null>(null)

  const SEG_COUNT = segments?.length ?? 1
  const SEG_ANGLE = 360 / SEG_COUNT

  useEffect(() => {
    if (!ready) return
    if (!isTelegram) {
      setError('Открой эту страницу через Telegram')
      setCanSpin(false)
      return
    }
    let cancelled = false

    Promise.all([
      fetch('/api/wheel/segments').then(r => r.json()),
      tgFetch('/api/wheel', initData).then(r => r.json()),
    ])
      .then(([seg, d]) => {
        if (cancelled) return
        setSegments(seg.segments ?? [])
        if (d.error) {
          setError(d.error === 'unauthorized' ? 'Не удалось авторизоваться' : d.error)
          setCanSpin(false)
          return
        }
        setCanSpin(Boolean(d.canSpin))
        setSpinsAvailable(typeof d.spinsAvailable === 'number' ? d.spinsAvailable : 0)
        setReason(d.reason ?? null)
        setNextSpinAt(d.nextSpinAt ?? null)
        if (d.lastSpin?.prize_leaves != null) setPrevPrize(d.lastSpin.prize_leaves)
      })
      .catch(() => { if (!cancelled) setError('Сеть недоступна') })
    return () => { cancelled = true }
  }, [ready, isTelegram, initData])

  const spin = async () => {
    if (spinning || !canSpin || !segments) return
    setSpinning(true)
    setResult(null)
    setError(null)

    try {
      const res = await tgFetch('/api/wheel', initData, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        const msg = data.error === 'no_credit'
          ? 'Нет доступных попыток'
          : data.error === 'not_member'
            ? 'Ты не в клубе'
            : data.error === 'no_prizes_configured'
              ? 'Колесо не настроено'
              : (data.error || 'Ошибка')
        setError(msg)
        setSpinning(false)
        return
      }
      const winIdx = data.segmentIndex as number
      const leaves = data.leaves as number
      const midAngle = winIdx * SEG_ANGLE + SEG_ANGLE / 2
      const target = (360 - midAngle) % 360
      const turns = 9 + Math.floor(Math.random() * 4)
      const currentBase = rotation - (rotation % 360)
      setRotation(currentBase + turns * 360 + target)

      setTimeout(() => {
        if (segments[winIdx]) setResult({ ...segments[winIdx], leaves })
        setSpinning(false)
        const remaining = typeof data.spinsAvailable === 'number' ? data.spinsAvailable : 0
        setSpinsAvailable(remaining)
        setCanSpin(remaining > 0)
        if (remaining === 0) setReason('awaiting_renewal')
        setPrevPrize(leaves)
        window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success')
        onSpinComplete?.()
      }, 8200)
    } catch {
      setError('Сеть недоступна')
      setSpinning(false)
    }
  }

  const statusLabel = useMemo(() => {
    if (canSpin === null) return 'загружаем…'
    if (canSpin) return spinsAvailable > 1 ? `${spinsAvailable} попытки доступно` : 'попытка доступна'
    if (reason === 'first_week_pending') return 'первый спин через неделю'
    if (reason === 'awaiting_renewal') return 'продли подписку'
    if (reason === 'not_member') return 'только для участников'
    return 'нет попыток'
  }, [canSpin, spinsAvailable, reason])

  const daysUntilFirstSpin = nextSpinAt
    ? Math.max(0, Math.ceil((new Date(nextSpinAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null

  if (!segments) {
    return <div className="text-center text-sm p-10" style={{ color: 'rgba(28,28,30,0.45)' }}>Загрузка…</div>
  }
  if (segments.length === 0) {
    return <div className="text-center text-sm p-10" style={{ color: 'rgba(28,28,30,0.45)' }}>Колесо ещё не настроено.</div>
  }

  return (
    <div className="max-w-xl mx-auto px-4 pb-8">
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
          {statusLabel}
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold mb-2 mt-3" style={{ color: '#1C1C1E', letterSpacing: '-1.2px', lineHeight: 1 }}>
          Крути колесо!
        </h1>
        <p className="text-sm" style={{ color: 'rgba(28,28,30,0.55)' }}>
          {reason === 'first_week_pending' && daysUntilFirstSpin != null
            ? `Первая попытка откроется через ${daysUntilFirstSpin} дн.`
            : reason === 'awaiting_renewal'
              ? 'Следующая попытка откроется при продлении подписки'
              : 'Крути и получай фантики'}
        </p>
        {prevPrize != null && !canSpin && !result && (
          <p className="text-xs mt-2" style={{ color: 'rgba(28,28,30,0.45)' }}>
            В прошлый раз ты выиграл {prevPrize}
          </p>
        )}
      </div>

      <div style={{ perspective: '1400px', marginBottom: 24 }}>
        <div style={{ transform: 'rotateX(20deg)', transformStyle: 'preserve-3d', position: 'relative', width: '100%', maxWidth: 500, margin: '0 auto' }}>
          <div style={{ position: 'absolute', bottom: '4%', left: '10%', right: '10%', height: 30, background: 'radial-gradient(ellipse at center, rgba(10,132,255,0.35) 0%, rgba(10,132,255,0) 70%)', filter: 'blur(20px)', zIndex: -1 }} />

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

          <svg
            viewBox="0 0 420 420"
            style={{
              width: '100%',
              display: 'block',
              transform: `rotate(${rotation}deg)`,
              transition: spinning ? 'transform 8s cubic-bezier(0.12, 0.82, 0.14, 1)' : 'none',
              filter: 'drop-shadow(0 24px 50px rgba(10,132,255,0.22)) drop-shadow(0 12px 20px rgba(0,0,0,0.14))',
            }}
          >
            <defs>
              {segments.map((s, i) => (
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

            {segments.map((s, i) => {
              const start = i * SEG_ANGLE
              const end = (i + 1) * SEG_ANGLE
              const mid = start + SEG_ANGLE / 2
              const textPos = polar(mid, R * 0.62)
              const len = s.label.length
              const fontSize = len > 10 ? 12 : len > 8 ? 14 : 17
              return (
                <g key={i}>
                  <path d={arcPath(start, end)} fill={`url(#grad-${i})`} stroke="rgba(255,255,255,0.45)" strokeWidth="2" />
                  <text
                    x={textPos.x} y={textPos.y}
                    fill="#FFFFFF" fontSize={fontSize} fontWeight="800"
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

      <div className="flex justify-center mb-6">
        <button
          onClick={spin}
          disabled={spinning || !canSpin}
          className="rounded-full px-10 py-4 text-base font-semibold transition-all active:scale-[0.97]"
          style={{
            background: !canSpin || spinning ? 'rgba(28,28,30,0.06)' : '#1C1C1E',
            color: !canSpin || spinning ? 'rgba(28,28,30,0.35)' : '#FFFFFF',
            minWidth: 240,
            boxShadow: !canSpin || spinning ? 'none' : '0 10px 30px rgba(28,28,30,0.22), 0 2px 6px rgba(28,28,30,0.10)',
            cursor: !canSpin || spinning ? 'not-allowed' : 'pointer',
            letterSpacing: '-0.3px',
            border: '1px solid rgba(28,28,30,0.08)',
          }}
        >
          {spinning
            ? 'Крутится...'
            : canSpin
              ? 'Крутить колесо'
              : canSpin === null
                ? 'Загрузка...'
                : reason === 'first_week_pending'
                  ? 'Первая попытка через неделю'
                  : reason === 'awaiting_renewal'
                    ? 'Продли подписку'
                    : 'Попыток нет'}
        </button>
      </div>

      {error && (
        <div className="text-center text-sm mb-4" style={{ color: '#FF3B30' }}>{error}</div>
      )}

      <div className="rounded-2xl p-4 mb-3" style={{ background: 'rgba(191,90,242,0.06)', border: '1px solid rgba(191,90,242,0.16)' }}>
        <div className="text-xs font-semibold uppercase mb-2" style={{ color: '#BF5AF2', letterSpacing: '0.6px' }}>
          Как работает Колесо удачи
        </div>
        <ul className="text-xs" style={{ color: 'rgba(28,28,30,0.70)', lineHeight: 1.8 }}>
          <li>Первая попытка — через неделю после вступления</li>
          <li>Новая попытка — каждое продление подписки (вместе с новым титулом)</li>
          <li>Призы: фантики, гайды, промокоды, разбор Instagram и созвон с Сергеем</li>
          <li>Доп. попытки можно купить за фантики в Киоске</li>
        </ul>
      </div>

      <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.66)', backdropFilter: 'blur(28px) saturate(160%)', WebkitBackdropFilter: 'blur(28px) saturate(160%)', border: '1px solid rgba(255,255,255,0.52)', boxShadow: '0 8px 32px rgba(0,0,0,0.10)' }}>
        <div className="text-xs font-semibold uppercase mb-3" style={{ color: 'rgba(28,28,30,0.45)', letterSpacing: '0.7px' }}>
          Возможные призы
        </div>
        <div className="flex flex-col gap-2">
          {segments.map((s, i) => {
            const isOpen = expanded === i
            return (
              <div key={i}>
                <button
                  onClick={() => setExpanded(isOpen ? null : i)}
                  className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-all"
                  style={{
                    background: `${s.color}10`,
                    border: `1px solid ${s.color}28`,
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ fontSize: 18, flexShrink: 0 }}>{s.emoji}</span>
                  <span
                    className="flex-1 text-sm font-medium truncate"
                    style={{ color: '#1C1C1E', letterSpacing: '-0.2px' }}
                  >
                    {s.prize}
                  </span>
                  <span style={{ fontSize: 11, color: 'rgba(28,28,30,0.30)', flexShrink: 0 }}>{isOpen ? '▲' : '▼'}</span>
                </button>
                {isOpen && (
                  <div className="rounded-xl px-3 py-2.5 mt-1 text-xs" style={{ background: `${s.color}08`, border: `1px solid ${s.color}18`, color: 'rgba(28,28,30,0.60)', lineHeight: 1.65 }}>
                    {s.explanation}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {result && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.40)', backdropFilter: 'blur(10px)' }} onClick={() => setResult(null)}>
          <div
            className="rounded-3xl p-8 text-center"
            style={{ background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(40px) saturate(180%)', border: '1px solid rgba(255,255,255,0.80)', boxShadow: `0 28px 80px rgba(0,0,0,0.28), 0 8px 32px ${result.color}33`, maxWidth: 420, width: '100%' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: 64, lineHeight: 1, marginBottom: 12 }}>🎉</div>
            <h2 className="text-2xl font-bold mb-1" style={{ color: '#1C1C1E', letterSpacing: '-0.8px' }}>Поздравляем!</h2>
            <p className="text-sm mb-5" style={{ color: 'rgba(28,28,30,0.55)' }}>Ты выиграл приз</p>

            <div className="rounded-2xl px-5 py-5 mb-4" style={{ background: `linear-gradient(135deg, ${result.color}1A 0%, ${result.color}0A 100%)`, border: `1px solid ${result.color}33` }}>
              <div style={{ fontSize: 36, marginBottom: 4 }}>{result.emoji || '🎁'}</div>
              <div className="text-2xl font-bold" style={{ color: result.color, letterSpacing: '-0.5px' }}>
                {result.leaves > 0 ? `${result.leaves} фантиков` : result.prize}
              </div>
              {result.leaves === 0 && (
                <div className="text-xs mt-2" style={{ color: 'rgba(28,28,30,0.55)' }}>
                  Сергей свяжется с тобой по этому призу.
                </div>
              )}
            </div>

            <button
              onClick={() => setShowExp(v => !v)}
              className="w-full rounded-xl py-2.5 text-sm font-medium mb-4 transition-all"
              style={{ background: showExplanation ? 'rgba(10,132,255,0.08)' : 'transparent', border: '1px solid rgba(10,132,255,0.20)', color: '#0A84FF', cursor: 'pointer' }}
            >
              {showExplanation ? '▲ Скрыть' : '▼ Что такое фантики?'}
            </button>
            {showExplanation && (
              <div className="rounded-xl px-4 py-3 mb-4 text-left text-xs" style={{ background: 'rgba(10,132,255,0.05)', border: '1px solid rgba(10,132,255,0.12)', color: 'rgba(28,28,30,0.70)', lineHeight: 1.65 }}>
                {LEAVES_EXPLANATION_FALLBACK}
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
