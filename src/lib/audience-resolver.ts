import { supabaseAdmin } from './supabase'
import type { AudienceKind, AudienceFilter, ResolvedTarget } from './audience-types'

// Re-export для обратной совместимости с server-кодом, который раньше брал
// типы и labels отсюда. Client Components должны импортить из ./audience-types.
export type { AudienceKind, AudienceFilter, ResolvedTarget } from './audience-types'
export { AUDIENCE_LABELS } from './audience-types'

export async function resolveAudience(
  kind: AudienceKind,
  filter?: AudienceFilter | null,
): Promise<ResolvedTarget[]> {
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
