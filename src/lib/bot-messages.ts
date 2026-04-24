// Тексты бота хранятся в таблице bot_messages (админка — /flow).
// Здесь общий хелпер: прочитать текст по ключу, подставить переменные,
// если в БД пусто — отдать fallback из кода.

import { supabaseAdmin } from './supabase'

export type TextVars = Record<string, string | number | undefined | null>

export async function getBotText(
  key: string,
  fallback: string,
  vars: TextVars = {},
): Promise<string> {
  const { data } = await supabaseAdmin
    .from('bot_messages')
    .select('content')
    .eq('key', key)
    .maybeSingle()

  const raw = (data?.content && data.content.trim()) ? data.content : fallback
  return renderVars(raw, vars)
}

export async function getBotVideo(key: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('bot_messages')
    .select('video_url')
    .eq('key', key)
    .maybeSingle()
  return data?.video_url || null
}

export function renderVars(tpl: string, vars: TextVars): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => {
    const v = vars[k]
    return v === undefined || v === null ? '' : String(v)
  })
}
