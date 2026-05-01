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

export interface AudienceFilter {
  rank?: string                  // только конкретный титул
  daysSinceSeen?: number         // активность не старше N дней
  tgIds?: number[]               // для custom_tg_ids
}

export interface ResolvedTarget {
  tg_id: number
  tg_first_name: string | null
  tg_username: string | null
}

export const AUDIENCE_LABELS: Record<AudienceKind, string> = {
  members_active: 'Активные участники клуба',
  members_churned: 'Ушедшие участники',
  bot_users_all: 'Все, кто касался бота',
  bot_users_no_member: 'Аудитория без подписки (в боте, не в клубе)',
  bot_users_active_30d: 'Активные в боте за 30 дней',
  custom_tg_ids: 'Конкретный список tg_id',
}
