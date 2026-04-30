// Тексты бота хранятся в таблице bot_messages (админка — /flow).
// Здесь общий хелпер: прочитать текст по ключу, подставить переменные,
// если в БД пусто — отдать fallback из кода.

import { supabaseAdmin } from './supabase'
import type { InlineUrlButton } from './telegram'

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

// Возвращает текст + inline-кнопки одним запросом. Удобно когда отправляем
// сообщение с CTA-кнопкой через sendTracked: текст берёт fallback при пустой
// записи в БД, кнопки же берутся как есть (нет «дефолтных» кнопок в коде —
// если в БД нет, то и кнопок не будет).
export async function getBotTemplate(
  key: string,
  fallback: string,
  vars: TextVars = {},
): Promise<{ text: string; buttons: InlineUrlButton[] | null }> {
  const { data } = await supabaseAdmin
    .from('bot_messages')
    .select('content, buttons')
    .eq('key', key)
    .maybeSingle()

  const raw = (data?.content && data.content.trim()) ? data.content : fallback
  return {
    text: renderVars(raw, vars),
    buttons: normalizeButtons(data?.buttons, vars),
  }
}

// Inline-кнопки для шаблона. Подставляет переменные ({tribute_link} и т.п.)
// в URL и label. Возвращает null, если кнопок нет или поле буттонов невалидно.
export async function getBotButtons(
  key: string,
  vars: TextVars = {},
): Promise<InlineUrlButton[] | null> {
  const { data } = await supabaseAdmin
    .from('bot_messages')
    .select('buttons')
    .eq('key', key)
    .maybeSingle()
  return normalizeButtons(data?.buttons, vars)
}

export function normalizeButtons(raw: unknown, vars: TextVars = {}): InlineUrlButton[] | null {
  if (!Array.isArray(raw)) return null
  const out: InlineUrlButton[] = []
  for (const b of raw) {
    if (!b || typeof b !== 'object') continue
    const labelRaw = (b as { label?: unknown }).label
    const urlRaw = (b as { url?: unknown }).url
    if (typeof labelRaw !== 'string' || typeof urlRaw !== 'string') continue
    const label = renderVars(labelRaw, vars).trim()
    const url = renderVars(urlRaw, vars).trim()
    if (!label || !url) continue
    out.push({ label, url })
  }
  return out.length ? out : null
}

export function renderVars(tpl: string, vars: TextVars): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => {
    const v = vars[k]
    return v === undefined || v === null ? '' : String(v)
  })
}
