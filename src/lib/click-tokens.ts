import { randomBytes } from 'crypto'
import { supabaseAdmin } from './supabase'

export interface WrapLinkOpts {
  targetUrl: string
  campaign?: string
  tgId?: number
  host: string         // 'https://example.com' (no trailing slash)
}

/**
 * Generates a short token, persists (token → target_url, campaign, tg_id),
 * returns a redirect URL of the form `${host}/api/r/${token}`.
 *
 * Use it for any CTA link in outgoing bot messages so we can attribute
 * clicks to a specific user / campaign.
 */
export async function wrapLink(opts: WrapLinkOpts): Promise<string> {
  const token = randomBytes(8).toString('base64url')   // ~11 chars
  await supabaseAdmin.from('click_tokens').insert({
    token,
    target_url: opts.targetUrl,
    campaign: opts.campaign ?? null,
    tg_id: opts.tgId ?? null,
  })
  return `${opts.host.replace(/\/$/, '')}/api/r/${token}`
}
