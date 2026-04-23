import { supabaseAdmin } from './supabase'
import { sendMessage } from './telegram'
import { TRIGGER_CONFIG } from './ranks'

const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID!

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
