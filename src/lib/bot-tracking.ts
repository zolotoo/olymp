import { supabaseAdmin } from './supabase'

interface TgUserLike {
  id: number
  username?: string
  first_name?: string
  last_name?: string
  language_code?: string
  is_bot?: boolean
}

interface TrackOpts {
  user: TgUserLike
  eventType: string
  chatId?: number
  payload?: Record<string, unknown>
}

/**
 * Upsert into `bot_users` and insert a row into `bot_events`.
 * Safe to call on every incoming update — failures are swallowed so
 * they never break the main webhook flow.
 */
export async function trackBotInteraction({ user, eventType, chatId, payload }: TrackOpts): Promise<void> {
  if (!user?.id || user.is_bot) return
  const now = new Date().toISOString()

  try {
    // Upsert user profile + bump counters.
    // We can't use supabase's upsert with an expression for events_count,
    // so we do a two-step: try update, if no row then insert.
    const { data: existing } = await supabaseAdmin
      .from('bot_users')
      .select('tg_id, events_count')
      .eq('tg_id', user.id)
      .maybeSingle()

    if (existing) {
      await supabaseAdmin
        .from('bot_users')
        .update({
          tg_username: user.username ?? null,
          tg_first_name: user.first_name ?? null,
          tg_last_name: user.last_name ?? null,
          language_code: user.language_code ?? null,
          last_seen_at: now,
          last_event_type: eventType,
          events_count: (existing.events_count ?? 0) + 1,
        })
        .eq('tg_id', user.id)
    } else {
      await supabaseAdmin.from('bot_users').insert({
        tg_id: user.id,
        tg_username: user.username ?? null,
        tg_first_name: user.first_name ?? null,
        tg_last_name: user.last_name ?? null,
        language_code: user.language_code ?? null,
        first_seen_at: now,
        last_seen_at: now,
        last_event_type: eventType,
        events_count: 1,
      })
    }

    await supabaseAdmin.from('bot_events').insert({
      tg_id: user.id,
      event_type: eventType,
      chat_id: chatId ?? null,
      payload: payload ?? null,
    })
  } catch (e) {
    console.error('trackBotInteraction failed:', e)
  }
}

/**
 * Update the cached channel-member flag for a user.
 * Call this after doing a getChatMember check elsewhere in the flow.
 */
export async function setBotUserChannelMember(tgId: number, isMember: boolean): Promise<void> {
  try {
    await supabaseAdmin
      .from('bot_users')
      .update({
        is_channel_member: isMember,
        channel_member_checked_at: new Date().toISOString(),
      })
      .eq('tg_id', tgId)
  } catch (e) {
    console.error('setBotUserChannelMember failed:', e)
  }
}
