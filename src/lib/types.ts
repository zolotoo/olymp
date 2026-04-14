export type MemberStatus = 'active' | 'churned'
export type MemberRank = 'newcomer' | 'member' | 'active' | 'champion' | 'legend'

export interface Member {
  id: string
  tg_id: number
  tg_username: string | null
  tg_first_name: string | null
  tg_last_name: string | null
  joined_at: string
  status: MemberStatus
  rank: MemberRank
  points: number
  last_active: string | null
  created_at: string
}

export interface ActivityLog {
  id: string
  member_id: string
  tg_id: number
  chat_id: number
  message_count: number
  week_start: string
  updated_at: string
}

export interface EventsLog {
  id: string
  member_id: string
  tg_id: number
  event_type: string
  triggered_at: string
  metadata: Record<string, unknown> | null
}

export interface PointsLog {
  id: string
  member_id: string
  tg_id: number
  points: number
  reason: string
  created_at: string
}

export interface MemberWithActivity extends Member {
  messages_this_week: number
  total_messages: number
}
