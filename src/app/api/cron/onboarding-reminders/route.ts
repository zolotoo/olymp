import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendMessageWithKeyboard, buildCallbackKeyboard } from '@/lib/telegram'
import { sendTracked } from '@/lib/send-tracked'
import { getBotTemplate } from '@/lib/bot-messages'
import { miniAppUrl } from '@/lib/mini-app'
import { dmGoalKeyboard } from '@/lib/onboarding'

// Дёргается pg_cron'ом каждые 15 минут (см. supabase/migrations/028).
//
// Четыре правила, все идемпотентные через onboarding_reminders (PK на tg_id+key):
//   1) onb_dm1_initial : DM-вопрос про цель, через 1ч после approve
//      (раньше отправлялся в webhook сразу — теперь отложен)
//   2) onb_wheel_3h    : напомнить про колесо, если не крутил за 3ч
//   3) onb_dm1_24h     : напомнить про DM-вопрос, если не ответил за 24ч
//   4) onb_full_72h    : напомнить добить мини-апп через 72ч после ответа в DM
//
// Все правила гейтят кандидатов по joined_at > cutoff. Cutoff пишется в
// bot_settings.onboarding_engagement_cutoff_at в миграции 028 (= now() на
// момент применения миграции). Так старичков не трогаем.

interface RuleReport {
  key: string
  candidates: number
  sent: number
  errors: number
  skipped: { reason: string; count: number }[]
}

const ALL_KEYS = ['onb_dm1_initial', 'onb_dm1_24h', 'onb_wheel_3h', 'onb_full_72h'] as const
type RuleKey = typeof ALL_KEYS[number]

// Анти-спам: если юзер писал боту/жал кнопку за последние 4 часа — пропускаем.
// Защищает от ситуаций когда юзер активно общается, а мы добиваем напоминалкой.
const RECENT_ACTIVITY_HOURS = 4

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  const xCron = req.headers.get('x-cron-secret')
  const expected = process.env.CRON_SECRET
  const ok = expected && (auth === `Bearer ${expected}` || xCron === expected)
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 1. Killswitch
  const { data: enabledRow } = await supabaseAdmin
    .from('bot_settings').select('value').eq('key', 'onboarding_reminders_enabled').maybeSingle()
  if (enabledRow?.value === false) {
    return NextResponse.json({ ok: true, skipped: 'globally_disabled' })
  }

  // 2. Cutoff: отсекаем участников до момента деплоя миграции 028.
  const { data: cutoffRow } = await supabaseAdmin
    .from('bot_settings').select('value').eq('key', 'onboarding_engagement_cutoff_at').maybeSingle()
  const cutoffRaw = cutoffRow?.value
  const cutoffIso = typeof cutoffRaw === 'string' ? cutoffRaw : null
  if (!cutoffIso) {
    return NextResponse.json({
      ok: false,
      error: 'cutoff_not_set',
      hint: 'Insert bot_settings.onboarding_engagement_cutoff_at first',
    }, { status: 500 })
  }

  // 3. Per-key enabled из bot_messages
  const { data: msgsRaw } = await supabaseAdmin
    .from('bot_messages').select('key, enabled').in('key', ALL_KEYS as unknown as string[])
  const enabledByKey = new Map<string, boolean>()
  for (const m of msgsRaw ?? []) enabledByKey.set(m.key, m.enabled !== false)

  const reports: RuleReport[] = []
  for (const key of ALL_KEYS) {
    if (enabledByKey.get(key) === false) {
      reports.push({ key, candidates: 0, sent: 0, errors: 0, skipped: [{ reason: 'rule_disabled', count: 1 }] })
      continue
    }
    try {
      reports.push(await runRule(key, cutoffIso))
    } catch (e) {
      console.error('onboarding-reminders: rule failed', key, e)
      reports.push({ key, candidates: 0, sent: 0, errors: 1, skipped: [{ reason: 'rule_error', count: 0 }] })
    }
  }

  return NextResponse.json({ ok: true, ran_at: new Date().toISOString(), reports })
}

