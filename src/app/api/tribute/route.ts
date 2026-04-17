import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendMessage, sendVideoNote } from '@/lib/telegram'
import { addMemory } from '@/lib/mem0'
import { getRank } from '@/lib/ranks'

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
async function onNewSubscription(payload: TributePayload) {
  const tgId = payload.telegram_user_id
  if (!tgId) return

  // Upsert member
  const { data: existing } = await supabaseAdmin
    .from('members')
    .select('id, points, rank')
    .eq('tg_id', tgId)
    .maybeSingle()

  if (!existing) {
    await supabaseAdmin.from('members').insert({
      tg_id: tgId,
      status: 'active',
      rank: 'newcomer',
      points: 0,
      welcome_sent: false,
    })
  } else {
    // Re-subscription — reactivate
    await supabaseAdmin
      .from('members')
      .update({ status: 'active' })
      .eq('tg_id', tgId)
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
    await sendMessage(
      tgId,
      `🎉 <b>Добро пожаловать в AI Олимп!</b>\n\n` +
      `Рад видеть тебя в клубе. Подписка активна до ${formatDate(payload.expires_at)}.\n\n` +
      `Инвайт-ссылка придёт отдельным сообщением от @Tribute — она одноразовая, не пересылай.\n\n` +
      `Как попадёшь в чат — пиши, задавай вопросы. ` +
      `За активность ты будешь получать 🍃 листики и расти в ранге. Вперёд! 🔥`
    )

    await supabaseAdmin
      .from('members')
      .update({ welcome_sent: true })
      .eq('tg_id', tgId)
  } catch {
    // DM failed — user hasn't started bot yet, will get welcome on /start
  }
}

// ─── Renewed subscription ─────────────────────────────────────────────────────
async function onRenewed(payload: TributePayload) {
  const tgId = payload.telegram_user_id
  if (!tgId) return

  const { data: member } = await supabaseAdmin
    .from('members')
    .select('id, points')
    .eq('tg_id', tgId)
    .maybeSingle()

  if (member) {
    // Bonus points for renewal
    const bonus = 100
    const newPoints = member.points + bonus
    await supabaseAdmin
      .from('members')
      .update({ points: newPoints, rank: getRank(newPoints), status: 'active' })
      .eq('tg_id', tgId)

    await supabaseAdmin.from('points_log').insert({
      member_id: member.id,
      tg_id: tgId,
      points: bonus,
      reason: 'subscription_renewal',
    })

    await supabaseAdmin.from('events_log').insert({
      member_id: member.id,
      tg_id: tgId,
      event_type: 'tribute_renewed',
      metadata: { expires_at: payload.expires_at, period: payload.period },
    })
  }

  try {
    await sendMessage(
      tgId,
      `✅ <b>Подписка продлена!</b>\n\n` +
      `Спасибо что остаёшься в AI Olymp — это важно.\n` +
      `Активна до ${formatDate(payload.expires_at)}\n\n` +
      `+100 листиков за верность 🍃`
    )
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
    await supabaseAdmin
      .from('members')
      .update({ status: 'churned' })
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
    await sendMessage(
      tgId,
      `Жаль видеть тебя уходящим из AI Olymp.\n\n` +
      `Если что-то пошло не так или есть обратная связь — напиши, всегда слушаю.`
    )
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
