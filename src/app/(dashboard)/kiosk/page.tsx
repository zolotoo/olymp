import { supabaseAdmin } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'

export const metadata = { title: 'Киоск — AI Олимп' }
export const dynamic = 'force-dynamic'

const glass = {
  background: 'rgba(255,255,255,0.66)',
  backdropFilter: 'blur(28px) saturate(160%)',
  WebkitBackdropFilter: 'blur(28px) saturate(160%)',
  border: '1px solid rgba(255,255,255,0.52)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.07)',
} as const

async function saveItem(formData: FormData) {
  'use server'
  const key = String(formData.get('key') ?? '').trim()
  if (!key) return
  const title = String(formData.get('title') ?? '')
  const description = String(formData.get('description') ?? '')
  const price = Number(formData.get('price') ?? 0)
  const kind = String(formData.get('kind') ?? 'info')
  const emoji = String(formData.get('emoji') ?? '')
  const image_url = String(formData.get('image_url') ?? '') || null
  const sort = Number(formData.get('sort') ?? 0)
  const active = formData.get('active') === 'on'

  await supabaseAdmin.from('shop_items').upsert({
    key, title, description, price, kind, emoji, image_url, sort,
    active, updated_at: new Date().toISOString(),
  })
  revalidatePath('/kiosk')
}

async function deleteItem(formData: FormData) {
  'use server'
  const key = String(formData.get('key') ?? '')
  if (!key) return
  await supabaseAdmin.from('shop_items').delete().eq('key', key)
  revalidatePath('/kiosk')
}

async function addCodes(formData: FormData) {
  'use server'
  const itemKey = String(formData.get('item_key') ?? '')
  const raw = String(formData.get('codes') ?? '')
  if (!itemKey || !raw.trim()) return
  const codes = raw.split(/[\n,\s]+/).map(c => c.trim()).filter(Boolean)
  if (!codes.length) return
  await supabaseAdmin.from('promo_codes').insert(codes.map(code => ({ item_key: itemKey, code })))
  revalidatePath('/kiosk')
}

async function deleteCode(formData: FormData) {
  'use server'
  const id = String(formData.get('id') ?? '')
  if (!id) return
  await supabaseAdmin.from('promo_codes').delete().eq('id', id)
  revalidatePath('/kiosk')
}

