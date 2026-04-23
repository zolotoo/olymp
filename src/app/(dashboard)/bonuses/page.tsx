export const metadata = { title: 'Бонусы — AI Олимп' }

const MONTHS = [
  {
    num: 1,
    label: 'Приветственный',
    desc: 'Первый месяц в клубе. Участник только вошёл, знакомство с системой.',
    prizes: [
      { label: '100 фантиков', prob: 'часто', highlight: false, strikethrough: false },
      { label: '200 фантиков', prob: 'часто', highlight: false, strikethrough: false },
      { label: '300 фантиков', prob: 'редко', highlight: false, strikethrough: false },
      { label: 'Закрытый гайд / шаблон', prob: 'часто', highlight: true, strikethrough: false },
      { label: 'Доступ к секретному контенту', prob: 'редко', highlight: true, strikethrough: false },
      { label: 'Скидка 50%', prob: 'никогда', highlight: false, strikethrough: true },
    ],
  },
  {
    num: 2,
    label: 'Социальный',
    desc: 'Второй месяц. Участник знает правила, самое время включить в жизнь сообщества.',
    prizes: [
      { label: '100 фантиков', prob: 'часто', highlight: false, strikethrough: false },
      { label: '200 фантиков', prob: 'часто', highlight: false, strikethrough: false },
      { label: '300 фантиков', prob: 'редко', highlight: false, strikethrough: false },
      { label: 'Место в групповом эфире', prob: 'часто', highlight: true, strikethrough: false },
      { label: 'Упоминание / репост в stories Сергея', prob: 'редко', highlight: true, strikethrough: false },
      { label: '1 вакансия на биржу Сергея', prob: 'редко', highlight: true, strikethrough: false },
      { label: 'Скидка 30%', prob: 'никогда', highlight: false, strikethrough: true },
    ],
  },
  {
    num: 3,
    label: 'Личный',
    desc: 'Третий месяц. Участник доказал вовлечённость, приз личного внимания Сергея.',
    prizes: [
      { label: '200 фантиков', prob: 'часто', highlight: false, strikethrough: false },
      { label: '300 фантиков', prob: 'часто', highlight: false, strikethrough: false },
      { label: '500 фантиков', prob: 'редко', highlight: false, strikethrough: false },
      { label: 'Консультация с Сергеем 15–20 мин', prob: 'редко', highlight: true, strikethrough: false },
      { label: 'Совместный пост в Instagram', prob: 'редко', highlight: true, strikethrough: false },
      { label: 'Скидка 50%', prob: 'никогда', highlight: false, strikethrough: true },
    ],
  },
]

const PROB_STYLE: Record<string, { bg: string; color: string }> = {
  часто:    { bg: 'rgba(48,209,88,0.12)',   color: '#28A745' },
  редко:    { bg: 'rgba(10,132,255,0.10)',  color: '#0A84FF' },
  никогда:  { bg: 'rgba(255,59,48,0.10)',   color: '#FF3B30' },
}

const glass = {
  background: 'rgba(255,255,255,0.66)',
  backdropFilter: 'blur(28px) saturate(160%)',
  WebkitBackdropFilter: 'blur(28px) saturate(160%)',
  border: '1px solid rgba(255,255,255,0.52)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.07)',
} as const

