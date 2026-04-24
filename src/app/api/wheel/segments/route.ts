import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// GET /api/wheel/segments — редактируемые сегменты колеса из таблицы wheel_prizes.
export async function GET() {
  const { data } = await supabaseAdmin
    .from('wheel_prizes')
    .select('key, sort, label, emoji, color, color_deep, prize, explanation, leaves, weight, never_drop')
    .eq('active', true)
    .order('sort', { ascending: true })

  const segments = (data ?? []).map(r => ({
    key: r.key,
    label: r.label,
    emoji: r.emoji ?? '',
    color: r.color,
    colorDeep: r.color_deep,
    prize: r.prize,
    explanation: r.explanation ?? '',
    leaves: r.leaves ?? undefined,
    weight: r.weight ?? undefined,
    neverDrop: Boolean(r.never_drop),
    reward: !r.never_drop && (r.weight != null) && (r.leaves == null || r.leaves === 0),
  }))

  return NextResponse.json({ segments })
}
