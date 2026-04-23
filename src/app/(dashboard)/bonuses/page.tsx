import { SEGMENTS } from '@/lib/wheel-prizes'

export const metadata = { title: 'Бонусы — AI Олимп' }

const glass = {
  background: 'rgba(255,255,255,0.66)',
  backdropFilter: 'blur(28px) saturate(160%)',
  WebkitBackdropFilter: 'blur(28px) saturate(160%)',
  border: '1px solid rgba(255,255,255,0.52)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.07)',
} as const

const TRIGGERS = [
  {
    title: 'Через 7 дней после вступления',
    desc: 'Один приветственный спин. Срабатывает автоматически при открытии мини-аппы, если прошла неделя с момента оплаты.',
  },
  {
    title: 'На каждое продление подписки',
    desc: 'Webhook от Tribute о renewed_subscription начисляет +1 попытку и +10 фантиков. Работает со 2-й оплаты и далее.',
  },
  {
    title: 'После отписки — сброс',
    desc: 'При cancelled_subscription все непотраченные попытки обнуляются. Если человек снова подпишется — цикл 7 дней запустится заново, но фантики и история сохранятся.',
  },
]

const EXTRA = [
  { title: 'Фантики за активность', desc: '+1 за реакцию на чужое сообщение, +3 за реакцию на своё, +5 за голос в опросе, +50 за активную неделю.' },
  { title: 'Таблица лидеров', desc: 'Топ-10 по фантикам показывается в дашборде и еженедельно публикуется в канале.' },
  { title: 'Пропуск активности', desc: 'Если участник предупредил о паузе заранее — фантики не сгорают, место в таблице сохраняется.' },
]

export default function BonusesPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="rounded-2xl px-6 py-5 mb-8" style={glass}>
        <div className="text-xs font-semibold mb-2 uppercase" style={{ color: 'rgba(28,28,30,0.45)', letterSpacing: '0.8px' }}>
          Геймификация
        </div>
        <h1 className="text-3xl font-bold mb-1" style={{ color: '#1C1C1E', letterSpacing: '-1px', lineHeight: 1.1 }}>
          Колесо фортуны
        </h1>
        <p className="text-sm" style={{ color: 'rgba(28,28,30,0.55)', letterSpacing: '-0.2px' }}>
          Колесо крутится по попыткам. Попытки копятся: первая — через неделю после вступления, далее — за каждое продление подписки.
        </p>
      </div>

      <div className="rounded-2xl p-5 mb-6" style={glass}>
        <h2 className="text-sm font-semibold mb-3" style={{ color: '#1C1C1E', letterSpacing: '-0.3px' }}>Когда даётся попытка</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          {TRIGGERS.map((t, i) => (
            <div key={i} className="rounded-xl p-3.5" style={{ background: 'rgba(255,255,255,0.50)', border: '1px solid rgba(255,255,255,0.45)' }}>
              <div className="text-sm font-semibold mb-1" style={{ color: '#1C1C1E', letterSpacing: '-0.2px' }}>{t.title}</div>
              <p className="text-sm" style={{ color: 'rgba(28,28,30,0.62)', letterSpacing: '-0.15px', lineHeight: 1.4 }}>{t.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl p-6 mb-5" style={glass}>
        <h2 className="text-base font-bold mb-3" style={{ color: '#1C1C1E', letterSpacing: '-0.4px' }}>
          Что показывает колесо
        </h2>
        <p className="text-sm mb-4" style={{ color: 'rgba(28,28,30,0.60)', letterSpacing: '-0.15px', lineHeight: 1.4 }}>
          В интерфейсе 8 секторов. Выпадают только «фантиковые» — 4 сектора из 8. Остальные показаны для атмосферы и никогда не выпадают.
        </p>
        <div className="grid sm:grid-cols-2 gap-2.5">
          {SEGMENTS.map((s, i) => {
            const drops = !s.neverDrop
            return (
              <div
                key={i}
                className="flex items-center justify-between gap-3 rounded-xl px-4 py-3"
                style={{
                  background: drops ? 'rgba(10,132,255,0.06)' : 'rgba(255,59,48,0.04)',
                  border: `1px solid ${drops ? 'rgba(10,132,255,0.14)' : 'rgba(255,59,48,0.12)'}`,
                }}
              >
                <span
                  className="text-sm font-medium"
                  style={{
                    color: drops ? '#1C1C1E' : 'rgba(28,28,30,0.40)',
                    textDecoration: drops ? 'none' : 'line-through',
                    letterSpacing: '-0.2px',
                  }}
                >
                  {s.prize}
                </span>
                <span
                  className="text-xs font-semibold px-2.5 py-1 rounded-full shrink-0"
                  style={drops
                    ? { background: 'rgba(48,209,88,0.14)', color: '#28A745' }
                    : { background: 'rgba(255,59,48,0.10)', color: '#FF3B30' }}
                >
                  {drops ? `${s.weight}%` : 'визуально'}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="rounded-2xl p-6" style={glass}>
        <h2 className="text-base font-bold mb-4" style={{ color: '#1C1C1E', letterSpacing: '-0.4px' }}>
          Дополнительные механики
        </h2>
        <div className="space-y-3">
          {EXTRA.map(r => (
            <div key={r.title} className="flex gap-3 rounded-xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.50)', border: '1px solid rgba(255,255,255,0.45)' }}>
              <div className="shrink-0 w-1 rounded-full mt-1" style={{ background: '#0A84FF', height: 16 }} />
              <div>
                <div className="text-sm font-semibold mb-0.5" style={{ color: '#1C1C1E', letterSpacing: '-0.25px' }}>{r.title}</div>
                <div className="text-sm" style={{ color: 'rgba(28,28,30,0.58)', letterSpacing: '-0.15px', lineHeight: 1.4 }}>{r.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