export default async function KioskAdminPage() {
  const [{ data: items }, { data: codes }, { data: purchases }] = await Promise.all([
    supabaseAdmin.from('shop_items').select('*').order('sort'),
    supabaseAdmin.from('promo_codes').select('*').order('created_at', { ascending: false }),
    supabaseAdmin.from('shop_purchases').select('*').order('created_at', { ascending: false }).limit(20),
  ])

  const codesByItem: Record<string, typeof codes> = {}
  for (const c of codes ?? []) {
    ;(codesByItem[c.item_key] ??= [] as NonNullable<typeof codes>).push(c)
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="rounded-2xl px-6 py-5" style={glass}>
        <div className="text-xs font-semibold uppercase mb-2" style={{ color: 'rgba(28,28,30,0.45)', letterSpacing: '0.8px' }}>
          Магазин
        </div>
        <h1 className="text-3xl font-bold" style={{ color: '#1C1C1E', letterSpacing: '-1px' }}>Киоск</h1>
        <p className="text-sm mt-1" style={{ color: 'rgba(28,28,30,0.55)' }}>
          Товары отображаются в мини-аппе у участников. Для товаров с типом <code>promo_code</code> нужно добавить промокоды в пул — они выдаются по одному при покупке.
        </p>
      </div>

      <div className="rounded-2xl p-6" style={glass}>
        <h2 className="text-lg font-bold mb-4" style={{ color: '#1C1C1E' }}>Товары</h2>
        <div className="space-y-5">
          {(items ?? []).map(i => {
            const pool = codesByItem[i.key] ?? []
            const unclaimed = pool.filter(c => !c.claimed_by)
            return (
              <div key={i.key} className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.45)' }}>
                <form action={saveItem} className="grid sm:grid-cols-6 gap-2 items-end">
                  <input type="hidden" name="key" value={i.key} />
                  <label className="text-xs sm:col-span-2" style={{ color: 'rgba(28,28,30,0.6)' }}>
                    Название
                    <input name="title" defaultValue={i.title} className="mt-1 w-full rounded-lg px-3 py-2 text-sm" style={{ background: '#fff', border: '1px solid rgba(28,28,30,0.1)' }} />
                  </label>
                  <label className="text-xs" style={{ color: 'rgba(28,28,30,0.6)' }}>
                    Цена (фантики)
                    <input name="price" type="number" defaultValue={i.price} className="mt-1 w-full rounded-lg px-3 py-2 text-sm" style={{ background: '#fff', border: '1px solid rgba(28,28,30,0.1)' }} />
                  </label>
                  <label className="text-xs" style={{ color: 'rgba(28,28,30,0.6)' }}>
                    Тип
                    <select name="kind" defaultValue={i.kind} className="mt-1 w-full rounded-lg px-3 py-2 text-sm" style={{ background: '#fff', border: '1px solid rgba(28,28,30,0.1)' }}>
                      <option value="promo_code">promo_code</option>
                      <option value="wheel_spin">wheel_spin</option>
                      <option value="info">info</option>
                    </select>
                  </label>
                  <label className="text-xs" style={{ color: 'rgba(28,28,30,0.6)' }}>
                    Эмодзи
                    <input name="emoji" defaultValue={i.emoji ?? ''} className="mt-1 w-full rounded-lg px-3 py-2 text-sm" style={{ background: '#fff', border: '1px solid rgba(28,28,30,0.1)' }} />
                  </label>
                  <label className="text-xs" style={{ color: 'rgba(28,28,30,0.6)' }}>
                    Порядок
                    <input name="sort" type="number" defaultValue={i.sort} className="mt-1 w-full rounded-lg px-3 py-2 text-sm" style={{ background: '#fff', border: '1px solid rgba(28,28,30,0.1)' }} />
                  </label>
                  <label className="text-xs sm:col-span-5" style={{ color: 'rgba(28,28,30,0.6)' }}>
                    Описание
                    <input name="description" defaultValue={i.description} className="mt-1 w-full rounded-lg px-3 py-2 text-sm" style={{ background: '#fff', border: '1px solid rgba(28,28,30,0.1)' }} />
                  </label>
                  <label className="text-xs" style={{ color: 'rgba(28,28,30,0.6)' }}>
                    Картинка (URL)
                    <input name="image_url" defaultValue={i.image_url ?? ''} className="mt-1 w-full rounded-lg px-3 py-2 text-sm" style={{ background: '#fff', border: '1px solid rgba(28,28,30,0.1)' }} />
                  </label>
                  <label className="text-xs flex items-center gap-2 sm:col-span-2" style={{ color: 'rgba(28,28,30,0.6)' }}>
                    <input name="active" type="checkbox" defaultChecked={i.active} />
                    Активен
                  </label>
                  <div className="flex gap-2 sm:col-span-4 justify-end">
                    <button type="submit" className="rounded-full px-4 py-2 text-xs font-semibold" style={{ background: '#0A84FF', color: '#fff', border: 'none', cursor: 'pointer' }}>
                      Сохранить
                    </button>
                  </div>
                </form>

                {i.kind === 'promo_code' && (
                  <div className="mt-4 rounded-lg p-3" style={{ background: 'rgba(10,132,255,0.05)' }}>
                    <div className="text-xs font-semibold mb-2" style={{ color: 'rgba(28,28,30,0.7)' }}>
                      Промокоды · всего {pool.length}, свободно {unclaimed.length}
                    </div>
                    <form action={addCodes} className="flex gap-2 items-start mb-2">
                      <input type="hidden" name="item_key" value={i.key} />
                      <textarea
                        name="codes"
                        rows={2}
                        placeholder="Промокоды — по одному на строку или через запятую"
                        className="flex-1 rounded-lg px-3 py-2 text-sm font-mono"
                        style={{ background: '#fff', border: '1px solid rgba(28,28,30,0.1)' }}
                      />
                      <button type="submit" className="rounded-full px-4 py-2 text-xs font-semibold" style={{ background: '#34C759', color: '#fff', border: 'none', cursor: 'pointer' }}>
                        Добавить
                      </button>
                    </form>
                    {pool.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {pool.map(c => (
                          <form key={c.id} action={deleteCode} className="inline-flex">
                            <input type="hidden" name="id" value={c.id} />
                            <button
                              type="submit"
                              title={c.claimed_by ? `Выдан ${c.claimed_by}` : 'Удалить'}
                              className="text-xs font-mono rounded px-2 py-1"
                              style={{
                                background: c.claimed_by ? 'rgba(28,28,30,0.08)' : '#fff',
                                color: c.claimed_by ? 'rgba(28,28,30,0.4)' : '#1C1C1E',
                                textDecoration: c.claimed_by ? 'line-through' : 'none',
                                border: '1px solid rgba(28,28,30,0.1)',
                                cursor: 'pointer',
                              }}
                            >
                              {c.code}
                            </button>
                          </form>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-3 flex justify-end">
                  <form action={deleteItem}>
                    <input type="hidden" name="key" value={i.key} />
                    <button type="submit" className="text-xs" style={{ color: '#FF3B30', background: 'none', border: 'none', cursor: 'pointer' }}>
                      Удалить товар
                    </button>
                  </form>
                </div>
              </div>
            )
          })}

          <form action={saveItem} className="rounded-xl p-4" style={{ background: 'rgba(52,199,89,0.06)', border: '1px dashed rgba(52,199,89,0.4)' }}>
            <div className="text-sm font-semibold mb-3" style={{ color: '#1C1C1E' }}>Новый товар</div>
            <div className="grid sm:grid-cols-6 gap-2 items-end">
              <label className="text-xs" style={{ color: 'rgba(28,28,30,0.6)' }}>
                Ключ
                <input name="key" required placeholder="consult_30" className="mt-1 w-full rounded-lg px-3 py-2 text-sm font-mono" style={{ background: '#fff', border: '1px solid rgba(28,28,30,0.1)' }} />
              </label>
              <label className="text-xs sm:col-span-2" style={{ color: 'rgba(28,28,30,0.6)' }}>
                Название
                <input name="title" required className="mt-1 w-full rounded-lg px-3 py-2 text-sm" style={{ background: '#fff', border: '1px solid rgba(28,28,30,0.1)' }} />
              </label>
              <label className="text-xs" style={{ color: 'rgba(28,28,30,0.6)' }}>
                Цена
                <input name="price" type="number" required className="mt-1 w-full rounded-lg px-3 py-2 text-sm" style={{ background: '#fff', border: '1px solid rgba(28,28,30,0.1)' }} />
              </label>
              <label className="text-xs" style={{ color: 'rgba(28,28,30,0.6)' }}>
                Тип
                <select name="kind" defaultValue="promo_code" className="mt-1 w-full rounded-lg px-3 py-2 text-sm" style={{ background: '#fff', border: '1px solid rgba(28,28,30,0.1)' }}>
                  <option value="promo_code">promo_code</option>
                  <option value="wheel_spin">wheel_spin</option>
                  <option value="info">info</option>
                </select>
              </label>
              <label className="text-xs" style={{ color: 'rgba(28,28,30,0.6)' }}>
                Порядок
                <input name="sort" type="number" defaultValue={100} className="mt-1 w-full rounded-lg px-3 py-2 text-sm" style={{ background: '#fff', border: '1px solid rgba(28,28,30,0.1)' }} />
              </label>
              <label className="text-xs sm:col-span-4" style={{ color: 'rgba(28,28,30,0.6)' }}>
                Описание
                <input name="description" className="mt-1 w-full rounded-lg px-3 py-2 text-sm" style={{ background: '#fff', border: '1px solid rgba(28,28,30,0.1)' }} />
              </label>
              <label className="text-xs" style={{ color: 'rgba(28,28,30,0.6)' }}>
                Эмодзи
                <input name="emoji" defaultValue="🎁" className="mt-1 w-full rounded-lg px-3 py-2 text-sm" style={{ background: '#fff', border: '1px solid rgba(28,28,30,0.1)' }} />
              </label>
              <label className="text-xs flex items-center gap-2" style={{ color: 'rgba(28,28,30,0.6)' }}>
                <input name="active" type="checkbox" defaultChecked />
                Активен
              </label>
            </div>
            <div className="mt-3 flex justify-end">
              <button type="submit" className="rounded-full px-4 py-2 text-xs font-semibold" style={{ background: '#34C759', color: '#fff', border: 'none', cursor: 'pointer' }}>
                Создать
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="rounded-2xl p-6" style={glass}>
        <h2 className="text-lg font-bold mb-3" style={{ color: '#1C1C1E' }}>Последние покупки</h2>
        {purchases && purchases.length > 0 ? (
          <div className="space-y-1.5">
            {purchases.map(p => (
              <div key={p.id} className="flex items-center justify-between text-sm rounded-lg px-3 py-2" style={{ background: 'rgba(255,255,255,0.5)' }}>
                <span className="font-mono text-xs" style={{ color: 'rgba(28,28,30,0.5)' }}>{new Date(p.created_at).toLocaleString('ru-RU')}</span>
                <span>{p.item_key}</span>
                <span style={{ color: 'rgba(28,28,30,0.5)' }}>tg {p.tg_id}</span>
                <span className="font-semibold" style={{ color: '#FF9500' }}>−{p.price_paid}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm" style={{ color: 'rgba(28,28,30,0.45)' }}>Покупок пока нет.</div>
        )}
      </div>
    </div>
  )
}
