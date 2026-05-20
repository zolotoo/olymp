// Чистые типы и константы аудитории — без зависимостей от Supabase.
// Можно безопасно импортировать в Client Components.
// Логика resolveAudience() живёт в audience-resolver.ts (server-only).

export type AudienceKind =
  | 'members_active'
  | 'members_churned'
  | 'bot_users_all'
  | 'bot_users_no_member'        // в боте, но не клубный участник
  | 'bot_users_active_30d'       // взаимодействовали в боте за 30 дней
  | 'custom_tg_ids'
  | 'segment_v'                  // фильтр по user_profile_v: funnel_stage, top_interest, …

export type FunnelStage = 'visitor' | 'onboarded' | 'engaged' | 'member' | 'churn_risk' | 'churned'

export interface SegmentFilter {
  funnelStages?: FunnelStage[]   // OR между значениями
  topInterest?: string           // kind из библиотеки (trends|practice|guides|streams|cases)
  goal?: string                  // sell|build|vibecode|explore|…
  subscriptionActive?: boolean
  onboardingDone?: boolean
  minDaysInactive?: number
  maxDaysInactive?: number
  minEngagement?: number         // 0..100
}

export interface AudienceFilter {
  rank?: string                  // только конкретный титул
  daysSinceSeen?: number         // активность не старше N дней
  tgIds?: number[]               // для custom_tg_ids
  segment?: SegmentFilter        // для segment_v
}

export interface ResolvedTarget {
  tg_id: number
  tg_first_name: string | null
  tg_username: string | null
  top_interest?: string | null   // для плейсхолдера {top_interest} (актуально для segment_v)
}

export const AUDIENCE_LABELS: Record<AudienceKind, string> = {
  members_active: 'Активные участники клуба',
  members_churned: 'Ушедшие участники',
  bot_users_all: 'Все, кто касался бота',
  bot_users_no_member: 'Аудитория без подписки (в боте, не в клубе)',
  bot_users_active_30d: 'Активные в боте за 30 дней',
  custom_tg_ids: 'Конкретный список tg_id',
  segment_v: '📊 Сегмент (по поведению и интересам)',
}

export const FUNNEL_LABELS: Record<FunnelStage, string> = {
  visitor: 'Гость',
  onboarded: 'Прошёл анкету',
  engaged: 'Изучает',
  member: 'Участник',
  churn_risk: 'Риск оттока',
  churned: 'Ушёл',
}

export const INTEREST_OPTIONS: { value: string; label: string }[] = [
  { value: 'trends', label: 'тренды' },
  { value: 'practice', label: 'практика' },
  { value: 'guides', label: 'гайды' },
  { value: 'streams', label: 'эфиры' },
  { value: 'results', label: 'результаты' },
  { value: 'rules', label: 'правила' },
  { value: 'free', label: 'бесплатное' },
]

export const GOAL_OPTIONS: { value: string; label: string }[] = [
  { value: 'sell', label: 'продажи через ИИ' },
  { value: 'build', label: 'строить ИИ-продукт' },
  { value: 'vibecode', label: 'вайб-кодинг' },
  { value: 'explore', label: 'просто изучаю' },
  { value: 'content', label: 'контент' },
  { value: 'media', label: 'медиа' },
  { value: 'product', label: 'продукт' },
]
