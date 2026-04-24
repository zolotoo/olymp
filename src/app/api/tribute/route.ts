import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendMessage, sendVideoNote } from '@/lib/telegram'
import { addMemory } from '@/lib/mem0'
import { getRankByMonth, loadTitles } from '@/lib/ranks'
import { getBotText } from '@/lib/bot-messages'

export async function POST(req: NextRequest) {
  // Verify Tribute signature (HMAC-SHA256)
  const signature = req.headers.get('trbt-signature')
  const body = await req.text()

  if (signature && process.env.TRIBUTE_API_KEY) {
    const { createHmac } = await import('crypto')
    const expected = createHmac('sha256', process.env.TRIBUTE_API_KEY).update(body).digest('hex')
    if (signature !== expected) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
  }

  const event = JSON.parse(body)
  const { name, payload } = event

  try {
    if (name === 'new_subscription') await onNewSubscription(payload)
    if (name === 'renewed_subscription') await onRenewed(payload)
    if (name === 'cancelled_subscription') await onCancelled(payload)
  } catch (err) {
    console.error('Tribute webhook error:', err)
  }

  return NextResponse.json({ ok: true })
}

// ─── New subscription ─────────────────────────────────────────────────────────
// "New" here means a fresh payment #1 for this subscription cycle.
// If the member previously churned, we reset the cycle (new 7-day timer, new
// subscription_count=1, no spin credits) but preserve points/history.
async function onNewSubscription(payload: TributePayload) {
  const tgId = payload.telegram_user_id
  if (!tgId) return

  const { data: existing } = await supabaseAdmin
    .from('members')
    .select('id, points, rank, status')
    .eq('tg_id', tgId)
    .maybeSingle()

  const nowIso = new Date().toISOString()

  if (!existing) {
    await supabaseAdmin.from('members').insert({
      tg_id: tgId,
      status: 'active',
      rank: 'newcomer',
      points: 0,
      welcome_sent: false,
      subscription_count: 1,
      spins_available: 0,
      first_week_spin_granted: false,
    })
  } else {
    // Returning user (active or churned). Start a fresh cycle:
    // reset the 7-day timer and subscription counter; keep points/history.
    await supabaseAdmin
      .from('members')
      .update({
        status: 'active',
        joined_at: nowIso,
        subscription_count: 1,
        spins_available: 0,
        first_week_spin_granted: false,
      })
      .eq('tg_id', tgId)

    if (existing.status === 'churned') {
      await supabaseAdmin.from('events_log').insert({
        member_id: existing.id,
        tg_id: tgId,
        event_type: 'rejoined',
        metadata: { subscription_id: payload.subscription_id },
      })
    }
  }

  const { data: member } = await supabaseAdmin
    .from('members')
    .select('id')
    .eq('tg_id', tgId)
    .single()

  if (member) {
    await supabaseAdmin.from('events_log').insert({
      member_id: member.id,
      tg_id: tgId,
      event_type: 'tribute_new_subscription',
      metadata: {
        subscription_id: payload.subscription_id,
        period: payload.period,
        price: payload.price,
        currency: payload.currency,
        expires_at: payload.expires_at,
      },
    })
  }

  addMemory(String(tgId), `Оформил подписку AI Olymp. Период: ${payload.period}, до ${payload.expires_at}`)

  // Send welcome
  const videoNoteId = process.env.TELEGRAM_WELCOME_VIDEO_NOTE_ID
  try {
    if (videoNoteId) {
      await sendVideoNote(tgId, videoNoteId)
      await delay(1500)
    }
    const congratsText = await getBotText(
      'l_subcongrats',
      `🎉 <b>Добро пожаловать в AI Олимп!</b>\n\n` +
      `Рад видеть тебя в клубе. Подписка активна до {expires_at}.\n\n` +
      `Инвайт-ссылка придёт отдельным сообщением от @Tribute — она одноразовая, не пересылай.\n\n` +
      `Как попадёшь в чат — пиши, задавай вопросы. ` +
      `За активность ты будешь получать фантики и расти в титуле. Вперёд! 🔥`,
      { expires_at: formatDate(payload.expires_at) },
    )
    await sendMessage(tgId, congratsText)

    await supabaseAdmin
      .from('members')
      .update({ welcome_sent: true })
      .eq('tg_id', tgId)
  } catch {
    // DM failed — user hasn't started bot yet, will get welcome on /start
  }
}

// ─── Renewed subscription ─────────────────────────────────────────────────────
// Each renewal: +10 фантиков and +1 spin credit. Increments subscription_count.
const RENEWAL_BONUS_POINTS = 10

