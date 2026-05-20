import { supabaseAdmin } from '@/lib/supabase'
import InsightsTable, { type RowDTO } from './InsightsTable'

export const metadata = { title: 'AI-инсайты · AI Олимп' }
export const dynamic = 'force-dynamic'

// Дефолтная аудитория для bulk-анализа — клубные участники, которые ОДНОВРЕМЕННО
// в чате и в канале. По ним и стартуем; страница изначально показывает их.
export default async function InsightsPage() {
  const { data: rows } = await supabaseAdmin
    .from('user_profile_v')
    .select('tg_id, tg_first_name, tg_username, funnel_stage, engagement_score, days_since_active, goal, top_kinds, subscription_active, rank, points, mini_app_opens_30d, library_clicks_30d, messages_30d')
    .eq('is_member', true)
    .eq('is_channel_member', true)
    .eq('is_group_member', true)
    .order('engagement_score', { ascending: false })
    .limit(500)

  const tgIds = (rows ?? []).map((r) => r.tg_id)
  const { data: insights } = tgIds.length
    ? await supabaseAdmin
        .from('user_insights')
        .select('tg_id, summary, suggested_action, engagement_hook, draft_message, generated_at, model')
        .in('tg_id', tgIds)
    : { data: [] }
  const insightMap = new Map<number, NonNullable<typeof insights>[number]>()
  for (const i of insights ?? []) insightMap.set(i.tg_id, i)

  const merged: RowDTO[] = (rows ?? []).map((r) => ({
    ...r,
    insight: insightMap.get(r.tg_id) ?? null,
  }))

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2" style={{ color: '#1C1C1E', letterSpacing: '-0.8px' }}>
        🧠 AI-инсайты
      </h1>
      <p className="text-sm mb-6" style={{ color: '#6E6E73' }}>
        ИИ анализирует каждого участника (member + в чате + в канале), даёт hook и готовый
        текст DM. Жми «Сгенерировать всё», чтобы прогнать пачкой, дальше выбирай — отправить
        сразу или собрать в broadcast-черновик.
      </p>
      <InsightsTable initial={merged} />
    </div>
  )
}
