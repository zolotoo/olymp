'use client'
import { useState, useEffect, useCallback } from 'react'
import TelegramEditor from './TelegramEditor'

type NodeType = 'root' | 'section' | 'trigger' | 'condition' | 'message' | 'video' | 'action' | 'points' | 'followup'

// Метаданные для узлов-догонов. Хардкод тут — ровно то, что читает
// Edge Function (followup-messages). Менять имена/задержки только парой.
type FollowupTrigger = 'clicked' | 'no_click'  // 'clicked' — нажал кнопку но не оплатил; 'no_click' — не нажал
interface FollowupMeta {
  parent_key: string
  trigger: FollowupTrigger
  delay_minutes: number
}

interface Node {
  id: string
  label: string
  type: NodeType
  detail?: string       // default text shown if DB has no record
  followup?: FollowupMeta
  children?: Node[]
}

interface MsgButton { label: string; url: string }
type MsgRecord = { label: string; type: string; content: string; video_url?: string; buttons?: MsgButton[]; enabled?: boolean }
type MsgMap = Record<string, MsgRecord>

// ─── Followup builder ─────────────────────────────────────────────────────────
// Под каждым продающим сообщением вешаем 4 догона: 15 мин и 24 часа,
// для двух триггеров (нажал кнопку но не оплатил / не нажал вовсе).
function buildFollowups(parentKey: string, parentLabel: string): Node[] {
  const variants: Array<{ suffix: string; trigger: FollowupTrigger; delay: number; label: string }> = [
    { suffix: 'fu_click_15m',   trigger: 'clicked',  delay: 15,        label: 'Догон · нажал, +15 мин' },
    { suffix: 'fu_click_24h',   trigger: 'clicked',  delay: 24 * 60,   label: 'Догон · нажал, +24 ч' },
    { suffix: 'fu_noclick_15m', trigger: 'no_click', delay: 15,        label: 'Догон · не нажал, +15 мин' },
    { suffix: 'fu_noclick_24h', trigger: 'no_click', delay: 24 * 60,   label: 'Догон · не нажал, +24 ч' },
  ]
  return variants.map(v => ({
    id: `${parentKey}_${v.suffix}`,
    label: v.label,
    type: 'followup',
    detail: `Если за указанное время от «${parentLabel}» условие выполнено — отправляется этот текст. Один раз на юзера.`,
    followup: { parent_key: parentKey, trigger: v.trigger, delay_minutes: v.delay },
  }))
}

