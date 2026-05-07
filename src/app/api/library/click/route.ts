import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthedUser } from '@/lib/telegram-auth'

// POST /api/library/click
// body: { chat_id, message_id, kind }
//
// Fire-and-forget трекер кликов «Открыть в Telegram» из мини-аппа.
// Используется на странице /stats/library и для авто-предложения «поднять
// в Featured» (kandidata cron — будущая фаза).
//
// Не блокируем UX: если запись не сохранилась — это не должно мешать
// открытию TG. Поэтому ошибки только логируются, ответ всегда 200.

export async function POST(req: NextRequest) {
  const initData = req.headers.get('x-telegram-init-data')
  const user = getAuthedUser(initData)
  // member_tg_id — опциональный, если кто-то всё-таки дёрнул без initData,
  // запишем без автора (анонимный клик).
  const memberTg = user?.id ?? null

  const body = (await req.json().catch(() => ({}))) as {
    chat_id?: number
    message_id?: number
    kind?: string
  }
  const chat_id = Number(body.chat_id)
  const message_id = Number(body.message_id)
  const kind = body.kind?.toString() ?? null
  if (!Number.isFinite(chat_id) || !Number.isFinite(message_id)) {
    return NextResponse.json({ ok: false }, { status: 200 })
  }

  try {
    await supabaseAdmin.from('library_events').insert({
      event_type: 'click',
      chat_id,
      message_id,
      kind,
      member_tg_id: memberTg,
    })
  } catch (e) {
    console.error('library_events insert failed:', e)
  }
  return NextResponse.json({ ok: true })
}
