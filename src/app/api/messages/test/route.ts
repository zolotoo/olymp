import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendMessage, sendVideoNote } from '@/lib/telegram'

// POST /api/messages/test — sends a preview of the message to @sergeyzolotykh
export async function POST(req: NextRequest) {
  const { key, label, content, type, video_url } = await req.json() as {
    key?: string
    label?: string
    content?: string
    type?: string
    video_url?: string
  }

  const adminTgId = process.env.TELEGRAM_ADMIN_TG_ID || process.env.TELEGRAM_ADMIN_CHAT_ID
  if (!adminTgId) return NextResponse.json({ error: 'no admin tg id configured' }, { status: 500 })

  const header =
    `🔍 <b>Проверка сообщения</b>\n` +
    `<i>${label || key || 'без названия'}</i>`

  // Always send the header
  await sendMessage(adminTgId, header)

  // Video node: send kruzhok (if file_id/url present)
  if (type === 'video') {
    if (!video_url) {
      await sendMessage(adminTgId, '⚠️ file_id не указан, видео не отправлено. Открой ноду и вставь file_id.')
      return NextResponse.json({ ok: false, reason: 'no video_url' })
    }
    const vn = await sendVideoNote(adminTgId, video_url)
    if (!vn?.ok) {
      await sendMessage(adminTgId, `❌ Telegram вернул ошибку: ${JSON.stringify(vn)}`)
      return NextResponse.json({ ok: false, reason: 'telegram error', vn })
    }
    if (content) {
      await sendMessage(adminTgId, content)
    }
    await supabaseAdmin.from('messages_log').insert({
      chat_id: Number(adminTgId),
      message_text: `[video_note ${video_url}] ${content || ''}`,
      reason: `test:${key || label || 'unknown'}`,
    })
    return NextResponse.json({ ok: true })
  }

  // Text node
  if (!content) {
    await sendMessage(adminTgId, '⚠️ Текст сообщения пустой.')
    return NextResponse.json({ ok: false, reason: 'no content' })
  }

  const result = await sendMessage(adminTgId, content)

  await supabaseAdmin.from('messages_log').insert({
    chat_id: Number(adminTgId),
    message_text: content,
    reason: `test:${key || label || 'unknown'}`,
  })

  return NextResponse.json({ ok: result?.ok ?? false })
}