async function runRule(key: RuleKey, cutoffIso: string): Promise<RuleReport> {
  // Each rule produces a list of candidate tg_ids and an optional auxiliary
  // "context" used for templating (имя, message_id и т.п.). Затем делаем общий
  // anti-spam / idempotency / send loop.

  const candidates = await pickCandidates(key, cutoffIso)
  if (!candidates.length) {
    return { key, candidates: 0, sent: 0, errors: 0, skipped: [] }
  }

  const tgIds = candidates.map(c => c.tgId)

  // Already-sent (idempotency)
  const { data: alreadyRaw } = await supabaseAdmin
    .from('onboarding_reminders')
    .select('tg_id')
    .eq('reminder_key', key)
    .in('tg_id', tgIds)
  const alreadySet = new Set((alreadyRaw ?? []).map(r => r.tg_id))

  // Recent activity (anti-spam) — любая активность юзера за окно.
  // Не фильтруем по event_type, все события в bot_events инициируются юзером.
  // Для onb_dm1_initial анти-спам не применяем: это первый и единственный
  // канал доставки вопроса, обязаны отправить даже если юзер активен.
  let recentSet = new Set<number>()
  if (key !== 'onb_dm1_initial') {
    const recentSince = new Date(Date.now() - RECENT_ACTIVITY_HOURS * 60 * 60 * 1000).toISOString()
    const { data: recentRaw } = await supabaseAdmin
      .from('bot_events')
      .select('tg_id')
      .in('tg_id', tgIds)
      .gte('created_at', recentSince)
    recentSet = new Set((recentRaw ?? []).map(r => r.tg_id))
  }

  // Имена для подстановки
  const { data: usersRaw } = await supabaseAdmin
    .from('bot_users')
    .select('tg_id, tg_first_name, tg_username')
    .in('tg_id', tgIds)
  const userByTg = new Map<number, { name: string }>()
  for (const u of usersRaw ?? []) {
    userByTg.set(u.tg_id, { name: u.tg_first_name || u.tg_username || 'друг' })
  }

  const skipReasons = new Map<string, number>()
  const bump = (reason: string) => skipReasons.set(reason, (skipReasons.get(reason) ?? 0) + 1)

  let sent = 0
  let errors = 0

  const miniAppHref = miniAppUrl()

  for (const c of candidates) {
    if (alreadySet.has(c.tgId)) { bump('already_sent'); continue }
    if (recentSet.has(c.tgId))  { bump('recent_activity'); continue }

    const name = userByTg.get(c.tgId)?.name || 'друг'

    let messageId: number | null = null
    let okFlag = false

    if (key === 'onb_dm1_initial' || key === 'onb_dm1_24h') {
      // DM-Q1 с callback-кнопками целей. Шаблон может быть пустым — тогда fallback.
      const tpl = await getBotTemplate(key, '', { name })
      if (!tpl.text.trim()) { bump('no_template'); continue }
      try {
        const res = await sendMessageWithKeyboard(
          c.tgId,
          tpl.text,
          buildCallbackKeyboard(dmGoalKeyboard()),
        ) as { ok: boolean; result?: { message_id: number } }
        okFlag = !!res?.ok
        messageId = res?.ok ? (res.result?.message_id ?? null) : null
      } catch (e) {
        console.error('onboarding-reminders: send failed', key, c.tgId, e)
      }
    } else {
      // URL-кнопочные напоминалки. Идут через sendTracked (учёт доставок + click).
      const tpl = await getBotTemplate(key, '', { name, mini_app_url: miniAppHref })
      if (!tpl.text.trim()) { bump('no_template'); continue }
      try {
        const res = await sendTracked(c.tgId, tpl.text, {
          campaign: 'onboarding_reminder',
          templateKey: key,
          buttons: tpl.buttons,
        })
        okFlag = !!res?.ok
        messageId = res?.ok ? (res.result?.message_id ?? null) : null
      } catch (e) {
        console.error('onboarding-reminders: send failed', key, c.tgId, e)
      }
    }

    // Идемпотентность: пишем строку независимо от ok=true/false. Заблокированные
    // DM не получится разблокировать ретраем, повторы только спамят логи.
    await supabaseAdmin.from('onboarding_reminders').insert({
      tg_id: c.tgId,
      reminder_key: key,
      message_id: messageId,
    }).select().maybeSingle()

    if (okFlag) sent++; else errors++
  }

  return {
    key,
    candidates: candidates.length,
    sent,
    errors,
    skipped: Array.from(skipReasons.entries()).map(([reason, count]) => ({ reason, count })),
  }
}

interface Candidate { tgId: number }