async function onRenewed(payload: TributePayload) {
  const tgId = payload.telegram_user_id
  if (!tgId) return

  const { data: member } = await supabaseAdmin
    .from('members')
    .select('id, points, rank, spins_available, subscription_count')
    .eq('tg_id', tgId)
    .maybeSingle()

  if (!member) return

  const prevRank = member.rank as import('@/lib/types').MemberRank
  const newCount = (member.subscription_count ?? 0) + 1
  const newRank = getRankByMonth(newCount)
  const newSpins = (member.spins_available ?? 0) + 1

  // Бонусы за переход титула берём из БД.
  const titles = await loadTitles()
  const titleBonus = newRank !== prevRank ? (titles[newRank]?.bonus_points ?? 0) : 0
  const newPoints = member.points + RENEWAL_BONUS_POINTS + titleBonus

  await supabaseAdmin
    .from('members')
    .update({
      points: newPoints,
      rank: newRank,
      status: 'active',
      spins_available: newSpins,
      subscription_count: newCount,
    })
    .eq('tg_id', tgId)

  await supabaseAdmin.from('points_log').insert({
    member_id: member.id,
    tg_id: tgId,
    points: RENEWAL_BONUS_POINTS,
    reason: 'subscription_renewal',
  })

  if (titleBonus > 0) {
    await supabaseAdmin.from('points_log').insert({
      member_id: member.id,
      tg_id: tgId,
      points: titleBonus,
      reason: `title_bonus:${newRank}`,
    })
  }

  await supabaseAdmin.from('events_log').insert([
    {
      member_id: member.id,
      tg_id: tgId,
      event_type: 'tribute_renewed',
      metadata: { expires_at: payload.expires_at, period: payload.period, subscription_count: newCount },
    },
    {
      member_id: member.id,
      tg_id: tgId,
      event_type: 'spin_credit_granted',
      metadata: { reason: 'renewal', subscription_count: newCount },
    },
  ])

  const titleMsg = newRank !== prevRank
    ? `\n\n🎖 Новый титул: <b>${titles[newRank].label}</b>${titleBonus > 0 ? ` (+${titleBonus} фантиков)` : ''}`
    : ''

  try {
    const renewText = await getBotText(
      'l_renewmsg',
      `✅ <b>Подписка продлена!</b>\n\n` +
      `Спасибо что остаёшься в AI Олимп.\n` +
      `Активна до {expires_at}\n\n` +
      `+{renewal_bonus} фантиков за верность и открылась ещё одна попытка в колесе 🎡{title_msg}`,
      {
        expires_at: formatDate(payload.expires_at),
        renewal_bonus: RENEWAL_BONUS_POINTS,
        title_msg: titleMsg,
      },
    )
    await sendMessage(tgId, renewText)
  } catch { /* DM blocked */ }
}

// ─── Cancelled subscription ───────────────────────────────────────────────────
async function onCancelled(payload: TributePayload) {
  const tgId = payload.telegram_user_id
  if (!tgId) return

  const { data: member } = await supabaseAdmin
    .from('members')
    .select('id')
    .eq('tg_id', tgId)
    .maybeSingle()

  if (member) {
    // Clear spin credits and reset the 7-day flag so a future re-subscription
    // starts a fresh cycle. Points and history stay intact.
    await supabaseAdmin
      .from('members')
      .update({
        status: 'churned',
        spins_available: 0,
        first_week_spin_granted: false,
      })
      .eq('tg_id', tgId)

    await supabaseAdmin.from('events_log').insert({
      member_id: member.id,
      tg_id: tgId,
      event_type: 'tribute_cancelled',
      metadata: { subscription_id: payload.subscription_id },
    })
  }

  // Notify admin
  const adminId = process.env.TELEGRAM_ADMIN_CHAT_ID
  if (adminId) {
    await sendMessage(
      adminId,
      `❌ Отписка: tg_id <code>${tgId}</code>\n` +
      `Подписка: ${payload.subscription_name || payload.subscription_id}`
    )
  }

  try {
    const farewellText = await getBotText(
      'l_farewell',
      `Жаль видеть тебя уходящим из AI Olymp.\n\n` +
      `Если что-то пошло не так или есть обратная связь — напиши, всегда слушаю.`,
      {},
    )
    await sendMessage(tgId, farewellText)
  } catch { /* DM blocked */ }
}

// ─── Utils ────────────────────────────────────────────────────────────────────
function formatDate(iso: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' })
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

interface TributePayload {
  telegram_user_id: number
  subscription_id: number
  subscription_name?: string
  period: string
  price: number
  currency: string
  expires_at: string
}
