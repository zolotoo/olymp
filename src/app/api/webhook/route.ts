import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  sendMessage, sendVideoNote, getChatMember, approveChatJoinRequest, declineChatJoinRequest,
  promoteChatMember, setChatAdministratorCustomTitle, deleteMessage,
} from '@/lib/telegram'
import { sendTracked } from '@/lib/send-tracked'
import { addMemory } from '@/lib/mem0'
import { POINTS, RANK_CONFIG } from '@/lib/ranks'
import type { MemberRank } from '@/lib/types'
import { trackBotInteraction, setBotUserChannelMember, setBotUserGroupMember } from '@/lib/bot-tracking'
import { enableMiniAppButton, disableMiniAppButton } from '@/lib/mini-app'
import { getBotText, getBotVideo } from '@/lib/bot-messages'

export async function POST(req: NextRequest) {
  const body = await req.json()

  try {
    await trackIncomingUpdate(body)

    // Delete service messages about users joining/leaving (requires bot admin with can_delete_messages)
    const m = body.message as { message_id?: number; chat?: { id: number }; new_chat_members?: unknown[]; left_chat_member?: unknown } | undefined
    if (m?.message_id && m.chat?.id && (m.new_chat_members || m.left_chat_member)) {
      try { await deleteMessage(m.chat.id, m.message_id) } catch (e) { console.error('deleteMessage (service) failed:', e) }
    }

    if (body.chat_join_request) await handleJoinRequest(body.chat_join_request)
    if (body.chat_member) await handleChatMember(body.chat_member)
    if (body.message) await handleMessage(body.message)
    if (body.edited_message) await storeIncomingMessage(body.edited_message as TgMessage, true)
    if (body.channel_post) await storeIncomingMessage(body.channel_post as TgMessage, false)
    if (body.edited_channel_post) await storeIncomingMessage(body.edited_channel_post as TgMessage, true)
    if (body.message_reaction) await handleReaction(body.message_reaction)
    if (body.poll_answer) await handlePollAnswer(body.poll_answer)
    if (body.message?.new_chat_members) await handleNewGroupMembers(body.message)
  } catch (err) {
    console.error('Webhook error:', err)
  }

  return NextResponse.json({ ok: true })
}

// Classify the update and log it into bot_users / bot_events.
// Only records interactions we care about (bot audience in private chats + join flow).
async function trackIncomingUpdate(body: Record<string, unknown>): Promise<void> {
  if (body.chat_join_request) {
    const r = body.chat_join_request as { from: TgUser; chat: TgChat }
    if (!r.from?.is_bot) {
      await trackBotInteraction({ user: r.from, eventType: 'join_request', chatId: r.chat.id })
    }
    return
  }

  if (body.message) {
    const msg = body.message as TgMessage & { text?: string }
    if (!msg.from || msg.from.is_bot) return
    // Bot audience = private DMs with the bot only.
    // Group/channel messages live in `tg_messages` + `activity_log`, not here.
    const isPrivate = msg.chat.type === 'private' || msg.chat.id === msg.from.id
    if (!isPrivate) return

    const text = msg.text ?? ''
    const eventType = text.startsWith('/')
      ? `command:${text.split(/\s+/)[0].toLowerCase()}`
      : 'message:private'
    await trackBotInteraction({
      user: msg.from,
      eventType,
      chatId: msg.chat.id,
      payload: text ? { text: text.slice(0, 500) } : undefined,
    })
    return
  }

  if ((body as { callback_query?: unknown }).callback_query) {
    const cb = (body as { callback_query: { from: TgUser; data?: string; message?: { chat?: TgChat } } }).callback_query
    if (cb.from?.is_bot) return
    await trackBotInteraction({
      user: cb.from,
      eventType: 'callback',
      chatId: cb.message?.chat?.id,
      payload: cb.data ? { data: cb.data.slice(0, 200) } : undefined,
    })
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, bot: 'AI Олимп' })
}

