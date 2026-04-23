/**
 * AI Олимп — Game Mechanics Specification
 * This file documents all planned mechanics. Implementation is incremental.
 */

// ─── Ranks ────────────────────────────────────────────────────────────────────
// Implemented in ranks.ts. Time conditions (months) are not yet enforced in code.
export const RANK_CONDITIONS = {
  newcomer:  { label: 'Адепт',          minPoints: 0,    minMonths: 0 },
  member:    { label: 'Герой',          minPoints: 500,  minMonths: 0 },
  active:    { label: 'Полубог',        minPoints: 1500, minMonths: 2 },
  champion:  { label: 'Бог Олимпа',    minPoints: 3500, minMonths: 3 },
  legend:    { label: 'Чемпион Олимпа', minPoints: 7000, minMonths: 6 },
} as const

// ─── Points ───────────────────────────────────────────────────────────────────
// Implemented in ranks.ts POINTS constant.
// POLL_VOTE=5, REACTION_RECEIVED=3, MESSAGE=1, REACTION_GIVEN=1

// ─── Welcome Funnel ───────────────────────────────────────────────────────────
// TODO: implement as scheduled DM sequences (day 0, 1, 2, 3)
export const WELCOME_FUNNEL = {
  day0: {
    desc: 'Кружочек от Сергея — личное приветствие',
    type: 'video_note' as const,
    // env: TELEGRAM_WELCOME_VIDEO_NOTE_ID
  },
  day1: {
    desc: 'Про титулы Олимпа — как работает система',
    type: 'message' as const,
  },
  day2: {
    desc: 'Про фантики — как зарабатывать',
    type: 'message' as const,
  },
  day3: {
    desc: 'Про Сергея и клуб + первое задание',
    type: 'message' as const,
  },
}

// ─── Fortune Wheel ────────────────────────────────────────────────────────────
// TODO: implement monthly wheel spin via bot command /wheel
// Items marked `neverDrops: true` are shown in UI but never actually drawn.

export const FORTUNE_WHEEL = {
  month1: {
    label: 'Приветственный',
    prizes: [
      { label: '100 фантиков',             weight: 30 },
      { label: '200 фантиков',             weight: 20 },
      { label: '300 фантиков',             weight: 10 },
      { label: 'Закрытый гайд / шаблон',   weight: 25 },
      { label: 'Доступ к секретному контенту', weight: 10 },
      { label: 'Скидка 50%',               weight: 5,  neverDrops: true },
    ],
  },
  month2: {
    label: 'Социальный',
    prizes: [
      { label: '100 фантиков',             weight: 25 },
      { label: '200 фантиков',             weight: 20 },
      { label: '300 фантиков',             weight: 10 },
      { label: 'Место в групповом эфире',  weight: 20 },
      { label: 'Упоминание в stories Сергея', weight: 15 },
      { label: '1 вакансия на биржу Сергея',  weight: 5 },
      { label: 'Скидка 30%',               weight: 5,  neverDrops: true },
    ],
  },
  month3: {
    label: 'Личный',
    prizes: [
      { label: '200 фантиков',             weight: 25 },
      { label: '300 фантиков',             weight: 20 },
      { label: '500 фантиков',             weight: 10 },
      { label: 'Консультация 15–20 мин',   weight: 15 },
      { label: 'Совместный пост в Instagram', weight: 20 },
      { label: 'Скидка 50%',               weight: 10, neverDrops: true },
    ],
  },
}

// ─── Activity Segments ────────────────────────────────────────────────────────
// TODO: compute weekly, store in members table, drive weekly touch DMs
export const ACTIVITY_SEGMENTS = {
  dead:    { emoji: '🚨', label: 'Мертвяки',  condition: 'messages_this_week === 0' },
  silent:  { emoji: '😶', label: 'Молчуны',   condition: 'messages_this_week < 3' },
  medium:  { emoji: '💬', label: 'Середняки', condition: 'messages_this_week < 10' },
  active:  { emoji: '🔥', label: 'Активные',  condition: 'messages_this_week >= 10' },
} as const

// ─── Weekly Touchpoints ───────────────────────────────────────────────────────
// TODO: cron every Monday — send 3 messages to each member by segment
// 1. Кружочек от Сергея (weekly topic, rotating)
// 2. Дайджест недели (what came out in channel)
// 3. Personal message by segment (see below)

export const WEEKLY_MESSAGES: Record<1|2|3|4, Record<keyof typeof ACTIVITY_SEGMENTS, string>> = {
  1: {
    dead:   'Ни одного сообщения — всё ок? Дарим бонус 🎁',
    silent: 'Вот как получить первые фантики',
    medium: 'До следующего титула осталось X фантиков',
    active: 'Ты в топе — вот твой бейдж 🏆',
  },
  2: {
    dead:   'Вопрос про ожидания + дайджест',
    silent: 'Напоминание про фантики + дайджест',
    medium: 'Тизер следующей недели + дайджест',
    active: 'Закрытый контент / ранний доступ',
  },
  3: {
    dead:   'Ещё не поздно — двойные фантики прямо сейчас',
    silent: 'Напоминание о колесе месяца 🎡',
    medium: 'Итоги фантиков за 3 недели',
    active: 'Топ таблицы лидеров + поздравление',
  },
  4: {
    dead:   'Подписка через 7 дней. Если отпишешься — 6 месяцев нельзя вернуться',
    silent: 'Предупреждение о продлении + расписание следующего месяца',
    medium: 'Итоги месяца + титул + что ждёт дальше',
    active: 'Личная благодарность + анонс следующего месяца',
  },
}

// ─── Retention Rules ──────────────────────────────────────────────────────────
export const RETENTION = {
  // On cancellation: block re-entry for 6 months (check subscription_started_at on new_subscription)
  churnLockMonths: 6,

  // Member can declare "activity pause" — points don't expire during pause
  activityPauseAllowed: true,
}

// ─── Leaderboard ─────────────────────────────────────────────────────────────
// Implemented as /members page sorted by points desc. Top 10 shown in channel weekly.
export const LEADERBOARD = {
  topN: 10,
  resetPeriod: 'never' as const, // cumulative, not monthly
}
