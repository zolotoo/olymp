'use client'
import { useState } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────
type NodeType = 'root' | 'section' | 'trigger' | 'condition' | 'message' | 'video' | 'action' | 'points'

interface Node {
  id: string
  label: string
  type: NodeType
  detail?: string
  children?: Node[]
}

// ─── Tree data ────────────────────────────────────────────────────────────────
const TREE: Node = {
  id: 'root', label: 'AI Олимп Бот', type: 'root',
  children: [
    {
      id: 's1', label: '1-я неделя в клубе', type: 'section',
      children: [
        {
          id: 't_start', label: '/start', type: 'trigger', detail: 'Первый контакт с ботом',
          children: [
            {
              id: 'c_notmember', label: 'Не участник', type: 'condition', detail: 'Не найден в базе members',
              children: [
                { id: 'l_sales', label: 'Продающее сообщение', type: 'message', detail: 'Описание клуба + ссылка Tribute' },
              ],
            },
            {
              id: 'c_nowelcome', label: 'Без приветствия', type: 'condition', detail: 'welcome_sent = false',
              children: [
                { id: 'l_wvideo', label: 'Кружок от Сергея', type: 'video', detail: 'Video note, один раз при входе' },
                { id: 'l_wmsg', label: 'Приветственное сообщение', type: 'message', detail: 'Имя, клуб, листики, ранги' },
              ],
            },
            {
              id: 'c_active', label: 'Активный участник', type: 'condition', detail: 'welcome_sent = true',
              children: [
                { id: 'l_profile', label: 'Профиль участника', type: 'message', detail: 'Ранг + листики + дней в клубе' },
              ],
            },
          ],
        },
        {
          id: 't_joinreq', label: 'Заявка в канал', type: 'trigger', detail: 'chat_join_request',
          children: [
            { id: 'l_approve', label: 'Авто-одобрение', type: 'action', detail: 'approveChatJoinRequest' },
            { id: 'l_jrvideo', label: 'Кружок в DM', type: 'video', detail: 'Если DM заблокирован — пропускается' },
          ],
        },
        {
          id: 't_newmem', label: 'Вступление в группу', type: 'trigger', detail: 'new_chat_members',
          children: [
            { id: 'l_grpwel', label: 'Приветствие в группе', type: 'message', detail: '@упоминание нового участника' },
            { id: 'l_dmwel', label: 'Приветствие в DM', type: 'message', detail: 'Если ещё не было отправлено' },
          ],
        },
      ],
    },
    {
      id: 's2', label: '1-й месяц в клубе', type: 'section',
      children: [
        {
          id: 't_tribute', label: 'Tribute — подписка', type: 'trigger', detail: 'Webhook от Tribute.co',
          children: [
            {
              id: 'c_newsub', label: 'Новая подписка', type: 'condition', detail: 'event: new_subscription',
              children: [
                { id: 'l_subvideo', label: 'Кружок от Сергея', type: 'video', detail: 'Video note при новой подписке' },
                { id: 'l_subcongrats', label: 'Поздравление', type: 'message', detail: 'Дата подписки + инструкция по invite' },
              ],
            },
            {
              id: 'c_renew', label: 'Продление', type: 'condition', detail: 'event: renewed_subscription',
              children: [
                { id: 'l_renewmsg', label: 'Подписка продлена', type: 'message', detail: '+100 листиков за верность' },
              ],
            },
            {
              id: 'c_cancel', label: 'Отписка', type: 'condition', detail: 'event: cancelled_subscription',
              children: [
                { id: 'l_adminnotif', label: 'Уведомление админу', type: 'action', detail: 'В TELEGRAM_ADMIN_CHAT_ID' },
                { id: 'l_farewell', label: 'Прощание участнику', type: 'message', detail: 'Приглашение дать обратную связь' },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 's3', label: 'Активность — постоянно', type: 'section',
      children: [
        {
          id: 't_activity', label: 'Активность — листики', type: 'trigger',
          children: [
            { id: 'l_msgpts',    label: 'Сообщение в чате', type: 'points', detail: '+1 листик автору' },
            { id: 'l_reactgive', label: 'Поставить реакцию', type: 'points', detail: '+1 листик тому, кто поставил' },
            { id: 'l_reactrecv', label: 'Получить реакцию',  type: 'points', detail: '+3 листика автору сообщения' },
            { id: 'l_poll',      label: 'Голосование',       type: 'points', detail: '+5 листиков проголосовавшему' },
            {
              id: 'c_rankup', label: 'Новый ранг', type: 'condition', detail: 'При достижении порога листиков',
              children: [
                { id: 'l_title',    label: 'Обновление титула',  type: 'action',  detail: 'Admin без прав + кастомный Telegram-титул' },
                { id: 'l_ranknotif', label: 'Уведомление в DM', type: 'message', detail: 'Новый ранг + поздравление' },
              ],
            },
          ],
        },
      ],
    },
  ],
}

// ─── Layout ───────────────────────────────────────────────────────────────────
const NW = 160   // node width
const NH = 40    // node height
const SLOT = 52  // vertical slot per leaf (NH + gap)
const LW = 210   // horizontal level width

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
  root:      { bg: 'rgba(18,18,20,0.70)',  border: 'rgba(255,255,255,0.14)', textColor: '#FFFFFF',  badge: 'бот',       badgeBg: 'rgba(255,255,255,0.15)', badgeColor: 'rgba(255,255,255,0.75)' },
  section:   { bg: 'rgba(24,24,28,0.62)',  border: 'rgba(255,255,255,0.12)', textColor: '#FFFFFF',  badge: 'раздел',    badgeBg: 'rgba(255,255,255,0.12)', badgeColor: 'rgba(255,255,255,0.65)' },
  trigger:   { bg: 'rgba(255,255,255,0.68)', border: 'rgba(255,255,255,0.52)', textColor: '#1C1C1E', badge: 'триггер',   badgeBg: 'rgba(255,149,0,0.14)',   badgeColor: '#C07000' },
  condition: { bg: 'rgba(255,255,255,0.55)', border: 'rgba(255,255,255,0.42)', textColor: '#3C3C43', badge: 'ветка',     badgeBg: 'rgba(90,90,100,0.12)',   badgeColor: '#636366' },
  message:   { bg: 'rgba(255,255,255,0.68)', border: 'rgba(255,255,255,0.52)', textColor: '#1C1C1E', badge: 'сообщение', badgeBg: 'rgba(10,132,255,0.13)',  badgeColor: '#0A84FF' },
  video:     { bg: 'rgba(255,255,255,0.68)', border: 'rgba(255,255,255,0.52)', textColor: '#1C1C1E', badge: 'видео',     badgeBg: 'rgba(191,90,242,0.13)',  badgeColor: '#BF5AF2' },
  action:    { bg: 'rgba(255,255,255,0.68)', border: 'rgba(255,255,255,0.52)', textColor: '#1C1C1E', badge: 'действие',  badgeBg: 'rgba(48,209,88,0.13)',   badgeColor: '#28A745' },
  points:    { bg: 'rgba(255,255,255,0.68)', border: 'rgba(255,255,255,0.52)', textColor: '#1C1C1E', badge: 'листики',   badgeBg: 'rgba(48,209,88,0.13)',   badgeColor: '#28A745' },
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function TreeClient() {
  const [selected, setSelected] = useState<Node | null>(null)

  const placed = placeNodes(TREE, 0, 0)
  const byId = new Map(placed.map(p => [p.node.id, p]))
  const totalLeaves = countLeaves(TREE)
  const canvasH = totalLeaves * SLOT + 20
  const canvasW = 4 * LW + NW + 20

  // Collect all edges
  const edges: { x1: number; y1: number; x2: number; y2: number }[] = []
  for (const p of placed) {
    if (p.node.children) {
      for (const child of p.node.children) {
        const cp = byId.get(child.id)
        if (cp) {
          edges.push({
            x1: p.x + NW, y1: p.y + NH / 2,
            x2: cp.x,     y2: cp.y + NH / 2,
          })
        }
      }
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="glass rounded-2xl px-6 py-5 mb-6 inline-block">
        <div
          className="text-xs font-semibold mb-2 tracking-widest uppercase"
          style={{ color: 'rgba(28,28,30,0.5)', letterSpacing: '0.8px' }}
        >
          Автоматизация
        </div>
        <h1 className="text-3xl font-bold" style={{ color: '#1C1C1E', letterSpacing: '-1px', lineHeight: 1.1 }}>
          Дерево сообщений
        </h1>
        <p className="text-sm mt-1" style={{ color: 'rgba(28,28,30,0.55)', letterSpacing: '-0.2px' }}>
          Нажмите на узел чтобы увидеть детали
        </p>
      </div>

      {/* Legend */}
      <div className="glass-sm rounded-2xl px-5 py-3 mb-6 flex flex-wrap gap-2.5">
        {(Object.entries(TYPE_STYLE) as [NodeType, typeof TYPE_STYLE[NodeType]][])
          .filter(([t]) => t !== 'root')
          .map(([, s]) => (
            <span
              key={s.badge}
              className="text-xs font-medium px-2.5 py-1 rounded-full"
              style={{ background: s.badgeBg, color: s.badgeColor }}
            >
              {s.badge}
            </span>
          ))}
      </div>

      {/* Tree canvas */}
      <div className="overflow-x-auto">
        <div style={{ position: 'relative', width: canvasW, height: canvasH }}>
          {/* SVG edges */}
          <svg
            style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }}
            width={canvasW} height={canvasH}
          >
            {edges.map((e, i) => {
              const cx = Math.abs(e.x2 - e.x1) * 0.42
              return (
                <path
                  key={i}
                  d={`M ${e.x1} ${e.y1} C ${e.x1 + cx} ${e.y1} ${e.x2 - cx} ${e.y2} ${e.x2} ${e.y2}`}
                  fill="none"
                  stroke="rgba(255,255,255,0.50)"
                  strokeWidth={1.5}
                />
              )
            })}
          </svg>

          {/* Nodes */}
          {placed.map(({ node, x, y }) => {
            const s = TYPE_STYLE[node.type]
            return (
              <div
                key={node.id}
                onClick={() => setSelected(node)}
                style={{
                  position: 'absolute',
                  left: x,
                  top: y,
                  width: NW,
                  height: NH,
                  background: s.bg,
                  border: `1px solid ${s.border}`,
                  backdropFilter: 'blur(20px) saturate(140%)',
                  WebkitBackdropFilter: 'blur(20px) saturate(140%)',
                  boxShadow: node.type === 'root' || node.type === 'section'
                    ? '0 8px 24px rgba(0,0,0,0.22)'
                    : '0 2px 10px rgba(0,0,0,0.10)',
                  borderRadius: 12,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0 10px',
                  gap: 6,
                  transition: 'transform 0.12s, box-shadow 0.12s',
                }}
                onMouseEnter={e => {
                  ;(e.currentTarget as HTMLDivElement).style.transform = 'scale(1.03)'
                  ;(e.currentTarget as HTMLDivElement).style.boxShadow = '0 6px 20px rgba(0,0,0,0.18)'
                }}
                onMouseLeave={e => {
                  ;(e.currentTarget as HTMLDivElement).style.transform = ''
                  ;(e.currentTarget as HTMLDivElement).style.boxShadow = node.type === 'root' || node.type === 'section'
                    ? '0 8px 24px rgba(0,0,0,0.22)'
                    : '0 2px 10px rgba(0,0,0,0.10)'
                }}
              >
                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: 500,
                    color: s.textColor,
                    letterSpacing: '-0.3px',
                    lineHeight: 1.3,
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    minWidth: 0,
                  }}
                >
                  {node.label}
                </span>
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 600,
                    color: s.badgeColor,
                    background: s.badgeBg,
                    padding: '2px 6px',
                    borderRadius: 50,
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    letterSpacing: '0.2px',
                  }}
                >
                  {s.badge}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Modal */}
      {selected && (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.35)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
          onClick={() => setSelected(null)}
        >
          <div
            style={{
              background: 'rgba(255,255,255,0.82)',
              backdropFilter: 'blur(40px) saturate(180%)',
              WebkitBackdropFilter: 'blur(40px) saturate(180%)',
              border: '1px solid rgba(255,255,255,0.70)',
              boxShadow: '0 24px 64px rgba(0,0,0,0.20)',
              borderRadius: 20,
              padding: '28px 32px',
              maxWidth: 420,
              width: '100%',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Badge */}
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.4px',
                textTransform: 'uppercase',
                color: TYPE_STYLE[selected.type].badgeColor,
                background: TYPE_STYLE[selected.type].badgeBg,
                padding: '3px 10px',
                borderRadius: 50,
                display: 'inline-block',
                marginBottom: 12,
              }}
            >
              {TYPE_STYLE[selected.type].badge}
            </span>
            {/* Title */}
            <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.7px', lineHeight: 1.2, color: '#1C1C1E', marginBottom: 8 }}>
              {selected.label}
            </h2>
            {/* Detail */}
            {selected.detail && (
              <p style={{ fontSize: 14, color: 'rgba(28,28,30,0.65)', letterSpacing: '-0.2px', lineHeight: 1.5 }}>
                {selected.detail}
              </p>
            )}
            {/* Children list */}
            {selected.children?.length ? (
              <div style={{ marginTop: 16, borderTop: '1px solid rgba(28,28,30,0.08)', paddingTop: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'rgba(28,28,30,0.38)', marginBottom: 8 }}>
                  Дочерние узлы
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {selected.children.map(c => (
                    <div
                      key={c.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        background: 'rgba(255,255,255,0.55)',
                        border: '1px solid rgba(255,255,255,0.50)',
                        borderRadius: 10,
                        padding: '7px 12px',
                        cursor: 'pointer',
                      }}
                      onClick={() => setSelected(c)}
                    >
                      <span style={{ fontSize: 13, fontWeight: 500, color: '#1C1C1E', letterSpacing: '-0.2px', flex: 1 }}>{c.label}</span>
                      <span style={{
                        fontSize: 10, fontWeight: 600,
                        color: TYPE_STYLE[c.type].badgeColor,
                        background: TYPE_STYLE[c.type].badgeBg,
                        padding: '2px 8px', borderRadius: 50,
                      }}>
                        {TYPE_STYLE[c.type].badge}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {/* Close */}
            <button
              onClick={() => setSelected(null)}
              style={{
                marginTop: 20,
                width: '100%',
                padding: '10px 0',
                background: 'rgba(28,28,30,0.07)',
                border: 'none',
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 500,
                color: 'rgba(28,28,30,0.65)',
                cursor: 'pointer',
                letterSpacing: '-0.2px',
              }}
            >
              Закрыть
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
