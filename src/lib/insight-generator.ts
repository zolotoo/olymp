// Генератор персональных инсайтов через OpenRouter (Haiku 4.5).
// Используется в /api/insights/[tgId] (одиночная регенерация) и
// /api/insights/bulk (массовая прогонка). Контракт:
//   на входе — строка user_profile_v
//   на выходе — { summary, suggested_action, engagement_hook, draft_message, model }
//
// Возвращаем text-готовый draft_message — админ сможет отправить одним кликом
// через sendTracked.

export type ProfileForInsight = {
  tg_id: number
  tg_first_name: string | null
  tg_username: string | null
  funnel_stage: string
  engagement_score: number
  is_member: boolean
  subscription_active: boolean
  onboarding_done: boolean
  goal: string | null
  goal_custom: string | null
  level: string | null
  skills: unknown
  hours_per_week: string | null
  has_business: string | null
  mini_app_opens_30d: number
  mini_app_opens_total: number
  library_clicks_30d: number
  library_clicks_total: number
  top_kinds: { kind: string; clicks: number }[] | null
  broadcasts_received_90d: number
  broadcasts_engaged_90d: number
  broadcast_engagement_pct: number | null
  messages_30d: number
  reactions_given_30d: number
  days_since_active: number | null
  rank: string | null
  points: number | null
  source: string | null
}

export type GeneratedInsight = {
  summary: string
  suggested_action: string
  engagement_hook: string
  draft_message: string
  model: string
}

const KIND_HUMAN: Record<string, string> = {
  trends: 'тренды',
  practice: 'практика',
  guides: 'гайды',
  streams: 'эфиры',
  results: 'результаты',
  rules: 'правила',
  free: 'бесплатное',
}

function buildPrompt(p: ProfileForInsight): string {
  const name = p.tg_first_name || p.tg_username || `id:${p.tg_id}`
  const topKindsStr = (p.top_kinds && p.top_kinds.length)
    ? p.top_kinds.map((k) => `${KIND_HUMAN[k.kind] || k.kind}(${k.clicks})`).join(', ')
    : '—'
  const skillsStr = Array.isArray(p.skills) ? (p.skills as string[]).join(', ') : '—'

  return `Ты — community-маркетолог AI Олимпа (клуба по работе с ИИ). Твоя задача — придумать,
как вовлечь конкретного участника и написать ему персональное сообщение в DM.

ДАННЫЕ ПО УЧАСТНИКУ:
Имя: ${name}
Стадия воронки: ${p.funnel_stage}
Подписка активна: ${p.subscription_active ? 'да' : 'нет'}; ранг: ${p.rank ?? '—'}; фантиков: ${p.points ?? 0}
Источник: ${p.source ?? 'main'}
Анкета пройдена: ${p.onboarding_done ? 'да' : 'нет'}; цель: ${p.goal || '—'}${p.goal_custom ? ` («${p.goal_custom}»)` : ''}; уровень: ${p.level || '—'}; часов в неделю: ${p.hours_per_week || '—'}; есть бизнес: ${p.has_business || '—'}
Навыки из анкеты: ${skillsStr}
Активность: дней с активности ${p.days_since_active ?? '—'}, сообщений в чате за 30д ${p.messages_30d}, реакций за 30д ${p.reactions_given_30d}
Mini-app: открытий за 30д ${p.mini_app_opens_30d} (всего ${p.mini_app_opens_total})
Библиотека: кликов за 30д ${p.library_clicks_30d} (всего ${p.library_clicks_total}); топ направления: ${topKindsStr}
Рассылки: получил за 90д ${p.broadcasts_received_90d}, открыл ${p.broadcasts_engaged_90d} (${p.broadcast_engagement_pct ?? 0}%)
Engagement-скор: ${p.engagement_score}/100

ОТВЕТ — строго JSON без markdown:
{
  "summary": "3 предложения по-русски: кто это, что цепляет, чего не сделал/риск",
  "suggested_action": "одна строка-инструкция для админа: что делать (напр. 'предложить эфир по vibecode')",
  "engagement_hook": "одна короткая фраза 5–8 слов — крючок, что должно зацепить этого юзера лично",
  "draft_message": "готовый текст DM на 'ты', 2–4 коротких предложения, тёплый человечный тон. Обращение по имени. Можно эмодзи в меру. НЕ упоминай 'я бот', не давай ссылок (админ добавит сам). Конкретно про то, что цепляет именно его. ВАЖНО: пиши обычным текстом — без markdown (звёздочки, подчёркивания, тройные backtick'и), без HTML-тегов, не используй символы '<' и '>' (заменяй словами)."
}`
}

export async function generateInsight(p: ProfileForInsight): Promise<GeneratedInsight | null> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) return null
  const model = 'anthropic/claude-haiku-4-5'

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://ai-olymp.vercel.app',
      'X-Title': 'AI Олимп Insights',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: buildPrompt(p) }],
      max_tokens: 700,
      response_format: { type: 'json_object' },
    }),
  })

  if (!res.ok) return null
  const data = await res.json()
  const raw: string | undefined = data?.choices?.[0]?.message?.content
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as Partial<GeneratedInsight>
    return {
      summary: String(parsed.summary || '').trim(),
      suggested_action: String(parsed.suggested_action || '').trim(),
      engagement_hook: String(parsed.engagement_hook || '').trim(),
      draft_message: String(parsed.draft_message || '').trim(),
      model,
    }
  } catch {
    return {
      summary: String(raw),
      suggested_action: '',
      engagement_hook: '',
      draft_message: '',
      model,
    }
  }
}
