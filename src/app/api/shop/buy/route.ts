import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthedUser } from '@/lib/telegram-auth'
import { sendMessage } from '@/lib/telegram'

// POST /api/shop/buy — списывает фантики, выдаёт предмет.
// Для promo_code клеймит код из пула; для wheel_spin начисляет +1 попытку.
export async function POST(req: NextRequest) {
  const initData = req.headers.get('x-telegram-init-data')
  const user = getAuthedUser(initData)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null) as { item_key?: string } | null
  const itemKey = body?.item_key
  if (!itemKey) return NextResponse.json({ error: 'bad_request' }, { status: 400 })

  const { data: item } = await supabaseAdmin
    .from('shop_items')
    .select('*')
    .eq('key', itemKey)
    .eq('active', true)
    .maybeSingle()
  if (!item) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const { data: member } = await supabaseAdmin
    .from('members')
    .select('id, points, spins_available')
    .eq('tg_id', user.id)
    .maybeSingle()
  if (!member) return NextResponse.json({ error: 'not_member' }, { status: 403 })

  if (member.points < item.price) {
    return NextResponse.json({ error: 'insufficient_points', missing: item.price - member.points }, { status: 409 })
  }

  let payload: Record<string, unknown> = {}
  let dmText = ''

  if (item.kind === 'promo_code') {
    const { data: code } = await supabaseAdmin
      .from('promo_codes')
      .select('id, code')
      .eq('item_key', itemKey)
      .is('claimed_by', null)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (!code) return NextResponse.json({ error: 'out_of_stock' }, { status: 409 })

    const { error: claimErr } = await supabaseAdmin
      .from('promo_codes')
      .update({ claimed_by: user.id, claimed_at: new Date().toISOString() })
      .eq('id', code.id)
      .is('claimed_by', null)
    if (claimErr) return NextResponse.json({ error: 'claim_failed' }, { status: 500 })

    payload = { promo_code: code.code }
    dmText = `🎟 <b>${item.title}</b>\n\nТвой промокод: <code>${code.code}</code>\n\n${item.description}`
  } else if (item.kind === 'wheel_spin') {
    await supabaseAdmin
      .from('members')
      .update({ spins_available: (member.spins_available ?? 0) + 1 })
      .eq('id', member.id)
    payload = { spin_granted: true }
    dmText = `🎡 <b>${item.title}</b>\n\nПопытка в Колесе добавлена. Открывай мини-аппку и крути!`
  } else {
    payload = { info: item.title }
    dmText = `✅ <b>${item.title}</b>\n\n${item.description}`
  }

  // Списываем фантики и логируем покупку.
  await supabaseAdmin
    .from('members')
    .update({ points: member.points - item.price })
    .eq('id', member.id)

  await supabaseAdmin.from('points_log').insert({
    member_id: member.id,
    tg_id: user.id,
    points: -item.price,
    reason: `shop:${itemKey}`,
  })

  await supabaseAdmin.from('shop_purchases').insert({
    member_id: member.id,
    tg_id: user.id,
    item_key: itemKey,
    price_paid: item.price,
    payload,
  })

  try { await sendMessage(user.id, dmText) } catch { /* DM blocked */ }

  // Для «ручных» товаров (info) — уведомить админа, чтобы он знал кого обработать.
  if (item.kind === 'info') {
    const adminId = process.env.TELEGRAM_ADMIN_CHAT_ID
    if (adminId) {
      const name = [user.first_name, user.username && `@${user.username}`].filter(Boolean).join(' ') || String(user.id)
      try {
        await sendMessage(
          adminId,
          `🛍 <b>Покупка в киоске</b>\n\n` +
          `${item.title}\n` +
          `Купил: ${name} (<code>${user.id}</code>)\n` +
          `Списано: ${item.price} фантиков`
        )
      } catch { /* ignore */ }
    }
  }

  return NextResponse.json({ ok: true, payload, pointsLeft: member.points - item.price })
}
