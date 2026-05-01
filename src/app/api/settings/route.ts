import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// Минимальный key/value-стор для глобальных флагов админки.
// Сейчас используется один ключ — followups_enabled.
// Если потом будут другие флаги — кладите сюда же, схема не меняется.

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('bot_settings')
    .select('key, value')
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  const map: Record<string, unknown> = {}
  for (const row of data ?? []) map[row.key] = row.value
  return NextResponse.json(map)
}

export async function PATCH(req: Request) {
  const body = await req.json() as { key?: string; value?: unknown }
  if (!body.key || typeof body.key !== 'string') {
    return NextResponse.json({ error: 'key required' }, { status: 400 })
  }
  const { error } = await supabaseAdmin
    .from('bot_settings')
    .upsert({
      key: body.key,
      value: body.value as object,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
