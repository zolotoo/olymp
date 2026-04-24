'use client'
import { useCallback, useEffect, useState } from 'react'
import { useTelegram, tgFetch } from './TelegramProvider'

interface ShopItem {
  key: string
  title: string
  description: string
  price: number
  kind: 'promo_code' | 'wheel_spin' | 'info'
  emoji: string
  image_url: string | null
  in_stock: boolean
}

interface ShopResponse {
  points: number
  items: ShopItem[]
  texts: Record<string, string>
}

function render(tpl: string | undefined, vars: Record<string, string | number>): string {
  if (!tpl) return ''
  return tpl.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''))
}

export default function KioskTab({ reloadKey = 0, onPurchase }: { reloadKey?: number; onPurchase?: () => void }) {
  const { initData, ready, isTelegram } = useTelegram()
  const [data, setData] = useState<ShopResponse | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const load = useCallback(() => {
    tgFetch('/api/shop', initData)
      .then(r => r.json())
      .then((d: ShopResponse) => setData(d))
      .catch(() => {})
  }, [initData])

  useEffect(() => {
    if (!ready || !isTelegram) return
    load()
  }, [ready, isTelegram, load, reloadKey])

  if (!data) {
    return <div className="text-center text-sm p-10" style={{ color: 'rgba(28,28,30,0.45)' }}>Загрузка…</div>
  }

  const { texts } = data
  const headline = texts['kiosk.headline'] || 'Киоск'
  const subtitle = texts['kiosk.subtitle'] || 'Трать фантики на бонусы клуба'
  const balance = render(texts['kiosk.balance'] || 'У тебя {points} фантиков', { points: data.points })
  const buyLabel = texts['kiosk.buy'] || 'Купить за {price}'
  const soldOut = texts['kiosk.sold_out'] || 'Нет в наличии'

  const buy = async (item: ShopItem) => {
    if (busyKey) return
    if (!item.in_stock) { setToast({ kind: 'err', text: soldOut }); return }
    if (data.points < item.price) {
      const missing = item.price - data.points
      setToast({ kind: 'err', text: render(texts['kiosk.insufficient'] || 'Не хватает {missing} фантиков', { missing }) })
      return
    }
    setBusyKey(item.key)
    try {
      const res = await tgFetch('/api/shop/buy', initData, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ item_key: item.key }),
      })
      const d = await res.json()
      if (!res.ok) {
        const msg =
          d.error === 'insufficient_points' ? render(texts['kiosk.insufficient'] || 'Не хватает {missing} фантиков', { missing: d.missing ?? '?' })
          : d.error === 'out_of_stock' ? soldOut
          : 'Не получилось. Попробуй позже.'
        setToast({ kind: 'err', text: msg })
      } else {
        setToast({ kind: 'ok', text: texts['kiosk.purchase_ok'] || 'Покупка оформлена. Детали придут в личку от бота.' })
        load()
        onPurchase?.()
      }
    } catch {
      setToast({ kind: 'err', text: 'Сеть недоступна' })
    } finally {
      setBusyKey(null)
      setTimeout(() => setToast(null), 3500)
    }
  }

  return (
    <div className="max-w-xl mx-auto px-4 pb-8">
      <div className="text-center mb-4">
        <h1 className="text-3xl sm:text-4xl font-bold mb-1 mt-3" style={{ color: '#1C1C1E', letterSpacing: '-1.2px', lineHeight: 1 }}>
          {headline}
        </h1>
        <p className="text-sm" style={{ color: 'rgba(28,28,30,0.55)' }}>{subtitle}</p>
      </div>

      <div
        className="rounded-2xl px-4 py-3 mb-4 flex items-center justify-between"
        style={{
          background: 'linear-gradient(135deg, #FFE88C 0%, #FFB84C 100%)',
          boxShadow: '0 6px 20px rgba(255,149,0,0.2)',
        }}
      >
        <div className="text-sm font-semibold" style={{ color: '#1C1C1E' }}>🍬 {balance}</div>
      </div>

      {/* 2-column grid */}
      <div className="grid grid-cols-2 gap-3">
        {data.items.map(item => {
          const canAfford = data.points >= item.price
          const disabled = !item.in_stock || busyKey === item.key
          return (
            <div
              key={item.key}
              className="rounded-2xl p-3 flex flex-col"
              style={{
                background: '#FFFFFF',
                border: '1px solid rgba(28,28,30,0.08)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
              }}
            >
              <div
                className="rounded-xl mb-3 flex items-center justify-center overflow-hidden"
                style={{
                  aspectRatio: '1 / 1',
                  background: item.image_url ? '#F5F5F7' : 'linear-gradient(135deg, #F0F6FF 0%, #E8F0FF 100%)',
                  fontSize: 48,
                }}
              >
                {item.image_url
                  ? <img src={item.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span>{item.emoji || '🎁'}</span>}
              </div>
              <div className="flex-1 min-h-0">
                <div className="text-sm font-bold mb-1" style={{ color: '#1C1C1E', letterSpacing: '-0.2px', lineHeight: 1.25 }}>
                  {item.title}
                </div>
                <div className="text-xs mb-3" style={{ color: 'rgba(28,28,30,0.55)', lineHeight: 1.4 }}>
                  {item.description}
                </div>
              </div>
              <button
                onClick={() => buy(item)}
                disabled={disabled}
                style={{
                  width: '100%',
                  padding: '10px 8px',
                  borderRadius: 999,
                  border: 'none',
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: '-0.2px',
                  cursor: disabled ? 'default' : 'pointer',
                  background: !item.in_stock
                    ? 'rgba(28,28,30,0.08)'
                    : canAfford
                      ? '#0A84FF'
                      : 'rgba(10,132,255,0.12)',
                  color: !item.in_stock
                    ? 'rgba(28,28,30,0.45)'
                    : canAfford
                      ? '#FFFFFF'
                      : '#0A84FF',
                  opacity: busyKey === item.key ? 0.6 : 1,
                }}
              >
                {!item.in_stock
                  ? soldOut
                  : busyKey === item.key
                    ? '...'
                    : render(buyLabel, { price: item.price })}
              </button>
            </div>
          )
        })}
      </div>

      {toast && (
        <div
          style={{
            position: 'fixed',
            left: 16, right: 16, bottom: 96,
            padding: '12px 16px',
            borderRadius: 14,
            background: toast.kind === 'ok' ? 'rgba(52,199,89,0.96)' : 'rgba(255,59,48,0.96)',
            color: '#fff',
            fontSize: 14,
            fontWeight: 600,
            textAlign: 'center',
            boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
            zIndex: 40,
          }}
        >
          {toast.text}
        </div>
      )}
    </div>
  )
}
