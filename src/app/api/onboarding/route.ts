import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthedUser } from '@/lib/telegram-auth'
import {
  GOALS, levelsForGoal, skillsForGoal, HOURS, BIZ, PATH_META,
  computeRecommendations, POINTS_FULL_ONBOARDING,
  type GoalId, type HoursId, type LevelOption, type OnboardingState,
} from '@/lib/onboarding'

function authed(req: NextRequest): number | null {
  const initData = req.headers.get('x-telegram-init-data')
  return getAuthedUser(initData)?.id ?? null
}

// GET /api/onboarding — состояние анкеты + опции под выбранную цель.
// Если goal=null, level/skills отдаём общими (explore).
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

  const goal = (row?.goal ?? null) as GoalId | null
  const skillsArr = Array.isArray(row?.skills) ? (row!.skills as string[]) : []

  return NextResponse.json({
    state: {
      goal,
      goal_custom: row?.goal_custom ?? null,
      level: (row?.level ?? null) as LevelOption['id'] | null,
      skills: skillsArr,
      hours: (row?.hours_per_week ?? null) as HoursId | null,
      has_business: row?.has_business ?? null,
    },
    progress: {
      dm_step1_done: !!row?.dm_step1_at,
      mini_app_done: !!row?.mini_app_done_at,
      points_awarded_step1: row?.dm_step1_at ? 5 : 0,
      points_awarded_full:  row?.mini_app_done_at ? POINTS_FULL_ONBOARDING : 0,
    },
    options: {
      goals: GOALS.map(g => ({ id: g.id, emoji: g.emoji, label: g.label })),
      levels: levelsForGoal(goal ?? 'explore'),
      skills: skillsForGoal(goal ?? 'explore'),
      hours: HOURS,
      biz: BIZ,
    },
    recommendations: row?.recommended_paths ?? null,
    pathMeta: PATH_META,
  })
}

// POST /api/onboarding — частичное обновление + финализация.
// body: { goal?, goal_custom?, level?, skills?, hours?, has_business?, finalize?: boolean }
//
// Идемпотентный: финализация (начисление +10 фантиков) срабатывает один раз.
// Каждый раз пересчитываем рекомендации по текущему состоянию.
export async function POST(req: NextRequest) {
  const tgId = authed(req)
  if (!tgId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as Partial<{
    goal: GoalId
    goal_custom: string | null
    level: LevelOption['id']
    skills: string[]
    hours: HoursId
    has_business: 'yes' | 'no' | 'in_progress'
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
  const merged: OnboardingState = {
    goal: (body.goal ?? existing?.goal ?? null) as GoalId | null,
    goal_custom: body.goal_custom !== undefined ? body.goal_custom : (existing?.goal_custom ?? null),
    level: (body.level ?? existing?.level ?? null) as LevelOption['id'] | null,
    skills: Array.isArray(body.skills) ? body.skills : (existing?.skills ?? []),
    hours: (body.hours ?? existing?.hours_per_week ?? null) as HoursId | null,
    has_business: (body.has_business ?? existing?.has_business ?? null) as OnboardingState['has_business'],
  }

  const recommendations = computeRecommendations(merged)

  const now = new Date().toISOString()
  const willFinalize = !!body.finalize && !existing?.mini_app_done_at

  const update: Record<string, unknown> = {
    goal: merged.goal,
    goal_custom: merged.goal_custom,
    level: merged.level,
    skills: merged.skills,
    hours_per_week: merged.hours,
    has_business: merged.has_business,
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
    // +10 фантиков — один раз.
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

    // Бонусный спин за прохождение анкеты — UX-обещание из текста.
    // Безопасно: spins_available хранится в членах, здесь просто +1.
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
    state: merged,
    recommendations,
    pointsAwarded,
    bonusSpinGranted,
    finalized: willFinalize || !!existing?.mini_app_done_at,
  })
}
