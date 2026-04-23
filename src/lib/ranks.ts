import type { MemberRank } from './types'

// Вселенная Олимпа — титулы
export const RANK_CONFIG: Record<MemberRank, { label: string; emoji: string; minPoints: number; color: string }> = {
  newcomer:  { label: 'Адепт',          emoji: '', minPoints: 0,   color: '#8E8E93' },
  member:    { label: 'Герой',          emoji: '', minPoints: 50,  color: '#0A84FF' },
  active:    { label: 'Чемпион Олимпа', emoji: '', minPoints: 100, color: '#BF5AF2' },
  champion:  { label: 'Полубог',        emoji: '', minPoints: 150, color: '#FF9500' },
  legend:    { label: 'Бог',            emoji: '', minPoints: 200, color: '#FF9F0A' },
}

const THRESHOLDS: { min: number; rank: MemberRank }[] = [
  { min: 200, rank: 'legend' },
  { min: 150, rank: 'champion' },
  { min: 100, rank: 'active' },
  { min: 50,  rank: 'member' },
  { min: 0,   rank: 'newcomer' },
]

export function getRank(points: number): MemberRank {
  return THRESHOLDS.find(t => points >= t.min)!.rank
}

export const POINTS = {
  MESSAGE: 0,  // фантики за сообщения отключены
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
