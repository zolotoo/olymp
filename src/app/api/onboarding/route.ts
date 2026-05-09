import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthedUser } from '@/lib/telegram-auth'
import {
  GOALS, LEVELS, LOOKING_FOR, PATH_META,
  computeRecommendations, POINTS_FULL_ONBOARDING,
  type GoalId, type LevelOption, type OnboardingState,
} from '@/lib/onboarding'

function authed(req: NextRequest): number | null {
  const initData = req.headers.get('x-telegram-init-data')
  return getAuthedUser(initData)?.id ?? null
}

const MOTIVATION_MAX = 300
const WORKING_ON_MAX = 300
const LOOKING_FOR_TEXT_MAX = 200

// GET /api/onboarding — состояние анкеты + опции.
// Recommendations считаем только когда mini_app_done_at != null.
export async function GET(req: NextRequest) {
  const tgId = authed(req)
  if (!tgId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: member } = await supabaseAdmin
    .from('members')
    .select('id')
    .eq('tg_id', tgId)
    .maybeSingle()
  if (!member) return NextResponse.json({ error: 'not_member' }, { status: 403 })

  const { data: row } = await supabaseAdmin
    .from('onboarding_answers')
    .select('*')
    .eq('member_id', member.id)
    .maybeSingle()

  const lookingForArr = Array.isArray(row?.looking_for) ? (row!.looking_for as string[]) : []

  return NextResponse.json({
    state: {
      goal: (row?.goal ?? null) as GoalId | null,
      goal_custom: row?.goal_custom ?? null,
      level: (row?.level ?? null) as LevelOption['id'] | null,
      looking_for: lookingForArr,
      looking_for_text: row?.looking_for_text ?? null,
      motivation: row?.motivation ?? null,
      working_on: row?.working_on ?? null,
    },
    progress: {
      dm_step1_done: !!row?.dm_step1_at,
      mini_app_done: !!row?.mini_app_done_at,
      points_awarded_step1: row?.dm_step1_at ? 5 : 0,
      points_awarded_full:  row?.mini_app_done_at ? POINTS_FULL_ONBOARDING : 0,
    },
    options: {
      goals: GOALS.map(g => ({ id: g.id, emoji: g.emoji, label: g.label })),
      levels: LEVELS,
      lookingFor: LOOKING_FOR,
    },
    limits: {
      motivation: MOTIVATION_MAX,
      workingOn: WORKING_ON_MAX,
      lookingForText: LOOKING_FOR_TEXT_MAX,
    },
    recommendations: row?.recommended_paths ?? null,
    pathMeta: PATH_META,
  })
}

