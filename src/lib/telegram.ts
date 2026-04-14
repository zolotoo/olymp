const BASE = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`

async function call(method: string, body: object) {
  const res = await fetch(`${BASE}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}

export async function sendMessage(chatId: number | string, text: string) {
  return call('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML' })
}

export async function sendVideoNote(chatId: number | string, fileId: string) {
  return call('sendVideoNote', { chat_id: chatId, video_note: fileId })
}

export async function setWebhook(url: string) {
  return call('setWebhook', {
    url,
    allowed_updates: ['message', 'chat_member', 'message_reaction'],
    drop_pending_updates: true,
  })
}

export async function deleteWebhook() {
  return call('deleteWebhook', {})
}
