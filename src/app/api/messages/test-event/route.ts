import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendMessage, sendVideoNote } from '@/lib/telegram'
import { normalizeButtons } from '@/lib/bot-messages'

// POST /api/messages/test-event — fires all child messages of an event/condition
// node sequentially (text + video circles in tree order) to the admin user.
export async function POST(req: NextRequest) {
  const { label, items } = await req.json() as {
    label?: string
    items?: Array<{ type: 'message' | 'video'; label?: string; content?: string; video_url?: string | null; buttons?: unknown }>
  }

  const adminTgId = process.env.TELEGRAM_ADMIN_TG_ID || process.env.TELEGRAM_ADMIN_CHAT_ID
  if (!adminTgId) return NextResponse.json({ error: 'no admin tg id configured' }, { status: 500 })
  if (!items?.length) return NextResponse.json({ error: 'no items' }, { status: 400 })

  const chatIdNum = /^-?\d+$/.test(adminTgId) ? Number(adminTgId) : null
  async function log(text: string) {
    await supabaseAdmin.from('messages_log').insert({
      chat_id: chatIdNum,
      message_text: text,
      reason: `test-event:${label || 'unknown'}`,
    })
  }

  await sendMessage(adminTgId, `🔍 <b>Тест события</b>\n<i>${label || 'без названия'}</i>`)

  const results: Array<{ label?: string; ok: boolean; reason?: string }> = []
  for (const it of items) {
    if (it.type === 'video') {
      if (!it.video_url) {
        await sendMessage(adminTgId, `⚠️ ${it.label || 'видео'}: file_id не указан`)
        results.push({ label: it.label, ok: false, reason: 'no video_url' })
        continue
      }
      const vn = await sendVideoNote(adminTgId, it.video_url)
      if (!vn?.ok) {
        await sendMessage(adminTgId, `❌ ${it.label || 'видео'}: ${JSON.stringify(vn)}`)
        results.push({ label: it.label, ok: false, reason: 'telegram error' })
      } else {
        // Если у видео есть кнопки — отправим их подписью отдельным сообщением.
        const btns = normalizeButtons(it.buttons)
        if (btns?.length || it.content) {
          await sendMessage(adminTgId, it.content || ' ', btns)
        }
        results.push({ label: it.label, ok: true })
      }
      await log(`[video_note ${it.video_url}] ${it.content || ''}`)
    } else if (it.type === 'message') {
      if (!it.content) {
        results.push({ label: it.label, ok: false, reason: 'no content' })
        continue
      }
      const r = await sendMessage(adminTgId, it.content, normalizeButtons(it.buttons))
      await log(it.content)
      results.push({ label: it.label, ok: !!r?.ok })
    }
    await new Promise(r => setTimeout(r, 1200))
  }

  return NextResponse.json({ ok: results.every(r => r.ok), results })
}
