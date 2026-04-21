export const dynamic = 'force-dynamic'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

function headers() {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
  }
}

async function pgrstReloadSchema() {
  try {
    await fetch(`${SUPA_URL}/rest/v1/rpc/pgrst_reload_schema`, {
      method: 'POST',
      headers: headers(),
      body: '{}',
    })
    await new Promise(r => setTimeout(r, 500))
  } catch { /* best effort */ }
}

export async function GET() {
  const url = `${SUPA_URL}/rest/v1/bot_messages?select=key,label,type,content,video_url,updated_at`

  let res = await fetch(url, { headers: headers(), cache: 'no-store' })
  if (res.status === 404 || (res.status >= 400 && res.status < 500)) {
    const txt = await res.text()
    if (txt.includes('schema cache') || txt.includes('PGRST205')) {
      await pgrstReloadSchema()
      res = await fetch(url, { headers: headers(), cache: 'no-store' })
    } else {
      console.error('bot_messages GET failed:', res.status, txt)
      return Response.json({ error: txt }, { status: 500 })
    }
  }

  if (!res.ok) {
    const txt = await res.text()
    console.error('bot_messages GET failed:', res.status, txt)
    return Response.json({ error: txt }, { status: 500 })
  }

  const data = await res.json() as Array<{ key: string; label: string; type: string; content: string; video_url?: string | null }>
  const map: Record<string, { label: string; type: string; content: string; video_url?: string }> =
    Object.fromEntries(data.map(r => [r.key, r]))
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

  async function upsert() {
    return fetch(`${SUPA_URL}/rest/v1/bot_messages?on_conflict=key`, {
      method: 'POST',
      headers: {
        ...headers(),
        Prefer: 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify(row),
      cache: 'no-store',
    })
  }

  let res = await upsert()
  if (!res.ok) {
    const txt = await res.text()
    if (txt.includes('schema cache') || txt.includes('PGRST205')) {
      await pgrstReloadSchema()
      res = await upsert()
    } else {
      console.error('bot_messages PATCH failed:', res.status, txt, 'body:', body)
      return Response.json({ error: txt }, { status: 500 })
    }
  }

  if (!res.ok) {
    const txt = await res.text()
    console.error('bot_messages PATCH failed after retry:', res.status, txt, 'body:', body)
    return Response.json({ error: txt }, { status: 500 })
  }

  const data = await res.json()
  return Response.json({ ok: true, saved: Array.isArray(data) ? data[0] : data })
}
