// Анкета «Мой путь».
//
// Цель: понять, зачем человек пришёл в AI Олимп, и предложить путь развития
// (контент / вайбкодинг / медиа / продукты / продажи). Анкета двухуровневая:
//   1) DM-шаг (1 вопрос про цель) сразу после approve заявки → +5 фантиков;
//   2) полная анкета в мини-аппе (уровень / умения / часы) → +10 фантиков
//      и расчёт top-3 рекомендованных направлений.
//
// Здесь — только бизнес-логика и константы. UI-тексты и CTA — в вызывающем
// коде (webhook + /api/onboarding), чтобы не плодить кросс-зависимости.

import { supabaseAdmin } from './supabase'
import type { InlineCallbackButton } from './telegram'

// ─── Цели ─────────────────────────────────────────────────────────────────────
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

// ─── Уровни — зависят от цели ────────────────────────────────────────────────
// Идея: вопрос «уровень» формулируется по-разному в зависимости от цели,
// иначе newcomer-ы выбирают наугад. У всех 4 точки на шкале — для скоринга это удобно.
export interface LevelOption {
  id: 'starter' | 'user' | 'maker' | 'pro'
  label: string
}

export function levelsForGoal(goal: GoalId): LevelOption[] {
  switch (goal) {
    case 'sell':
      return [
        { id: 'starter', label: 'Только думаю как зарабатывать на AI' },
        { id: 'user',    label: 'Делал заказ-два, нерегулярно' },
        { id: 'maker',   label: 'Регулярные клиенты, доход есть' },
        { id: 'pro',     label: 'Команда / агентство / стабильный поток' },
      ]
    case 'build':
      return [
        { id: 'starter', label: 'Идея есть, к коду не подходил' },
        { id: 'user',    label: 'Собирал прототипы в Lovable / v0' },
        { id: 'maker',   label: 'Запускал MVP, есть пользователи' },
        { id: 'pro',     label: 'Продукт в проде, выручка/команда' },
      ]
    case 'content':
      return [
        { id: 'starter', label: 'Хочу начать вести' },
        { id: 'user',    label: 'Веду нерегулярно, малая аудитория' },
        { id: 'maker',   label: 'Регулярный контент, охваты растут' },
        { id: 'pro',     label: 'Монетизирую блог, есть команда' },
      ]
    case 'vibecode':
      return [
        { id: 'starter', label: 'Никогда не кодил' },
        { id: 'user',    label: 'Cursor/Claude Code пробовал, страшновато' },
        { id: 'maker',   label: 'Пилю свои тулзы, выкатываю в прод' },
        { id: 'pro',     label: 'Шипаю фичи каждый день, помогаю другим' },
      ]
    case 'explore':
    case 'custom':
    default:
      return [
        { id: 'starter', label: 'Только знакомлюсь с AI' },
        { id: 'user',    label: 'Использую ChatGPT/Claude в работе' },
        { id: 'maker',   label: 'Кодю и автоматизирую с AI' },
        { id: 'pro',     label: 'Запускаю AI-продукты или контент' },
      ]
  }
}

// ─── Умения — зависят от цели ────────────────────────────────────────────────
// Чипы для multi-select в мини-аппе. Для каждой цели — свой набор + базовый.
export interface SkillOption { id: string; label: string }

const BASE_SKILLS: SkillOption[] = [
  { id: 'prompts',  label: 'Промпт-инжиниринг' },
  { id: 'chatgpt',  label: 'ChatGPT/Claude в быту' },
]

const SKILLS_BY_GOAL: Record<GoalId, SkillOption[]> = {
  sell: [
    { id: 'sales_funnel', label: 'Воронки и продажи' },
    { id: 'crm_automation', label: 'CRM/автоматизация' },
    { id: 'sales_scripts', label: 'AI-скрипты продаж' },
    { id: 'lead_gen',     label: 'Лидогенерация с AI' },
  ],
  build: [
    { id: 'cursor',  label: 'Cursor / Claude Code' },
    { id: 'lovable', label: 'Lovable / v0' },
    { id: 'n8n',     label: 'n8n / Make / Zapier' },
    { id: 'agents',  label: 'AI-агенты' },
    { id: 'api',     label: 'API LLM (OpenAI/Anthropic)' },
  ],
  content: [
    { id: 'mj',     label: 'Midjourney / Flux' },
    { id: 'video',  label: 'Sora / Veo / Kling' },
    { id: 'voice',  label: 'ElevenLabs / голос' },
    { id: 'edit',   label: 'CapCut / монтаж' },
    { id: 'writing', label: 'AI-копирайтинг' },
  ],
  vibecode: [
    { id: 'cursor',   label: 'Cursor / Claude Code' },
    { id: 'lovable',  label: 'Lovable / v0' },
    { id: 'cli',      label: 'Терминал / git' },
    { id: 'deploy',   label: 'Деплой (Vercel/Supabase)' },
  ],
  explore: [
    { id: 'cursor',  label: 'Cursor / Claude Code' },
    { id: 'lovable', label: 'Lovable / v0' },
    { id: 'mj',      label: 'Midjourney / Flux' },
    { id: 'n8n',     label: 'n8n / автоматизации' },
    { id: 'voice',   label: 'ElevenLabs / голос' },
  ],
  custom: [
    { id: 'cursor',  label: 'Cursor / Claude Code' },
    { id: 'lovable', label: 'Lovable / v0' },
    { id: 'mj',      label: 'Midjourney / Flux' },
    { id: 'n8n',     label: 'n8n / автоматизации' },
    { id: 'voice',   label: 'ElevenLabs / голос' },
  ],
}

