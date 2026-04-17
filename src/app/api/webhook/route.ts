import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  sendMessage, sendVideoNote, getChatMember, approveChatJoinRequest,
  promoteChatMember, setChatAdministratorCustomTitle,
} from '@/lib/telegram'
import { addMemory } from '@/lib/mem0'
import { getRank, POINTS, RANK_CONFIG } from '@/lib/ranks'
import type { MemberRank } from '@/lib/types'

export async function POST(req: NextRequest) {
  const body = await req.json()

  try {
    if (body.chat_join_request) await handleJoinRequest(body.chat_join_request)
    if (body.chat_member) await handleChatMember(body.chat_member)
    if (body.message) await handleMessage(body.message)
    if (body.message_reaction) await handleReaction(body.message_reaction)
    if (body.poll_answer) await handlePollAnswer(body.poll_answer)
    if (body.message?.new_chat_members) await handleNewGroupMembers(body.message)
  } catch (err) {
    console.error('Webhook error:', err)
  }

  return NextResponse.json({ ok: true })
}

export async function GET() {
  return NextResponse.json({ ok: true, bot: 'AI Олимп' })
}

// ─── Join request (channel with approval mode) ────────────────────────────────
async function handleJoinRequest(update: { chat: TgChat; from: TgUser }) {
  const { chat, from: user } = update
  if (user.is_bot) return

  const channelId = process.env.TELEGRAM_CHANNEL_ID
  if (channelId && String(chat.id) !== channelId) return

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

  await sendWelcome(user)
  await approveChatJoinRequest(chat.id, user.id)
}

// ─── New member joins channel ─────────────────────────────────────────────────
async function handleChatMember(update: TgChatMemberUpdate) {
  const { new_chat_member, chat } = update

  const channelId = process.env.TELEGRAM_CHANNEL_ID
  if (channelId && String(chat.id) !== channelId) return

  const { status } = new_chat_member
  if (!['member', 'administrator'].includes(status)) return

  const user = new_chat_member.user
  if (user.is_bot) return

  const { data: existing } = await supabaseAdmin
    .from('members').select('id').eq('tg_id', user.id).maybeSingle()

  if (existing) return

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

  if (member) {
    await supabaseAdmin.from('events_log').insert({
      member_id: member.id,
      tg_id: user.id,
      event_type: 'joined',
      metadata: { chat_id: chat.id, username: user.username ?? null },
    })
  }

  const name = user.first_name || user.username || String(user.id)
  addMemory(String(user.id), `${name} вступил в клуб AI Олимп${user.username ? `. Username: @${user.username}` : '.'}`)

  const dmSent = await sendWelcome(user)

  if (!dmSent) {
    const groupId = process.env.TELEGRAM_GROUP_ID
    if (groupId) {
      const mention = user.username
        ? `@${user.username}`
        : `<a href="tg://user?id=${user.id}">${user.first_name || 'участник'}</a>`

      await sendMessage(
        groupId,
        `👋 ${mention} — добро пожаловать в AI Олимп!\n\n` +
        `Напиши боту /start чтобы получить личное приветствие и активировать профиль 🔥`
      )
    }
  }
}

// ─── Track messages ────────────────────────────────────────────────────────────
async function handleMessage(message: TgMessage) {
  const user = message.from
  if (!user || user.is_bot) return

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
      await sendMessage(
        user.id,
        `👋 <b>${user.first_name || 'Привет'}!</b>\n\n` +
        `Ты в AI Олимп уже <b>${days} дней</b>\n` +
        `Ранг: <b>${rankConfig.emoji} ${rankConfig.label}</b> | Листики: <b>${member.points} 🍃</b>\n\n` +
        `Пиши в клубный чат — там вся жизнь 🔥`
      )
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

  // Store message for reaction tracking
  if (message.message_id && message.chat.id) {
    await supabaseAdmin.from('tg_messages').upsert(
      { message_id: message.message_id, chat_id: message.chat.id, author_tg_id: user.id },
      { onConflict: 'message_id,chat_id' }
    )
  }

  const newPoints = member.points + POINTS.MESSAGE
  const newRank = getRank(newPoints)

  await supabaseAdmin
    .from('members')
    .update({ last_active: new Date().toISOString(), points: newPoints, rank: newRank })
    .eq('tg_id', user.id)

  await supabaseAdmin.from('points_log').insert({
    member_id: member.id,
    tg_id: user.id,
    points: POINTS.MESSAGE,
    reason: 'message',
  })

  // Rank-up: set Telegram admin title
  if (newRank !== member.rank) {
    await applyRankTitle(user.id, newRank)
    try {
      const rc = RANK_CONFIG[newRank]
      await sendMessage(
        user.id,
        `🎉 <b>Новый ранг!</b>\n\n` +
        `Ты достиг ранга <b>${rc.emoji} ${rc.label}</b> в AI Олимп!\n` +
        `Твой титул в чате обновлён. Продолжай — ты на правильном пути 🍃`
      )
    } catch { /* DM blocked */ }
  }

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

  if (message.text && message.text.length > 30) {
    addMemory(String(user.id), message.text)
  }
}

