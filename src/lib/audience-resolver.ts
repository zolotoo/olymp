import { supabaseAdmin } from './supabase'
import type { AudienceKind, AudienceFilter, ResolvedTarget, SegmentFilter } from './audience-types'

// Re-export для обратной совместимости с server-кодом, который раньше брал
// типы и labels отсюда. Client Components должны импортить из ./audience-types.
export type { AudienceKind, AudienceFilter, ResolvedTarget } from './audience-types'
export { AUDIENCE_LABELS } from './audience-types'

export async function resolveAudience(
  kind: AudienceKind,
  filter?: AudienceFilter | null,
): Promise<ResolvedTarget[]> {
  if (kind === 'segment_v') {
    return resolveSegment(filter?.segment ?? {})
  }
  if (kind === 'custom_tg_ids') {
    const ids = (filter?.tgIds || []).filter((n) => Number.isFinite(n))
    if (ids.length === 0) return []
    const { data } = await supabaseAdmin
      .from('bot_users')
      .select('tg_id, tg_first_name, tg_username')
      .in('tg_id', ids)
    return (data as ResolvedTarget[] | null) ?? []
  }

  if (kind.startsWith('members_')) {
    let q = supabaseAdmin.from('members').select('tg_id, tg_first_name, tg_username, rank, last_active')
    q = kind === 'members_active' ? q.eq('status', 'active') : q.eq('status', 'churned')
    if (filter?.rank) q = q.eq('rank', filter.rank)
    if (filter?.daysSinceSeen) {
      const since = new Date(Date.now() - filter.daysSinceSeen * 86400000).toISOString()
      q = q.gte('last_active', since)
    }
    const { data } = await q
    return (data as ResolvedTarget[] | null) ?? []
  }

  // bot_users_* branches
  let q = supabaseAdmin
    .from('bot_users')
    .select('tg_id, tg_first_name, tg_username, last_seen_at')
  if (kind === 'bot_users_active_30d') {
    const since = new Date(Date.now() - 30 * 86400000).toISOString()
    q = q.gte('last_seen_at', since)
  }
  if (filter?.daysSinceSeen) {
    const since = new Date(Date.now() - filter.daysSinceSeen * 86400000).toISOString()
    q = q.gte('last_seen_at', since)
  }
  const { data: bus } = await q
  let list = (bus as ResolvedTarget[] | null) ?? []

  if (kind === 'bot_users_no_member') {
    const { data: members } = await supabaseAdmin.from('members').select('tg_id')
    const memberIds = new Set((members ?? []).map((m: { tg_id: number }) => m.tg_id))
    list = list.filter((u) => !memberIds.has(u.tg_id))
  }
  return list
}

// Сегмент по user_profile_v. Top_interest проверяем containment по jsonb массиву top_kinds:
// топ-кинд считается «интересом» если входит в top_kinds (мы хранили там топ-3).
async function resolveSegment(seg: SegmentFilter): Promise<ResolvedTarget[]> {
  let q = supabaseAdmin
    .from('user_profile_v')
    .select('tg_id, tg_first_name, tg_username, top_kinds, funnel_stage')

  if (seg.funnelStages && seg.funnelStages.length > 0) {
    q = q.in('funnel_stage', seg.funnelStages)
  }
  if (seg.goal) q = q.eq('goal', seg.goal)
  if (typeof seg.subscriptionActive === 'boolean') q = q.eq('subscription_active', seg.subscriptionActive)
  if (typeof seg.onboardingDone === 'boolean') q = q.eq('onboarding_done', seg.onboardingDone)
  if (typeof seg.minDaysInactive === 'number') q = q.gte('days_since_active', seg.minDaysInactive)
  if (typeof seg.maxDaysInactive === 'number') q = q.lte('days_since_active', seg.maxDaysInactive)
  if (typeof seg.minEngagement === 'number') q = q.gte('engagement_score', seg.minEngagement)
  if (seg.topInterest) {
    // jsonb containment: top_kinds @> '[{"kind":"trends"}]'
    q = q.contains('top_kinds', [{ kind: seg.topInterest }])
  }

  const { data } = await q
  type Row = {
    tg_id: number
    tg_first_name: string | null
    tg_username: string | null
    top_kinds: { kind: string; clicks: number }[] | null
  }
  return ((data as Row[] | null) ?? []).map((r) => ({
    tg_id: r.tg_id,
    tg_first_name: r.tg_first_name,
    tg_username: r.tg_username,
    top_interest: r.top_kinds && r.top_kinds[0] ? r.top_kinds[0].kind : null,
  }))
}
