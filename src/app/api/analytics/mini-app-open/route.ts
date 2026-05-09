import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthedUser } from '@/lib/telegram-auth'
import { trackBotInteraction } from '@/lib/bot-tracking'
import { recordFirstMiniAppOpen } from '@/lib/onboarding'

export async function POST(req: NextRequest) {
  const initData = req.headers.get('x-telegram-init-data')
  const user = getAuthedUser(initData)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  await trackBotInteraction({
    user: { id: user.id, username: user.username, first_name: user.first_name, last_name: user.last_name },
    eventType: 'mini_app_open',
  })

  // Грант +5 фантиков за первое открытие мини-аппы (idempotent через
  // onboarding_answers.dm_step1_at). Это та же сумма, что раньше выдавалась
  // за ответ на DM-вопрос про цель — теперь триггер сместился на сам факт
  // открытия мини-аппы, потому что DM-вопроса больше нет.
  const { data: member } = await supabaseAdmin
    .from('members').select('id').eq('tg_id', user.id).maybeSingle()

  let awarded = false
  if (member) {
    const r = await recordFirstMiniAppOpen({ memberId: member.id, tgId: user.id })
    awarded = r.awarded
  }

  return NextResponse.json({ ok: true, points_awarded: awarded ? 5 : 0 })
}
