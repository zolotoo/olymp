import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getChatMember } from '@/lib/telegram'
import { setBotUserGroupMember } from '@/lib/bot-tracking'
import { getCurrentAdminTgId } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// One-shot: ask Telegram getChatMember(GROUP_ID, tg_id) for every known
// tg_id (members + bot_users) and persist is_group_member on bot_users.
// Idempotent — safe to re-run.
export async function POST() {
  const adminTgId = await getCurrentAdminTgId()
  if (!adminTgId) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  const groupId = process.env.TELEGRAM_GROUP_ID
  if (!groupId) return NextResponse.json({ ok: false, error: 'no_group_id' }, { status: 500 })

  const tgIds = new Set<number>()
  const { data: members } = await supabaseAdmin.from('members').select('tg_id')
  for (const m of members || []) if (m.tg_id) tgIds.add(Number(m.tg_id))
  const { data: bu } = await supabaseAdmin.from('bot_users').select('tg_id')
  for (const u of bu || []) if (u.tg_id) tgIds.add(Number(u.tg_id))

  let inGroup = 0
  let notInGroup = 0
  let errors = 0
  const ids = Array.from(tgIds)

  for (const tgId of ids) {
    try {
      const res = await getChatMember(groupId, tgId)
      const status = res?.result?.status
      if (!status) { errors++; continue }
      const isMember = ['member', 'administrator', 'creator', 'restricted'].includes(status)
      await setBotUserGroupMember(tgId, isMember)
      if (isMember) inGroup++; else notInGroup++
    } catch (e) {
      console.error('backfill getChatMember failed for', tgId, e)
      errors++
    }
    // Telegram bot API limit ≈ 30 req/sec to a single chat. Stay well under.
    await new Promise((r) => setTimeout(r, 60))
  }

  return NextResponse.json({ ok: true, total: ids.length, inGroup, notInGroup, errors })
}
