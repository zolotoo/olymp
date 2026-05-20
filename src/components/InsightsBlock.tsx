'use client'

import { useState } from 'react'
import type { UserProfileV, UserInsight } from '@/lib/profile-loader'

const card = {
  background: 'rgba(255,255,255,0.70)',
  backdropFilter: 'blur(28px) saturate(160%)',
  WebkitBackdropFilter: 'blur(28px) saturate(160%)',
  border: '1px solid rgba(255,255,255,0.55)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)',
}

const STAGE_LABEL: Record<string, { label: string; color: string }> = {
  visitor:    { label: 'Гость',         color: '#8E8E93' },
  onboarded:  { label: 'Прошёл анкету', color: '#5AC8FA' },
  engaged:    { label: 'Изучает',       color: '#FF9F0A' },
  member:     { label: 'Участник',      color: '#30D158' },
  churn_risk: { label: 'Риск оттока',   color: '#FF9500' },
  churned:    { label: 'Ушёл',          color: '#FF3B30' },
}

const GOAL_LABEL: Record<string, string> = {
  sell: 'продажи через ИИ',
  build: 'строить ИИ-продукт',
  vibecode: 'вайб-кодинг',
  explore: 'просто изучаю',
  content: 'контент',
  media: 'медиа',
  product: 'продукт',
}

const KIND_LABEL: Record<string, string> = {
  trends: 'тренды',
  practice: 'практика',
  guides: 'гайды',
  streams: 'эфиры',
  results: 'результаты',
  rules: 'правила',
  free: 'бесплатное',
}

function kindLabel(k: string): string { return KIND_LABEL[k] || k }

