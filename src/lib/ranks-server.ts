import 'server-only'
import { supabaseAdmin } from './supabase'
import type { MemberRank } from './types'
import { RANK_ORDER, RANK_CONFIG, type TitleRow } from './ranks'

// Серверный ридер таблицы titles (для применения бонусов при переходе титула).
export async function loadTitles(): Promise<Record<MemberRank, TitleRow>> {
  const { data } = await supabaseAdmin
    .from('titles')
    .select('rank, month, label, color, tag_title, bonus_points, perks')

  const byRank: Record<string, TitleRow> = {}
  for (const row of data ?? []) {
    byRank[row.rank] = {
      rank: row.rank as MemberRank,
      month: row.month,
      label: row.label,
      color: row.color,
      tag_title: row.tag_title ?? row.label,
      bonus_points: row.bonus_points ?? 0,
      perks: Array.isArray(row.perks) ? row.perks : [],
    }
  }

  // Заполняем пробелы дефолтами.
  const result = {} as Record<MemberRank, TitleRow>
  for (const r of RANK_ORDER) {
    const fallback = RANK_CONFIG[r]
    result[r] = byRank[r] ?? {
      rank: r,
      month: fallback.month,
      label: fallback.label,
      color: fallback.color,
      tag_title: fallback.tagTitle,
      bonus_points: fallback.bonusPoints,
      perks: fallback.perks,
    }
  }
  return result
}
