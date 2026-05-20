// Массовая прогонка инсайтов. По умолчанию аудитория — клубные участники,
// которые ОДНОВРЕМЕННО состоят в чате и в канале (is_member + in_channel + in_group).
// Это критерий «реально живой участник», по которому стоит вкладываться в персональный
// контент, остальных лучше прогонять отдельным сегментом-нудж-кампанией.
//
// Возвращает NDJSON-стрим: одна JSON-строка на каждого юзера (status/ok/error),
// чтобы UI мог рендерить прогресс в реальном времени.

import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentAdminTgId } from '@/lib/admin-auth'
import { generateInsight, isInsightError, type ProfileForInsight } from '@/lib/insight-generator'

interface BulkBody {
  // если передать tg_ids — обработаем только их (для «перегенерить выбранных»)
  tg_ids?: number[]
  // принудительно перегенерить, даже если уже есть insight
  force?: boolean
  // ограничение для безопасности (по умолчанию 200)
  limit?: number
}

export async function POST(req: NextRequest) {
  const admin = await getCurrentAdminTgId()
  if (!admin) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 })

  let body: BulkBody = {}
  try { body = await req.json() as BulkBody } catch { /* пустое тело — берём дефолты */ }
  const force = body.force === true
  const limit = Math.min(body.limit ?? 200, 500)

  // 1) Выбираем аудиторию.
  // Если админ явно прислал tg_ids — берём именно их, без strict-фильтра по
  // membership (иначе админ передаёт список, а часть молча выпадает).
  // Если tg_ids нет — дефолтная аудитория: member + в чате + в канале.
  const explicitIds = body.tg_ids && body.tg_ids.length > 0 ? body.tg_ids : null
  let q = supabaseAdmin
    .from('user_profile_v')
    .select('*')
    .order('engagement_score', { ascending: false })
    .limit(limit)
  if (explicitIds) {
    q = q.in('tg_id', explicitIds)
  } else {
    q = q.eq('is_member', true).eq('is_channel_member', true).eq('is_group_member', true)
  }
  const { data: profiles, error } = await q
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  let targets = (profiles ?? []) as ProfileForInsight[]

  // 2) Если не force — отфильтровать уже сгенерированных за 7 дней
  if (!force && targets.length > 0) {
    const ids = targets.map((p) => p.tg_id)
    const since = new Date(Date.now() - 7 * 86400 * 1000).toISOString()
    const { data: fresh } = await supabaseAdmin
      .from('user_insights')
      .select('tg_id, generated_at, draft_message')
      .in('tg_id', ids)
      .gte('generated_at', since)
    const skip = new Set((fresh ?? [])
      .filter((r) => r.draft_message && r.draft_message.length > 0)
      .map((r) => r.tg_id))
    targets = targets.filter((p) => !skip.has(p.tg_id))
  }

  // 3) Стримим NDJSON. Параллелизм 5 — Haiku держит, OpenRouter rate-лимит тоже.
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder()
      const write = (obj: unknown) => controller.enqueue(enc.encode(JSON.stringify(obj) + '\n'))

      write({ type: 'start', total: targets.length })

      const CONCURRENCY = 5
      let cursor = 0
      let okCount = 0
      let errCount = 0

      async function worker() {
        while (true) {
          const i = cursor++
          if (i >= targets.length) return
          const p = targets[i]
          try {
            const gen = await generateInsight(p)
            if (isInsightError(gen)) {
              write({ type: 'row', tg_id: p.tg_id, ok: false, error: gen.error, detail: gen.detail })
              errCount++
              continue
            }
            const { error: upErr } = await supabaseAdmin
              .from('user_insights')
              .upsert({
                tg_id: p.tg_id,
                summary: gen.summary,
                suggested_action: gen.suggested_action,
                engagement_hook: gen.engagement_hook,
                draft_message: gen.draft_message,
                model: gen.model,
                generated_at: new Date().toISOString(),
              }, { onConflict: 'tg_id' })
            if (upErr) {
              write({ type: 'row', tg_id: p.tg_id, ok: false, error: upErr.message })
              errCount++
            } else {
              write({
                type: 'row',
                tg_id: p.tg_id,
                name: p.tg_first_name || p.tg_username,
                ok: true,
                hook: gen.engagement_hook,
                preview: gen.draft_message.slice(0, 120),
              })
              okCount++
            }
          } catch (e) {
            write({ type: 'row', tg_id: p.tg_id, ok: false, error: e instanceof Error ? e.message : 'error' })
            errCount++
          }
        }
      }

      await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()))
      write({ type: 'done', ok: okCount, errors: errCount, total: targets.length })
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
