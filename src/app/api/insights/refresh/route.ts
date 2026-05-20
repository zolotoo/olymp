// Batch-чтение свежих insights для списка tg_id.
// Используется на странице /insights после стрима bulk-генерации, чтобы
// одним запросом подтянуть только что записанные строки и обновить таблицу.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentAdminTgId } from '@/lib/admin-auth'

export async function GET(req: NextRequest) {
  const admin = await getCurrentAdminTgId()
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const url = new URL(req.url)
  const idsRaw = url.searchParams.get('ids') ?? ''
  const ids = idsRaw.split(',').map(Number).filter((n) => Number.isFinite(n))
  if (ids.length === 0) return NextResponse.json({ insights: [] })

  const { data, error } = await supabaseAdmin
    .from('user_insights')
    .select('tg_id, summary, suggested_action, engagement_hook, draft_message, generated_at, model')
    .in('tg_id', ids)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ insights: data ?? [] })
}
