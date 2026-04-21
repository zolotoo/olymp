import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// Direct PostgREST HTTP call — bypasses any client-side staleness.
// When PostgREST schema cache is stale we send NOTIFY pgrst and retry once.
const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function pgrstReloadSchema() {
  // Supabase exposes NOTIFY via the REST endpoint pg_notify
  try {
    await fetch(`${SUPA_URL}/rest/v1/rpc/pgrst_reload_schema`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    }).catch(() => null)
  } catch { /* best effort */ }
}

function isSchemaCacheError(err: { message?: string; code?: string } | null): boolean {
  if (!err) return false
  const msg = err.message || ''
  return msg.includes('schema cache') || err.code === 'PGRST205'
}

export async function GET() {
  let { data, error } = await supabaseAdmin
    .from('bot_messages')
    .select('key, label, type, content, video_url, updated_at')

  if (isSchemaCacheError(error)) {
    await pgrstReloadSchema()
    await new Promise(r => setTimeout(r, 400))
    ;({ data, error } = await supabaseAdmin
      .from('bot_messages')
      .select('key, label, type, content, video_url, updated_at'))
  }

  if (error) {
    console.error('bot_messages GET error:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
  const map: Record<string, { label: string; type: string; content: string; video_url?: string }> =
    Object.fromEntries((data || []).map(r => [r.key, r]))
  return Response.json(map)
}

export async function PATCH(req: Request) {
  const body = await req.json() as { key: string; content: string; video_url?: string; label?: string; type?: string }
  const { key, content, video_url, label, type } = body
  if (!key) return Response.json({ error: 'key required' }, { status: 400 })

  const row = {
    key,
    content: content ?? '',
    video_url: video_url ?? null,
    label: label ?? key,
    type: type ?? 'message',
    updated_at: new Date().toISOString(),
  }

  let { data, error } = await supabaseAdmin
    .from('bot_messages')
    .upsert(row, { onConflict: 'key' })
    .select('key, updated_at')
    .single()

  if (isSchemaCacheError(error)) {
    await pgrstReloadSchema()
    await new Promise(r => setTimeout(r, 400))
    ;({ data, error } = await supabaseAdmin
      .from('bot_messages')
      .upsert(row, { onConflict: 'key' })
      .select('key, updated_at')
      .single())
  }

  if (error) {
    console.error('bot_messages PATCH error:', error, 'body:', body)
    return Response.json({ error: error.message }, { status: 500 })
  }
  return Response.json({ ok: true, saved: data })
}
