import 'server-only'
import { supabaseAdmin } from './supabase'
import type { WheelPick } from './wheel-prizes'

// Серверный выбор приза: берём активные сегменты из БД, считаем веса.
export async function pickWheelPrizeFromDb(): Promise<WheelPick | null> {
  const { data } = await supabaseAdmin
    .from('wheel_prizes')
    .select('key, sort, prize, leaves, weight, never_drop')
    .eq('active', true)
    .order('sort', { ascending: true })

  if (!data || data.length === 0) return null

  const eligible = data
    .map((r, i) => ({ ...r, segmentIndex: i }))
    .filter(r => !r.never_drop && r.weight != null && r.weight > 0)

  const total = eligible.reduce((sum, e) => sum + (e.weight ?? 0), 0)
  if (total <= 0) return null

  let rand = Math.random() * total
  for (const e of eligible) {
    rand -= e.weight ?? 0
    if (rand <= 0) {
      return {
        key: e.key,
        leaves: e.leaves ?? 0,
        reward: (e.leaves ?? 0) === 0,
        segmentIndex: e.segmentIndex,
        prize: e.prize,
      }
    }
  }
  const f = eligible[0]
  return {
    key: f.key,
    leaves: f.leaves ?? 0,
    reward: (f.leaves ?? 0) === 0,
    segmentIndex: f.segmentIndex,
    prize: f.prize,
  }
}