// ─── Join request (channel "AI Олимп" or group "AI Олимп / Ветки") ────────────
async function handleJoinRequest(update: { chat: TgChat; from: TgUser }) {
  const { chat, from: user } = update
  if (user.is_bot) return

  const channelId = process.env.TELEGRAM_CHANNEL_ID
  const groupId = process.env.TELEGRAM_GROUP_ID
  const chatStr = String(chat.id)
  const isChannel = !!channelId && chatStr === channelId
  const isGroup = !!groupId && chatStr === groupId
  if (!isChannel && !isGroup) return

  if (isGroup) {
    await handleGroupJoinRequest(chat, user)
    return
  }

  // Channel join request: same flow as before.
  const { data: existing } = await supabaseAdmin
    .from('members')
    .select('id, welcome_sent')
    .eq('tg_id', user.id)
    .maybeSingle()

  if (!existing) {
    await supabaseAdmin.from('members').insert({
      tg_id: user.id,
      tg_username: user.username ?? null,
      tg_first_name: user.first_name ?? null,
      tg_last_name: user.last_name ?? null,
      status: 'active',
      rank: 'newcomer',
      points: 0,
      welcome_sent: false,
    })
    addMemory(String(user.id), `${user.first_name || user.username || user.id} подал заявку в AI Олимп`)
  }

  const { data: member } = await supabaseAdmin
    .from('members').select('id').eq('tg_id', user.id).single()

  if (member) {
    await supabaseAdmin.from('events_log').insert({
      member_id: member.id,
      tg_id: user.id,
      event_type: 'join_request',
      metadata: { chat_id: chat.id },
    })
  }

  // Per message tree: on channel join request, only auto-approve + DM circle.
  // Welcome text is sent only on Tribute subscription (see /api/tribute).
  await approveChatJoinRequest(chat.id, user.id)
  await enableMiniAppButton(user.id)

  try {
    const videoNoteId = (await getBotVideo('l_jrvideo')) || process.env.TELEGRAM_WELCOME_VIDEO_NOTE_ID
    if (videoNoteId) {
      const r = await sendVideoNote(user.id, videoNoteId)
      if (!r?.ok) console.error('join_request: sendVideoNote (l_jrvideo) failed', r)
    } else {
      console.warn('join_request: no video note configured (l_jrvideo / TELEGRAM_WELCOME_VIDEO_NOTE_ID)')
    }
  } catch (e) {
    console.error('join_request: video note exception', e)
  }

  await supabaseAdmin.from('members').update({ welcome_sent: true }).eq('tg_id', user.id)
}

// Group "AI Олимп / Ветки": approve only if user is subscribed to the channel.
async function handleGroupJoinRequest(chat: TgChat, user: TgUser) {
  const channelId = process.env.TELEGRAM_CHANNEL_ID
  let isChannelMember = false
  if (channelId) {
    try {
      const res = await getChatMember(channelId, user.id) as { ok: boolean; result?: { status: string } }
      const status = res?.result?.status
      isChannelMember = !!status && ['member', 'administrator', 'creator'].includes(status)
    } catch (e) {
      console.error('group join: getChatMember failed', e)
    }
  }

  const { data: member } = await supabaseAdmin
    .from('members').select('id').eq('tg_id', user.id).maybeSingle()

  if (isChannelMember) {
    await approveChatJoinRequest(chat.id, user.id)
    if (member) {
      await supabaseAdmin.from('events_log').insert({
        member_id: member.id,
        tg_id: user.id,
        event_type: 'group_join_approved',
        metadata: { chat_id: chat.id },
      })
    }
    return
  }

  await declineChatJoinRequest(chat.id, user.id)
  if (member) {
    await supabaseAdmin.from('events_log').insert({
      member_id: member.id,
      tg_id: user.id,
      event_type: 'group_join_denied',
      metadata: { chat_id: chat.id, reason: 'no_channel_subscription' },
    })
  }

  try {
    const denyText = await getBotText(
      'l_groupdeny',
      `Чтобы попасть в группу <b>AI Олимп / Ветки</b>, сначала оформи подписку на канал AI Олимп.`,
      {},
    )
    await sendTracked(user.id, denyText, { campaign: 'group_join_denied', templateKey: 'l_groupdeny' })
  } catch { /* DM blocked */ }
}

