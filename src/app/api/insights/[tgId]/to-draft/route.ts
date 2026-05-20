// Создаёт broadcasts-черновик с одной целью — этим юзером.
// Аудитория — custom_tg_ids. Так админ сможет открыть draft в /broadcasts/[id],
// поправить текст/кнопки и отправить штатным флоу (с трекингом доставки).

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentAdminTgId } from '@/lib/admin-auth'

export async function POST(req: NextRequest, ctx: { params: Promise<{ tgId: string }> }) {
  const admin = await getCurrentAdminTgId()
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { tgId: tgIdStr } = await ctx.params
  const tgId = Number(tgIdStr)
  if (!Number.isFinite(tgId)) return NextResponse.json({ error: 'bad_tg_id' }, { status: 400 })

  let body: { text?: string; title?: string } = {}
  try { body = await req.json() as { text?: string; title?: string } } catch { /* */ }

  const [{ data: insight }, { data: profile }] = await Promise.all([
    supabaseAdmin.from('user_insights').select('draft_message, engagement_hook').eq('tg_id', tgId).maybeSingle(),
    supabaseAdmin.from('user_profile_v').select('tg_first_name, tg_username').eq('tg_id', tgId).maybeSingle(),
  ])

  const text = (body.text || insight?.draft_message || '').trim()
  if (!text) {
    return NextResponse.json(
      { error: 'no_draft', message: 'Нет draft_message — сгенерируй инсайт сначала' },
      { status: 409 },
    )
  }

  const who = profile?.tg_first_name || profile?.tg_username || `id:${tgId}`
  const title = (body.title || `Персональное · ${who}`).slice(0, 120)

  const { data: created, error } = await supabaseAdmin
    .from('broadcasts')
    .insert({
      title,
      text,
      audience: 'custom_tg_ids',
      audience_filter: { tgIds: [tgId] },
      status: 'draft',
      created_by_tg: admin,
    })
    .select('id')
    .single()
  if (error || !created) return NextResponse.json({ error: error?.message ?? 'db_error' }, { status: 500 })

  return NextResponse.json({ ok: true, broadcast_id: created.id, redirect: `/broadcasts/${created.id}` })
}
