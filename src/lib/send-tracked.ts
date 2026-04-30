import { supabaseAdmin } from './supabase'
import { sendMessage, type InlineUrlButton } from './telegram'
import { wrapLink } from './click-tokens'

export interface TrackedSendOpts {
  campaign?: string                    // 'welcome' | 'sales_pitch' | 'broadcast:<id>' | 'renewal' | 'manual'
  templateKey?: string                 // ключ из bot_messages
  broadcastId?: string                 // FK на broadcasts(id)
  buttons?: InlineUrlButton[] | null   // inline-кнопки; URL автоматически оборачиваются click_tokens
}

interface TgSendResult {
  ok: boolean
  result?: { message_id: number; chat: { id: number } }
  description?: string
  error_code?: number
}

function publicHost(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://aiolymp.vercel.app').replace(/\/$/, '')
}

// Оборачивает URL каждой inline-кнопки в click_tokens, чтобы каждый клик
// логировался в bot_events (event_type='link_click') и попадал в
// message_deliveries.engagement_kind='click'. Это позволяет видеть, кто
// нажал «Оплатить» (или другую CTA), но не дошёл до целевого действия.
async function trackButtons(
  buttons: InlineUrlButton[] | null | undefined,
  tgId: number,
  campaign: string | undefined,
  templateKey: string | undefined,
): Promise<InlineUrlButton[] | null> {
  if (!buttons?.length) return null
  const host = publicHost()
  const baseCampaign = campaign || (templateKey ? `tpl:${templateKey}` : 'button')
  const tracked: InlineUrlButton[] = []
  for (const b of buttons) {
    if (!b?.label || !b?.url) continue
    try {
      const url = await wrapLink({
        targetUrl: b.url,
        campaign: `${baseCampaign}:btn:${b.label}`.slice(0, 120),
        tgId,
        host,
      })
      tracked.push({ label: b.label, url })
    } catch (e) {
      console.error('sendTracked: wrapLink failed for button', b.label, e)
      // Фолбэк — кнопка всё ещё работает, просто без трекинга.
      tracked.push({ label: b.label, url: b.url })
    }
  }
  return tracked.length ? tracked : null
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
  const buttons = await trackButtons(opts.buttons, tgId, opts.campaign, opts.templateKey)
  try {
    result = (await sendMessage(tgId, text, buttons)) as TgSendResult
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