// ─── New member joins channel ─────────────────────────────────────────────────
async function handleChatMember(update: TgChatMemberUpdate) {
  const { new_chat_member, chat } = update

  const channelId = process.env.TELEGRAM_CHANNEL_ID
  const groupId = process.env.TELEGRAM_GROUP_ID
  const chatStr = String(chat.id)
  const isChannel = channelId && chatStr === channelId
  const isGroup = groupId && chatStr === groupId
  if (!isChannel && !isGroup) return

  const { status } = new_chat_member
  const user = new_chat_member.user
  if (user.is_bot) return

  // On leave (channel или group): помечаем участника churned, логируем событие.
  // Фантики/титул/историю НЕ трогаем — только статус. Для админа это видно
  // в /members (серая строчка) и в events_log.
  if (['left', 'kicked', 'banned'].includes(status)) {
    if (isChannel) {
      await disableMiniAppButton(user.id)
      await setBotUserChannelMember(user.id, false)
    }
    if (isGroup) await setBotUserGroupMember(user.id, false)

    const { data: existing } = await supabaseAdmin
      .from('members')
      .select('id, status')
      .eq('tg_id', user.id)
      .maybeSingle()

    if (existing && existing.status !== 'churned') {
      await supabaseAdmin
        .from('members')
        .update({ status: 'churned' })
        .eq('id', existing.id)

      await supabaseAdmin.from('events_log').insert({
        member_id: existing.id,
        tg_id: user.id,
        event_type: isChannel ? 'left_channel' : 'left_group',
        metadata: {
          chat_id: chat.id,
          status,
          source: 'chat_member_update',
        },
      })
    }
    return
  }

  if (!['member', 'administrator', 'creator'].includes(status)) return

  // On join to the channel: give the user the personal Mini App button.
  if (isChannel) {
    await enableMiniAppButton(user.id)
    await setBotUserChannelMember(user.id, true)
  }
  if (isGroup) await setBotUserGroupMember(user.id, true)

  const { data: existing } = await supabaseAdmin
    .from('members').select('id, rank').eq('tg_id', user.id).maybeSingle()

  let memberId = existing?.id
  let memberRank: MemberRank = (existing?.rank as MemberRank) || 'newcomer'

  if (!existing) {
    await supabaseAdmin.from('members').insert({
      tg_id: user.id,
      tg_username: user.username ?? null,
      tg_first_name: user.first_name ?? null,
      tg_last_name: user.last_name ?? null,
      status: 'active',
      rank: 'newcomer',
      points: 0,
      welcome_sent: false,
    })

    const { data: member } = await supabaseAdmin
      .from('members').select('id').eq('tg_id', user.id).single()
    memberId = member?.id

    if (memberId) {
      await supabaseAdmin.from('events_log').insert({
        member_id: memberId,
        tg_id: user.id,
        event_type: 'joined',
        metadata: { chat_id: chat.id, username: user.username ?? null },
      })
    }

    const name = user.first_name || user.username || String(user.id)
    addMemory(String(user.id), `${name} вступил в клуб AI Олимп${user.username ? `. Username: @${user.username}` : '.'}`)
  }

  // When user appears in the GROUP, give them the rank title (admin badge).
  if (isGroup) {
    await applyRankTitle(user.id, memberRank)
  }

  // Приветствие в DM уже отправляется в handleJoinRequest при одобрении заявки.
  // Публичное приветствие в группе отключено по требованию.
}

