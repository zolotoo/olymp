import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { RANK_CONFIG } from '@/lib/ranks'
import type { MemberRank } from '@/lib/types'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [
    { data: member },
    { data: pointsLog },
    { data: events },
    { data: activity },
  ] = await Promise.all([
    supabaseAdmin.from('members').select('*').eq('id', id).single(),
    supabaseAdmin.from('points_log').select('*').eq('member_id', id).order('created_at', { ascending: false }).limit(100),
    supabaseAdmin.from('events_log').select('*').eq('member_id', id).order('triggered_at', { ascending: false }).limit(50),
    supabaseAdmin.from('activity_log').select('*').eq('member_id', id).order('week_start', { ascending: false }).limit(12),
  ])

  if (!member) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const rank = RANK_CONFIG[member.rank as MemberRank]
  const totalMessages = (activity || []).reduce((s, r) => s + r.message_count, 0)
  const daysSinceJoin = Math.floor((Date.now() - new Date(member.joined_at).getTime()) / (1000 * 60 * 60 * 24))
  const daysSinceActive = member.last_active
    ? Math.floor((Date.now() - new Date(member.last_active).getTime()) / (1000 * 60 * 60 * 24))
    : null

  const pointsByReason = (pointsLog || []).reduce((acc: Record<string, number>, r) => {
    acc[r.reason] = (acc[r.reason] || 0) + r.points
    return acc
  }, {})

  const prompt = `Ты аналитик сообщества AI Олимп. Дай краткое (3-4 предложения) резюме участника на основе данных:

Имя: ${member.tg_first_name || member.tg_username || 'Без имени'}
Юзернейм: ${member.tg_username ? '@' + member.tg_username : 'нет'}
Титул: ${rank.emoji} ${rank.label}
Фантики: ${member.points}
Дней в клубе: ${daysSinceJoin}
Дней с последней активности: ${daysSinceActive ?? 'нет активности'}
Всего сообщений: ${totalMessages}
Источники фантиков: ${JSON.stringify(pointsByReason)}
Статус: ${member.status}
Событий: ${(events || []).map(e => e.event_type).join(', ') || 'нет'}

Резюме должно включать: уровень вовлечённости, риски оттока, что мотивирует участника. Пиши по-русски, кратко и по делу.`

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'OPENROUTER_API_KEY not set' }, { status: 500 })
  }

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://ai-olymp.vercel.app',
      'X-Title': 'AI Олимп Dashboard',
    },
    body: JSON.stringify({
      model: 'anthropic/claude-haiku-4-5',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300,
    }),
  })

  const data = await res.json()
  const summary = data?.choices?.[0]?.message?.content || 'Не удалось сгенерировать резюме'

  return NextResponse.json({ summary })
}
