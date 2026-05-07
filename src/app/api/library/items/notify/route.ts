import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentAdminTgId } from '@/lib/admin-auth'
import { miniAppUrl } from '@/lib/mini-app'

// POST /api/library/items/notify
// body: { id: number }
//
// Создаёт broadcasts-черновик из карточки библиотеки и возвращает его id.
// Не отправляет — админ редактирует и сам жмёт "Отправить" в /broadcasts/[id].
//
// Это та самая «Substack-кнопка»: опубликовал — предложили уведомить,
// рассылка собирается из шаблона, ты правишь и отправляешь сам.

const KIND_LABEL: Record<string, string> = {
  practice: 'Новый практикум',
  guides: 'Новый гайд',
  streams: 'Новый эфир',
  free: 'Бесплатная нейросеть',
  trends: 'Тренд недели',
  rules: 'Важно: обновление',
  results: 'Кейс участника',
}

const KIND_EMOJI: Record<string, string> = {
  practice: '🎓',
  guides: '📝',
  streams: '🎬',
  free: '🆓',
  trends: '📈',
  rules: '📖',
  results: '🏆',
}

function buildText(args: {
  kindLabel: string
  emoji: string
  title: string
  bodySnippet: string
}): string {
  return [
    `${args.emoji} ${args.kindLabel} в Олимпе`,
    '',
    `«${args.title}»`,
    '',
    args.bodySnippet,
  ].filter(Boolean).join('\n')
}

function snippet(text: string, limit = 280): string {
  const t = (text ?? '').trim()
  if (!t) return ''
  // Берём со 2-й строки (1-я уйдёт в заголовок). Если такой нет — берём весь.
  const lines = t.split(/\n+/).map(s => s.trim()).filter(Boolean)
  const rest = lines.slice(1).join(' ')
  const useText = rest.length ? rest : t
  return useText.length > limit ? useText.slice(0, limit).trim() + '…' : useText
}

function deriveTitle(text: string | null, override: string | null): string {
  if (override?.trim()) return override.trim().slice(0, 120)
  const t = (text ?? '').trim()
  const first = t.split(/\n+/).map(s => s.trim()).find(Boolean) ?? ''
  return first.slice(0, 120) || 'Новый материал'
}

export async function POST(req: NextRequest) {
  const adminTg = await getCurrentAdminTgId()
  if (!adminTg) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as { id?: number }
  const id = Number(body.id)
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: 'bad_id' }, { status: 400 })
  }

  // Берём карточку + сырой текст из tg_messages.
  const { data: item, error } = await supabaseAdmin
    .from('library_items')
    .select(`
      id, chat_id, message_id, thread_id, kind, status, title_override,
      tg_messages:tg_messages!inner ( text )
    `)
    .eq('id', id)
    .maybeSingle()
  if (error || !item) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  // Уведомляем только о реально опубликованных постах. Иначе участник кликнет —
  // и попадёт в пустоту (мини-апп показывает только published).
  if (item.status !== 'published') {
    return NextResponse.json({ error: 'not_published' }, { status: 409 })
  }

  const tgText = (item as { tg_messages?: { text?: string | null } }).tg_messages?.text ?? null
  const title = deriveTitle(tgText, item.title_override ?? null)
  const kindLabel = KIND_LABEL[item.kind] ?? 'Новый материал'
  const emoji = KIND_EMOJI[item.kind] ?? '📚'
  const text = buildText({ kindLabel, emoji, title, bodySnippet: snippet(tgText ?? '') })

  // CTA: открыть мини-апп на табе Библиотеки с фильтром по kind и подсветкой
  // конкретного поста. Параметры читаются клиентом миниаппа (см. /app/page.tsx).
  const cta_url = `${miniAppUrl()}&tab=library&kind=${encodeURIComponent(item.kind)}&msg=${item.message_id}`
  const cta_label = 'Открыть в приложении'

  // Имя черновика — для админа, не для участников.
  const draftTitle = `Библиотека: ${title}`.slice(0, 120)

  const { data: created, error: insErr } = await supabaseAdmin
    .from('broadcasts')
    .insert({
      title: draftTitle,
      text,
      audience: 'members_active',
      audience_filter: null,
      cta_url,
      cta_label,
      status: 'draft',
      created_by_tg: adminTg,
    })
    .select('id')
    .single()
  if (insErr || !created) {
    return NextResponse.json({ error: 'broadcast_create_failed: ' + (insErr?.message ?? 'unknown') }, { status: 500 })
  }

  return NextResponse.json({ ok: true, broadcast_id: created.id })
}
