import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendMessage, sendVideoNote, sendMessageWithKeyboard, buildCallbackKeyboard } from '@/lib/telegram'
import { normalizeButtons } from '@/lib/bot-messages'
import { dmGoalKeyboard } from '@/lib/onboarding'

// Ключи, к которым реальная отправка прикручивает callback-клавиатуру
// dmGoalKeyboard() поверх текста из bot_messages. URL-кнопок при этом нет.
// В превью /flow эти кнопки не сохранены в bot_messages.buttons, поэтому
// тест-отправка должна сама понимать какую клавиатуру прицеплять.
const KEYS_WITH_DM_GOAL_KEYBOARD = new Set(['l_dm_q1', 'onb_dm1_24h'])

// POST /api/messages/test — sends a preview of the message to @sergeyzolotykh
export async function POST(req: NextRequest) {
  const { key, label, content, type, video_url, buttons } = await req.json() as {
    key?: string
    label?: string
    content?: string
    type?: string
    video_url?: string
    buttons?: unknown
  }
  const previewButtons = normalizeButtons(buttons)

  const adminTgId = process.env.TELEGRAM_ADMIN_TG_ID || process.env.TELEGRAM_ADMIN_CHAT_ID
  if (!adminTgId) return NextResponse.json({ error: 'no admin tg id configured' }, { status: 500 })

  // Numeric chat_id for DB. Telegram API itself accepts both number and @username,
  // but messages_log.chat_id is bigint — store null if adminTgId is a @username.
  const chatIdNum = /^-?\d+$/.test(adminTgId) ? Number(adminTgId) : null

  async function log(text: string) {
    const { error } = await supabaseAdmin.from('messages_log').insert({
      chat_id: chatIdNum,
      message_text: text,
      reason: `test:${label || key || 'unknown'}`,
    })
    if (error) console.error('messages_log insert error:', error)
  }

  const header =
    `🔍 <b>Проверка сообщения</b>\n` +
    `<i>${label || key || 'без названия'}</i>`

  await sendMessage(adminTgId, header)

  // Video node: send kruzhok (if file_id present)
  if (type === 'video') {
    if (!video_url) {
      await sendMessage(adminTgId, '⚠️ file_id не указан, видео не отправлено. Открой ноду и вставь file_id.')
      await log(`[video node, no file_id] ${content || ''}`)
      return NextResponse.json({ ok: false, reason: 'no video_url' })
    }
    const vn = await sendVideoNote(adminTgId, video_url)
    if (!vn?.ok) {
      const errText = `❌ Telegram вернул ошибку: ${JSON.stringify(vn)}`
      await sendMessage(adminTgId, errText)
      await log(`[video_note error] ${errText}`)
      return NextResponse.json({ ok: false, reason: 'telegram error', vn })
    }
    if (content) await sendMessage(adminTgId, content, previewButtons)
    await log(`[video_note ${video_url}] ${content || ''}`)
    return NextResponse.json({ ok: true })
  }

  // Text node
  if (!content) {
    await sendMessage(adminTgId, '⚠️ Текст сообщения пустой.')
    await log('[empty content]')
    return NextResponse.json({ ok: false, reason: 'no content' })
  }

  // DM-Q1 / 24h-напоминалка: реальная отправка прикручивает callback-клавиатуру
  // целей программно. Превью повторяет это поведение, чтобы тест-сообщение
  // выглядело идентично тому, что увидит новичок.
  if (key && KEYS_WITH_DM_GOAL_KEYBOARD.has(key)) {
    const result = await sendMessageWithKeyboard(
      adminTgId,
      content,
      buildCallbackKeyboard(dmGoalKeyboard()),
    )
    await log(content)
    return NextResponse.json({ ok: result?.ok ?? false })
  }

  const result = await sendMessage(adminTgId, content, previewButtons)
  await log(content)
  return NextResponse.json({ ok: result?.ok ?? false })
}