async function pickCandidates(key: RuleKey, cutoffIso: string): Promise<Candidate[]> {
  const nowIso = new Date().toISOString()

  if (key === 'onb_dm1_initial') {
    // dm1_due_at прошло, dm_step1_at пуст. Заодно гарантируем что юзер прошёл cutoff.
    // joined_at — в members; dm1_due_at — в onboarding_answers. Делаем JOIN через tg_id.
    const { data, error } = await supabaseAdmin
      .from('onboarding_answers')
      .select('tg_id, dm1_due_at, dm_step1_at, members:member_id(joined_at, status)')
      .lte('dm1_due_at', nowIso)
      .is('dm_step1_at', null)
      .limit(500)
    if (error) throw error
    return (data ?? [])
      .filter((r: unknown) => {
        const row = r as { members?: { joined_at?: string; status?: string } | null }
        const m = row.members
        if (!m) return false
        if (m.status !== 'active') return false
        if (!m.joined_at || m.joined_at <= cutoffIso) return false
        return true
      })
      .map((r) => ({ tgId: (r as { tg_id: number }).tg_id }))
  }

  if (key === 'onb_dm1_24h') {
    // 24ч после approve, dm_step1_at пуст, и onb_dm1_initial уже был отправлен
    // (без него вначале 24-час напоминалка не имеет смысла — юзер ещё не получил
    // первый вопрос). Реализация: смотрим members с joined_at между cutoff и
    // now-24h, фильтруем по onboarding_answers.dm_step1_at IS NULL.
    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: members, error } = await supabaseAdmin
      .from('members')
      .select('tg_id, joined_at, status')
      .gt('joined_at', cutoffIso)
      .lte('joined_at', cutoff24h)
      .eq('status', 'active')
      .limit(500)
    if (error) throw error
    if (!members?.length) return []

    const tgIds = members.map(m => m.tg_id)
    const [{ data: ans }, { data: initialSent }] = await Promise.all([
      supabaseAdmin.from('onboarding_answers').select('tg_id, dm_step1_at').in('tg_id', tgIds),
      supabaseAdmin.from('onboarding_reminders').select('tg_id').eq('reminder_key', 'onb_dm1_initial').in('tg_id', tgIds),
    ])
    const answered = new Set((ans ?? []).filter(a => a.dm_step1_at).map(a => a.tg_id))
    const initialOk = new Set((initialSent ?? []).map(r => r.tg_id))

    return members
      .filter(m => !answered.has(m.tg_id) && initialOk.has(m.tg_id))
      .map(m => ({ tgId: m.tg_id }))
  }

  if (key === 'onb_wheel_3h') {
    // 3ч после approve, ни одной крутки в wheel_spins.
    const cutoff3h = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
    const { data: members, error } = await supabaseAdmin
      .from('members')
      .select('tg_id, joined_at, status')
      .gt('joined_at', cutoffIso)
      .lte('joined_at', cutoff3h)
      .eq('status', 'active')
      .limit(500)
    if (error) throw error
    if (!members?.length) return []

    const tgIds = members.map(m => m.tg_id)
    const { data: spins } = await supabaseAdmin
      .from('wheel_spins').select('tg_id').in('tg_id', tgIds)
    const spun = new Set((spins ?? []).map(s => s.tg_id))

    return members.filter(m => !spun.has(m.tg_id)).map(m => ({ tgId: m.tg_id }))
  }

  if (key === 'onb_full_72h') {
    // 72ч после dm_step1_at, mini_app_done_at пуст.
    const cutoff72h = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString()
    const { data, error } = await supabaseAdmin
      .from('onboarding_answers')
      .select('tg_id, dm_step1_at, mini_app_done_at, members:member_id(joined_at, status)')
      .not('dm_step1_at', 'is', null)
      .lte('dm_step1_at', cutoff72h)
      .is('mini_app_done_at', null)
      .limit(500)
    if (error) throw error
    return (data ?? [])
      .filter((r: unknown) => {
        const row = r as { members?: { joined_at?: string; status?: string } | null }
        const m = row.members
        if (!m) return false
        if (m.status !== 'active') return false
        if (!m.joined_at || m.joined_at <= cutoffIso) return false
        return true
      })
      .map((r) => ({ tgId: (r as { tg_id: number }).tg_id }))
  }

  return []
}

