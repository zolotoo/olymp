const BASE = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`

async function call(method: string, body: object) {
  const res = await fetch(`${BASE}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}

export interface InlineUrlButton {
  label: string
  url: string
}

function buildInlineKeyboard(buttons?: InlineUrlButton[] | null) {
  if (!buttons?.length) return undefined
  // Каждая кнопка на своей строке — Telegram сам сожмёт по ширине, и так читается лучше.
  return { inline_keyboard: buttons.map(b => [{ text: b.label, url: b.url }]) }
}

export async function sendMessage(
  chatId: number | string,
  text: string,
  buttons?: InlineUrlButton[] | null,
) {
  const payload: Record<string, unknown> = { chat_id: chatId, text, parse_mode: 'HTML' }
  const reply_markup = buildInlineKeyboard(buttons)
  if (reply_markup) payload.reply_markup = reply_markup
  return call('sendMessage', payload)
}

export async function sendVideoNote(chatId: number | string, fileId: string) {
  return call('sendVideoNote', { chat_id: chatId, video_note: fileId.trim() })
}

export async function setWebhook(url: string) {
  return call('setWebhook', {
    url,
    allowed_updates: [
      'message',
      'edited_message',
      'channel_post',
      'edited_channel_post',
      'chat_member',
      'chat_join_request',
      'message_reaction',
      'poll_answer',
      'callback_query',
    ],
    drop_pending_updates: true,
  })
}

export async function deleteWebhook() {
  return call('deleteWebhook', {})
}

export async function getChatMember(chatId: string | number, userId: number) {
  return call('getChatMember', { chat_id: chatId, user_id: userId })
}

export async function approveChatJoinRequest(chatId: string | number, userId: number) {
  return call('approveChatJoinRequest', { chat_id: chatId, user_id: userId })
}

export async function declineChatJoinRequest(chatId: string | number, userId: number) {
  return call('declineChatJoinRequest', { chat_id: chatId, user_id: userId })
}

// Promote to admin with minimal rights — only to allow setting a custom title (rank badge).
// Telegram requires at least ONE permission to be true, otherwise the call demotes the user.
// can_invite_users is the least intrusive permission that still makes them an admin.
export async function promoteChatMember(chatId: string | number, userId: number) {
  return call('promoteChatMember', {
    chat_id: chatId,
    user_id: userId,
    is_anonymous: false,
    can_manage_chat: false,
    can_delete_messages: false,
    can_manage_video_chats: false,
    can_restrict_members: false,
    can_promote_members: false,
    can_change_info: false,
    can_invite_users: true,
    can_post_messages: false,
    can_edit_messages: false,
    can_pin_messages: false,
  })
}

export async function setChatAdministratorCustomTitle(chatId: string | number, userId: number, customTitle: string) {
  return call('setChatAdministratorCustomTitle', {
    chat_id: chatId,
    user_id: userId,
    custom_title: customTitle,
  })
}

export async function addChatMember(chatId: string | number, userId: number) {
  return call('addChatMember', { chat_id: chatId, user_id: userId })
}

export async function deleteMessage(chatId: string | number, messageId: number) {
  return call('deleteMessage', { chat_id: chatId, message_id: messageId })
}

// Set the default menu button for all users who haven't been individually configured.
// type 'default' → standard commands menu (see setMyCommands).
export async function setDefaultMenuButtonToCommands() {
  return call('setChatMenuButton', { menu_button: { type: 'default' } })
}

// Enable the Mini App button ONLY for a specific user (private chat context).
// Use after approving a join request or when a user becomes a club member.
export async function setUserWebAppMenuButton(chatId: number, webAppUrl: string, text = 'AI Олимп') {
  return call('setChatMenuButton', {
    chat_id: chatId,
    menu_button: { type: 'web_app', text, web_app: { url: webAppUrl } },
  })
}

// Reset a specific user back to the default menu — call when user leaves the club.
export async function resetUserMenuButton(chatId: number) {
  return call('setChatMenuButton', {
    chat_id: chatId,
    menu_button: { type: 'default' },
  })
}

export async function setMyCommands(commands: { command: string; description: string }[]) {
  return call('setMyCommands', { commands })
}
