// Shared wheel configuration. Imported by both the API route (server)
// and the FortuneWheel component (client).

export interface Segment {
  label: string
  emoji: string
  color: string
  colorDeep: string
  prize: string
  explanation: string
  leaves?: number
  neverDrop?: boolean
  weight?: number
}

export const SEGMENTS: Segment[] = [
  {
    label: '10',
    emoji: '',
    color: '#0A84FF', colorDeep: '#0066CC',
    prize: '10 фантиков',
    leaves: 10,
    weight: 40,
    explanation: 'Фантики, внутренняя валюта AI Олимпа. Идут в зачёт титула и дают бонусы: консультации от Сергея, групповые созвоны, секретные уроки.',
  },
  {
    label: 'Гайд',
    emoji: '📘',
    color: '#BF5AF2', colorDeep: '#8E3BC9',
    prize: 'Закрытый гайд',
    neverDrop: true,
    explanation: 'Закрытый авторский гайд по AI-инструментам: промпты, связки моделей, рабочие процессы, которыми Сергей пользуется сам.',
  },
  {
    label: '20',
    emoji: '',
    color: '#30D158', colorDeep: '#1FA544',
    prize: '20 фантиков',
    leaves: 20,
    weight: 35,
    explanation: 'Фантики, внутренняя валюта AI Олимпа. Идут в зачёт титула и дают бонусы: консультации от Сергея, групповые созвоны, секретные уроки.',
  },
  {
    label: 'Секрет',
    emoji: '🔒',
    color: '#FF375F', colorDeep: '#C82747',
    prize: 'Секретный контент',
    neverDrop: true,
    explanation: 'Доступ к закрытым материалам клуба: уроки, разборы, кейсы, которые не публикуются в общем канале.',
  },
  {
    label: '50',
    emoji: '',
    color: '#FF9500', colorDeep: '#CC7600',
    prize: '50 фантиков',
    leaves: 50,
    weight: 20,
    explanation: 'Фантики, внутренняя валюта AI Олимпа. Большой выигрыш, ты близко к новому титулу!',
  },
  {
    label: 'VeoSee',
    emoji: '🎁',
    color: '#40C8E0', colorDeep: '#2691A3',
    prize: 'Промокод VeoSeeBot',
    neverDrop: true,
    explanation: 'Эксклюзивный промокод от партнёров VeoSeeBot — расширенный доступ к AI-инструментам.',
  },
  {
    label: '15',
    emoji: '',
    color: '#5E5CE6', colorDeep: '#3C3AB8',
    prize: '15 фантиков',
    leaves: 15,
    weight: 5,
    explanation: 'Фантики, внутренняя валюта AI Олимпа. Идут в зачёт титула и дают бонусы: консультации от Сергея, групповые созвоны, секретные уроки.',
  },
  {
    label: 'Скидка',
    emoji: '🎟️',
    color: '#FFD60A', colorDeep: '#CC9A00',
    prize: 'Скидка 50% на месяц',
    neverDrop: true,
    explanation: 'Скидка 50% на продление подписки в AI Олимп — оплачиваешь следующий месяц за полцены.',
  },
]

export const LEAVES_EXPLANATION =
  'Фантики, внутренняя валюта AI Олимпа. Идут в зачёт титула и дают разные бонусы: ' +
  'консультации от Сергея, групповые созвоны, секретные уроки. ' +
  'Зарабатывай их за реакции, голосования и еженедельный бонус. ' +
  'Чем больше фантиков, тем выше титул: Адепт → Герой → Чемпион Олимпа → Полубог → Бог.'

interface EligibleEntry {
  segmentIndex: number
  leaves: number
  weight: number
}

const ELIGIBLE: EligibleEntry[] = SEGMENTS
  .map((s, i) => ({ s, i }))
  .filter(({ s }) => !s.neverDrop && s.weight !== undefined && s.leaves !== undefined)
  .map(({ s, i }) => ({ segmentIndex: i, leaves: s.leaves!, weight: s.weight! }))

const ELIGIBLE_TOTAL = ELIGIBLE.reduce((sum, e) => sum + e.weight, 0)

export function pickWheelPrize(): { segmentIndex: number; leaves: number } {
  let rand = Math.random() * ELIGIBLE_TOTAL
  for (const e of ELIGIBLE) {
    rand -= e.weight
    if (rand <= 0) return { segmentIndex: e.segmentIndex, leaves: e.leaves }
  }
  const fallback = ELIGIBLE[0]
  return { segmentIndex: fallback.segmentIndex, leaves: fallback.leaves }
}
