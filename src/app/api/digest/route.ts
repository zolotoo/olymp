import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentAdminTgId } from '@/lib/admin-auth'
import { buildDigestPreview, applyOverrides, digestCtaUrl } from '@/lib/digest'
import { sendMessage } from '@/lib/telegram'

// GET /api/digest?week=YYYY-MM-DD
//   Возвращает сборку дайджеста + сохранённое состояние weekly_digests:
//   intro_md, outro_md, status, sent_to_*. По умолчанию — текущая неделя.
//
// PATCH /api/digest
//   body: { week_start, intro_md?, outro_md? }
//   Сохраняет правки intro/outro как override шаблона.
//
// POST /api/digest
//   body: { week_start, target: 'channel'|'dm'|'both' }
//   Отправляет дайджест. Канал — публикация в основной канал (env LIBRARY_CHANNEL_ID),
//   DM — broadcast через существующий механизм рассылок (audience=members_active).
//   Помечает weekly_digests.status='sent' и поднимает sent_to_*.

export async function GET(req: NextRequest) {
  const adminTg = await getCurrentAdminTgId()
  if (!adminTg) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const weekParam = url.searchParams.get('week')
  const weekStart = weekParam ? new Date(weekParam + 'T00:00:00Z') : undefined

  const preview = await buildDigestPreview(weekStart)

  const { data: saved } = await supabaseAdmin
    .from('weekly_digests')
    .select('*')
    .eq('week_start', preview.week_start)
    .maybeSingle()

  const text_final = applyOverrides(preview.text_md, saved?.intro_md, saved?.outro_md)

  return NextResponse.json({
    preview,
    saved: saved ?? null,
    text_final,
    cta_url: digestCtaUrl(),
  })
}

export async function PATCH(req: NextRequest) {
  const adminTg = await getCurrentAdminTgId()
  if (!adminTg) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as {
    week_start?: string
    intro_md?: string | null
    outro_md?: string | null
  }
  const week = String(body.week_start ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) {
    return NextResponse.json({ error: 'bad_week' }, { status: 400 })
  }

  const intro = body.intro_md?.toString().trim() || null
  const outro = body.outro_md?.toString().trim() || null

  const { error } = await supabaseAdmin
    .from('weekly_digests')
    .upsert(
      { week_start: week, intro_md: intro, outro_md: outro, updated_at: new Date().toISOString() },
      { onConflict: 'week_start' },
    )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function POST(req: NextRequest) {
  const adminTg = await getCurrentAdminTgId()
  if (!adminTg) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as {
    week_start?: string
    target?: 'channel' | 'dm' | 'both'
  }
  const week = String(body.week_start ?? '')
  const target = body.target ?? 'both'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) {
    return NextResponse.json({ error: 'bad_week' }, { status: 400 })
  }
  if (!['channel', 'dm', 'both'].includes(target)) {
    return NextResponse.json({ error: 'bad_target' }, { status: 400 })
  }

  const preview = await buildDigestPreview(new Date(week + 'T00:00:00Z'))
  if (preview.total_published === 0) {
    return NextResponse.json({ error: 'empty_week' }, { status: 409 })
  }

  const { data: saved } = await supabaseAdmin
    .from('weekly_digests')
    .select('intro_md, outro_md, status, sent_to_channel, sent_to_dm')
    .eq('week_start', week)
    .maybeSingle()
  const text_final = applyOverrides(preview.text_md, saved?.intro_md, saved?.outro_md)
  const cta_url = digestCtaUrl()

  const result = { channel: false, dm_broadcast_id: null as number | null, errors: [] as string[] }

  // Канал — публикация прямого Telegram-сообщения от бота.
  if (target === 'channel' || target === 'both') {
    const channelId = process.env.LIBRARY_CHANNEL_ID
    if (!channelId) {
      result.errors.push('LIBRARY_CHANNEL_ID не задан')
    } else {
      try {
        await sendMessage(channelId, text_final, [
          { label: 'Открыть в приложении', url: cta_url },
        ])
        result.channel = true
      } catch (e) {
        result.errors.push('channel: ' + (e instanceof Error ? e.message : String(e)))
      }
    }
  }

  // DM — отдельный broadcast-черновик и сразу отправка через существующий
  // /api/broadcasts/[id]/send. Никаких новых рассыльных конвейеров.
  if (target === 'dm' || target === 'both') {
    const { data: created, error } = await supabaseAdmin
      .from('broadcasts')
      .insert({
        title: `Дайджест ${week}`,
        text: text_final,
        audience: 'members_active',
        audience_filter: null,
        cta_url,
        cta_label: 'Открыть в приложении',
        status: 'draft',
        created_by_tg: adminTg,
      })
      .select('id')
      .single()
    if (error || !created) {
      result.errors.push('dm broadcast create: ' + (error?.message ?? 'unknown'))
    } else {
      result.dm_broadcast_id = created.id
      const host = req.headers.get('host')
      const proto = host?.includes('localhost') ? 'http' : 'https'
      try {
        await fetch(`${proto}://${host}/api/broadcasts/${created.id}/send`, {
          method: 'POST',
          headers: { 'x-internal-trigger': process.env.CRON_SECRET || '' },
        })
      } catch (e) {
        result.errors.push('dm send: ' + (e instanceof Error ? e.message : String(e)))
      }
    }
  }

  // Помечаем дайджест отправленным. Если оба канала упали — оставляем draft.
  if (result.channel || result.dm_broadcast_id) {
    await supabaseAdmin.from('weekly_digests').upsert(
      {
        week_start: week,
        status: 'sent',
        sent_to_channel: result.channel,
        sent_to_dm: !!result.dm_broadcast_id,
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'week_start' },
    )
  }

  return NextResponse.json({ ok: result.errors.length === 0, ...result })
}
