// Онбординг «Мой путь».
//
// Двухуровневый:
//   1) DM-шаг (1 вопрос про цель) с inline-кнопками. +5 фантиков.
//   2) Анкета в мини-аппе на одном экране (level / looking_for / motivation /
//      working_on). +10 фантиков и бонусная крутка Колеса.
//
// DM-вопрос отправляется не сразу на approve, а через 1 час: cron-endpoint
// /api/cron/onboarding-reminders читает onboarding_answers.dm1_due_at.
//
// Здесь только бизнес-логика и константы. Тексты вопросов и ack-сообщения
// хранятся в bot_messages (ключи l_dm_q1 / l_dm_q1_ack / l_dm_q1_custom_ack /
// l_onb_thanks) и редактируются через /flow.

import { supabaseAdmin } from './supabase'
import type { InlineCallbackButton } from './telegram'

// ─── Цели (DM-шаг) ───────────────────────────────────────────────────────────
export const GOALS = [
  { id: 'sell',     emoji: '💰', label: 'Зарабатывать на AI' },
  { id: 'build',    emoji: '🛠',  label: 'Делать продукты с AI' },
  { id: 'content',  emoji: '🎬', label: 'Создавать контент с AI' },
  { id: 'vibecode', emoji: '⚡️', label: 'Вайбкодить' },
  { id: 'explore',  emoji: '🧭', label: 'Просто разобраться' },
] as const

export type GoalId = typeof GOALS[number]['id'] | 'custom'

export const GOAL_LABELS: Record<string, string> = Object.fromEntries(
  GOALS.map(g => [g.id, g.label]),
)
GOAL_LABELS.custom = 'Свой вариант'

// ─── Уровень в AI (мини-апп шаг) ─────────────────────────────────────────────
export interface LevelOption {
  id: 'starter' | 'user' | 'maker' | 'pro'
  label: string
}

export const LEVELS: LevelOption[] = [
  { id: 'starter', label: 'Новичок' },
  { id: 'user',    label: 'Пользователь' },
  { id: 'maker',   label: 'Делаю штуки' },
  { id: 'pro',     label: 'Pro' },
]

// ─── Что хочешь забрать из клуба (мульти-чипы) ───────────────────────────────
// Action-oriented формулировки: «забрать конкретный исход», не «получить
// абстрактное». Используются для скоринга направлений и для отображения
// Сергею в /members и /member-summary.
export interface LookingForOption { id: string; emoji: string; label: string }

export const LOOKING_FOR: LookingForOption[] = [
  { id: 'content_views',  emoji: '🎬', label: 'Делать контент с миллионными охватами' },
  { id: 'vibe_app',       emoji: '⚡', label: 'Завайбкодить своё приложение или сервис' },
  { id: 'earn_ai',        emoji: '💰', label: 'Начать зарабатывать на AI' },
  { id: 'sergey_advice',  emoji: '🧠', label: 'Получить советы и разборы от Сергея' },
  { id: 'agency_clients', emoji: '🚀', label: 'Запустить AI-агентство и взять клиентов' },
  { id: 'embed_in_biz',   emoji: '🛠',  label: 'Внедрить AI в свою работу или бизнес' },
  { id: 'community',      emoji: '🤝', label: 'Найти команду и единомышленников' },
  { id: 'where_to_start', emoji: '🎯', label: 'Понять с чего вообще начать в AI' },
]

// ─── Кнопки DM-вопроса ───────────────────────────────────────────────────────
export function dmGoalKeyboard(): InlineCallbackButton[][] {
  // 2 в ряд, кроме последнего ряда (custom отдельно).
  const rows: InlineCallbackButton[][] = []
  let row: InlineCallbackButton[] = []
  for (const g of GOALS) {
    row.push({ label: `${g.emoji} ${g.label}`, callback_data: `onb_goal_${g.id}` })
    if (row.length === 2) {
      rows.push(row)
      row = []
    }
  }
  if (row.length) rows.push(row)
  rows.push([{ label: '✍️ Написать своё', callback_data: 'onb_goal_custom_init' }])
  return rows
}

export const POINTS_DM_STEP1 = 5
export const POINTS_FULL_ONBOARDING = 10

