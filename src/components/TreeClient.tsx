'use client'
import { useState, useEffect, useCallback } from 'react'
import TelegramEditor from './TelegramEditor'

type NodeType = 'root' | 'section' | 'trigger' | 'condition' | 'message' | 'video' | 'action' | 'points'

interface Node {
  id: string
  label: string
  type: NodeType
  detail?: string       // default text shown if DB has no record
  children?: Node[]
}

type MsgRecord = { label: string; type: string; content: string; video_url?: string }
type MsgMap = Record<string, MsgRecord>

// ─── Tree data ────────────────────────────────────────────────────────────────
const TREE: Node = {
  id: 'root', label: 'AI Олимп Бот', type: 'root',
  children: [
    {
      id: 's1', label: '1-я неделя в клубе', type: 'section',
      children: [
        {
          id: 't_start', label: '/start', type: 'trigger', detail: 'Первый контакт пользователя с ботом',
          children: [
            { id: 'c_notmember', label: 'Не участник', type: 'condition', detail: 'Не найден в базе members',
              children: [
                { id: 'l_sales', label: 'Продающее сообщение', type: 'message', detail: 'Привет! Клуб AI Олимп...' },
              ],
            },
            { id: 'c_active', label: 'Активный участник', type: 'condition', detail: 'welcome_sent = true',
              children: [
                { id: 'l_profile', label: 'Профиль участника', type: 'message', detail: 'Ранг + листики + дней в клубе' },
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
                { id: 'l_subvideo',    label: 'Кружок от Сергея', type: 'video',   detail: 'Видео при новой подписке' },
                { id: 'l_subcongrats', label: 'Поздравление',     type: 'message', detail: '[Имя], ты официально в AI Олимп!' },
              ],
            },
            { id: 'c_renew', label: 'Продление', type: 'condition', detail: 'event: renewed_subscription',
              children: [
                { id: 'l_renewmsg', label: 'Подписка продлена', type: 'message', detail: '+100 листиков за верность' },
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
        { id: 't_activity', label: 'Активность → Листики', type: 'trigger',
          children: [
            { id: 'l_msgpts',    label: 'Сообщение в чате',  type: 'points', detail: 'Отслеживается для еженедельного бонуса (листики не начисляются)' },
            { id: 'l_reactgive', label: 'Поставить реакцию', type: 'points', detail: '+1 листик тому, кто поставил' },
            { id: 'l_reactrecv', label: 'Получить реакцию',  type: 'points', detail: '+3 листика автору сообщения' },
            { id: 'l_poll',      label: 'Голосование',       type: 'points', detail: '+5 листиков проголосовавшему' },
            { id: 'c_rankup', label: 'Новый ранг', type: 'condition', detail: 'Порог листиков пересечён',
              children: [
                { id: 'l_title',     label: 'Обновление титула', type: 'action',  detail: 'promoteChatMember + setChatAdministratorCustomTitle' },
                { id: 'l_ranknotif', label: 'Уведомление в DM',  type: 'message', detail: 'Поздравляю! Ты достиг ранга [Ранг]!' },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 's4', label: 'Еженедельные касания', type: 'section',
      children: [
        { id: 'w_video', label: 'Кружок от Сергея', type: 'video', detail: 'Еженедельный video note от Сергея.' },
        { id: 'w1', label: 'Неделя 1', type: 'trigger', detail: 'Первая неделя в клубе',
          children: [
            { id: 'w1_dead',   label: 'Мертвяки',   type: 'condition', detail: 'Ни одного сообщения', children: [{ id: 'w1_dead_msg',   label: 'Бонус за первый шаг',    type: 'message', detail: '' }] },
            { id: 'w1_silent', label: 'Молчуны',    type: 'condition', detail: 'Менее 3 сообщений',   children: [{ id: 'w1_silent_msg', label: 'Как получить листики',   type: 'message', detail: '' }] },
            { id: 'w1_medium', label: 'Середняки',  type: 'condition', detail: '3–9 сообщений',       children: [{ id: 'w1_medium_msg', label: 'До следующего ранга',    type: 'message', detail: '' }] },
            { id: 'w1_active', label: 'Активные',   type: 'condition', detail: '10+ сообщений',       children: [{ id: 'w1_active_msg', label: 'Бейдж топа',             type: 'message', detail: '' }] },
          ],
        },
        { id: 'w2', label: 'Неделя 2', type: 'trigger', detail: 'Вторая неделя',
          children: [
            { id: 'w2_dead',   label: 'Мертвяки',  type: 'condition', detail: '', children: [{ id: 'w2_dead_msg',   label: 'Вопрос про ожидания',  type: 'message', detail: '' }] },
            { id: 'w2_silent', label: 'Молчуны',   type: 'condition', detail: '', children: [{ id: 'w2_silent_msg', label: 'Напоминание + дайджест',type: 'message', detail: '' }] },
            { id: 'w2_medium', label: 'Середняки', type: 'condition', detail: '', children: [{ id: 'w2_medium_msg', label: 'Тизер следующей недели', type: 'message', detail: '' }] },
            { id: 'w2_active', label: 'Активные',  type: 'condition', detail: '', children: [{ id: 'w2_active_msg', label: 'Ранний доступ',          type: 'message', detail: '' }] },
          ],
        },
        { id: 'w3', label: 'Неделя 3', type: 'trigger', detail: 'Третья неделя',
          children: [
            { id: 'w3_dead',   label: 'Мертвяки',  type: 'condition', detail: '', children: [{ id: 'w3_dead_msg',   label: 'Двойные листики',     type: 'message', detail: '' }] },
            { id: 'w3_silent', label: 'Молчуны',   type: 'condition', detail: '', children: [{ id: 'w3_silent_msg', label: 'Напоминание о колесе', type: 'message', detail: '' }] },
            { id: 'w3_medium', label: 'Середняки', type: 'condition', detail: '', children: [{ id: 'w3_medium_msg', label: 'Итоги за 3 недели',    type: 'message', detail: '' }] },
            { id: 'w3_active', label: 'Активные',  type: 'condition', detail: '', children: [{ id: 'w3_active_msg', label: 'Топ таблицы лидеров', type: 'message', detail: '' }] },
          ],
        },
        { id: 'w4', label: 'Неделя 4 · перед продлением', type: 'trigger', detail: 'За 7 дней до продления',
          children: [
            { id: 'w4_dead',   label: 'Мертвяки',  type: 'condition', detail: '', children: [{ id: 'w4_dead_msg',   label: 'Предупреждение об уходе', type: 'message', detail: '' }] },
            { id: 'w4_silent', label: 'Молчуны',   type: 'condition', detail: '', children: [{ id: 'w4_silent_msg', label: 'Анонс следующего месяца', type: 'message', detail: '' }] },
            { id: 'w4_medium', label: 'Середняки', type: 'condition', detail: '', children: [{ id: 'w4_medium_msg', label: 'Итоги месяца',            type: 'message', detail: '' }] },
            { id: 'w4_active', label: 'Активные',  type: 'condition', detail: '', children: [{ id: 'w4_active_msg', label: 'Личная благодарность',    type: 'message', detail: '' }] },
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
  points:    { bg: 'rgba(255,255,255,0.72)', border: 'rgba(255,255,255,0.55)', textColor: '#1C1C1E',            badge: 'листики',   badgeBg: 'rgba(48,209,88,0.12)',   badgeColor: '#1C8A3C' },
}

const EDITABLE_TYPES: NodeType[] = ['message', 'video', 'action']

// ─── Main component ───────────────────────────────────────────────────────────
export default function TreeClient() {
  const [selected, setSelected]   = useState<Node | null>(null)
  const [messages, setMessages]   = useState<MsgMap>({})
  const [editing, setEditing]     = useState(false)
  const [draftContent, setDraft]  = useState('')
  const [draftUrl, setDraftUrl]   = useState('')
  const [saving, setSaving]       = useState(false)
  const [saveOk, setSaveOk]       = useState(false)
  const [testing, setTesting]     = useState(false)
  const [testOk, setTestOk]       = useState(false)

  // Fetch all messages from DB on mount
  useEffect(() => {
    fetch('/api/messages')
      .then(r => r.json())
      .then((map: MsgMap) => setMessages(map))
      .catch(() => {})
  }, [])

  // Effective content: DB overrides static default
  const getContent = useCallback((node: Node): string => {
    return messages[node.id]?.content ?? node.detail ?? ''
  }, [messages])

  const getVideoUrl = useCallback((node: Node): string => {
    return messages[node.id]?.video_url ?? ''
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
        }),
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
    setEditing(true)
    setSaveOk(false)
  }

  const handleSave = async () => {
    if (!selected) return
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
  const canvasW = 5 * LW + NW + 16

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
      <div className="inline-block rounded-3xl px-6 py-5 mb-5" style={glassCard}>
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
                  {getContent(selected) && (
                    <button onClick={handleTest} disabled={testing} style={{ padding: '5px 12px', background: testing ? 'rgba(48,209,88,0.08)' : 'rgba(48,209,88,0.10)', border: '1px solid rgba(48,209,88,0.24)', borderRadius: 50, fontSize: 12.5, fontWeight: 600, color: '#1C8A3C', cursor: testing ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
                      {testing ? '...' : '▶ Проверить'}
                    </button>
                  )}
                </div>
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
                      {selected.type === 'message' ? 'Текст сообщения' : selected.type === 'video' ? 'Описание' : 'Детали'}
                    </div>
                    <div
                      className="tg-preview"
                      style={{ background: selected.type === 'message' ? 'rgba(10,132,255,0.05)' : 'rgba(28,28,30,0.04)', border: `1px solid ${selected.type === 'message' ? 'rgba(10,132,255,0.12)' : 'rgba(28,28,30,0.08)'}`, borderRadius: 14, padding: '14px 16px', fontSize: 13.5, color: 'rgba(28,28,30,0.85)', lineHeight: 1.65, whiteSpace: 'pre-wrap', letterSpacing: '-0.15px', wordBreak: 'break-word' }}
                      dangerouslySetInnerHTML={{
                        __html: getContent(selected).replace(
                          /<tg-spoiler>([\s\S]*?)<\/tg-spoiler>/g,
                          '<span class="tg-spoiler-preview">$1</span>'
                        ),
                      }}
                    />
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
                  {selected.type === 'message' ? 'Текст сообщения' : 'Описание'}
                </div>
                <TelegramEditor
                  value={draftContent}
                  onChange={setDraft}
                  placeholder={selected.type === 'video' ? 'Подпись к кружку...' : 'Введите текст сообщения...'}
                  minHeight={140}
                />
                <p style={{ fontSize: 11.5, color: 'rgba(28,28,30,0.42)', marginTop: 6, letterSpacing: '-0.1px' }}>
                  Используй [Имя], [N], [Ранг] как плейсхолдеры, бот подставит значения автоматически.
                </p>
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
