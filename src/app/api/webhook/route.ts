import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendMessage, sendVideoNote } from '@/lib/telegram'
import { addMemory } from '@/lib/mem0'
import { getRank, POINTS } from '@/lib/ranks'

export async function POST(req: NextRequest) {
  const body = await req.json()

  try {
    if (body.chat_member) await handleChatMember(body.chat_member)
    if (body.message) await handleMessage(body.message)
    if (body.message_reaction) await handleReaction(body.message_reaction)
  } catch (err) {
    console.error('Webhook error:', err)
  }

  return NextResponse.json({ ok: true })
}

// GET for quick health check
export async function GET() {
  return NextResponse.json({ ok: true, bot: 'AI Olymp' })
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

  // Upsert member
  const { data: existing } = await supabaseAdmin
    .from('members')
    .select('id')
    .eq('tg_id', user.id)
    .maybeSingle()

  if (existing) return

  await supabaseAdmin.from('members').insert({
    tg_id: user.id,
    tg_username: user.username ?? null,
    tg_first_name: user.first_name ?? null,
    tg_last_name: user.last_name ?? null,
    status: 'active',
    rank: 'newcomer',
    points: 0,
  })

  const { data: member } = await supabaseAdmin
    .from('members')
    .select('id')
    .eq('tg_id', user.id)
    .single()

  if (member) {
    await supabaseAdmin.from('events_log').insert({
      member_id: member.id,
      tg_id: user.id,
      event_type: 'joined',
      metadata: { chat_id: chat.id, username: user.username ?? null },
    })
  }

  // Mem0
  const name = user.first_name || user.username || String(user.id)
  addMemory(String(user.id), `${name} вступил в клуб AI Olymp${user.username ? `. Username: @${user.username}` : '.'}`)

  // Send welcome video note then text
  const videoNoteId = process.env.TELEGRAM_WELCOME_VIDEO_NOTE_ID
  if (videoNoteId) {
    await sendVideoNote(user.id, videoNoteId)
    await delay(1500)
  }

  await sendMessage(
    user.id,
    `👋 <b>Привет, ${user.first_name || 'участник'}!</b>\n\n` +
    `Добро пожаловать в AI Olymp — рад видеть тебя здесь.\n\n` +
    `Здесь мы разбираем AI инструменты, делимся инсайтами и строим проекты. ` +
    `Пиши в чат, задавай вопросы — это самый важный шаг.`
  )
}

// ─── Track messages ────────────────────────────────────────────────────────────
async function handleMessage(message: TgMessage) {
  const user = message.from
  if (!user || user.is_bot) return

  // /start command — personal DM to bot
  if (message.text === '/start' && message.chat.id === user.id) {
    const { data: member } = await supabaseAdmin
      .from('members')
      .select('rank, points, joined_at')
      .eq('tg_id', user.id)
      .maybeSingle()

    if (member) {
      const days = Math.floor((Date.now() - new Date(member.joined_at).getTime()) / (1000 * 60 * 60 * 24))
      await sendMessage(
        user.id,
        `👋 <b>${user.first_name || 'Привет'}!</b>\n\n` +
        `Ты в AI Olymp уже <b>${days} дней</b>\n` +
        `Ранг: <b>${member.rank}</b> | Баллы: <b>${member.points}</b>\n\n` +
        `Пиши в клубный чат — там вся жизнь 🔥`
      )
    } else {
      await sendMessage(
        user.id,
        `👋 <b>Привет, ${user.first_name || 'друг'}!</b>\n\n` +
        `Я бот AI Olymp. Вступи в канал клуба, чтобы стать участником.`
      )
    }
    return
  }

  const { data: member } = await supabaseAdmin
    .from('members')
    .select('*')
    .eq('tg_id', user.id)
    .maybeSingle()

  if (!member) return

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

  // Save meaningful messages to Mem0 (non-blocking)
  if (message.text && message.text.length > 30) {
    addMemory(String(user.id), message.text)
  }
}

// ─── Track reactions ──────────────────────────────────────────────────────────
async function handleReaction(reaction: TgReaction) {
  if (!reaction.user?.id) return

  const { data: actor } = await supabaseAdmin
    .from('members')
    .select('id, points')
    .eq('tg_id', reaction.user.id)
    .maybeSingle()

  if (!actor) return

  const newPoints = actor.points + POINTS.REACTION_GIVEN
  await supabaseAdmin
    .from('members')
    .update({ points: newPoints, rank: getRank(newPoints) })
    .eq('id', actor.id)

  await supabaseAdmin.from('points_log').insert({
    member_id: actor.id,
    tg_id: reaction.user.id,
    points: POINTS.REACTION_GIVEN,
    reason: 'reaction_given',
  })
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
interface TgMessage { from?: TgUser; chat: TgChat; text?: string }
interface TgReaction { user?: TgUser }