// ─── Запись ответа на DM-шаг ─────────────────────────────────────────────────
// Идемпотентно: повторный ответ не начисляет фантики второй раз.
// Если строка onboarding_answers уже была создана webhook'ом (с dm1_due_at),
// мы её апдейтим. Если её нет — создаём.
export async function recordDmGoalAnswer(opts: {
  memberId: string
  tgId: number
  goal: GoalId
  customText?: string | null
}): Promise<{ awarded: boolean; alreadyAnswered: boolean }> {
  const { memberId, tgId, goal, customText } = opts
  const now = new Date().toISOString()

  const { data: existing } = await supabaseAdmin
    .from('onboarding_answers')
    .select('member_id, dm_step1_at')
    .eq('member_id', memberId)
    .maybeSingle()

  if (existing?.dm_step1_at) {
    // Уже отвечал — обновим goal/custom если перетыкивает, фантики не доначисляем.
    await supabaseAdmin
      .from('onboarding_answers')
      .update({
        goal,
        goal_custom: customText ?? null,
        updated_at: now,
      })
      .eq('member_id', memberId)
    return { awarded: false, alreadyAnswered: true }
  }

  if (existing) {
    await supabaseAdmin
      .from('onboarding_answers')
      .update({
        goal,
        goal_custom: customText ?? null,
        dm_step1_at: now,
        updated_at: now,
      })
      .eq('member_id', memberId)
  } else {
    await supabaseAdmin.from('onboarding_answers').insert({
      member_id: memberId,
      tg_id: tgId,
      goal,
      goal_custom: customText ?? null,
      dm_step1_at: now,
    })
  }

  // Начисление фантиков за DM-шаг.
  const { data: member } = await supabaseAdmin
    .from('members').select('points').eq('id', memberId).single()
  if (member) {
    await supabaseAdmin
      .from('members')
      .update({ points: (member.points ?? 0) + POINTS_DM_STEP1, onboarding_dm_state: null })
      .eq('id', memberId)
    await supabaseAdmin.from('points_log').insert({
      member_id: memberId,
      tg_id: tgId,
      points: POINTS_DM_STEP1,
      reason: 'onboarding_dm_step1',
    })
  }

  return { awarded: true, alreadyAnswered: false }
}

// ─── Скоринг рекомендаций ────────────────────────────────────────────────────
// Прозрачное правило: больше всего вес от цели (DM) + от чипов «что хочешь
// забрать». Уровень даёт небольшой буст pro-направлениям. Возвращаем top-3.
export type PathKind = 'content' | 'vibecode' | 'media' | 'product' | 'sales'

export const PATH_META: Record<PathKind, { emoji: string; label: string; description: string }> = {
  content:  { emoji: '🎨', label: 'AI-контент',          description: 'Картинки, видео, голос, креатив с AI на потоке.' },
  vibecode: { emoji: '⚡️', label: 'Вайбкодинг',          description: 'Cursor, Claude Code, Lovable, пилишь сам без бэкграунда.' },
  media:    { emoji: '📈', label: 'Развитие медиа',      description: 'Блог, охваты, монетизация, растишь личный бренд.' },
  product:  { emoji: '🛠',  label: 'AI-продукты',         description: 'От MVP до выручки, собираешь и шипишь свой продукт.' },
  sales:    { emoji: '💰', label: 'Продажи через AI',    description: 'Воронки, скрипты, автоматизация лидов с AI.' },
}

export interface OnboardingState {
  goal: GoalId | null
  goal_custom: string | null
  level: LevelOption['id'] | null
  looking_for: string[]
  motivation: string | null
  working_on: string | null
}

export function computeRecommendations(s: OnboardingState): { kind: PathKind; score: number }[] {
  const score: Record<PathKind, number> = {
    content: 0, vibecode: 0, media: 0, product: 0, sales: 0,
  }

  // Цель — самый сильный сигнал.
  if (s.goal === 'sell')     { score.sales += 50; score.product += 20 }
  if (s.goal === 'build')    { score.product += 50; score.vibecode += 30 }
  if (s.goal === 'content')  { score.content += 50; score.media += 30 }
  if (s.goal === 'vibecode') { score.vibecode += 55; score.product += 20 }
  if (s.goal === 'explore' || s.goal === 'custom' || s.goal === null) {
    score.content += 12; score.vibecode += 12; score.media += 10; score.product += 10; score.sales += 8
  }

  // Чипы «что хочешь забрать» — точечные бусты.
  const has = (id: string) => s.looking_for.includes(id)
  if (has('content_views'))  { score.content += 18; score.media += 10 }
  if (has('vibe_app'))       { score.vibecode += 18; score.product += 10 }
  if (has('earn_ai'))        { score.sales += 12; score.product += 8 }
  if (has('sergey_advice'))  { score.media += 5; score.product += 5; score.content += 5 }
  if (has('agency_clients')) { score.sales += 18; score.product += 10 }
  if (has('embed_in_biz'))   { score.product += 12; score.sales += 6 }
  if (has('community'))      { score.media += 4; score.content += 4; score.product += 4 }
  if (has('where_to_start')) {
    // Новичкам не закидываем pro-направления, чуть выравниваем
    score.content += 5; score.vibecode += 5; score.media += 3
  }

  // Уровень — экспертам докидываем по pro-направлениям.
  if (s.level === 'pro' || s.level === 'maker') {
    score.product += 5; score.vibecode += 5; score.sales += 5
  }

  // Нормализация в 0..100, отдаём top-3.
  const max = Math.max(...Object.values(score), 1)
  return (Object.keys(score) as PathKind[])
    .map(kind => ({ kind, score: Math.round((score[kind] / max) * 100) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
}
