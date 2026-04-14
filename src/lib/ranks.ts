import type { MemberRank } from './types'

export const RANK_CONFIG: Record<MemberRank, { label: string; emoji: string; minPoints: number; color: string }> = {
  newcomer:  { label: 'Новичок',  emoji: '🌱', minPoints: 0,    color: 'text-gray-400' },
  member:    { label: 'Участник', emoji: '⭐', minPoints: 100,  color: 'text-blue-400' },
  active:    { label: 'Активный', emoji: '🔥', minPoints: 500,  color: 'text-orange-400' },
  champion:  { label: 'Чемпион',  emoji: '🏆', minPoints: 1000, color: 'text-yellow-400' },
  legend:    { label: 'Легенда',  emoji: '👑', minPoints: 2500, color: 'text-purple-400' },
}

const THRESHOLDS: { min: number; rank: MemberRank }[] = [
  { min: 2500, rank: 'legend' },
  { min: 1000, rank: 'champion' },
  { min: 500,  rank: 'active' },
  { min: 100,  rank: 'member' },
  { min: 0,    rank: 'newcomer' },
]

export function getRank(points: number): MemberRank {
  return THRESHOLDS.find(t => points >= t.min)!.rank
}

export const POINTS = {
  MESSAGE: 5,
  REACTION_GIVEN: 2,
  REACTION_RECEIVED: 10,
  POLL_VOTE: 3,
  WEEKLY_ACTIVE_BONUS: 50,
}

export const TRIGGER_CONFIG = {
  INACTIVE_DAYS: 7,
  ACTIVE_MESSAGES_PER_WEEK: 10,
  WEEK_MILESTONES: [1, 2, 4, 8, 12, 24],
}
