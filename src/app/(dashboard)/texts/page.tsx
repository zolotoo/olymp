import { supabaseAdmin } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'

export const metadata = { title: 'Тексты и титулы — AI Олимп' }
export const dynamic = 'force-dynamic'

const glass = {
  background: 'rgba(255,255,255,0.66)',
  backdropFilter: 'blur(28px) saturate(160%)',
  WebkitBackdropFilter: 'blur(28px) saturate(160%)',
  border: '1px solid rgba(255,255,255,0.52)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.07)',
} as const

async function saveText(formData: FormData) {
  'use server'
  const key = String(formData.get('key') ?? '')
  const content = String(formData.get('content') ?? '')
  if (!key) return
  await supabaseAdmin
    .from('app_texts')
    .update({ content, updated_at: new Date().toISOString() })
    .eq('key', key)
  revalidatePath('/texts')
}

async function saveTitle(formData: FormData) {
  'use server'
  const rank = String(formData.get('rank') ?? '')
  const label = String(formData.get('label') ?? '')
  const color = String(formData.get('color') ?? '')
  const tagTitle = String(formData.get('tag_title') ?? '')
  const bonusPoints = Number(formData.get('bonus_points') ?? 0)
  const perksRaw = String(formData.get('perks') ?? '')
  const perks = perksRaw.split('\n').map(l => l.trim()).filter(Boolean)
  if (!rank) return
  await supabaseAdmin
    .from('titles')
    .update({
      label, color, tag_title: tagTitle,
      bonus_points: isFinite(bonusPoints) ? bonusPoints : 0,
      perks,
      updated_at: new Date().toISOString(),
    })
    .eq('rank', rank)
  revalidatePath('/texts')
}

export default async function TextsPage() {
  const [{ data: texts }, { data: titles }] = await Promise.all([
    supabaseAdmin.from('app_texts').select('*').order('key'),
    supabaseAdmin.from('titles').select('*').order('month'),
  ])

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="rounded-2xl px-6 py-5" style={glass}>
        <div className="text-xs font-semibold uppercase mb-2" style={{ color: 'rgba(28,28,30,0.45)', letterSpacing: '0.8px' }}>
          Редактор
        </div>
        <h1 className="text-3xl font-bold" style={{ color: '#1C1C1E', letterSpacing: '-1px' }}>Тексты и титулы</h1>
        <p className="text-sm mt-1" style={{ color: 'rgba(28,28,30,0.55)' }}>
          Здесь редактируются все строки мини-аппы и бонусы титулов. Переменные — в фигурных скобках: <code>{'{points}'}</code>, <code>{'{title}'}</code>, <code>{'{months_left}'}</code>, <code>{'{price}'}</code> и т.п.
        </p>
      </div>

      <div className="rounded-2xl p-6" style={glass}>
        <h2 className="text-lg font-bold mb-4" style={{ color: '#1C1C1E' }}>Титулы (по месяцам)</h2>
        <div className="space-y-4">
          {(titles ?? []).map(t => (
            <form key={t.rank} action={saveTitle} className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.45)' }}>
              <input type="hidden" name="rank" value={t.rank} />
              <div className="flex items-center gap-3 mb-3">
                <div style={{ width: 14, height: 14, borderRadius: '50%', background: t.color }} />
                <div className="text-xs font-semibold uppercase" style={{ color: 'rgba(28,28,30,0.6)', letterSpacing: '0.6px' }}>
                  Месяц {t.month} · {t.rank}
                </div>
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                <label className="text-xs" style={{ color: 'rgba(28,28,30,0.6)' }}>
                  Название
                  <input name="label" defaultValue={t.label} className="mt-1 w-full rounded-lg px-3 py-2 text-sm" style={{ background: '#fff', border: '1px solid rgba(28,28,30,0.1)' }} />
                </label>
                <label className="text-xs" style={{ color: 'rgba(28,28,30,0.6)' }}>
                  Цвет
                  <input name="color" defaultValue={t.color} className="mt-1 w-full rounded-lg px-3 py-2 text-sm font-mono" style={{ background: '#fff', border: '1px solid rgba(28,28,30,0.1)' }} />
                </label>
                <label className="text-xs" style={{ color: 'rgba(28,28,30,0.6)' }}>
                  Тег в TG чате
                  <input name="tag_title" defaultValue={t.tag_title} maxLength={16} className="mt-1 w-full rounded-lg px-3 py-2 text-sm" style={{ background: '#fff', border: '1px solid rgba(28,28,30,0.1)' }} />
                </label>
                <label className="text-xs" style={{ color: 'rgba(28,28,30,0.6)' }}>
                  Бонусные фантики (при переходе)
                  <input name="bonus_points" type="number" defaultValue={t.bonus_points} className="mt-1 w-full rounded-lg px-3 py-2 text-sm" style={{ background: '#fff', border: '1px solid rgba(28,28,30,0.1)' }} />
                </label>
              </div>
              <label className="text-xs block mt-3" style={{ color: 'rgba(28,28,30,0.6)' }}>
                Бонусы (по одному в строке)
                <textarea
                  name="perks"
                  defaultValue={(t.perks ?? []).join('\n')}
                  rows={Math.max(3, (t.perks ?? []).length + 1)}
                  className="mt-1 w-full rounded-lg px-3 py-2 text-sm font-mono"
                  style={{ background: '#fff', border: '1px solid rgba(28,28,30,0.1)' }}
                />
              </label>
              <div className="mt-3 flex justify-end">
                <button type="submit" className="rounded-full px-4 py-2 text-xs font-semibold" style={{ background: '#0A84FF', color: '#fff', border: 'none', cursor: 'pointer' }}>
                  Сохранить
                </button>
              </div>
            </form>
          ))}
        </div>
      </div>

      <div className="rounded-2xl p-6" style={glass}>
        <h2 className="text-lg font-bold mb-4" style={{ color: '#1C1C1E' }}>Строки UI</h2>
        <div className="space-y-3">
          {(texts ?? []).map(t => (
            <form key={t.key} action={saveText} className="rounded-xl p-3.5" style={{ background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.45)' }}>
              <input type="hidden" name="key" value={t.key} />
              <div className="flex items-baseline justify-between mb-2 gap-3">
                <div>
                  <div className="text-sm font-semibold" style={{ color: '#1C1C1E' }}>{t.label ?? t.key}</div>
                  <code className="text-xs" style={{ color: 'rgba(28,28,30,0.45)' }}>{t.key}</code>
                </div>
                <button type="submit" className="rounded-full px-3 py-1 text-xs font-semibold" style={{ background: '#0A84FF', color: '#fff', border: 'none', cursor: 'pointer' }}>
                  Сохранить
                </button>
              </div>
              <textarea
                name="content"
                defaultValue={t.content}
                rows={Math.max(2, Math.min(8, (t.content ?? '').split('\n').length + 1))}
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={{ background: '#fff', border: '1px solid rgba(28,28,30,0.1)' }}
              />
            </form>
          ))}
        </div>
      </div>
    </div>
  )
}