// ─── Track reactions ──────────────────────────────────────────────────────────
async function handleReaction(reaction: TgReaction) {
  if (!reaction.user?.id) return
  if (!reaction.new_reaction?.length) return // skip removal

  const reactorId = reaction.user.id

  // 1. REACTION_GIVEN листики to the person who reacted
  const { data: actor } = await supabaseAdmin
    .from('members').select('id, points, rank').eq('tg_id', reactorId).maybeSingle()

  if (actor) {
    const newPoints = actor.points + POINTS.REACTION_GIVEN
    const newRank = getRank(newPoints)
    await supabaseAdmin
      .from('members')
      .update({ points: newPoints, rank: newRank })
      .eq('id', actor.id)
    await supabaseAdmin.from('points_log').insert({
      member_id: actor.id, tg_id: reactorId,
      points: POINTS.REACTION_GIVEN, reason: 'reaction_given',
    })
    if (newRank !== actor.rank) await applyRankTitle(reactorId, newRank)
  }

  // 2. REACTION_RECEIVED листики to the original message author
  if (reaction.chat?.id && reaction.message_id) {
    const { data: msg } = await supabaseAdmin
      .from('tg_messages')
      .select('author_tg_id')
      .eq('message_id', reaction.message_id)
      .eq('chat_id', reaction.chat.id)
      .maybeSingle()

    if (msg && msg.author_tg_id !== reactorId) {
      const { data: author } = await supabaseAdmin
        .from('members').select('id, points, rank').eq('tg_id', msg.author_tg_id).maybeSingle()

      if (author) {
        const newPoints = author.points + POINTS.REACTION_RECEIVED
        const newRank = getRank(newPoints)
        await supabaseAdmin
          .from('members')
          .update({ points: newPoints, rank: newRank })
          .eq('id', author.id)
        await supabaseAdmin.from('points_log').insert({
          member_id: author.id, tg_id: msg.author_tg_id,
          points: POINTS.REACTION_RECEIVED, reason: 'reaction_received',
        })
        if (newRank !== author.rank) await applyRankTitle(msg.author_tg_id, newRank)
      }
    }
  }
}

// ─── Poll votes ───────────────────────────────────────────────────────────────
async function handlePollAnswer(update: TgPollAnswer) {
  if (!update.user?.id) return

  const { data: member } = await supabaseAdmin
    .from('members').select('id, points, rank').eq('tg_id', update.user.id).maybeSingle()

  if (!member) return

  const newPoints = member.points + POINTS.POLL_VOTE
  const newRank = getRank(newPoints)

  await supabaseAdmin
    .from('members')
    .update({ points: newPoints, rank: newRank, last_active: new Date().toISOString() })
    .eq('id', member.id)

  await supabaseAdmin.from('points_log').insert({
    member_id: member.id, tg_id: update.user.id,
    points: POINTS.POLL_VOTE, reason: 'poll_vote',
  })

  if (newRank !== member.rank) await applyRankTitle(update.user.id, newRank)
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

    const mention = user.username
      ? `@${user.username}`
      : `<a href="tg://user?id=${user.id}">${user.first_name || 'участник'}</a>`

    await sendMessage(
      message.chat.id,
      `👋 ${mention} — добро пожаловать в AI Олимп!\n\n` +
      `Напиши боту /start чтобы активировать профиль и получить приветствие.`
    )

    if (!existing || !existing.welcome_sent) {
      await sendWelcome(user)
    }
  }
}

// ─── Welcome helper ───────────────────────────────────────────────────────────
async function sendWelcome(user: TgUser): Promise<boolean> {
  try {
    const videoNoteId = process.env.TELEGRAM_WELCOME_VIDEO_NOTE_ID
    if (videoNoteId) {
      await sendVideoNote(user.id, videoNoteId)
      await delay(1500)
    }
    const result = await sendMessage(
      user.id,
      `👋 <b>Привет, ${user.first_name || 'участник'}!</b>\n\n` +
      `Добро пожаловать в AI Олимп — рад видеть тебя здесь.\n\n` +
      `Здесь мы разбираем AI инструменты, делимся инсайтами и строим проекты. ` +
      `Пиши в чат, задавай вопросы — это самый важный шаг.\n\n` +
      `За активность ты получаешь 🍃 листики и растёшь в ранге. Удачи!`
    )
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
  await sendMessage(
    user.id,
    `👋 <b>Привет, ${user.first_name || 'друг'}!</b>\n\n` +
    `<b>AI Олимп</b> — закрытый клуб тех, кто строит будущее с AI.\n\n` +
    `🔥 Разборы инструментов и кейсов\n` +
    `📈 Геймификация: листики 🍃, ранги, рейтинги\n` +
    `🤝 Сильное сообщество практиков\n` +
    `🎥 Личное приветствие от основателя\n\n` +
    `<b>Оформить подписку:</b>\n${tributeLink}`
  )
}

// ─── Set Telegram rank title (no-rights admin) ────────────────────────────────
async function applyRankTitle(userId: number, rank: MemberRank) {
  const groupId = process.env.TELEGRAM_GROUP_ID
  if (!groupId) return
  const rc = RANK_CONFIG[rank]
  try {
    await promoteChatMember(groupId, userId)
    await setChatAdministratorCustomTitle(groupId, userId, `${rc.emoji} ${rc.label}`)
  } catch { /* User may not be in group yet */ }
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
interface TgChat { id: number }
interface TgChatMemberUpdate { chat: TgChat; new_chat_member: { user: TgUser; status: string } }
interface TgMessage { message_id?: number; from?: TgUser; chat: TgChat; text?: string; new_chat_members?: TgUser[] }
interface TgReaction { user?: TgUser; chat?: TgChat; message_id?: number; new_reaction?: unknown[] }
interface TgPollAnswer { poll_id: string; user?: TgUser; option_ids: number[] }
