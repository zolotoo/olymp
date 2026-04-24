import FortuneWheel from '@/components/FortuneWheel'
import { supabaseAdmin } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'

export const metadata = { title: 'Колесо удачи · AI Олимп' }
export const dynamic = 'force-dynamic'

const glass = {
  background: 'rgba(255,255,255,0.66)',
  backdropFilter: 'blur(28px) saturate(160%)',
  WebkitBackdropFilter: 'blur(28px) saturate(160%)',
  border: '1px solid rgba(255,255,255,0.52)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.07)',
} as const

async function savePrize(formData: FormData) {
  'use server'
  const key = String(formData.get('key') ?? '').trim()
  if (!key) return
  const num = (name: string) => {
    const v = formData.get(name)
    if (v === null || v === '') return null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  await supabaseAdmin.from('wheel_prizes').upsert({
    key,
    sort: num('sort') ?? 0,
    label: String(formData.get('label') ?? ''),
    emoji: String(formData.get('emoji') ?? '') || null,
    color: String(formData.get('color') ?? '#0A84FF'),
    color_deep: String(formData.get('color_deep') ?? '#0A84FF'),
    prize: String(formData.get('prize') ?? ''),
    explanation: String(formData.get('explanation') ?? '') || null,
    leaves: num('leaves'),
    weight: num('weight'),
    never_drop: formData.get('never_drop') === 'on',
    active: formData.get('active') === 'on',
    updated_at: new Date().toISOString(),
  })
  revalidatePath('/wheel')
}

async function deletePrize(formData: FormData) {
  'use server'
  const key = String(formData.get('key') ?? '')
  if (!key) return
  await supabaseAdmin.from('wheel_prizes').delete().eq('key', key)
  revalidatePath('/wheel')
}

export default async function WheelPage() {
  const { data: prizes } = await supabaseAdmin
    .from('wheel_prizes')
    .select('*')
    .order('sort', { ascending: true })

  return (
    <div className="py-2 sm:py-6 space-y-8">
      <FortuneWheel />

      <div className="max-w-5xl mx-auto rounded-2xl p-6" style={glass}>
        <div className="mb-5">
          <div className="text-xs font-semibold uppercase mb-1" style={{ color: 'rgba(28,28,30,0.45)', letterSpacing: '0.8px' }}>
            Управление
          </div>
          <h2 className="text-2xl font-bold" style={{ color: '#1C1C1E', letterSpacing: '-0.6px' }}>Сегменты колеса</h2>
          <p className="text-sm mt-1" style={{ color: 'rgba(28,28,30,0.55)' }}>
            Активные сегменты отображаются в мини-аппе. <code>weight</code> — шанс выпадения (чем больше, тем чаще). <code>leaves</code> — сколько фантиков зачислить (пусто или 0 = неденежная награда). <code>never_drop</code> — сегмент показывается на колесе, но никогда не выпадает.
          </p>
        </div>

        <div className="space-y-3">
          {(prizes ?? []).map(p => (
            <form key={p.key} action={savePrize} className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.45)' }}>
              <input type="hidden" name="key" value={p.key} />
              <div className="grid sm:grid-cols-6 gap-2 items-end">
                <label className="text-xs" style={{ color: 'rgba(28,28,30,0.6)' }}>
                  Порядок
                  <input name="sort" type="number" defaultValue={p.sort} className="mt-1 w-full rounded-lg px-3 py-2 text-sm" style={{ background: '#fff', border: '1px solid rgba(28,28,30,0.1)' }} />
                </label>
                <label className="text-xs sm:col-span-2" style={{ color: 'rgba(28,28,30,0.6)' }}>
                  Label (на секторе)
                  <input name="label" defaultValue={p.label} className="mt-1 w-full rounded-lg px-3 py-2 text-sm" style={{ background: '#fff', border: '1px solid rgba(28,28,30,0.1)' }} />
                </label>
                <label className="text-xs" style={{ color: 'rgba(28,28,30,0.6)' }}>
                  Эмодзи
                  <input name="emoji" defaultValue={p.emoji ?? ''} className="mt-1 w-full rounded-lg px-3 py-2 text-sm" style={{ background: '#fff', border: '1px solid rgba(28,28,30,0.1)' }} />
                </label>
                <label className="text-xs" style={{ color: 'rgba(28,28,30,0.6)' }}>
                  Цвет
                  <input name="color" defaultValue={p.color} className="mt-1 w-full rounded-lg px-3 py-2 text-sm font-mono" style={{ background: '#fff', border: '1px solid rgba(28,28,30,0.1)' }} />
                </label>
                <label className="text-xs" style={{ color: 'rgba(28,28,30,0.6)' }}>
                  Цвет (dark)
                  <input name="color_deep" defaultValue={p.color_deep} className="mt-1 w-full rounded-lg px-3 py-2 text-sm font-mono" style={{ background: '#fff', border: '1px solid rgba(28,28,30,0.1)' }} />
                </label>
                <label className="text-xs sm:col-span-3" style={{ color: 'rgba(28,28,30,0.6)' }}>
                  Приз (название, как в модалке)
                  <input name="prize" defaultValue={p.prize} className="mt-1 w-full rounded-lg px-3 py-2 text-sm" style={{ background: '#fff', border: '1px solid rgba(28,28,30,0.1)' }} />
                </label>
                <label className="text-xs sm:col-span-3" style={{ color: 'rgba(28,28,30,0.6)' }}>
                  Пояснение
                  <input name="explanation" defaultValue={p.explanation ?? ''} className="mt-1 w-full rounded-lg px-3 py-2 text-sm" style={{ background: '#fff', border: '1px solid rgba(28,28,30,0.1)' }} />
                </label>
                <label className="text-xs" style={{ color: 'rgba(28,28,30,0.6)' }}>
                  Leaves (фантики)
                  <input name="leaves" type="number" defaultValue={p.leaves ?? ''} className="mt-1 w-full rounded-lg px-3 py-2 text-sm" style={{ background: '#fff', border: '1px solid rgba(28,28,30,0.1)' }} />
                </label>
                <label className="text-xs" style={{ color: 'rgba(28,28,30,0.6)' }}>
                  Weight (шанс)
                  <input name="weight" type="number" step="0.1" defaultValue={p.weight ?? ''} className="mt-1 w-full rounded-lg px-3 py-2 text-sm" style={{ background: '#fff', border: '1px solid rgba(28,28,30,0.1)' }} />
                </label>
                <label className="text-xs flex items-center gap-2" style={{ color: 'rgba(28,28,30,0.6)' }}>
                  <input name="never_drop" type="checkbox" defaultChecked={p.never_drop} />
                  Never drop
                </label>
                <label className="text-xs flex items-center gap-2" style={{ color: 'rgba(28,28,30,0.6)' }}>
                  <input name="active" type="checkbox" defaultChecked={p.active} />
                  Активен
                </label>
                <div className="text-xs font-mono sm:col-span-2" style={{ color: 'rgba(28,28,30,0.4)' }}>
                  key: {p.key}
                </div>
              </div>
              <div className="mt-3 flex justify-end gap-3 items-center">
                <button type="submit" className="rounded-full px-4 py-2 text-xs font-semibold" style={{ background: '#0A84FF', color: '#fff', border: 'none', cursor: 'pointer' }}>
                  Сохранить
                </button>
              </div>
              <div className="mt-2 flex justify-end">
                <DeleteButton action={deletePrize} keyValue={p.key} />
              </div>
            </form>
          ))}

          <form action={savePrize} className="rounded-xl p-4" style={{ background: 'rgba(52,199,89,0.06)', border: '1px dashed rgba(52,199,89,0.4)' }}>
            <div className="text-sm font-semibold mb-3" style={{ color: '#1C1C1E' }}>Новый сегмент</div>
            <div className="grid sm:grid-cols-6 gap-2 items-end">
              <label className="text-xs" style={{ color: 'rgba(28,28,30,0.6)' }}>
                Ключ (уникальный)
                <input name="key" required placeholder="leaves_50" className="mt-1 w-full rounded-lg px-3 py-2 text-sm font-mono" style={{ background: '#fff', border: '1px solid rgba(28,28,30,0.1)' }} />
              </label>
              <label className="text-xs" style={{ color: 'rgba(28,28,30,0.6)' }}>
                Порядок
                <input name="sort" type="number" defaultValue={100} className="mt-1 w-full rounded-lg px-3 py-2 text-sm" style={{ background: '#fff', border: '1px solid rgba(28,28,30,0.1)' }} />
              </label>
              <label className="text-xs sm:col-span-2" style={{ color: 'rgba(28,28,30,0.6)' }}>
                Label
                <input name="label" required className="mt-1 w-full rounded-lg px-3 py-2 text-sm" style={{ background: '#fff', border: '1px solid rgba(28,28,30,0.1)' }} />
              </label>
              <label className="text-xs" style={{ color: 'rgba(28,28,30,0.6)' }}>
                Эмодзи
                <input name="emoji" defaultValue="🎁" className="mt-1 w-full rounded-lg px-3 py-2 text-sm" style={{ background: '#fff', border: '1px solid rgba(28,28,30,0.1)' }} />
              </label>
              <label className="text-xs" style={{ color: 'rgba(28,28,30,0.6)' }}>
                Цвет
                <input name="color" defaultValue="#0A84FF" className="mt-1 w-full rounded-lg px-3 py-2 text-sm font-mono" style={{ background: '#fff', border: '1px solid rgba(28,28,30,0.1)' }} />
              </label>
              <label className="text-xs" style={{ color: 'rgba(28,28,30,0.6)' }}>
                Цвет (dark)
                <input name="color_deep" defaultValue="#0055CC" className="mt-1 w-full rounded-lg px-3 py-2 text-sm font-mono" style={{ background: '#fff', border: '1px solid rgba(28,28,30,0.1)' }} />
              </label>
              <label className="text-xs sm:col-span-3" style={{ color: 'rgba(28,28,30,0.6)' }}>
                Приз
                <input name="prize" required className="mt-1 w-full rounded-lg px-3 py-2 text-sm" style={{ background: '#fff', border: '1px solid rgba(28,28,30,0.1)' }} />
              </label>
              <label className="text-xs sm:col-span-3" style={{ color: 'rgba(28,28,30,0.6)' }}>
                Пояснение
                <input name="explanation" className="mt-1 w-full rounded-lg px-3 py-2 text-sm" style={{ background: '#fff', border: '1px solid rgba(28,28,30,0.1)' }} />
              </label>
              <label className="text-xs" style={{ color: 'rgba(28,28,30,0.6)' }}>
                Leaves
                <input name="leaves" type="number" className="mt-1 w-full rounded-lg px-3 py-2 text-sm" style={{ background: '#fff', border: '1px solid rgba(28,28,30,0.1)' }} />
              </label>
              <label className="text-xs" style={{ color: 'rgba(28,28,30,0.6)' }}>
                Weight
                <input name="weight" type="number" step="0.1" className="mt-1 w-full rounded-lg px-3 py-2 text-sm" style={{ background: '#fff', border: '1px solid rgba(28,28,30,0.1)' }} />
              </label>
              <label className="text-xs flex items-center gap-2" style={{ color: 'rgba(28,28,30,0.6)' }}>
                <input name="never_drop" type="checkbox" />
                Never drop
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
    </div>
  )
}

function DeleteButton({ action, keyValue }: { action: (fd: FormData) => Promise<void>; keyValue: string }) {
  return (
    <form action={action}>
      <input type="hidden" name="key" value={keyValue} />
      <button type="submit" className="text-xs" style={{ color: '#FF3B30', background: 'none', border: 'none', cursor: 'pointer' }}>
        Удалить сегмент
      </button>
    </form>
  )
}
