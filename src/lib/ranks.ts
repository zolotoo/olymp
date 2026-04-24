import type { MemberRank } from './types'

// ВАЖНО: этот файл client-safe. Серверные вещи (loadTitles) — в ranks-server.ts.

// Титулы теперь зависят от количества оплаченных месяцев (subscription_count), а не фантиков.
// Первый месяц — Адепт, второй — Герой, третий — Чемпион, четвёртый — Полубог, пятый и далее — Бог.
export const RANK_ORDER: MemberRank[] = ['newcomer', 'member', 'active', 'champion', 'legend']

export const RANK_MONTH: Record<MemberRank, number> = {
  newcomer: 1,
  member: 2,
  active: 3,
  champion: 4,
  legend: 5,
}

// Дефолты (fallback / SSR). Реальные значения читаются из таблицы titles через loadTitles() (ranks-server.ts).
export const RANK_CONFIG: Record<MemberRank, { label: string; emoji: string; color: string; month: number; bonusPoints: number; tagTitle: string; perks: string[] }> = {
  newcomer: { label: 'Адепт',          emoji: '', color: '#8E8E93', month: 1, bonusPoints: 0,  tagTitle: 'Адепт',   perks: [] },
  member:   { label: 'Герой',          emoji: '', color: '#0A84FF', month: 2, bonusPoints: 10, tagTitle: 'Герой',   perks: ['Тег Герой в общем чате', '+10 фантиков', 'Практикум: как сделать монтаж на миллион просмотров с помощью ИИ', 'Участие в розыгрыше консультации с Сергеем'] },
  active:   { label: 'Чемпион Олимпа', emoji: '', color: '#BF5AF2', month: 3, bonusPoints: 20, tagTitle: 'Чемпион', perks: ['Тег Чемпион в общем чате', '+20 фантиков', '1 разбор Инстаграма от Сергея с рекомендациями'] },
  champion: { label: 'Полубог',        emoji: '', color: '#FF9500', month: 4, bonusPoints: 30, tagTitle: 'Полубог', perks: ['Тег Полубог в общем чате', '+30 фантиков', 'Личный практикум для Полубогов — как я дважды заработал больше 10 000 долларов в ИИ'] },
  legend:   { label: 'Бог',            emoji: '', color: '#FF9F0A', month: 5, bonusPoints: 40, tagTitle: 'Бог',     perks: ['Тег Бог в общем чате', '+40 фантиков', '+1 общий созвон в неделю только для Богов'] },
}

export function getRankByMonth(subscriptionCount: number): MemberRank {
  const m = Math.max(1, subscriptionCount || 1)
  if (m >= 5) return 'legend'
  if (m === 4) return 'champion'
  if (m === 3) return 'active'
  if (m === 2) return 'member'
  return 'newcomer'
}

export interface TitleRow {
  rank: MemberRank
  month: number
  label: string
  color: string
  tag_title: string
  bonus_points: number
  perks: string[]
}

export const POINTS = {
  MESSAGE: 0,
  REACTION_GIVEN: 0,     // disabled: фантики за реакцию на чужое сообщение больше не выдаются
  REACTION_RECEIVED: 3,
  POLL_VOTE: 5,
}

export const TRIGGER_CONFIG = {
  INACTIVE_DAYS: 7,
  WEEK_MILESTONES: [1, 2, 4, 8, 12, 24],
}
