import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendTracked } from '@/lib/send-tracked'
import { getBotTemplate } from '@/lib/bot-messages'

// Дёргается pg_cron'ом каждые 5 минут (см. supabase/migrations/021_followups_cron.sql).
// Идёт по правилам ниже, для каждой пары (parent_template, trigger, delay):
//   1) находит доставки исходного сообщения старше delay
//   2) исключает тех, кто уже оплатил, ответил боту в DM или уже получил этот догон
//   3) проверяет триггер (был клик по кнопке за окно или нет)
//   4) шлёт текст из bot_messages[followup_key], логирует в followup_sends
//
// Правила синхронизированы с buildFollowups() в src/components/TreeClient.tsx
// — если добавляешь новый узел в дерево, добавь и сюда.

type Trigger = 'clicked' | 'no_click'

interface FollowupRule {
  followup_key: string
  parent_key: string
  trigger: Trigger
  delay_minutes: number
}

const PARENT_KEYS = ['l_sales', 'l_sales_hochy', 'l_sales_promts', 'l_sales_claude'] as const

const RULES: FollowupRule[] = PARENT_KEYS.flatMap(parent => [
  { followup_key: `${parent}_fu_click_15m`,   parent_key: parent, trigger: 'clicked',  delay_minutes: 15 },
  { followup_key: `${parent}_fu_click_24h`,   parent_key: parent, trigger: 'clicked',  delay_minutes: 24 * 60 },
  { followup_key: `${parent}_fu_noclick_15m`, parent_key: parent, trigger: 'no_click', delay_minutes: 15 },
  { followup_key: `${parent}_fu_noclick_24h`, parent_key: parent, trigger: 'no_click', delay_minutes: 24 * 60 },
])

// Сколько максимум назад смотрим доставки. Защищает от того что включили
// фичу — и за одно срабатывание разлили старые сообщения недельной давности.
const LOOKBACK_DAYS = 7

