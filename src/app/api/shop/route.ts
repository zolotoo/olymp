import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthedUser } from '@/lib/telegram-auth'

// GET /api/shop — список товаров киоска + баланс пользователя + тексты.
export async function GET(req: NextRequest) {
  const initData = req.headers.get('x-telegram-init-data')
  const user = getAuthedUser(initData)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const [{ data: member }, { data: items }, { data: texts }] = await Promise.all([
    supabaseAdmin.from('members').select('id, points').eq('tg_id', user.id).maybeSingle(),
    supabaseAdmin.from('shop_items').select('*').eq('active', true).order('sort', { ascending: true }),
    supabaseAdmin.from('app_texts').select('key, content').in('key', [
      'kiosk.headline', 'kiosk.subtitle', 'kiosk.balance',
      'kiosk.sold_out', 'kiosk.buy', 'kiosk.insufficient', 'kiosk.purchase_ok',
    ]),
  ])

  // Для promo_code товаров проверяем наличие хотя бы одного неклеймнутого кода в пуле.
  const promoKeys = (items ?? []).filter(i => i.kind === 'promo_code').map(i => i.key)
  const stock: Record<string, number> = {}
  if (promoKeys.length) {
    const { data: rows } = await supabaseAdmin
      .from('promo_codes')
      .select('item_key')
      .is('claimed_by', null)
      .in('item_key', promoKeys)
    for (const r of rows ?? []) stock[r.item_key] = (stock[r.item_key] ?? 0) + 1
  }

  const textMap: Record<string, string> = {}
  for (const t of texts ?? []) textMap[t.key] = t.content

  return NextResponse.json({
    points: member?.points ?? 0,
    items: (items ?? []).map(i => ({
      key: i.key,
      title: i.title,
      description: i.description,
      price: i.price,
      kind: i.kind,
      emoji: i.emoji ?? '',
      image_url: i.image_url,
      in_stock: i.kind === 'promo_code' ? (stock[i.key] ?? 0) > 0 : true,
    })),
    texts: textMap,
  })
}
