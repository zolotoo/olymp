// Типы и дефолты для колеса. Реальный источник сегментов — таблица wheel_prizes.
// Клиенты получают сегменты через GET /api/wheel/segments,
// сервер выбирает победителя через pickWheelPrizeFromDb() в wheel-prizes-server.ts.
//
// ВАЖНО: этот файл client-safe — не импортировать сюда supabase/серверные модули,
// иначе бандлер втащит service role key в клиентский чанк.

export interface Segment {
  key: string
  label: string
  emoji: string
  color: string
  colorDeep: string
  prize: string
  explanation: string
  leaves?: number
  neverDrop?: boolean
  weight?: number
  reward?: boolean
}

export const LEAVES_EXPLANATION_FALLBACK =
  'Фантики, внутренняя валюта AI Олимпа. Идут в зачёт бонусов и обмениваются на награды в Киоске. ' +
  'Титулы повышаются каждый месяц подписки.'

export interface WheelPick {
  key: string
  leaves: number
  reward: boolean
  segmentIndex: number
  prize: string
}
