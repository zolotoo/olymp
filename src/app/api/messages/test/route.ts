import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendMessage } from '@/lib/telegram'

// POST /api/messages/test — sends a preview of the message to @sergeyzolotykh
export async function POST(req: NextRequest) {
  const { key, label, content } = await req.json()
  if (!content) return NextResponse.json({ error: 'no content' }, { status: 400 })

  const adminTgId = process.env.TELEGRAM_ADMIN_TG_ID || process.env.TELEGRAM_ADMIN_CHAT_ID
  if (!adminTgId) return NextResponse.json({ error: 'no admin tg id configured' }, { status: 500 })

  const preview =
    `🔍 <b>Проверка сообщения</b>\n` +
    `<i>${label || key || 'без названия'}</i>\n\n` +
    `${content}`

  const result = await sendMessage(adminTgId, preview)

  // Log to messages_log
  await supabaseAdmin.from('messages_log').insert({
    chat_id: Number(adminTgId),
    message_text: content,
    reason: `test:${key || label || 'unknown'}`,
  })

  return NextResponse.json({ ok: result?.ok ?? false })
}