export default function InsightsBlock({
  tgId,
  profile,
  insight: initialInsight,
}: {
  tgId: number
  profile: UserProfileV
  insight: UserInsight | null
}) {
  const [insight, setInsight] = useState<UserInsight | null>(initialInsight)
  const [loading, setLoading] = useState(false)

  async function regenerate() {
    setLoading(true)
    try {
      const res = await fetch(`/api/insights/${tgId}`, { method: 'POST' })
      const data = await res.json()
      if (data?.summary) {
        setInsight({
          tg_id: tgId,
          summary: data.summary,
          suggested_action: data.suggested_action,
          engagement_hook: data.engagement_hook ?? null,
          draft_message: data.draft_message ?? null,
          next_lessons: null,
          generated_at: new Date().toISOString(),
          model: data.model,
        })
      }
    } finally {
      setLoading(false)
    }
  }

  const stage = STAGE_LABEL[profile.funnel_stage] ?? { label: profile.funnel_stage, color: '#8E8E93' }
  const score = profile.engagement_score
  const scoreColor = score >= 70 ? '#30D158' : score >= 40 ? '#FF9F0A' : '#FF3B30'

  return (
    <div className="rounded-2xl p-6 mb-5" style={card}>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="font-semibold" style={{ color: '#1D1D1F' }}>🧠 Инсайты</h2>
          <span
            className="text-xs font-bold uppercase tracking-wide"
            style={{
              padding: '4px 10px',
              borderRadius: 50,
              background: `${stage.color}1A`,
              color: stage.color,
              letterSpacing: '0.6px',
            }}
          >
            {stage.label}
          </span>
          <span
            className="text-xs font-semibold"
            style={{
              padding: '4px 10px',
              borderRadius: 50,
              background: `${scoreColor}1A`,
              color: scoreColor,
            }}
          >
            engagement {score}/100
          </span>
        </div>
        <button
          onClick={regenerate}
          disabled={loading}
          className="text-sm px-3 py-1.5 rounded-xl font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
          style={{ background: '#0A84FF', color: '#FFFFFF' }}
        >
          {loading ? 'Генерирую…' : (insight ? '↻ Обновить' : '✨ Сгенерировать резюме')}
        </button>
      </div>

      {/* LLM-резюме */}
      {insight?.summary ? (
        <div className="mb-4 pb-4" style={{ borderBottom: '1px solid rgba(28,28,30,0.08)' }}>
          <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: '#1D1D1F' }}>
            {insight.summary}
          </p>
          {insight.suggested_action && (
            <div
              className="mt-3 text-sm rounded-xl px-3 py-2"
              style={{ background: 'rgba(48,209,88,0.12)', color: '#1D1D1F', borderLeft: '3px solid #30D158' }}
            >
              <span className="font-semibold" style={{ color: '#248A3D' }}>→ Действие: </span>
              {insight.suggested_action}
            </div>
          )}
          <div className="text-xs mt-2" style={{ color: '#AEAEB2' }}>
            {insight.model || 'llm'} · {new Date(insight.generated_at).toLocaleString('ru')}
          </div>
        </div>
      ) : (
        <div className="mb-4 text-sm" style={{ color: '#8E8E93' }}>
          LLM-резюме ещё не сгенерировано. Нажми «✨ Сгенерировать резюме», чтобы получить
          краткое описание и рекомендацию действия.
        </div>
      )}

      {/* Онбординг */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <div className="text-xs mb-2" style={{ color: '#AEAEB2', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
            Цель / уровень
          </div>
          {profile.onboarding_done ? (
            <div className="text-sm" style={{ color: '#1D1D1F' }}>
              <div>
                <span className="font-semibold">{GOAL_LABEL[profile.goal || ''] || profile.goal || 'не указана'}</span>
                {profile.goal_custom && <span style={{ color: '#8E8E93' }}> · «{profile.goal_custom}»</span>}
              </div>
              <div className="text-xs mt-1" style={{ color: '#6E6E73' }}>
                уровень: {profile.level || '—'} · {profile.hours_per_week || '—'} ч/нед
                {profile.has_business ? ` · бизнес: ${profile.has_business}` : ''}
              </div>
              {Array.isArray(profile.skills) && (profile.skills as string[]).length > 0 && (
                <div className="text-xs mt-1" style={{ color: '#6E6E73' }}>
                  навыки: {(profile.skills as string[]).join(', ')}
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm" style={{ color: '#FF9500' }}>анкета «Мой путь» не пройдена</div>
          )}
        </div>

        <div>
          <div className="text-xs mb-2" style={{ color: '#AEAEB2', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
            Топ интересы (библиотека)
          </div>
          {profile.top_kinds && profile.top_kinds.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {profile.top_kinds.map((k) => (
                <span
                  key={k.kind}
                  className="text-xs font-semibold"
                  style={{
                    padding: '4px 10px',
                    borderRadius: 50,
                    background: 'rgba(10,132,255,0.10)',
                    color: '#0A84FF',
                  }}
                >
                  {kindLabel(k.kind)} · {k.clicks}
                </span>
              ))}
            </div>
          ) : (
            <div className="text-sm" style={{ color: '#8E8E93' }}>пока ничего не открывал</div>
          )}
        </div>
      </div>

      {/* Числа */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4" style={{ borderTop: '1px solid rgba(28,28,30,0.08)' }}>
        <MiniStat label="Miniapp 30д" value={profile.mini_app_opens_30d} sub={`всего ${profile.mini_app_opens_total}`} />
        <MiniStat label="Библиотека 30д" value={profile.library_clicks_30d} sub={`всего ${profile.library_clicks_total}`} />
        <MiniStat
          label="Рассылки 90д"
          value={`${profile.broadcasts_engaged_90d}/${profile.broadcasts_received_90d}`}
          sub={profile.broadcast_engagement_pct != null ? `${profile.broadcast_engagement_pct}% открытий` : '—'}
        />
        <MiniStat
          label="Дней без активности"
          value={profile.days_since_active ?? '—'}
          sub={profile.subscription_active ? 'подписка активна' : 'без подписки'}
          highlight={(profile.days_since_active ?? 0) >= 14}
        />
      </div>
    </div>
  )
}

function MiniStat({ label, value, sub, highlight }: { label: string; value: string | number; sub?: string; highlight?: boolean }) {
  return (
    <div>
      <div className="text-xs mb-0.5" style={{ color: '#AEAEB2' }}>{label}</div>
      <div className="text-lg font-bold" style={{ color: highlight ? '#FF9500' : '#1D1D1F', letterSpacing: '-0.3px' }}>{value}</div>
      {sub && <div className="text-xs mt-0.5" style={{ color: '#8E8E93' }}>{sub}</div>}
    </div>
  )
}
