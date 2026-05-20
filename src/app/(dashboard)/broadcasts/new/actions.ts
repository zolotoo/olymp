'use server'

import { redirect } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'
import { resolveAudience, type AudienceKind } from '@/lib/audience-resolver'
import type { SegmentFilter, FunnelStage } from '@/lib/audience-types'
import { getCurrentAdminTgId } from '@/lib/admin-auth'

export interface CreateState {
  error?: string
  preview?: { count: number; sample: string[] }
}

function parseSegmentFromFD(fd: FormData): SegmentFilter {
  const stages = fd.getAll('seg_stage').map(String).filter(Boolean) as FunnelStage[]
  const topInterest = String(fd.get('seg_top_interest') || '') || undefined
  const goal = String(fd.get('seg_goal') || '') || undefined
  const subRaw = String(fd.get('seg_subscription') || '')
  const onbRaw = String(fd.get('seg_onboarding') || '')
  const minInactRaw = String(fd.get('seg_min_inactive') || '')
  const maxInactRaw = String(fd.get('seg_max_inactive') || '')
  const minEngRaw = String(fd.get('seg_min_engagement') || '')
  const seg: SegmentFilter = {
    funnelStages: stages.length ? stages : undefined,
    topInterest,
    goal,
    subscriptionActive: subRaw === 'yes' ? true : subRaw === 'no' ? false : undefined,
    onboardingDone: onbRaw === 'yes' ? true : onbRaw === 'no' ? false : undefined,
    minDaysInactive: minInactRaw ? Number(minInactRaw) : undefined,
    maxDaysInactive: maxInactRaw ? Number(maxInactRaw) : undefined,
    minEngagement: minEngRaw ? Number(minEngRaw) : undefined,
  }
  // удалим undefined-ключи, чтобы не пухло в jsonb
  return Object.fromEntries(Object.entries(seg).filter(([, v]) => v !== undefined)) as SegmentFilter
}

function buildAudienceFilter(audience: AudienceKind, fd: FormData) {
  if (audience === 'custom_tg_ids') {
    const tgIdsRaw = String(fd.get('tg_ids') || '')
    const tgIds = tgIdsRaw.split(/[\s,]+/).map(Number).filter((n) => Number.isFinite(n))
    return { tgIds }
  }
  if (audience === 'segment_v') {
    return { segment: parseSegmentFromFD(fd) }
  }
  return undefined
}

export async function previewAudienceAction(_prev: CreateState, fd: FormData): Promise<CreateState> {
  const audience = String(fd.get('audience') || 'members_active') as AudienceKind
  const targets = await resolveAudience(audience, buildAudienceFilter(audience, fd))
  return {
    preview: {
      count: targets.length,
      sample: targets.slice(0, 8).map((t) => '@' + (t.tg_username || `id:${t.tg_id}`)),
    },
  }
}

export async function createBroadcastAction(_prev: CreateState, fd: FormData): Promise<CreateState> {
  const adminTg = await getCurrentAdminTgId()
  if (!adminTg) return { error: 'Не авторизован' }

  const title = String(fd.get('title') || '').trim()
  const text = String(fd.get('text') || '').trim()
  const audience = String(fd.get('audience') || '') as AudienceKind
  const cta_url = String(fd.get('cta_url') || '').trim() || null
  const cta_label = String(fd.get('cta_label') || '').trim() || null
  const audienceFilter = buildAudienceFilter(audience, fd) ?? null
  const sendNow = fd.get('send_now') === '1'

  if (!title) return { error: 'Введи название' }
  if (!text) return { error: 'Введи текст рассылки' }
  if (!audience) return { error: 'Выбери аудиторию' }

  // Persist draft first so we have an id even if send fails
  const { data: created, error: dbErr } = await supabaseAdmin
    .from('broadcasts')
    .insert({
      title,
      text,
      audience,
      audience_filter: audienceFilter,
      cta_url,
      cta_label,
      status: 'draft',
      created_by_tg: adminTg,
    })
    .select('id')
    .single()

  if (dbErr || !created) return { error: 'DB error: ' + (dbErr?.message ?? 'unknown') }

  if (!sendNow) {
    redirect(`/broadcasts/${created.id}`)
  }

  // Synchronous send via internal API (kept simple for v1)
  const { headers } = await import('next/headers')
  const h = await headers()
  const host = h.get('host')
  const proto = host?.includes('localhost') ? 'http' : 'https'
  await fetch(`${proto}://${host}/api/broadcasts/${created.id}/send`, {
    method: 'POST',
    headers: { 'x-internal-trigger': process.env.CRON_SECRET || '' },
  })

  redirect(`/broadcasts/${created.id}`)
}
