// Онбординг «Мой путь».
//
// Последовательность касаний:
//   1) approve канала → видеокружок + welcome (миг, в webhook)
//   2) +1ч → DM «открой мини-аппу» с URL-кнопкой (cron, шаблон l_dm_q1)
//   3) первое открытие мини-аппы → +5 фантиков, dm_step1_at = now
//      (api/analytics/mini-app-open)
//   4) заполнение анкеты в мини-аппе → +10 фантиков, бонус-крутка Колеса,
//      mini_app_done_at = now (api/onboarding POST с finalize)
//
// Раньше шаг 2 был DM-вопросом про цель с 5 callback-кнопками. Это
// дублировало мини-апп вопрос «Что хочешь забрать из клуба?» и сбивало
// новичков. Сейчас цель собираем только из chip'ов looking_for, top-1
// мапим на PathKind через scoring.
//
// Тексты сообщений живут в bot_messages и редактируются через /flow.

import { supabaseAdmin } from './supabase'

// ─── LEGACY: цели ───────────────────────────────────────────────────────────
// Раньше DM-вопрос предлагал выбрать одну из 5 целей. Сейчас не используется
// в активном онбординге, но колонка onboarding_answers.goal остаётся для
// исторических записей.
export const GOALS = [
  { id: 'sell',     emoji: '💰', label: 'Зарабатывать на AI' },
  { id: 'build',    emoji: '🛠',  label: 'Делать продукты с AI' },
  { id: 'content',  emoji: '🎬', label: 'Создавать контент с AI' },
  { id: 'vibecode', emoji: '⚡️', label: 'Вайбкодить' },
  { id: 'explore',  emoji: '🧭', label: 'Просто разобраться' },
] as const

export type GoalId = typeof GOALS[number]['id'] | 'custom'

// ─── Уровень в AI ────────────────────────────────────────────────────────────
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

// ─── Что хочешь забрать из клуба (chip-набор анкеты) ─────────────────────────
// Action-oriented формулировки. Top-1 определяет основное направление пути.
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

export const POINTS_FIRST_OPEN = 5
export const POINTS_FULL_ONBOARDING = 10

// ─── First mini-app open: грант +5 фантиков, marker dm_step1_at ─────────────
// Идемпотентно: повторный открытый мини-аппы фантиков не добавит. Если у
// участника уже есть dm_step1_at (например, из старого DM-флоу) — никаких
// изменений, фантики не задваиваются.
export async function recordFirstMiniAppOpen(opts: {
  memberId: string
  tgId: number
}): Promise<{ awarded: boolean; alreadyMarked: boolean }> {
  const { memberId, tgId } = opts
  const now = new Date().toISOString()

  const { data: existing } = await supabaseAdmin
    .from('onboarding_answers')
    .select('member_id, dm_step1_at')
    .eq('member_id', memberId)
    .maybeSingle()

  if (existing?.dm_step1_at) {
    return { awarded: false, alreadyMarked: true }
  }

  if (existing) {
    await supabaseAdmin
      .from('onboarding_answers')
      .update({ dm_step1_at: now, updated_at: now })
      .eq('member_id', memberId)
  } else {
    await supabaseAdmin.from('onboarding_answers').insert({
      member_id: memberId,
      tg_id: tgId,
      dm_step1_at: now,
    })
  }

  // +5 фантиков (та же сумма что раньше давалась за DM-ответ).
  const { data: member } = await supabaseAdmin
    .from('members').select('points').eq('id', memberId).single()
  if (member) {
    await supabaseAdmin
      .from('members')
      .update({ points: (member.points ?? 0) + POINTS_FIRST_OPEN })
      .eq('id', memberId)
    await supabaseAdmin.from('points_log').insert({
      member_id: memberId,
      tg_id: tgId,
      points: POINTS_FIRST_OPEN,
      reason: 'onboarding_first_open',
    })
  }

  return { awarded: true, alreadyMarked: false }
}

// ─── Скоринг рекомендаций ────────────────────────────────────────────────────
// Чипы looking_for — основной сигнал (раньше доминировал DM-goal). Уровень
// добавляет небольшой буст pro/maker направлениям.
export type PathKind = 'content' | 'vibecode' | 'media' | 'product' | 'sales'

export const PATH_META: Record<PathKind, { emoji: string; label: string; description: string }> = {
  content:  { emoji: '🎨', label: 'AI-контент',          description: 'Картинки, видео, голос, креатив с AI на потоке.' },
  vibecode: { emoji: '⚡️', label: 'Вайбкодинг',          description: 'Cursor, Claude Code, Lovable, пилишь сам без бэкграунда.' },
  media:    { emoji: '📈', label: 'Развитие медиа',      description: 'Блог, охваты, монетизация, растишь личный бренд.' },
  product:  { emoji: '🛠',  label: 'AI-продукты',         description: 'От MVP до выручки, собираешь и шипишь свой продукт.' },
  sales:    { emoji: '💰', label: 'Продажи через AI',    description: 'Воронки, скрипты, автоматизация лидов с AI.' },
}

export interface OnboardingState {
  goal: GoalId | null            // legacy, может быть NULL для новых записей
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

  // Чипы looking_for — основной сигнал.
  const has = (id: string) => s.looking_for.includes(id)
  if (has('content_views'))  { score.content += 50; score.media += 20 }
  if (has('vibe_app'))       { score.vibecode += 50; score.product += 20 }
  if (has('earn_ai'))        { score.sales += 50; score.product += 20 }
  if (has('sergey_advice'))  { score.media += 10; score.product += 10; score.content += 10 }
  if (has('agency_clients')) { score.sales += 40; score.product += 25 }
  if (has('embed_in_biz'))   { score.product += 40; score.sales += 15 }
  if (has('community'))      { score.media += 30; score.content += 15 }
  if (has('where_to_start')) {
    // Новичок ещё не определился — равномерно понемногу.
    score.content += 12; score.vibecode += 12; score.media += 10; score.product += 10; score.sales += 8
  }

  // LEGACY: если есть исторический goal (старый DM-флоу) — учитываем.
  if (s.goal === 'sell')     { score.sales += 30; score.product += 12 }
  if (s.goal === 'build')    { score.product += 30; score.vibecode += 18 }
  if (s.goal === 'content')  { score.content += 30; score.media += 18 }
  if (s.goal === 'vibecode') { score.vibecode += 32; score.product += 12 }

  // Уровень — экспертам докидываем по pro-направлениям.
  if (s.level === 'pro' || s.level === 'maker') {
    score.product += 5; score.vibecode += 5; score.sales += 5
  }

  // Если ни одного сигнала — даём минимально-разнообразный fallback,
  // чтобы UI не показал «все по 0%».
  const total = Object.values(score).reduce((a, b) => a + b, 0)
  if (total === 0) {
    score.content = 50; score.vibecode = 50; score.media = 50; score.product = 50; score.sales = 50
  }

  // Нормализация в 0..100, отдаём top-3.
  const max = Math.max(...Object.values(score), 1)
  return (Object.keys(score) as PathKind[])
    .map(kind => ({ kind, score: Math.round((score[kind] / max) * 100) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
}