export default function BonusesPage() {
  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="rounded-2xl px-6 py-5 mb-8" style={glass}>
        <div className="text-xs font-semibold mb-2 uppercase" style={{ color: 'rgba(28,28,30,0.45)', letterSpacing: '0.8px' }}>
          Геймификация
        </div>
        <h1 className="text-3xl font-bold mb-1" style={{ color: '#1C1C1E', letterSpacing: '-1px', lineHeight: 1.1 }}>
          Колесо фортуны
        </h1>
        <p className="text-sm" style={{ color: 'rgba(28,28,30,0.55)', letterSpacing: '-0.2px' }}>
          Каждый месяц участник получает один случайный приз из колеса
        </p>
      </div>

      {/* How it works */}
      <div className="rounded-2xl p-5 mb-6" style={glass}>
        <h2 className="text-sm font-semibold mb-3" style={{ color: '#1C1C1E', letterSpacing: '-0.3px' }}>Как работает</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          {[
            { step: '1', text: 'Каждый месяц бот отправляет участнику кнопку «Крутить колесо»' },
            { step: '2', text: 'Система выбирает случайный приз из пула текущего месяца' },
            { step: '3', text: 'Участник получает приз в DM. Фантики зачисляются автоматически' },
          ].map(s => (
            <div key={s.step} className="flex gap-3 rounded-xl p-3.5" style={{ background: 'rgba(255,255,255,0.50)', border: '1px solid rgba(255,255,255,0.45)' }}>
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                style={{ background: 'rgba(10,132,255,0.12)', color: '#0A84FF' }}
              >
                {s.step}
              </div>
              <p className="text-sm" style={{ color: 'rgba(28,28,30,0.65)', letterSpacing: '-0.15px', lineHeight: 1.4 }}>
                {s.text}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Month cards */}
      <div className="space-y-5">
        {MONTHS.map(month => (
          <div key={month.num} className="rounded-2xl p-6" style={glass}>
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <div className="flex items-baseline gap-2.5 mb-1">
                  <span
                    className="text-xs font-bold uppercase"
                    style={{ color: 'rgba(28,28,30,0.40)', letterSpacing: '0.7px' }}
                  >
                    Месяц {month.num}
                  </span>
                  <h2 className="text-lg font-bold" style={{ color: '#1C1C1E', letterSpacing: '-0.5px' }}>
                    {month.label}
                  </h2>
                </div>
                <p className="text-sm" style={{ color: 'rgba(28,28,30,0.55)', letterSpacing: '-0.15px', lineHeight: 1.4 }}>
                  {month.desc}
                </p>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-2.5">
              {month.prizes.map((prize, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-3 rounded-xl px-4 py-3"
                  style={{
                    background: prize.strikethrough
                      ? 'rgba(255,59,48,0.04)'
                      : prize.highlight
                        ? 'rgba(10,132,255,0.06)'
                        : 'rgba(255,255,255,0.52)',
                    border: `1px solid ${prize.strikethrough ? 'rgba(255,59,48,0.12)' : 'rgba(255,255,255,0.45)'}`,
                  }}
                >
                  <span
                    className="text-sm font-medium"
                    style={{
                      color: prize.strikethrough ? 'rgba(28,28,30,0.35)' : '#1C1C1E',
                      textDecoration: prize.strikethrough ? 'line-through' : 'none',
                      letterSpacing: '-0.2px',
                    }}
                  >
                    {prize.label}
                  </span>
                  <span
                    className="text-xs font-semibold px-2.5 py-1 rounded-full shrink-0"
                    style={{ background: PROB_STYLE[prize.prob].bg, color: PROB_STYLE[prize.prob].color }}
                  >
                    {prize.prob}
                  </span>
                </div>
              ))}
            </div>

            {month.prizes.some(p => p.strikethrough) && (
              <p className="text-xs mt-3" style={{ color: 'rgba(28,28,30,0.40)', letterSpacing: '-0.1px' }}>
                Зачёркнутые призы присутствуют в интерфейсе колеса, но никогда не выпадают.
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Internal probabilities (для нас, не для пользователя) */}
      <div className="rounded-2xl p-6 mt-5" style={{ ...glass, background: 'rgba(255,249,230,0.70)' }}>
        <div className="text-xs font-semibold mb-2 uppercase" style={{ color: '#B8860B', letterSpacing: '0.8px' }}>
          Внутренние вероятности · только для нас
        </div>
        <h2 className="text-base font-bold mb-3" style={{ color: '#1C1C1E', letterSpacing: '-0.4px' }}>
          Реальные шансы колеса (месяц 1)
        </h2>
        <p className="text-sm mb-4" style={{ color: 'rgba(28,28,30,0.60)', letterSpacing: '-0.15px', lineHeight: 1.4 }}>
          В интерфейсе колеса пользователь видит 8 секторов. Алгоритм выбирает приз только из 4 «фантиковых» секторов, остальные 4 визуальные, они никогда не выпадают.
        </p>
        <div className="space-y-2">
          {[
            { label: '10 фантиков', pct: '40%' },
            { label: '20 фантиков', pct: '35%' },
            { label: '50 фантиков', pct: '20%' },
            { label: '15 фантиков', pct: '5%' },
            { label: 'Гайд / Секрет / VeoSeeBot / Скидка', pct: '0% (визуально)' },
          ].map(r => (
            <div
              key={r.label}
              className="flex items-center justify-between rounded-xl px-4 py-2.5"
              style={{ background: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.50)' }}
            >
              <span className="text-sm font-medium" style={{ color: '#1C1C1E', letterSpacing: '-0.2px' }}>{r.label}</span>
              <span className="text-sm font-bold" style={{ color: '#B8860B', letterSpacing: '-0.2px' }}>{r.pct}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Extra rules */}
      <div className="rounded-2xl p-6 mt-5" style={glass}>
        <h2 className="text-base font-bold mb-4" style={{ color: '#1C1C1E', letterSpacing: '-0.4px' }}>
          Дополнительные механики
        </h2>
        <div className="space-y-3">
          {[
            { title: 'Блокировка на 6 месяцев', desc: 'При отписке нельзя вернуться раньше 6 месяцев. Проверяется по дате subscription_started_at.' },
            { title: 'Пропуск активности', desc: 'Участник предупредил о паузе заранее — фантики не сгорают, место в таблице сохраняется.' },
            { title: 'Таблица лидеров', desc: 'Топ-10 участников по фантикам. Показывается в дашборде. Еженедельно публикуется в канале.' },
          ].map(r => (
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
