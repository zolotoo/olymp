import type { MemberRank } from './types'

// Вселенная Олимпа — ранги
// Условия включают баллы + минимум месяцев (время пока не учитывается в коде, TODO)
export const RANK_CONFIG: Record<MemberRank, { label: string; emoji: string; minPoints: number; color: string }> = {
  newcomer:  { label: 'Адепт',          emoji: '⚡', minPoints: 0,    color: '#8E8E93' },
  member:    { label: 'Герой',          emoji: '⚔️', minPoints: 500,  color: '#0A84FF' },
  active:    { label: 'Полубог',        emoji: '🌊', minPoints: 1500, color: '#FF9500' },
  champion:  { label: 'Бог Олимпа',    emoji: '🔱', minPoints: 3500, color: '#FF9F0A' },
  legend:    { label: 'Чемпион Олимпа', emoji: '👑', minPoints: 7000, color: '#BF5AF2' },
}

const THRESHOLDS: { min: number; rank: MemberRank }[] = [
  { min: 7000, rank: 'legend' },
  { min: 3500, rank: 'champion' },
  { min: 1500, rank: 'active' },
  { min: 500,  rank: 'member' },
  { min: 0,    rank: 'newcomer' },
]

export function getRank(points: number): MemberRank {
  return THRESHOLDS.find(t => points >= t.min)!.rank
}

export const POINTS = {
  MESSAGE: 1,
  REACTION_GIVEN: 1,
  REACTION_RECEIVED: 3,
  POLL_VOTE: 5,
  WEEKLY_ACTIVE_BONUS: 50,
}

export const TRIGGER_CONFIG = {
  INACTIVE_DAYS: 7,
  ACTIVE_MESSAGES_PER_WEEK: 10,
  WEEK_MILESTONES: [1, 2, 4, 8, 12, 24],
}