// ─── Tree data ────────────────────────────────────────────────────────────────
const TREE: Node = {
  id: 'root', label: 'AI Олимп Бот', type: 'root',
  children: [
    {
      id: 's1', label: '1-я неделя в клубе', type: 'section',
      children: [
        {
          id: 't_start', label: '/start', type: 'trigger', detail: 'Первый контакт пользователя с ботом. Поддерживаются deep-link источники: ?start=hochy / promts / claude. Чистый /start или ?start=main → ветка MAIN.',
          children: [
            { id: 'c_notmember', label: 'Не участник', type: 'condition', detail: 'Не найден в базе members. Текст подбирается по источнику первого касания (deep-link при первом /start). Возвращающимся юзерам всегда отправляется MAIN.',
              children: [
                { id: 'c_src_main',   label: 'Источник · MAIN (основа)', type: 'condition', detail: 'Чистый /start или ?start=main. Это дефолтная ветка — что показывалось до введения источников.',
                  children: [
                    { id: 'l_sales', label: 'Продающее · MAIN', type: 'message', detail: 'Привет! Клуб AI Олимп...',
                      children: buildFollowups('l_sales', 'Продающее · MAIN'),
                    },
                  ],
                },
                { id: 'c_src_hochy',  label: 'Источник · ХОЧУ', type: 'condition', detail: 'Перешёл по ссылке t.me/<bot>?start=hochy',
                  children: [
                    { id: 'l_sales_hochy', label: 'Продающее · ХОЧУ', type: 'message', detail: 'Стартует с тем же текстом, что MAIN — отредактируй под аудиторию ХОЧУ',
                      children: buildFollowups('l_sales_hochy', 'Продающее · ХОЧУ'),
                    },
                  ],
                },
                { id: 'c_src_promts', label: 'Источник · ПРОМТЫ', type: 'condition', detail: 'Перешёл по ссылке t.me/<bot>?start=promts',
                  children: [
                    { id: 'l_sales_promts', label: 'Продающее · ПРОМТЫ', type: 'message', detail: 'Стартует с тем же текстом, что MAIN — отредактируй под аудиторию ПРОМТЫ',
                      children: buildFollowups('l_sales_promts', 'Продающее · ПРОМТЫ'),
                    },
                  ],
                },
                { id: 'c_src_claude', label: 'Источник · КЛОД', type: 'condition', detail: 'Перешёл по ссылке t.me/<bot>?start=claude',
                  children: [
                    { id: 'l_sales_claude', label: 'Продающее · КЛОД', type: 'message', detail: 'Стартует с тем же текстом, что MAIN — отредактируй под аудиторию КЛОД',
                      children: buildFollowups('l_sales_claude', 'Продающее · КЛОД'),
                    },
                  ],
                },
              ],
            },
            { id: 'c_active', label: 'Активный участник', type: 'condition', detail: 'welcome_sent = true',
              children: [
                { id: 'l_profile', label: 'Профиль участника', type: 'message', detail: 'Титул + фантики + дней в клубе' },
              ],
            },
          ],
        },
        { id: 't_joinreq', label: 'Заявка в канал', type: 'trigger', detail: 'chat_join_request',
          children: [
            { id: 'l_approve', label: 'Авто-одобрение', type: 'action', detail: 'approveChatJoinRequest' },
            { id: 'l_jrvideo', label: 'Кружок в DM', type: 'video', detail: 'Если DM заблокированы, пропускается' },
          ],
        },
        { id: 't_newmem', label: 'Вступление в группу', type: 'trigger', detail: 'new_chat_members',
          children: [
            { id: 'l_grprank', label: 'Выдача титула «Адепт»', type: 'action', detail: 'applyRankTitle newcomer' },
          ],
        },
      ],
    },
    {
      id: 's2', label: '1-й месяц в клубе', type: 'section',
      children: [
        { id: 't_tribute', label: 'Tribute · подписка', type: 'trigger', detail: 'Webhook от Tribute.co',
          children: [
            { id: 'c_newsub', label: 'Новая подписка', type: 'condition', detail: 'event: new_subscription',
              children: [
                { id: 'l_subcongrats', label: 'Поздравление',     type: 'message', detail: '[Имя], ты официально в AI Олимп!' },
                { id: 'l_subvideo',    label: 'Кружок от Сергея', type: 'video',   detail: 'Видео при новой подписке' },
              ],
            },
            { id: 'c_renew', label: 'Продление', type: 'condition', detail: 'event: renewed_subscription',
              children: [
                { id: 'l_renewmsg', label: 'Продление + новый титул', type: 'message', detail: 'Благодарим, объявляем новый титул и его бонусы, +10 фантиков и новый спин' },
              ],
            },
            { id: 'c_cancel', label: 'Отписка', type: 'condition', detail: 'event: cancelled_subscription',
              children: [
                { id: 'l_adminnotif', label: 'Уведомление админу', type: 'action',  detail: 'В TELEGRAM_ADMIN_CHAT_ID' },
                { id: 'l_farewell',   label: 'Прощание участнику', type: 'message', detail: '[Имя], жаль, что уходишь...' },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 's3', label: 'Активность · постоянно', type: 'section',
      children: [
        { id: 't_activity', label: 'Активность → Фантики', type: 'trigger',
          children: [
            { id: 'l_msgpts',    label: 'Сообщение в чате',  type: 'points', detail: 'Учитывается в статистике активности (фантики не начисляются)' },
            { id: 'l_reactgive', label: 'Поставить реакцию', type: 'points', detail: 'Фантики не начисляются' },
            { id: 'l_reactrecv', label: 'Получить реакцию',  type: 'points', detail: '+3 фантика автору сообщения' },
            { id: 'l_poll',      label: 'Голосование',       type: 'points', detail: '+5 фантиков проголосовавшему (работает только в публичных опросах, не в анонимных)' },
          ],
        },
      ],
    },
    {
      id: 's4', label: 'Еженедельные касания', type: 'section',
      children: [
        { id: 't_weekly', label: 'Рассылка по дням в клубе', type: 'trigger', detail: 'Supabase Edge Function weekly-messages, pg_cron каждый день в 12:00 МСК. Одно сообщение всем — когда с joined_at прошло 7/14/21/28 дней.',
          children: [
            { id: 'weekly_week1', label: '+7 дней · первая неделя',                type: 'message', detail: 'Приветственный спин Колеса удачи открывается через 7 дней.' },
            { id: 'weekly_week2', label: '+14 дней · промокод ZOLOTO',             type: 'message', detail: '-20% в @VeoSeeBot по коду ZOLOTO.' },
            { id: 'weekly_week3', label: '+21 день · письмо от основателя',         type: 'message', detail: 'Длинное письмо от Сергея с итогами 3 недель и напоминанием про титулы.' },
            { id: 'weekly_week4', label: '+28 дней · следующий титул',              type: 'message', detail: 'Напоминание о продлении и новом титуле. За 2 дня до продления.' },
          ],
        },
      ],
    },
  ],
}

// ─── Layout ───────────────────────────────────────────────────────────────────
const NW = 158
const NH = 40
const SLOT = 50
const LW = 210

interface Placed { node: Node; x: number; y: number }

function countLeaves(n: Node): number {
  if (!n.children?.length) return 1
  return n.children.reduce((s, c) => s + countLeaves(c), 0)
}

function placeNodes(node: Node, depth: number, leafStart: number): Placed[] {
  const leaves = countLeaves(node)
  const cy = (leafStart + leaves / 2) * SLOT
  const placed: Placed[] = [{ node, x: depth * LW, y: cy - NH / 2 }]
  if (node.children?.length) {
    let ls = leafStart
    for (const child of node.children) {
      placed.push(...placeNodes(child, depth + 1, ls))
      ls += countLeaves(child)
    }
  }
  return placed
}

// ─── Node styles ──────────────────────────────────────────────────────────────
const TYPE_STYLE: Record<NodeType, { bg: string; border: string; textColor: string; badge: string; badgeBg: string; badgeColor: string }> = {
  root:      { bg: 'rgba(20,20,24,0.72)',    border: 'rgba(255,255,255,0.16)', textColor: '#FFF',               badge: 'бот',       badgeBg: 'rgba(255,255,255,0.15)', badgeColor: 'rgba(255,255,255,0.75)' },
  section:   { bg: 'rgba(26,26,30,0.65)',    border: 'rgba(255,255,255,0.14)', textColor: '#FFF',               badge: 'раздел',    badgeBg: 'rgba(255,255,255,0.13)', badgeColor: 'rgba(255,255,255,0.65)' },
  trigger:   { bg: 'rgba(255,255,255,0.72)', border: 'rgba(255,255,255,0.55)', textColor: '#1C1C1E',            badge: 'триггер',   badgeBg: 'rgba(255,165,0,0.13)',   badgeColor: '#A86200' },
  condition: { bg: 'rgba(255,255,255,0.55)', border: 'rgba(255,255,255,0.44)', textColor: 'rgba(28,28,30,0.72)',badge: 'ветка',     badgeBg: 'rgba(100,100,110,0.10)', badgeColor: '#636366' },
  message:   { bg: 'rgba(255,255,255,0.72)', border: 'rgba(255,255,255,0.55)', textColor: '#1C1C1E',            badge: 'сообщение', badgeBg: 'rgba(10,132,255,0.12)',  badgeColor: '#0A84FF' },
  video:     { bg: 'rgba(255,255,255,0.72)', border: 'rgba(255,255,255,0.55)', textColor: '#1C1C1E',            badge: 'видео',     badgeBg: 'rgba(191,90,242,0.12)',  badgeColor: '#BF5AF2' },
  action:    { bg: 'rgba(255,255,255,0.72)', border: 'rgba(255,255,255,0.55)', textColor: '#1C1C1E',            badge: 'действие',  badgeBg: 'rgba(48,209,88,0.12)',   badgeColor: '#1C8A3C' },
  points:    { bg: 'rgba(255,255,255,0.72)', border: 'rgba(255,255,255,0.55)', textColor: '#1C1C1E',            badge: 'фантики',   badgeBg: 'rgba(48,209,88,0.12)',   badgeColor: '#1C8A3C' },
  followup:  { bg: 'rgba(255,255,255,0.72)', border: 'rgba(255,255,255,0.55)', textColor: '#1C1C1E',            badge: 'догон',     badgeBg: 'rgba(255,149,0,0.13)',   badgeColor: '#B25E00' },
}

const EDITABLE_TYPES: NodeType[] = ['message', 'video', 'action', 'followup']

function formatDelay(min: number): string {
  if (min < 60) return `+${min} мин`
  const hours = min / 60
  return Number.isInteger(hours) ? `+${hours} ч` : `+${hours.toFixed(1)} ч`
}

const TRIGGER_LABEL: Record<FollowupTrigger, string> = {
  clicked:  'нажал кнопку, не оплатил',
  no_click: 'не нажал кнопку',
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function TreeClient() {
  const [selected, setSelected]   = useState<Node | null>(null)
  const [messages, setMessages]   = useState<MsgMap>({})
  const [editing, setEditing]     = useState(false)
  const [draftContent, setDraft]  = useState('')
  const [draftUrl, setDraftUrl]   = useState('')
  const [draftButtons, setDraftButtons] = useState<MsgButton[]>([])
  const [draftEnabled, setDraftEnabled] = useState(true)
  const [saving, setSaving]       = useState(false)
  const [saveOk, setSaveOk]       = useState(false)
  const [testing, setTesting]     = useState(false)
  const [testOk, setTestOk]       = useState(false)

  // Глобальный тумблер «Догоны вкл/выкл»
  const [followupsEnabled, setFollowupsEnabled] = useState<boolean | null>(null)
  const [togglingGlobal, setTogglingGlobal]     = useState(false)

  // Fetch all messages from DB on mount
  useEffect(() => {
    fetch('/api/messages')
      .then(r => r.json())
      .then((map: MsgMap) => setMessages(map))
      .catch(() => {})
    fetch('/api/settings')
      .then(r => r.json())
      .then((s: Record<string, unknown>) => {
        setFollowupsEnabled(s.followups_enabled !== false)
      })
      .catch(() => setFollowupsEnabled(true))
  }, [])

  const toggleGlobalFollowups = async () => {
    if (followupsEnabled === null) return
    const next = !followupsEnabled
    setTogglingGlobal(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'followups_enabled', value: next }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(`Не удалось переключить: ${err.error || res.statusText}`)
        return
      }
      setFollowupsEnabled(next)
    } finally {
      setTogglingGlobal(false)
    }
  }

  // Effective content: DB overrides static default
  const getContent = useCallback((node: Node): string => {
    return messages[node.id]?.content ?? node.detail ?? ''
  }, [messages])

  const getVideoUrl = useCallback((node: Node): string => {
    return messages[node.id]?.video_url ?? ''
  }, [messages])

  const getButtons = useCallback((node: Node): MsgButton[] => {
    return messages[node.id]?.buttons ?? []
  }, [messages])

  const getEnabled = useCallback((node: Node): boolean => {
    return messages[node.id]?.enabled !== false
  }, [messages])

  const openNode = (node: Node) => {
    setSelected(node)
    setEditing(false)
    setSaveOk(false)
    setTestOk(false)
  }

  const handleTest = async () => {
    if (!selected) return
    setTesting(true)
    setTestOk(false)
    try {
      await fetch('/api/messages/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: selected.id,
          label: selected.label,
          type: selected.type,
          content: getContent(selected),
          video_url: getVideoUrl(selected) || null,
          buttons: getButtons(selected),
        }),
      })
      setTestOk(true)
    } finally {
      setTesting(false)
    }
  }

  // Collect message/video descendants in tree order — used by "test event" button
  // on trigger/condition nodes.
  const collectTestables = useCallback((node: Node): Node[] => {
    const out: Node[] = []
    const walk = (n: Node) => {
      if (n.type === 'message' || n.type === 'video') out.push(n)
      n.children?.forEach(walk)
    }
    node.children?.forEach(walk)
    return out
  }, [])

  const handleTestEvent = async () => {
    if (!selected) return
    const items = collectTestables(selected).map(n => ({
      type: n.type as 'message' | 'video',
      label: n.label,
      content: getContent(n),
      video_url: getVideoUrl(n) || null,
      buttons: getButtons(n),
    }))
    if (!items.length) return
    setTesting(true)
    setTestOk(false)
    try {
      await fetch('/api/messages/test-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: selected.label, items }),
      })
      setTestOk(true)
    } finally {
      setTesting(false)
    }
  }

  const startEdit = () => {
    if (!selected) return
    setDraft(getContent(selected))
    setDraftUrl(getVideoUrl(selected))
    setDraftButtons(getButtons(selected).map(b => ({ ...b })))
    setDraftEnabled(getEnabled(selected))
    setEditing(true)
    setSaveOk(false)
  }

  const handleSave = async () => {
    if (!selected) return
    const cleanButtons = draftButtons
      .map(b => ({ label: b.label.trim(), url: b.url.trim() }))
      .filter(b => b.label && b.url)
    setSaving(true)
    try {
      const res = await fetch('/api/messages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: selected.id,
          label: selected.label,
          type: selected.type,
          content: draftContent,
          video_url: draftUrl || null,
          buttons: cleanButtons,
          enabled: draftEnabled,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'unknown error' }))
        alert(`Не удалось сохранить: ${err.error || res.statusText}`)
        return
      }
      setMessages(prev => ({
        ...prev,
        [selected.id]: {
          label: selected.label,
          type: selected.type,
          content: draftContent,
          video_url: draftUrl || undefined,
          buttons: cleanButtons.length ? cleanButtons : undefined,
          enabled: draftEnabled,
        },
      }))
      setEditing(false)
      setSaveOk(true)
    } catch (e) {
      alert(`Сеть недоступна: ${e instanceof Error ? e.message : 'unknown'}`)
    } finally {
      setSaving(false)
    }
  }

  const placed = placeNodes(TREE, 0, 0)
  const byId = new Map(placed.map(p => [p.node.id, p]))
  const totalLeaves = countLeaves(TREE)
  const canvasH = totalLeaves * SLOT + 24
  const canvasW = Math.max(...placed.map(p => p.x)) + NW + 16

  const edges: { x1: number; y1: number; x2: number; y2: number }[] = []
  for (const p of placed) {
    if (p.node.children) {
      for (const child of p.node.children) {
        const cp = byId.get(child.id)
        if (cp) edges.push({ x1: p.x + NW, y1: p.y + NH / 2, x2: cp.x, y2: cp.y + NH / 2 })
      }
    }
  }

  const glassCard = {
    background: 'rgba(255,255,255,0.72)',
    backdropFilter: 'blur(28px) saturate(160%)',
    WebkitBackdropFilter: 'blur(28px) saturate(160%)',
    border: '1px solid rgba(255,255,255,0.55)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.10)',
  } as const

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <div className="inline-block rounded-3xl px-6 py-5" style={glassCard}>
          <div className="text-xs font-semibold uppercase mb-2" style={{ color: 'rgba(28,28,30,0.42)', letterSpacing: '0.8px' }}>
            Автоматизация
          </div>
          <h1 className="text-3xl font-bold" style={{ color: '#1C1C1E', letterSpacing: '-1px', lineHeight: 1.1 }}>
            Дерево сообщений
          </h1>
          <p className="text-sm mt-1" style={{ color: 'rgba(28,28,30,0.50)', letterSpacing: '-0.2px' }}>
            Нажмите на узел, чтобы посмотреть или отредактировать сообщение
          </p>
        </div>

        {/* Global followups toggle */}
        <button
          onClick={toggleGlobalFollowups}
          disabled={togglingGlobal || followupsEnabled === null}
          style={{
            ...glassCard,
            padding: '14px 18px',
            borderRadius: 24,
            cursor: togglingGlobal || followupsEnabled === null ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            border: `1px solid ${followupsEnabled ? 'rgba(48,209,88,0.40)' : 'rgba(255,69,58,0.30)'}`,
          }}
          title="Останавливает или возобновляет все 16 догонов сразу"
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <span style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'rgba(28,28,30,0.50)' }}>
              Догоны
            </span>
            <span style={{ fontSize: 15, fontWeight: 700, color: followupsEnabled ? '#1C8A3C' : '#FF453A', letterSpacing: '-0.3px', marginTop: 2 }}>
              {followupsEnabled === null ? '...' : followupsEnabled ? 'Включены' : 'Выключены'}
            </span>
          </div>
          {/* iOS-style switch */}
          <div style={{
            width: 44, height: 26, borderRadius: 50,
            background: followupsEnabled ? '#34C759' : 'rgba(120,120,128,0.32)',
            position: 'relative',
            transition: 'background 0.18s',
          }}>
            <div style={{
              position: 'absolute',
              top: 2,
              left: followupsEnabled ? 20 : 2,
              width: 22, height: 22, borderRadius: '50%',
              background: '#FFF',
              boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
              transition: 'left 0.18s',
            }} />
          </div>
        </button>
      </div>

      {/* Legend */}
      <div className="rounded-3xl px-5 py-3 mb-5 flex flex-wrap gap-2" style={{
        background: 'rgba(255,255,255,0.62)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        border: '1px solid rgba(255,255,255,0.48)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
      }}>
        {(Object.entries(TYPE_STYLE) as [NodeType, typeof TYPE_STYLE[NodeType]][])
          .filter(([t]) => t !== 'root')
          .map(([t, s]) => (
            <span key={t} className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: s.badgeBg, color: s.badgeColor }}>
              {s.badge}
            </span>
          ))}
        <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: 'rgba(10,132,255,0.10)', color: '#0A84FF', marginLeft: 8 }}>
          ✏️ редактируемые
        </span>
      </div>

      {/* Tree canvas */}
      <div style={{ overflowX: 'auto' }}>
        <div style={{ position: 'relative', width: canvasW, height: canvasH, minWidth: canvasW }}>
          <svg style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }} width={canvasW} height={canvasH}>
            {edges.map((e, i) => {
              const cx = Math.abs(e.x2 - e.x1) * 0.44
              return (
                <path key={i}
                  d={`M ${e.x1} ${e.y1} C ${e.x1 + cx} ${e.y1} ${e.x2 - cx} ${e.y2} ${e.x2} ${e.y2}`}
                  fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth={1.5}
                />
              )
            })}
          </svg>

          {placed.map(({ node, x, y }) => {
            const s = TYPE_STYLE[node.type]
            const isDark = node.type === 'root' || node.type === 'section'
            const isEditable = EDITABLE_TYPES.includes(node.type)
            const hasDbContent = !!messages[node.id]?.content
            const isFollowup = node.type === 'followup'
            const isDisabledFollowup = isFollowup && (
              messages[node.id]?.enabled === false || followupsEnabled === false
            )
            return (
              <div key={node.id} onClick={() => openNode(node)}
                style={{
                  position: 'absolute', left: x, top: y, width: NW, height: NH,
                  background: s.bg, border: `1px solid ${s.border}`,
                  backdropFilter: 'blur(20px) saturate(140%)',
                  WebkitBackdropFilter: 'blur(20px) saturate(140%)',
                  boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.20)' : '0 2px 10px rgba(0,0,0,0.08)',
                  borderRadius: 14, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0 8px 0 10px', gap: 4,
                  transition: 'transform 0.12s, box-shadow 0.12s',
                  opacity: isDisabledFollowup ? 0.42 : 1,
                }}
                onMouseEnter={e => { const el = e.currentTarget as HTMLDivElement; el.style.transform = 'scale(1.04)'; el.style.boxShadow = '0 6px 20px rgba(0,0,0,0.15)' }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLDivElement; el.style.transform = ''; el.style.boxShadow = isDark ? '0 8px 24px rgba(0,0,0,0.20)' : '0 2px 10px rgba(0,0,0,0.08)' }}
              >
                <span style={{ fontSize: 11, fontWeight: 500, color: s.textColor, letterSpacing: '-0.3px', lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', minWidth: 0 }}>
                  {node.label}
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
                  <span style={{ fontSize: 9, fontWeight: 600, color: s.badgeColor, background: s.badgeBg, padding: '2px 6px', borderRadius: 50, whiteSpace: 'nowrap' }}>
                    {s.badge}
                  </span>
                  {isEditable && (
                    <span style={{ fontSize: 8, color: hasDbContent ? '#0A84FF' : 'rgba(28,28,30,0.25)', lineHeight: 1 }}>
                      {hasDbContent ? '✏️' : '○'}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Modal ── */}
      {selected && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.28)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={() => { setSelected(null); setEditing(false) }}
        >
          <div
            style={{ background: 'rgba(255,255,255,0.90)', backdropFilter: 'blur(40px) saturate(180%)', WebkitBackdropFilter: 'blur(40px) saturate(180%)', border: '1px solid rgba(255,255,255,0.72)', boxShadow: '0 24px 64px rgba(0,0,0,0.18)', borderRadius: 24, padding: '26px 28px', maxWidth: 480, width: '100%', maxHeight: '88vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Type badge */}
            <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.4px', textTransform: 'uppercase', color: TYPE_STYLE[selected.type].badgeColor, background: TYPE_STYLE[selected.type].badgeBg, padding: '3px 10px', borderRadius: 50, display: 'inline-block', marginBottom: 10 }}>
              {TYPE_STYLE[selected.type].badge}
            </span>
            {selected.followup && (
              <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.4px', textTransform: 'uppercase', color: '#B25E00', background: 'rgba(255,149,0,0.13)', padding: '3px 10px', borderRadius: 50, display: 'inline-block', marginLeft: 6, marginBottom: 10 }}>
                {formatDelay(selected.followup.delay_minutes)} · {TRIGGER_LABEL[selected.followup.trigger]}
              </span>
            )}
            {selected.type === 'followup' && !getEnabled(selected) && (
              <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.4px', textTransform: 'uppercase', color: '#FF453A', background: 'rgba(255,69,58,0.10)', padding: '3px 10px', borderRadius: 50, display: 'inline-block', marginLeft: 6, marginBottom: 10 }}>
                выключен
              </span>
            )}
            {selected.type === 'followup' && followupsEnabled === false && (
              <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.4px', textTransform: 'uppercase', color: '#FF453A', background: 'rgba(255,69,58,0.10)', padding: '3px 10px', borderRadius: 50, display: 'inline-block', marginLeft: 6, marginBottom: 10 }}>
                догоны выкл глобально
              </span>
            )}

            {/* Title + edit toggle */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
              <h2 style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-0.6px', lineHeight: 1.2, color: '#1C1C1E', margin: 0 }}>
                {selected.label}
              </h2>
              {EDITABLE_TYPES.includes(selected.type) && !editing && (
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={startEdit} style={{ padding: '5px 12px', background: 'rgba(10,132,255,0.10)', border: '1px solid rgba(10,132,255,0.20)', borderRadius: 50, fontSize: 12.5, fontWeight: 600, color: '#0A84FF', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    ✏️ Редактировать
                  </button>
                  {(getContent(selected) || getVideoUrl(selected)) && (
                    <button onClick={handleTest} disabled={testing} style={{ padding: '5px 12px', background: testing ? 'rgba(48,209,88,0.08)' : 'rgba(48,209,88,0.10)', border: '1px solid rgba(48,209,88,0.24)', borderRadius: 50, fontSize: 12.5, fontWeight: 600, color: '#1C8A3C', cursor: testing ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
                      {testing ? '...' : '▶ Проверить'}
                    </button>
                  )}
                </div>
              )}
              {(selected.type === 'trigger' || selected.type === 'condition') && collectTestables(selected).length > 0 && (
                <button onClick={handleTestEvent} disabled={testing} style={{ padding: '5px 12px', background: testing ? 'rgba(48,209,88,0.08)' : 'rgba(48,209,88,0.10)', border: '1px solid rgba(48,209,88,0.24)', borderRadius: 50, fontSize: 12.5, fontWeight: 600, color: '#1C8A3C', cursor: testing ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {testing ? '...' : '▶ Тест события'}
                </button>
              )}
            </div>

            {/* ── View mode ── */}
            {!editing && (
              <>
                {/* Video URL */}
                {selected.type === 'video' && getVideoUrl(selected) && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'rgba(28,28,30,0.38)', marginBottom: 6 }}>Ссылка / File ID</div>
                    <a href={getVideoUrl(selected)} target="_blank" rel="noopener noreferrer"
                      style={{ display: 'block', background: 'rgba(191,90,242,0.07)', border: '1px solid rgba(191,90,242,0.18)', borderRadius: 12, padding: '10px 14px', fontSize: 12.5, color: '#BF5AF2', wordBreak: 'break-all', textDecoration: 'none' }}>
                      {getVideoUrl(selected)}
                    </a>
                  </div>
                )}
                {/* Content — rendered as Telegram HTML */}
                {getContent(selected) && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'rgba(28,28,30,0.38)', marginBottom: 6 }}>
                      {(selected.type === 'message' || selected.type === 'followup') ? 'Текст сообщения' : selected.type === 'video' ? 'Описание' : 'Детали'}
                    </div>
                    <div
                      className="tg-preview"
                      style={{ background: (selected.type === 'message' || selected.type === 'followup') ? 'rgba(10,132,255,0.05)' : 'rgba(28,28,30,0.04)', border: `1px solid ${(selected.type === 'message' || selected.type === 'followup') ? 'rgba(10,132,255,0.12)' : 'rgba(28,28,30,0.08)'}`, borderRadius: 14, padding: '14px 16px', fontSize: 13.5, color: 'rgba(28,28,30,0.85)', lineHeight: 1.65, whiteSpace: 'pre-wrap', letterSpacing: '-0.15px', wordBreak: 'break-word' }}
                      dangerouslySetInnerHTML={{
                        __html: getContent(selected).replace(
                          /<tg-spoiler>([\s\S]*?)<\/tg-spoiler>/g,
                          '<span class="tg-spoiler-preview">$1</span>'
                        ),
                      }}
                    />
                  </div>
                )}
                {/* Buttons — view mode */}
                {getButtons(selected).length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'rgba(28,28,30,0.38)', marginBottom: 6 }}>
                      Кнопки ({getButtons(selected).length}) · клики трекаются
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {getButtons(selected).map((b, i) => (
                        <a key={i} href={b.url} target="_blank" rel="noopener noreferrer"
                          style={{ display: 'block', padding: '9px 14px', background: 'rgba(10,132,255,0.10)', border: '1px solid rgba(10,132,255,0.22)', borderRadius: 12, fontSize: 13, fontWeight: 600, color: '#0A84FF', textAlign: 'center', textDecoration: 'none', wordBreak: 'break-all' }}>
                          {b.label}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
                {saveOk && (
                  <div style={{ marginTop: 10, fontSize: 12.5, color: '#1C8A3C', fontWeight: 500 }}>✓ Сохранено</div>
                )}
                {testOk && (
                  <div style={{ marginTop: 10, fontSize: 12.5, color: '#1C8A3C', fontWeight: 500 }}>✓ Отправлено в @sergeyzolotykh</div>
                )}
                {/* Children */}
                {selected.children?.length ? (
                  <div style={{ marginTop: 14 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'rgba(28,28,30,0.38)', marginBottom: 7 }}>Дочерние ({selected.children.length})</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {selected.children.map(c => (
                        <div key={c.id} onClick={() => openNode(c)}
                          style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.60)', border: '1px solid rgba(255,255,255,0.52)', borderRadius: 12, padding: '8px 12px', cursor: 'pointer' }}>
                          <span style={{ fontSize: 13, fontWeight: 500, color: '#1C1C1E', letterSpacing: '-0.2px', flex: 1 }}>{c.label}</span>
                          <span style={{ fontSize: 9.5, fontWeight: 600, color: TYPE_STYLE[c.type].badgeColor, background: TYPE_STYLE[c.type].badgeBg, padding: '2px 8px', borderRadius: 50, whiteSpace: 'nowrap' }}>
                            {TYPE_STYLE[c.type].badge}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            )}

            {/* ── Edit mode ── */}
            {editing && (
              <div>
                {/* Per-followup toggle */}
                {selected.type === 'followup' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', marginBottom: 14, background: draftEnabled ? 'rgba(48,209,88,0.06)' : 'rgba(255,69,58,0.06)', border: `1px solid ${draftEnabled ? 'rgba(48,209,88,0.22)' : 'rgba(255,69,58,0.22)'}`, borderRadius: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1C1C1E', letterSpacing: '-0.2px' }}>
                        {draftEnabled ? 'Этот догон активен' : 'Этот догон выключен'}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'rgba(28,28,30,0.50)', marginTop: 2 }}>
                        Выкл — не отправляется, но остальные 15 продолжают работать
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDraftEnabled(v => !v)}
                      style={{
                        width: 44, height: 26, borderRadius: 50,
                        background: draftEnabled ? '#34C759' : 'rgba(120,120,128,0.32)',
                        position: 'relative',
                        border: 'none', padding: 0,
                        cursor: 'pointer',
                        transition: 'background 0.18s',
                      }}
                    >
                      <div style={{
                        position: 'absolute',
                        top: 2,
                        left: draftEnabled ? 20 : 2,
                        width: 22, height: 22, borderRadius: '50%',
                        background: '#FFF',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
                        transition: 'left 0.18s',
                      }} />
                    </button>
                  </div>
                )}
                {selected.type === 'video' && (
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'rgba(28,28,30,0.45)', marginBottom: 6 }}>
                      Ссылка / Telegram File ID
                    </label>
                    <input
                      value={draftUrl}
                      onChange={e => setDraftUrl(e.target.value)}
                      placeholder="https://... или file_id из Telegram"
                      style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.70)', border: '1px solid rgba(10,132,255,0.25)', borderRadius: 12, fontSize: 13, color: '#1C1C1E', outline: 'none', letterSpacing: '-0.15px', boxSizing: 'border-box' }}
                    />
                  </div>
                )}
                <div style={{ marginBottom: 6, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'rgba(28,28,30,0.45)' }}>
                  {(selected.type === 'message' || selected.type === 'followup') ? 'Текст сообщения' : 'Описание'}
                </div>
                <TelegramEditor
                  value={draftContent}
                  onChange={setDraft}
                  placeholder={selected.type === 'video' ? 'Подпись к кружку...' : 'Введите текст сообщения...'}
                  minHeight={140}
                  buttons={draftButtons}
                />
                <p style={{ fontSize: 11.5, color: 'rgba(28,28,30,0.42)', marginTop: 6, letterSpacing: '-0.1px' }}>
                  Используй [Имя], [N], [Титул] как плейсхолдеры, бот подставит значения автоматически.
                </p>

                {/* Buttons editor — для текстовых сообщений и догонов (у video_note Telegram не разрешает кнопки) */}
                {(selected.type === 'message' || selected.type === 'followup') && (
                <div style={{ marginTop: 18 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'rgba(28,28,30,0.45)' }}>
                      Inline-кнопки
                    </label>
                    <button type="button"
                      onClick={() => setDraftButtons(prev => [...prev, { label: '', url: '' }])}
                      style={{ padding: '4px 10px', background: 'rgba(10,132,255,0.10)', border: '1px solid rgba(10,132,255,0.22)', borderRadius: 50, fontSize: 11.5, fontWeight: 600, color: '#0A84FF', cursor: 'pointer' }}>
                      + Добавить
                    </button>
                  </div>
                  {draftButtons.length === 0 ? (
                    <p style={{ fontSize: 11.5, color: 'rgba(28,28,30,0.42)', letterSpacing: '-0.1px', margin: 0 }}>
                      Нет кнопок. Добавь кнопку с URL — например «Оплатить» с ссылкой на Tribute. Клики автоматически логируются.
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {draftButtons.map((b, i) => (
                        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 10, background: 'rgba(10,132,255,0.04)', border: '1px solid rgba(10,132,255,0.14)', borderRadius: 12 }}>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <input
                              value={b.label}
                              onChange={e => setDraftButtons(prev => prev.map((x, j) => j === i ? { ...x, label: e.target.value } : x))}
                              placeholder="Текст кнопки (например, Оплатить)"
                              maxLength={60}
                              style={{ flex: 1, padding: '8px 12px', background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(10,132,255,0.20)', borderRadius: 10, fontSize: 13, color: '#1C1C1E', outline: 'none', boxSizing: 'border-box' }}
                            />
                            <button type="button"
                              onClick={() => setDraftButtons(prev => prev.filter((_, j) => j !== i))}
                              title="Удалить кнопку"
                              style={{ padding: '6px 10px', background: 'rgba(255,69,58,0.10)', border: '1px solid rgba(255,69,58,0.22)', borderRadius: 10, fontSize: 13, color: '#FF453A', cursor: 'pointer' }}>
                              ✕
                            </button>
                          </div>
                          <input
                            value={b.url}
                            onChange={e => setDraftButtons(prev => prev.map((x, j) => j === i ? { ...x, url: e.target.value } : x))}
                            placeholder="https://tribute.tg/..."
                            style={{ width: '100%', padding: '8px 12px', background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(10,132,255,0.20)', borderRadius: 10, fontSize: 12.5, color: '#1C1C1E', outline: 'none', boxSizing: 'border-box', fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace' }}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                  <button onClick={handleSave} disabled={saving}
                    style={{ flex: 1, padding: '11px 0', background: saving ? 'rgba(10,132,255,0.25)' : '#0A84FF', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, color: '#FFFFFF', cursor: saving ? 'not-allowed' : 'pointer', letterSpacing: '-0.2px' }}>
                    {saving ? 'Сохраняю...' : 'Сохранить'}
                  </button>
                  <button onClick={() => setEditing(false)}
                    style={{ padding: '11px 20px', background: 'rgba(28,28,30,0.07)', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 500, color: 'rgba(28,28,30,0.60)', cursor: 'pointer' }}>
                    Отмена
                  </button>
                </div>
              </div>
            )}

            {/* Close */}
            {!editing && (
              <button onClick={() => { setSelected(null); setEditing(false) }}
                style={{ marginTop: 16, width: '100%', padding: '10px 0', background: 'rgba(28,28,30,0.06)', border: 'none', borderRadius: 12, fontSize: 13.5, fontWeight: 500, color: 'rgba(28,28,30,0.55)', cursor: 'pointer', letterSpacing: '-0.2px' }}>
                Закрыть
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
