import { supabaseAdmin } from './supabase'
import { sendMessage } from './telegram'
import { getRank, POINTS, TRIGGER_CONFIG } from './ranks'

const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID!

function getWeekStart(): string {
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(now)
  monday.setDate(diff)
  monday.setHours(0, 0, 0, 0)
  return monday.toISOString().split('T')[0]
}

async function alreadyTriggered(tgId: number, eventType: string, since?: string): Promise<boolean> {
  let query = supabaseAdmin
    .from('events_log')
    .select('id')
    .eq('tg_id', tgId)
    .eq('event_type', eventType)

  if (since) query = query.gte('triggered_at', since)

  const { data } = await query.limit(1).maybeSingle()
  return !!data
}

async function logEvent(memberId: string, tgId: number, eventType: string, metadata?: object) {
  await supabaseAdmin.from('events_log').insert({
    member_id: memberId,
    tg_id: tgId,
    event_type: eventType,
    metadata: metadata || null,
  })
}

// Check members inactive for 7+ days → notify admin
export async function checkInactiveMembers() {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - TRIGGER_CONFIG.INACTIVE_DAYS)

  const { data: members } = await supabaseAdmin
    .from('members')
    .select('*')
    .eq('status', 'active')
    .or(`last_active.is.null,last_active.lt.${cutoff.toISOString()}`)

  for (const member of members || []) {
    const alreadyNotified = await alreadyTriggered(
      member.tg_id,
      'inactive_notified',
      cutoff.toISOString()
    )
    if (alreadyNotified) continue

    const name = member.tg_first_name || member.tg_username || String(member.tg_id)
    const lastSeen = member.last_active
      ? new Date(member.last_active).toLocaleDateString('ru')
      : 'никогда'

    await sendMessage(
      ADMIN_CHAT_ID,
      `⚠️ <b>${name}</b> (@${member.tg_username || member.tg_id}) молчит ${TRIGGER_CONFIG.INACTIVE_DAYS}+ дней\n` +
      `Последняя активность: ${lastSeen}\n` +
      `Баллы: ${member.points} | Титул: ${member.rank}`
    )

    await logEvent(member.id, member.tg_id, 'inactive_notified', { days: TRIGGER_CONFIG.INACTIVE_DAYS })
  }
}

// Check members with 10+ messages this week → send bonus
export async function checkWeeklyActiveMembers() {
  const weekStart = getWeekStart()

  const { data: activityRows } = await supabaseAdmin
    .from('activity_log')
    .select('tg_id, message_count, member_id')
    .gte('week_start', weekStart)
    .gte('message_count', TRIGGER_CONFIG.ACTIVE_MESSAGES_PER_WEEK)

  // Group by tg_id (may have activity in multiple chats)
  const totals = new Map<number, { member_id: string; total: number }>()
  for (const row of activityRows || []) {
    const existing = totals.get(row.tg_id)
    if (existing) {
      existing.total += row.message_count
    } else {
      totals.set(row.tg_id, { member_id: row.member_id, total: row.message_count })
    }
  }

  for (const [tgId, { member_id, total }] of totals) {
    if (total < TRIGGER_CONFIG.ACTIVE_MESSAGES_PER_WEEK) continue

    const alreadyBonused = await alreadyTriggered(tgId, 'active_bonus', weekStart)
    if (alreadyBonused) continue

    const { data: member } = await supabaseAdmin
      .from('members')
      .select('*')
      .eq('tg_id', tgId)
      .single()

    if (!member) continue

    const name = member.tg_first_name || 'участник'
    await sendMessage(
      tgId,
      `🔥 <b>${name}</b>, ты огонь на этой неделе!\n\n` +
      `${total} сообщений — это энергия, которая заряжает весь клуб.\n\n` +
      `Держи +${POINTS.WEEKLY_ACTIVE_BONUS} бонусных баллов ⭐`
    )

    const newPoints = member.points + POINTS.WEEKLY_ACTIVE_BONUS
    await supabaseAdmin
      .from('members')
      .update({ points: newPoints, rank: getRank(newPoints) })
      .eq('id', member.id)

    await supabaseAdmin.from('points_log').insert({
      member_id,
      tg_id: tgId,
      points: POINTS.WEEKLY_ACTIVE_BONUS,
      reason: 'weekly_active_bonus',
    })

    await logEvent(member_id, tgId, 'active_bonus', { week_start: weekStart, messages: total })
  }
}

// Check week milestones since joining
export async function checkWeekMilestones() {
  const MILESTONE_TEXT: Record<number, string> = {
    1:  '🎉 Первая неделя в AI Olymp позади! Как первые впечатления? Напиши — мне важно знать.',
    2:  '📅 2 недели с нами. Что уже применил из того, что узнал в клубе?',
    4:  '🌟 Месяц в клубе — это уже по-настоящему. Ты часть ядра AI Olymp.',
    8:  '🏆 2 месяца! Ты резидент. Скоро получишь кое-что особенное.',
    12: '🚀 3 месяца в AI Olymp. Ты видел, как развивается этот клуб изнутри — это бесценно.',
    24: '👑 Полгода с нами. Ты — легенда клуба. Честно и без преувеличений.',
  }

  const { data: members } = await supabaseAdmin
    .from('members')
    .select('*')
    .eq('status', 'active')

  for (const member of members || []) {
    const weeksIn = Math.floor(
      (Date.now() - new Date(member.joined_at).getTime()) / (7 * 24 * 60 * 60 * 1000)
    )

    if (!TRIGGER_CONFIG.WEEK_MILESTONES.includes(weeksIn)) continue
    if (!(weeksIn in MILESTONE_TEXT)) continue

    const eventType = `milestone_week_${weeksIn}`
    const alreadySent = await alreadyTriggered(member.tg_id, eventType)
    if (alreadySent) continue

    await sendMessage(member.tg_id, MILESTONE_TEXT[weeksIn])
    await logEvent(member.id, member.tg_id, eventType, { weeks: weeksIn })
  }
}
