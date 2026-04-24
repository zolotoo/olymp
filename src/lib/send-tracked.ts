import { supabaseAdmin } from './supabase'
import { sendMessage } from './telegram'

export interface TrackedSendOpts {
  campaign?: string                    // 'welcome' | 'sales_pitch' | 'broadcast:<id>' | 'renewal' | 'manual'
  templateKey?: string                 // ключ из bot_messages
  broadcastId?: string                 // FK на broadcasts(id)
}

interface TgSendResult {
  ok: boolean
  result?: { message_id: number; chat: { id: number } }
  description?: string
  error_code?: number
}

/**
 * Wrapper around sendMessage that records delivery into message_deliveries.
 * Used for everything we want to track per-recipient: welcome, pitches,
 * broadcasts, ad-hoc admin messages.
 */
export async function sendTracked(
  tgId: number,
  text: string,
  opts: TrackedSendOpts = {},
): Promise<TgSendResult | null> {
  let result: TgSendResult | null = null
  let errText: string | null = null
  try {
    result = (await sendMessage(tgId, text)) as TgSendResult
    if (!result?.ok) errText = result?.description || 'unknown_error'
  } catch (e: unknown) {
    errText = e instanceof Error ? e.message : String(e)
  }

  try {
    await supabaseAdmin.from('message_deliveries').insert({
      tg_id: tgId,
      chat_id: tgId,
      tg_message_id: result?.ok ? result.result?.message_id ?? null : null,
      campaign: opts.campaign ?? null,
      template_key: opts.templateKey ?? null,
      broadcast_id: opts.broadcastId ?? null,
      text: text.slice(0, 4000),
      delivered: !!result?.ok,
      error_text: errText,
    })
  } catch (e) {
    console.error('sendTracked: failed to log delivery', e)
  }

  return result
}