// ─── Track messages ────────────────────────────────────────────────────────────
async function handleMessage(message: TgMessage) {
  const user = message.from
  if (!user || user.is_bot) return

  // Persist full text + metadata for every incoming message (any chat, any user).
  // Must run before early-returns below so we never lose a record.
  await storeIncomingMessage(message, false)

  // DEBUG: log incoming video notes so we can grab file_id
  if ((message as TgMessage & { video_note?: { file_id: string; duration?: number } }).video_note) {
    const vn = (message as TgMessage & { video_note?: { file_id: string; duration?: number } }).video_note!
    await supabaseAdmin.from('messages_log').insert({
      tg_id: user.id,
      chat_id: message.chat.id,
      tg_username: user.username ?? null,
      tg_first_name: user.first_name ?? null,
      message_text: `VIDEO_NOTE file_id=${vn.file_id} duration=${vn.duration ?? '?'}s`,
      reason: 'debug:video_note',
    })
    await sendMessage(
      user.id,
      `✅ Кружок получен!\n\n<code>${vn.file_id}</code>\n\nСкопируй этот file_id в env <code>TELEGRAM_WELCOME_VIDEO_NOTE_ID</code>.`
    )
    return
  }

  // /start in private chat
  if (message.text === '/start' && message.chat.id === user.id) {
    const { data: member } = await supabaseAdmin
      .from('members')
      .select('rank, points, joined_at, welcome_sent')
      .eq('tg_id', user.id)
      .maybeSingle()

    if (member) {
      if (!member.welcome_sent) {
        await sendWelcome(user)
        return
      }
      const days = Math.floor((Date.now() - new Date(member.joined_at).getTime()) / (1000 * 60 * 60 * 24))
      const rankConfig = RANK_CONFIG[member.rank as MemberRank]
      const text = await getBotText(
        'l_profile',
        `👋 <b>{name}!</b>\n\n` +
        `Ты в AI Олимп уже <b>{days} дней</b>\n` +
        `Титул: <b>{rank_emoji} {rank_label}</b> | Фантики: <b>{points}</b>\n\n` +
        `Пиши в клубный чат, там вся жизнь 🔥`,
        {
          name: user.first_name || 'Привет',
          days,
          rank_emoji: rankConfig.emoji,
          rank_label: rankConfig.label,
          points: member.points,
        },
      )
      await sendMessage(user.id, text)
    } else {
      const channelId = process.env.TELEGRAM_CHANNEL_ID
      if (channelId) {
        const res = await getChatMember(channelId, user.id)
        const status = res?.result?.status
        const isMember = ['member', 'administrator', 'creator'].includes(status)

        if (isMember) {
          await supabaseAdmin.from('members').insert({
            tg_id: user.id,
            tg_username: user.username ?? null,
            tg_first_name: user.first_name ?? null,
            tg_last_name: user.last_name ?? null,
            status: 'active',
            rank: 'newcomer',
            points: 0,
          })
          addMemory(String(user.id), `${user.first_name || user.username || user.id} зарегистрирован через /start`)
          await sendWelcome(user)
          await enableMiniAppButton(user.id)
        } else {
          await sendSalesPitch(user)
        }
      } else {
        await sendSalesPitch(user)
      }
    }
    return
  }

  const { data: member } = await supabaseAdmin
    .from('members').select('*').eq('tg_id', user.id).maybeSingle()

  if (!member) return

  // (tg_messages uprise happened at top via storeIncomingMessage)

  // Фантики за сообщения отключены (POINTS.MESSAGE = 0)
  // Обновляем только last_active
  await supabaseAdmin
    .from('members')
    .update({ last_active: new Date().toISOString() })
    .eq('tg_id', user.id)

  // Weekly activity counter
  const weekStart = currentWeekStart()
  const { data: activity } = await supabaseAdmin
    .from('activity_log')
    .select('id, message_count')
    .eq('tg_id', user.id)
    .eq('chat_id', message.chat.id)
    .eq('week_start', weekStart)
    .maybeSingle()

  if (activity) {
    await supabaseAdmin
      .from('activity_log')
      .update({ message_count: activity.message_count + 1, updated_at: new Date().toISOString() })
      .eq('id', activity.id)
  } else {
    await supabaseAdmin.from('activity_log').insert({
      member_id: member.id,
      tg_id: user.id,
      chat_id: message.chat.id,
      message_count: 1,
      week_start: weekStart,
    })
  }

  if (message.text) {
    addMemory(String(user.id), message.text)
  }
}

