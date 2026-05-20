// Отправляет draft_message из user_insights в DM юзеру через sendTracked.
// Сначала смотрим, есть ли актуальный draft; если нет — возвращаем 409,
// чтобы UI попросил сгенерировать сначала.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentAdminTgId } from '@/lib/admin-auth'
import { sendTracked } from '@/lib/send-tracked'

// telegram.sendMessage форсит parse_mode=HTML — LLM-сгенерированный draft
// может содержать <, >, & (например «<3» или «Tom & Jerry»), что роняет
// отправку с «can't parse entities». Эскейпим, но оставляем переводы строк.
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ tgId: string }> }) {
  const admin = await getCurrentAdminTgId()
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { tgId: tgIdStr } = await ctx.params
  const tgId = Number(tgIdStr)
  if (!Number.isFinite(tgId)) return NextResponse.json({ error: 'bad_tg_id' }, { status: 400 })

  // Текст можно прислать в теле — на случай, если админ отредактировал в UI.
  // Если не пришёл — берём из user_insights.draft_message.
  let body: { text?: string } = {}
  try { body = await req.json() as { text?: string } } catch { /* пусто */ }

  let text = (body.text || '').trim()
  if (!text) {
    const { data: row } = await supabaseAdmin
      .from('user_insights')
      .select('draft_message')
      .eq('tg_id', tgId)
      .maybeSingle()
    text = (row?.draft_message || '').trim()
  }
  if (!text) {
    return NextResponse.json(
      { error: 'no_draft', message: 'Нет draft_message — сгенерируй инсайт сначала' },
      { status: 409 },
    )
  }

  const res = await sendTracked(tgId, escapeHtml(text), { campaign: 'insight_personal_dm' })
  if (!res?.ok) {
    return NextResponse.json({ error: 'tg_send_failed', tg_error: res?.description ?? null }, { status: 502 })
  }
  return NextResponse.json({ ok: true, message_id: res.result?.message_id ?? null })
}
