import { supabaseAdmin } from './supabase'
import { getMemories } from './mem0'

export type Member = {
  id: string
  tg_id: number
  tg_username: string | null
  tg_first_name: string | null
  tg_last_name: string | null
  joined_at: string
  status: string
  rank: string
  points: number
  last_active: string | null
}

export type BotUser = {
  tg_id: number
  tg_username: string | null
  tg_first_name: string | null
  tg_last_name: string | null
  language_code: string | null
  is_channel_member: boolean | null
  first_seen_at: string
  last_seen_at: string
  last_event_type: string | null
  events_count: number
}

export type BotEvent = {
  id: string
  tg_id: number
  event_type: string
  chat_id: number | null
  payload: Record<string, unknown> | null
  created_at: string
}

export type TgMessageRow = {
  message_id: number
  chat_id: number
  author_tg_id: number
  text: string | null
  chat_type: string | null
  chat_title: string | null
  reply_to_message_id: number | null
  has_media: boolean
  media_kind: string | null
  sent_at: string
  edited_at: string | null
}

export type ReactionRow = {
  id: string
  message_id: number
  chat_id: number
  reactor_tg_id: number
  author_tg_id: number | null
  emoji: string | null
  emoji_type: string | null
  action: string
  created_at: string
}

export type DeliveryRow = {
  id: string
  tg_id: number
  chat_id: number | null
  campaign: string | null
  template_key: string | null
  text: string | null
  has_media: boolean
  delivered: boolean
  error_text: string | null
  sent_at: string
  engaged_at: string | null
  engagement_kind: string | null
}

export type EventLogRow = {
  id: string
  event_type: string
  triggered_at: string
  metadata: Record<string, unknown> | null
}

export type PointsLogRow = {
  id: string
  points: number
  reason: string
  created_at: string
}

export type ActivityRow = {
  id: string
  message_count: number
  week_start: string
}

export type ProfileData = {
  tgId: number
  member: Member | null
  botUser: BotUser | null
  botEvents: BotEvent[]
  incomingMessages: TgMessageRow[]
  outgoingDeliveries: DeliveryRow[]
  reactionsGiven: ReactionRow[]
  reactionsReceived: ReactionRow[]
  memories: { results?: Array<{ id: string; memory: string; created_at?: string }> } | null
  eventsLog: EventLogRow[]
  pointsLog: PointsLogRow[]
  activity: ActivityRow[]
  totalMessages: number
}

// Load every piece of data we have for a tg_id.
// Used by both members/[id] and audience/[tg_id] pages so the UI can show
// the same unified card — plus membership-specific blocks when member is set.
export async function loadProfile(tgIdOrMemberUuid: string | number): Promise<ProfileData | null> {
  let tgId: number | null = null
  let member: Member | null = null

  if (typeof tgIdOrMemberUuid === 'number' || /^\d+$/.test(String(tgIdOrMemberUuid))) {
    tgId = Number(tgIdOrMemberUuid)
  }

  if (tgId === null) {
    // It's a UUID — load by members.id then extract tg_id
    const { data } = await supabaseAdmin
      .from('members')
      .select('*')
      .eq('id', String(tgIdOrMemberUuid))
      .maybeSingle()
    if (!data) return null
    member = data as Member
    tgId = member.tg_id
  } else {
    const { data } = await supabaseAdmin
      .from('members')
      .select('*')
      .eq('tg_id', tgId)
      .maybeSingle()
    if (data) member = data as Member
  }

  if (tgId === null) return null

  const [
    { data: botUser },
    { data: botEvents },
    { data: incomingMessages },
    { data: outgoingDeliveries },
    { data: reactionsGiven },
    { data: reactionsReceived },
    eventsLogRes,
    pointsLogRes,
    activityRes,
    allActivityRes,
  ] = await Promise.all([
    supabaseAdmin.from('bot_users').select('*').eq('tg_id', tgId).maybeSingle(),
    supabaseAdmin
      .from('bot_events')
      .select('*')
      .eq('tg_id', tgId)
      .order('created_at', { ascending: false })
      .limit(200),
    supabaseAdmin
      .from('tg_messages')
      .select('*')
      .eq('author_tg_id', tgId)
      .order('sent_at', { ascending: false })
      .limit(200),
    supabaseAdmin
      .from('message_deliveries')
      .select('*')
      .eq('tg_id', tgId)
      .order('sent_at', { ascending: false })
      .limit(200),
    supabaseAdmin
      .from('reactions_log')
      .select('*')
      .eq('reactor_tg_id', tgId)
      .order('created_at', { ascending: false })
      .limit(100),
    supabaseAdmin
      .from('reactions_log')
      .select('*')
      .eq('author_tg_id', tgId)
      .order('created_at', { ascending: false })
      .limit(100),
    member
      ? supabaseAdmin
          .from('events_log')
          .select('id, event_type, triggered_at, metadata')
          .eq('member_id', member.id)
          .order('triggered_at', { ascending: false })
          .limit(50)
      : Promise.resolve({ data: [] as EventLogRow[] }),
    member
      ? supabaseAdmin
          .from('points_log')
          .select('id, points, reason, created_at')
          .eq('member_id', member.id)
          .order('created_at', { ascending: false })
          .limit(50)
      : Promise.resolve({ data: [] as PointsLogRow[] }),
    member
      ? supabaseAdmin
          .from('activity_log')
          .select('id, message_count, week_start')
          .eq('member_id', member.id)
          .order('week_start', { ascending: false })
          .limit(12)
      : Promise.resolve({ data: [] as ActivityRow[] }),
    member
      ? supabaseAdmin.from('activity_log').select('message_count').eq('member_id', member.id)
      : Promise.resolve({ data: [] as { message_count: number }[] }),
  ])

  const memories = await getMemories(String(tgId)).catch(() => null)
  const totalMessages = ((allActivityRes.data as { message_count: number }[] | null) || [])
    .reduce((s, r) => s + (r.message_count || 0), 0)

  return {
    tgId,
    member,
    botUser: (botUser as BotUser | null) ?? null,
    botEvents: (botEvents as BotEvent[] | null) ?? [],
    incomingMessages: (incomingMessages as TgMessageRow[] | null) ?? [],
    outgoingDeliveries: (outgoingDeliveries as DeliveryRow[] | null) ?? [],
    reactionsGiven: (reactionsGiven as ReactionRow[] | null) ?? [],
    reactionsReceived: (reactionsReceived as ReactionRow[] | null) ?? [],
    memories,
    eventsLog: (eventsLogRes.data as EventLogRow[] | null) ?? [],
    pointsLog: (pointsLogRes.data as PointsLogRow[] | null) ?? [],
    activity: (activityRes.data as ActivityRow[] | null) ?? [],
    totalMessages,
  }
}