// POST /api/onboarding — частичное обновление + финализация.
// body: { level?, looking_for?, looking_for_text?, motivation?, working_on?, finalize?: boolean }
//
// Идемпотентный: финализация (+10 фантиков, бонус-крутка) срабатывает один раз.
// Финализация требует level + looking_for(>=1) + motivation. Если чего-то нет —
// 400 с деталями. Раньше была свободная финализация без обязательных полей.
export async function POST(req: NextRequest) {
  const tgId = authed(req)
  if (!tgId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as Partial<{
    level: LevelOption['id']
    looking_for: string[]
    looking_for_text: string | null
    motivation: string | null
    working_on: string | null
    finalize: boolean
  }>

  const { data: member } = await supabaseAdmin
    .from('members')
    .select('id, tg_id, points')
    .eq('tg_id', tgId)
    .maybeSingle()
  if (!member) return NextResponse.json({ error: 'not_member' }, { status: 403 })

  const { data: existing } = await supabaseAdmin
    .from('onboarding_answers')
    .select('*')
    .eq('member_id', member.id)
    .maybeSingle()

  // Сшиваем предыдущее состояние с новыми данными (только то, что прислали).
  const validLookingForIds = new Set(LOOKING_FOR.map(l => l.id))
  const incomingLookingFor = Array.isArray(body.looking_for)
    ? body.looking_for.filter(id => validLookingForIds.has(id))
    : (Array.isArray(existing?.looking_for) ? (existing!.looking_for as string[]) : [])

  const merged: OnboardingState = {
    goal: (existing?.goal ?? null) as GoalId | null,
    goal_custom: existing?.goal_custom ?? null,
    level: (body.level ?? existing?.level ?? null) as LevelOption['id'] | null,
    looking_for: incomingLookingFor,
    motivation: trimOrKeep(body.motivation, existing?.motivation, MOTIVATION_MAX),
    working_on: trimOrKeep(body.working_on, existing?.working_on, WORKING_ON_MAX),
  }
  const lookingForText = trimOrKeep(body.looking_for_text, existing?.looking_for_text, LOOKING_FOR_TEXT_MAX)

  const willFinalize = !!body.finalize && !existing?.mini_app_done_at
  if (willFinalize) {
    if (!merged.level) {
      return NextResponse.json({ error: 'level_required' }, { status: 400 })
    }
    if (!merged.looking_for.length) {
      return NextResponse.json({ error: 'looking_for_required' }, { status: 400 })
    }
    if (!merged.motivation || !merged.motivation.trim()) {
      return NextResponse.json({ error: 'motivation_required' }, { status: 400 })
    }
  }

  const recommendations = computeRecommendations(merged)
  const now = new Date().toISOString()

  const update: Record<string, unknown> = {
    level: merged.level,
    looking_for: merged.looking_for,
    looking_for_text: lookingForText,
    motivation: merged.motivation,
    working_on: merged.working_on,
    recommended_paths: recommendations,
    updated_at: now,
  }
  if (willFinalize) update.mini_app_done_at = now

  if (existing) {
    await supabaseAdmin.from('onboarding_answers').update(update).eq('member_id', member.id)
  } else {
    await supabaseAdmin.from('onboarding_answers').insert({
      member_id: member.id,
      tg_id: member.tg_id,
      ...update,
    })
  }

  let pointsAwarded = 0
  let bonusSpinGranted = false

  if (willFinalize) {
    await supabaseAdmin
      .from('members')
      .update({ points: (member.points ?? 0) + POINTS_FULL_ONBOARDING })
      .eq('id', member.id)
    await supabaseAdmin.from('points_log').insert({
      member_id: member.id,
      tg_id: member.tg_id,
      points: POINTS_FULL_ONBOARDING,
      reason: 'onboarding_full',
    })
    pointsAwarded = POINTS_FULL_ONBOARDING

    // Бонусный спин за прохождение анкеты.
    const { data: spinRow } = await supabaseAdmin
      .from('members')
      .select('spins_available')
      .eq('id', member.id)
      .single()
    if (spinRow) {
      await supabaseAdmin
        .from('members')
        .update({ spins_available: (spinRow.spins_available ?? 0) + 1 })
        .eq('id', member.id)
      await supabaseAdmin.from('events_log').insert({
        member_id: member.id,
        tg_id: member.tg_id,
        event_type: 'spin_credit_granted',
        metadata: { reason: 'onboarding_full' },
      })
      bonusSpinGranted = true
    }
  }

  return NextResponse.json({
    ok: true,
    state: { ...merged, looking_for_text: lookingForText },
    recommendations,
    pointsAwarded,
    bonusSpinGranted,
    finalized: willFinalize || !!existing?.mini_app_done_at,
  })
}

// Валидируем и тримим текстовое поле. Если в body не пришло (undefined) —
// сохраняем существующее. Если пришло null или пустая строка — сбрасываем.
function trimOrKeep(
  incoming: string | null | undefined,
  existing: string | null | undefined,
  max: number,
): string | null {
  if (incoming === undefined) return existing ?? null
  if (incoming === null) return null
  const t = String(incoming).trim()
  if (!t) return null
  return t.slice(0, max)
}