export function skillsForGoal(goal: GoalId): SkillOption[] {
  return [...BASE_SKILLS, ...(SKILLS_BY_GOAL[goal] ?? SKILLS_BY_GOAL.explore)]
}

// ─── Часы в неделю ───────────────────────────────────────────────────────────
export const HOURS = [
  { id: '<2',   label: 'Меньше 2 часов' },
  { id: '2-5',  label: '2–5 часов' },
  { id: '5-10', label: '5–10 часов' },
  { id: '10+',  label: 'Больше 10 часов' },
] as const

export type HoursId = typeof HOURS[number]['id']

// ─── Бизнес/проект ───────────────────────────────────────────────────────────
export const BIZ = [
  { id: 'yes',          label: 'Да, есть к чему прикручивать' },
  { id: 'in_progress',  label: 'Запускаю прямо сейчас' },
  { id: 'no',           label: 'Пока нет' },
] as const

// ─── Кнопки первого DM-вопроса ───────────────────────────────────────────────
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

export const DM_QUESTION_TEXT =
  '🧭 <b>Первый вопрос для твоей карты пути</b>\n\n' +
  'Что ты хочешь от <b>AI Олимп</b> в первую очередь?\n\n' +
  'Выбери вариант — и сразу +5 фантиков. ' +
  'Дальше в Мини-аппе (раздел «Профиль») разберём подробнее и накинем ещё +10 + откроем Колесо удачи.'

export const DM_AWAITING_CUSTOM_TEXT =
  '✍️ Окей, расскажи своими словами: что ты хочешь от AI Олимп? ' +
  'Просто напиши следующим сообщением 1–3 предложения.'

export const POINTS_DM_STEP1 = 5
export const POINTS_FULL_ONBOARDING = 10

// ─── Запись ответа на DM-шаг ─────────────────────────────────────────────────
// Идемпотентно: повторный ответ не начисляет фантики второй раз.
// Возвращает true если фантики были начислены сейчас.
export async function recordDmGoalAnswer(opts: {
  memberId: string
  tgId: number
  goal: GoalId
  customText?: string | null
}): Promise<{ awarded: boolean; alreadyAnswered: boolean }> {
  const { memberId, tgId, goal, customText } = opts
  const now = new Date().toISOString()

  // Проверяем существующую запись.
  const { data: existing } = await supabaseAdmin
    .from('onboarding_answers')
    .select('member_id, dm_step1_at')
    .eq('member_id', memberId)
    .maybeSingle()

  if (existing?.dm_step1_at) {
    // Уже отвечал — обновим goal/custom если человек переотвечал, но фантики не начислим.
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

  // Начисление фантиков.
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
// Простое прозрачное правило: один ответ — один вес. Рекомендуем top-3.
export type PathKind = 'content' | 'vibecode' | 'media' | 'product' | 'sales'

export const PATH_META: Record<PathKind, { emoji: string; label: string; description: string }> = {
  content:  { emoji: '🎨', label: 'AI-контент',          description: 'Картинки, видео, голос — креатив с AI на потоке.' },
  vibecode: { emoji: '⚡️', label: 'Вайбкодинг',          description: 'Cursor, Claude Code, Lovable — пилишь сам без бэкграунда.' },
  media:    { emoji: '📈', label: 'Развитие медиа',      description: 'Блог, охваты, монетизация — растишь личный бренд.' },
  product:  { emoji: '🛠',  label: 'AI-продукты',         description: 'От MVP до выручки — собираешь и шипишь свой продукт.' },
  sales:    { emoji: '💰', label: 'Продажи через AI',    description: 'Воронки, скрипты, автоматизация лидов с AI.' },
}

export interface OnboardingState {
  goal: GoalId | null
  goal_custom: string | null
  level: LevelOption['id'] | null
  skills: string[]
  hours: HoursId | null
  has_business: 'yes' | 'no' | 'in_progress' | null
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
    // Разогрев — равномерно понемногу, чтобы не выдавать «пусто».
    score.content += 12; score.vibecode += 12; score.media += 10; score.product += 10; score.sales += 8
  }

  // Умения — даём бонус соответствующим направлениям.
  const has = (id: string) => s.skills.includes(id)
  if (has('mj') || has('video') || has('voice') || has('edit')) score.content += 18
  if (has('writing'))                                            { score.content += 8; score.media += 10 }
  if (has('cursor') || has('lovable') || has('cli') || has('deploy')) score.vibecode += 18
  if (has('agents') || has('api') || has('n8n'))                 score.product += 18
  if (has('sales_funnel') || has('crm_automation') || has('sales_scripts') || has('lead_gen')) score.sales += 18

  // Часы — масштаб готовности к серьёзному пути.
  if (s.hours === '10+')   { score.product += 8; score.vibecode += 6; score.sales += 6 }
  if (s.hours === '5-10')  { score.product += 4; score.vibecode += 3; score.media += 3 }

  // Бизнес есть — продажи и продукт получают буст.
  if (s.has_business === 'yes' || s.has_business === 'in_progress') {
    score.sales += 12
    score.product += 10
  }

  // Уровень — экспертам докидываем по pro-направлениям.
  if (s.level === 'pro' || s.level === 'maker') {
    score.product += 4; score.vibecode += 4; score.sales += 4
  }

  // Нормализация в 0..100, отдаём top-3 (всегда возвращаем что-то).
  const max = Math.max(...Object.values(score), 1)
  const ranked = (Object.keys(score) as PathKind[])
    .map(kind => ({ kind, score: Math.round((score[kind] / max) * 100) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)

  return ranked
}
