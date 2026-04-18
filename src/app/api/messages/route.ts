import { supabase } from '@/lib/supabase'

export async function GET() {
  const { data, error } = await supabase
    .from('bot_messages')
    .select('key, label, type, content, video_url, updated_at')
  if (error) return Response.json({ error: error.message }, { status: 500 })
  const map: Record<string, { label: string; type: string; content: string; video_url?: string }> =
    Object.fromEntries((data || []).map(r => [r.key, r]))
  return Response.json(map)
}

export async function PATCH(req: Request) {
  const body = await req.json() as { key: string; content: string; video_url?: string; label?: string; type?: string }
  const { key, content, video_url, label, type } = body
  if (!key) return Response.json({ error: 'key required' }, { status: 400 })

  const { error } = await supabase
    .from('bot_messages')
    .upsert(
      { key, content: content ?? '', video_url: video_url ?? null, label: label ?? key, type: type ?? 'message', updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    )
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