// ─── Track reactions ──────────────────────────────────────────────────────────
// Telegram присылает и постановку, и снятие. Мы логируем каждое событие:
// diff(old vs new) → rows 'added' / 'removed' в reactions_log.
async function handleReaction(reaction: TgReaction) {
  if (!reaction.user?.id) return
  const reactorId = reaction.user.id
  if (!reaction.chat?.id || !reaction.message_id) return

  const oldR = reaction.old_reaction ?? []
  const newR = reaction.new_reaction ?? []
  const keyOf = (r: TgReactionType) =>
    r.type === 'emoji' ? `e:${r.emoji}` :
    r.type === 'custom_emoji' ? `c:${r.custom_emoji_id}` :
    `p:paid`
  const oldKeys = new Set(oldR.map(keyOf))
  const newKeys = new Set(newR.map(keyOf))
  const added = newR.filter((r) => !oldKeys.has(keyOf(r)))
  const removed = oldR.filter((r) => !newKeys.has(keyOf(r)))

  // Определяем автора исходного сообщения (если знаем)
  const { data: msg } = await supabaseAdmin
    .from('tg_messages')
    .select('author_tg_id')
    .eq('message_id', reaction.message_id)
    .eq('chat_id', reaction.chat.id)
    .maybeSingle()
  const authorTgId: number | null = msg?.author_tg_id ?? null

  // Логируем каждое изменение
  const rows: Array<{
    message_id: number
    chat_id: number
    reactor_tg_id: number
    author_tg_id: number | null
    emoji: string | null
    emoji_type: string
    action: 'added' | 'removed'
  }> = []
  for (const r of added) {
    rows.push({
      message_id: reaction.message_id, chat_id: reaction.chat.id,
      reactor_tg_id: reactorId, author_tg_id: authorTgId,
      emoji: r.emoji ?? r.custom_emoji_id ?? null, emoji_type: r.type,
      action: 'added',
    })
  }
  for (const r of removed) {
    rows.push({
      message_id: reaction.message_id, chat_id: reaction.chat.id,
      reactor_tg_id: reactorId, author_tg_id: authorTgId,
      emoji: r.emoji ?? r.custom_emoji_id ?? null, emoji_type: r.type,
      action: 'removed',
    })
  }
  if (rows.length) {
    try {
      await supabaseAdmin.from('reactions_log').insert(rows)
    } catch (e) {
      console.error('reactions_log insert failed:', e)
    }
  }

  // Трек в bot_events — чтобы реакции светились в аудитории
  if (added.length || removed.length) {
    await trackBotInteraction({
      user: reaction.user,
      eventType: added.length ? 'reaction:added' : 'reaction:removed',
      chatId: reaction.chat.id,
      payload: {
        message_id: reaction.message_id,
        added: added.map((r) => r.emoji ?? r.custom_emoji_id),
        removed: removed.map((r) => r.emoji ?? r.custom_emoji_id),
        author_tg_id: authorTgId,
      },
    })
  }

  // Engagement-прокси: если реакция поставлена на исходящую рассылку боту,
  // помечаем доставку как "прочитано".
  if (added.length && authorTgId === null) {
    try {
      await supabaseAdmin
        .from('message_deliveries')
        .update({ engaged_at: new Date().toISOString(), engagement_kind: 'reaction' })
        .eq('tg_id', reactorId)
        .is('engaged_at', null)
        .gte('sent_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    } catch { /* best-effort */ }
  }

  // REACTION_RECEIVED фантики автору — только за новые (added) реакции от других
  if (added.length && authorTgId && authorTgId !== reactorId) {
    const { data: author } = await supabaseAdmin
      .from('members').select('id, points').eq('tg_id', authorTgId).maybeSingle()

    if (author) {
      const delta = POINTS.REACTION_RECEIVED * added.length
      await supabaseAdmin
        .from('members')
        .update({ points: author.points + delta })
        .eq('id', author.id)
      await supabaseAdmin.from('points_log').insert({
        member_id: author.id, tg_id: authorTgId,
        points: delta, reason: 'reaction_received',
      })
    }
  }
}

// ─── Poll votes ───────────────────────────────────────────────────────────────
async function handlePollAnswer(update: TgPollAnswer) {
  if (!update.user?.id) return

  const { data: member } = await supabaseAdmin
    .from('members').select('id, points').eq('tg_id', update.user.id).maybeSingle()

  if (!member) return

  const newPoints = member.points + POINTS.POLL_VOTE

  await supabaseAdmin
    .from('members')
    .update({ points: newPoints, last_active: new Date().toISOString() })
    .eq('id', member.id)

  await supabaseAdmin.from('points_log').insert({
    member_id: member.id, tg_id: update.user.id,
    points: POINTS.POLL_VOTE, reason: 'poll_vote',
  })
}

// ─── New member joined group/forum ────────────────────────────────────────────
async function handleNewGroupMembers(message: TgMessage) {
  const newMembers: TgUser[] = message.new_chat_members || []

  for (const user of newMembers) {
    if (user.is_bot) continue

    const { data: existing } = await supabaseAdmin
      .from('members').select('id, welcome_sent').eq('tg_id', user.id).maybeSingle()

    if (!existing) {
      await supabaseAdmin.from('members').insert({
        tg_id: user.id,
        tg_username: user.username ?? null,
        tg_first_name: user.first_name ?? null,
        tg_last_name: user.last_name ?? null,
        status: 'active',
        rank: 'newcomer',
        points: 0,
        welcome_sent: false,
      })
      addMemory(String(user.id), `${user.first_name || user.username || user.id} вступил в AI Олимп`)
    }

    // Публичное приветствие в группе отключено.
    // DM-приветствие уже отправляется в handleJoinRequest при одобрении заявки на канал.

    // Apply newcomer rank title in the group
    await applyRankTitle(user.id, 'newcomer')
  }
}

// ─── bot_messages helper ──────────────────────────────────────────────────────
async function getBotMessage(key: string): Promise<{ content: string | null; video_url: string | null }> {
  const { data } = await supabaseAdmin
    .from('bot_messages')
    .select('content, video_url')
    .eq('key', key)
    .maybeSingle()
  return { content: data?.content ?? null, video_url: data?.video_url ?? null }
}

function renderTemplate(tpl: string, user: TgUser): string {
  const name = user.first_name || user.username || 'участник'
  return tpl.replace(/\[Имя\]/g, name)
}

// ─── Welcome helper ───────────────────────────────────────────────────────────
async function sendWelcome(user: TgUser): Promise<boolean> {
  try {
    // 1. Video note: prefer bot_messages[rank_newcomer_video].video_url, fallback to env
    const videoMsg = await getBotMessage('rank_newcomer_video')
    const videoNoteId = videoMsg.video_url || process.env.TELEGRAM_WELCOME_VIDEO_NOTE_ID
    if (videoNoteId) {
      await sendVideoNote(user.id, videoNoteId)
      await delay(1500)
    }

    // 2. Welcome text: prefer bot_messages[rank_newcomer_welcome].content
    const welcomeMsg = await getBotMessage('rank_newcomer_welcome')
    const text = welcomeMsg.content
      ? renderTemplate(welcomeMsg.content, user)
      : `👋 <b>Привет, ${user.first_name || 'участник'}!</b>\n\n` +
        `Добро пожаловать в AI Олимп, рад видеть тебя здесь.\n\n` +
        `Здесь мы разбираем AI инструменты, делимся инсайтами и строим проекты. ` +
        `Пиши в чат, задавай вопросы, это самый важный шаг.\n\n` +
        `За активность ты получаешь фантики и растёшь в титуле. Удачи!`

    const result = await sendTracked(user.id, text, { campaign: 'welcome', templateKey: 'rank_newcomer_welcome' })
    if (!result?.ok) return false
    await supabaseAdmin.from('members').update({ welcome_sent: true }).eq('tg_id', user.id)
    return true
  } catch {
    return false
  }
}

// ─── Sales pitch for non-members ─────────────────────────────────────────────
async function sendSalesPitch(user: TgUser) {
  const tributeLink = process.env.TRIBUTE_LINK || 'https://tribute.tg'
  const text = await getBotText(
    'l_sales',
    `👋 <b>Привет, {name}!</b>\n\n` +
    `<b>AI Олимп</b>, закрытый клуб тех, кто строит будущее с AI.\n\n` +
    `🔥 Разборы инструментов и кейсов\n` +
    `📈 Геймификация: фантики, титулы, рейтинги\n` +
    `🤝 Сильное сообщество практиков\n` +
    `🎥 Личное приветствие от основателя\n\n` +
    `<b>Оформить подписку:</b>\n{tribute_link}`,
    { name: user.first_name || 'друг', tribute_link: tributeLink },
  )
  await sendTracked(user.id, text, { campaign: 'sales_pitch', templateKey: 'l_sales' })
}

// ─── Set Telegram rank title (no-rights admin) ────────────────────────────────
async function applyRankTitle(userId: number, rank: MemberRank) {
  const groupId = process.env.TELEGRAM_GROUP_ID
  if (!groupId) {
    console.warn('applyRankTitle: TELEGRAM_GROUP_ID is not set')
    return
  }
  // Тэг титула берём из БД (titles.tag_title), с фолбэком на хардкод.
  let tagTitle = RANK_CONFIG[rank].tagTitle || RANK_CONFIG[rank].label
  const { data: titleRow } = await supabaseAdmin
    .from('titles')
    .select('tag_title, label')
    .eq('rank', rank)
    .maybeSingle()
  if (titleRow) tagTitle = titleRow.tag_title || titleRow.label || tagTitle

  try {
    const prom = await promoteChatMember(groupId, userId)
    if (!prom?.ok) console.error('promoteChatMember failed:', prom)
    // Telegram запрещает произвольные эмодзи в custom_title. Лимит 16 символов.
    const set = await setChatAdministratorCustomTitle(groupId, userId, tagTitle.slice(0, 16))
    if (!set?.ok) console.error('setChatAdministratorCustomTitle failed:', set)
  } catch (e) {
    console.error('applyRankTitle exception:', e)
  }
}

// ─── Utils ────────────────────────────────────────────────────────────────────
function currentWeekStart(): string {
  const now = new Date()
  const day = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - day + (day === 0 ? -6 : 1))
  monday.setHours(0, 0, 0, 0)
  return monday.toISOString().split('T')[0]
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

// ─── Minimal Telegram types ───────────────────────────────────────────────────
interface TgUser { id: number; is_bot?: boolean; first_name?: string; last_name?: string; username?: string }
interface TgChat { id: number; type?: string; title?: string }
interface TgChatMemberUpdate { chat: TgChat; new_chat_member: { user: TgUser; status: string } }
interface TgMessage {
  message_id?: number
  from?: TgUser
  sender_chat?: TgChat
  chat: TgChat
  date?: number
  edit_date?: number
  text?: string
  caption?: string
  reply_to_message?: { message_id: number }
  new_chat_members?: TgUser[]
  left_chat_member?: TgUser
  photo?: unknown[]
  video?: unknown
  video_note?: unknown
  voice?: unknown
  audio?: unknown
  document?: unknown
  sticker?: unknown
  animation?: unknown
}
interface TgReactionType { type: 'emoji' | 'custom_emoji' | 'paid'; emoji?: string; custom_emoji_id?: string }
interface TgReaction {
  user?: TgUser
  actor_chat?: TgChat
  chat?: TgChat
  message_id?: number
  old_reaction?: TgReactionType[]
  new_reaction?: TgReactionType[]
}
interface TgPollAnswer { poll_id: string; user?: TgUser; option_ids: number[] }

// Media classifier for tg_messages.media_kind
function classifyMedia(m: TgMessage): { has: boolean; kind: string | null } {
  if (m.photo) return { has: true, kind: 'photo' }
  if (m.video) return { has: true, kind: 'video' }
  if (m.video_note) return { has: true, kind: 'video_note' }
  if (m.voice) return { has: true, kind: 'voice' }
  if (m.audio) return { has: true, kind: 'audio' }
  if (m.document) return { has: true, kind: 'document' }
  if (m.sticker) return { has: true, kind: 'sticker' }
  if (m.animation) return { has: true, kind: 'animation' }
  return { has: false, kind: null }
}

// Persist any incoming chat message (original or edited) to tg_messages.
// Called for message / edited_message / channel_post / edited_channel_post.
async function storeIncomingMessage(msg: TgMessage, isEdit: boolean): Promise<void> {
  if (!msg.message_id || !msg.chat?.id) return
  // Author: prefer from.id; for channel posts Telegram provides sender_chat instead.
  const authorId = msg.from?.id ?? msg.sender_chat?.id
  if (!authorId) return
  if (msg.from?.is_bot) return

  const text = msg.text ?? msg.caption ?? null
  const media = classifyMedia(msg)
  const sentAt = msg.date ? new Date(msg.date * 1000).toISOString() : new Date().toISOString()
  const editedAt = isEdit
    ? (msg.edit_date ? new Date(msg.edit_date * 1000).toISOString() : new Date().toISOString())
    : null

  try {
    await supabaseAdmin.from('tg_messages').upsert(
      {
        message_id: msg.message_id,
        chat_id: msg.chat.id,
        author_tg_id: authorId,
        text,
        chat_type: msg.chat.type ?? null,
        chat_title: msg.chat.title ?? null,
        reply_to_message_id: msg.reply_to_message?.message_id ?? null,
        has_media: media.has,
        media_kind: media.kind,
        sent_at: sentAt,
        edited_at: editedAt,
      },
      { onConflict: 'message_id,chat_id' },
    )
  } catch (e) {
    console.error('storeIncomingMessage failed:', e)
  }
}