interface RuleReport {
  followup_key: string
  candidates: number
  sent: number
  skipped: { reason: string; count: number }[]
  errors: number
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  const xCron = req.headers.get('x-cron-secret')
  const expected = process.env.CRON_SECRET
  const ok = expected && (auth === `Bearer ${expected}` || xCron === expected)
  if (!ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const reports: RuleReport[] = []
  for (const rule of RULES) {
    try {
      reports.push(await runRule(rule))
    } catch (e) {
      console.error('followup rule failed', rule.followup_key, e)
      reports.push({
        followup_key: rule.followup_key,
        candidates: 0, sent: 0, errors: 1,
        skipped: [{ reason: 'rule_error', count: 0 }],
      })
    }
  }

  return NextResponse.json({
    ok: true,
    ran_at: new Date().toISOString(),
    reports,
  })
}

async function runRule(rule: FollowupRule): Promise<RuleReport> {
  const now = Date.now()
  const cutoff = new Date(now - rule.delay_minutes * 60_000).toISOString()
  const lookback = new Date(now - LOOKBACK_DAYS * 24 * 60 * 60_000).toISOString()

  // 1. Кандидаты — доставки исходного шаблона старше delay (но не старше lookback).
  //    Берём первую доставку на юзера (если их несколько — нас интересует та,
  //    с момента которой пошёл отсчёт).
  const { data: deliveriesRaw } = await supabaseAdmin
    .from('message_deliveries')
    .select('tg_id, sent_at')
    .eq('template_key', rule.parent_key)
    .eq('delivered', true)
    .lte('sent_at', cutoff)
    .gte('sent_at', lookback)
    .order('sent_at', { ascending: true })

  const deliveries = (deliveriesRaw ?? []) as { tg_id: number; sent_at: string }[]

  // dedup: одна (самая ранняя в окне) доставка на юзера
  const earliestByUser = new Map<number, string>()
  for (const d of deliveries) {
    if (!earliestByUser.has(d.tg_id)) earliestByUser.set(d.tg_id, d.sent_at)
  }
  const candidates = Array.from(earliestByUser.entries()).map(([tg_id, sent_at]) => ({ tg_id, sent_at }))

  if (!candidates.length) {
    return { followup_key: rule.followup_key, candidates: 0, sent: 0, errors: 0, skipped: [] }
  }

  const tgIds = candidates.map(c => c.tg_id)

  // 2. Кому уже отправлен этот догон (idempotency)
  const { data: alreadyRaw } = await supabaseAdmin
    .from('followup_sends')
    .select('tg_id')
    .eq('followup_key', rule.followup_key)
    .in('tg_id', tgIds)
  const alreadySet = new Set((alreadyRaw ?? []).map(r => r.tg_id))

  // 3. Кто уже active (= оплатил)
  const { data: membersRaw } = await supabaseAdmin
    .from('members')
    .select('tg_id, status')
    .in('tg_id', tgIds)
  const activeSet = new Set((membersRaw ?? []).filter(m => m.status === 'active').map(m => m.tg_id))

  // 4. Шаблон догона. Если его нет в БД — этот догон ещё не настроен в /flow,
  //    тихо скипаем чтобы не спамить пустотой.
  const tpl = await getBotTemplate(rule.followup_key, '')
  const hasTemplate = !!tpl.text.trim()

  const skipReasons = new Map<string, number>()
  const bump = (k: string) => skipReasons.set(k, (skipReasons.get(k) ?? 0) + 1)

  let sent = 0
  let errors = 0

  for (const c of candidates) {
    if (alreadySet.has(c.tg_id))  { bump('already_sent'); continue }
    if (activeSet.has(c.tg_id))   { bump('paid'); continue }
    if (!hasTemplate)             { bump('no_template'); continue }

    // 5. События юзера ПОСЛЕ исходной доставки. Нужно для двух проверок:
    //    - replied  : ответил в DM или повторно нажал /start → не спамим
    //    - clicked  : был ли клик по кнопке (для триггера)
    const { data: eventsRaw } = await supabaseAdmin
      .from('bot_events')
      .select('event_type')
      .eq('tg_id', c.tg_id)
      .gt('created_at', c.sent_at)
      .in('event_type', ['message', 'command:/start', 'link_click'])

    const events = eventsRaw ?? []
    const replied = events.some(e => e.event_type === 'message' || e.event_type === 'command:/start')
    const clicked = events.some(e => e.event_type === 'link_click')

    if (replied) { bump('replied'); continue }
    if (rule.trigger === 'clicked'  && !clicked) { bump('no_click'); continue }
    if (rule.trigger === 'no_click' &&  clicked) { bump('did_click'); continue }

    // 6. Подставить имя в текст. Берём из bot_users (там есть всегда — юзер
    //    точно писал боту, раз есть message_delivery).
    const { data: bu } = await supabaseAdmin
      .from('bot_users')
      .select('tg_first_name, tg_username')
      .eq('tg_id', c.tg_id)
      .maybeSingle()
    const name = bu?.tg_first_name || bu?.tg_username || 'друг'
    const text = tpl.text.replace(/\{name\}/g, name).replace(/\[Имя\]/g, name)

    // 7. Шлём
    const result = await sendTracked(c.tg_id, text, {
      campaign: 'followup',
      templateKey: rule.followup_key,
      buttons: tpl.buttons,
    })

    // 8. Записываем независимо от ok — если DM заблокирован, не пытаемся
    //    бесконечно (одна попытка). error_text уже логируется в message_deliveries.
    await supabaseAdmin.from('followup_sends').insert({
      tg_id: c.tg_id,
      followup_key: rule.followup_key,
      message_id: result?.ok ? (result.result?.message_id ?? null) : null,
    })

    if (result?.ok) sent++
    else errors++
  }

  return {
    followup_key: rule.followup_key,
    candidates: candidates.length,
    sent,
    errors,
    skipped: Array.from(skipReasons.entries()).map(([reason, count]) => ({ reason, count })),
  }
}
