'use server'

import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentAdminTgId } from '@/lib/admin-auth'

export interface SaveDraftState {
  error?: string
  saved?: boolean
}

// Редактирование draft-черновика: только текст и подписи кнопок.
// Сами URL не правим — они задаются при создании (например, библиотечным notify).
export async function saveDraftAction(
  _prev: SaveDraftState,
  fd: FormData,
): Promise<SaveDraftState> {
  const adminTg = await getCurrentAdminTgId()
  if (!adminTg) return { error: 'Не авторизован' }

  const id = String(fd.get('id') || '').trim()
  if (!id) return { error: 'bad_id' }

  const title = String(fd.get('title') || '').trim()
  const text = String(fd.get('text') || '').trim()
  const cta_label = String(fd.get('cta_label') || '').trim() || null
  const cta_label_2 = String(fd.get('cta_label_2') || '').trim() || null

  if (!title) return { error: 'Введи название' }
  if (!text) return { error: 'Введи текст рассылки' }

  // Гард: править можно только draft. sent/sending не трогаем.
  const { data: current } = await supabaseAdmin
    .from('broadcasts')
    .select('status')
    .eq('id', id)
    .maybeSingle()
  if (!current) return { error: 'not_found' }
  if (current.status !== 'draft') return { error: 'Можно править только черновик' }

  const { error } = await supabaseAdmin
    .from('broadcasts')
    .update({ title, text, cta_label, cta_label_2 })
    .eq('id', id)
  if (error) return { error: 'DB error: ' + error.message }

  revalidatePath(`/broadcasts/${id}`)
  return { saved: true }
}
