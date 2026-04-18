export const metadata = { title: 'Дерево сообщений — AI Олимп' }

// ─── Data ─────────────────────────────────────────────────────────────────────
type NodeType = 'root' | 'trigger' | 'condition' | 'message' | 'video' | 'action' | 'points'

interface TreeNode {
  label: string
  desc?: string
  type: NodeType
  children?: TreeNode[]
}

const TREE: TreeNode = {
  label: '🤖 AI Олимп Бот',
  type: 'root',
  children: [
    {
      label: '/start — первый контакт',
      type: 'trigger',
      children: [
        {
          label: 'Не участник клуба',
          type: 'condition',
          children: [
            { label: '💳 Продающее сообщение', desc: 'Описание клуба + ссылка Tribute', type: 'message' },
          ],
        },
        {
          label: 'Участник — welcome не отправлен',
          type: 'condition',
          children: [
            { label: '🎥 Кружок от Сергея', desc: 'video note, 1 раз при входе', type: 'video' },
            { label: '👋 Приветственное сообщение', desc: 'Имя, клуб, листики, ранги', type: 'message' },
          ],
        },
        {
          label: 'Активный участник',
          type: 'condition',
          children: [
            { label: '📊 Профиль', desc: 'Ранг + листики + дней в клубе', type: 'message' },
          ],
        },
      ],
    },

    {
      label: '💳 Tribute — оплата подписки',
      type: 'trigger',
      children: [
        {
          label: 'new_subscription',
          type: 'condition',
          children: [
            { label: '🎥 Кружок от Сергея', type: 'video' },
            { label: '🎉 Поздравление с вступлением', desc: 'Дата подписки + инструкция по invite', type: 'message' },
          ],
        },
        {
          label: 'renewed_subscription',
          type: 'condition',
          children: [
            { label: '✅ Подписка продлена', desc: '+100 листиков за верность 🍃', type: 'message' },
          ],
        },
        {
          label: 'cancelled_subscription',
          type: 'condition',
          children: [
            { label: '❌ Уведомление админу', desc: 'В TELEGRAM_ADMIN_CHAT_ID', type: 'action' },
            { label: '💬 Прощание участнику', desc: 'Приглашение дать обратную связь', type: 'message' },
          ],
        },
      ],
    },

    {
      label: '📨 Заявка в канал (chat_join_request)',
      type: 'trigger',
      children: [
        { label: '✅ Авто-одобрение заявки', desc: 'approveChatJoinRequest', type: 'action' },
        { label: '🎥 Кружок + приветствие в DM', desc: 'Если DM заблокирован — пропускается', type: 'video' },
      ],
    },

    {
      label: '👥 Вступление в группу (new_chat_members)',
      type: 'trigger',
      children: [
        { label: '👋 Приветствие в группе', desc: '@упоминание нового участника', type: 'message' },
        { label: '👋 Приветствие в DM', desc: 'Если ещё не было отправлено', type: 'message' },
      ],
    },

    {
      label: '📊 Активность → Листики 🍃',
      type: 'trigger',
      children: [
        { label: '💬 Сообщение в чате', desc: '+1 🍃 автору', type: 'points' },
        { label: '👍 Поставить реакцию', desc: '+1 🍃 тому, кто поставил', type: 'points' },
        { label: '❤️ Получить реакцию', desc: '+3 🍃 автору сообщения', type: 'points' },
        { label: '🗳️ Проголосовать в опросе', desc: '+5 🍃 проголосовавшему', type: 'points' },
        {
          label: '🏆 Новый ранг (при достижении порога)',
          type: 'condition',
          children: [
            { label: '⚡→⚔️→🌊→🔱→👑 Telegram-титул обновлён', desc: 'Admin без прав + кастомный титул', type: 'action' },
            { label: '🎉 Уведомление участнику в DM', desc: 'Новый ранг + поздравление', type: 'message' },
          ],
        },
      ],
    },
  ],
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const NODE_STYLE: Record<NodeType, { bg: string; border: string; color: string; badge: string; badgeBg: string; badgeColor: string }> = {
  root:      { bg: '#1D1D1F', border: '#1D1D1F', color: '#FFFFFF', badge: 'корень',    badgeBg: 'rgba(255,255,255,0.15)', badgeColor: '#FFFFFF' },
  trigger:   { bg: '#FFFFFF', border: '#E5E5EA', color: '#1D1D1F', badge: 'триггер',   badgeBg: 'rgba(255,149,0,0.1)',   badgeColor: '#FF9500' },
  condition: { bg: '#F9F9FB', border: '#E5E5EA', color: '#6E6E73', badge: 'ветка',     badgeBg: 'rgba(174,174,178,0.12)',badgeColor: '#8E8E93' },
  message:   { bg: '#FFFFFF', border: '#E5E5EA', color: '#1D1D1F', badge: 'сообщение', badgeBg: 'rgba(10,132,255,0.08)', badgeColor: '#0A84FF' },
  video:     { bg: '#FFFFFF', border: '#E5E5EA', color: '#1D1D1F', badge: 'видео',     badgeBg: 'rgba(191,90,242,0.08)', badgeColor: '#BF5AF2' },
  action:    { bg: '#FFFFFF', border: '#E5E5EA', color: '#1D1D1F', badge: 'действие',  badgeBg: 'rgba(48,209,88,0.08)',  badgeColor: '#30D158' },
  points:    { bg: '#FFFFFF', border: '#E5E5EA', color: '#1D1D1F', badge: 'листики',   badgeBg: 'rgba(48,209,88,0.1)',   badgeColor: '#30D158' },
}

// ─── Components ───────────────────────────────────────────────────────────────
function NodeCard({ node }: { node: TreeNode }) {
  const s = NODE_STYLE[node.type]
  return (
    <div
      className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl"
      style={{
        background: s.bg,
        border: `1px solid ${s.border}`,
        boxShadow: node.type === 'root' ? '0 4px 20px rgba(0,0,0,0.15)' : '0 1px 4px rgba(0,0,0,0.04)',
        minWidth: 0,
      }}
    >
      <div className="min-w-0">
        <span className="text-sm font-medium leading-snug" style={{ color: s.color }}>
          {node.label}
        </span>
        {node.desc && (
          <div className="text-xs mt-0.5 truncate" style={{ color: '#AEAEB2' }}>{node.desc}</div>
        )}
      </div>
      <span
        className="text-xs font-medium px-2 py-0.5 rounded-full shrink-0"
        style={{ background: s.badgeBg, color: s.badgeColor }}
      >
        {s.badge}
      </span>
    </div>
  )
}

function TreeNodeComponent({ node, isLast = false }: { node: TreeNode; isLast?: boolean }) {
  const hasChildren = node.children && node.children.length > 0
  return (
    <div>
      <NodeCard node={node} />
      {hasChildren && (
        <div className="tree-children">
          {node.children!.map((child, i) => (
            <div key={i} className={`tree-child${i === node.children!.length - 1 ? ' tree-child-last' : ''}`}>
              <TreeNodeComponent node={child} isLast={i === node.children!.length - 1} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function FlowPage() {
  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="mb-8">
        <div
          className="inline-block text-xs font-semibold px-3 py-1 rounded-full mb-3"
          style={{ background: 'rgba(10,132,255,0.08)', color: '#0A84FF', letterSpacing: '0.5px' }}
        >
          АВТОМАТИЗАЦИЯ
        </div>
        <h1 className="text-3xl font-bold mb-1" style={{ color: '#1D1D1F', letterSpacing: '-0.6px' }}>
          Дерево сообщений
        </h1>
        <p className="text-sm" style={{ color: '#6E6E73' }}>
          Все автоматические сообщения бота — когда и почему отправляются
        </p>
      </div>

      {/* Legend */}
      <div
        className="rounded-2xl p-4 mb-6 flex flex-wrap gap-3"
        style={{ background: '#FFFFFF', border: '1px solid #E5E5EA' }}
      >
        {[
          { label: 'триггер',   bg: 'rgba(255,149,0,0.1)',   color: '#FF9500' },
          { label: 'ветка',     bg: 'rgba(174,174,178,0.12)',color: '#8E8E93' },
          { label: 'сообщение', bg: 'rgba(10,132,255,0.08)', color: '#0A84FF' },
          { label: 'видео',     bg: 'rgba(191,90,242,0.08)', color: '#BF5AF2' },
          { label: 'действие',  bg: 'rgba(48,209,88,0.08)',  color: '#30D158' },
          { label: 'листики',   bg: 'rgba(48,209,88,0.1)',   color: '#30D158' },
        ].map(b => (
          <span
            key={b.label}
            className="text-xs font-medium px-2.5 py-1 rounded-full"
            style={{ background: b.bg, color: b.color }}
          >
            {b.label}
          </span>
        ))}
      </div>

      {/* Tree */}
      <div
        className="rounded-2xl p-6"
        style={{ background: '#FFFFFF', border: '1px solid #E5E5EA', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}
      >
        <TreeNodeComponent node={TREE} />
      </div>

      {/* Ranks reference */}
      <div
        className="rounded-2xl p-6 mt-5"
        style={{ background: '#FFFFFF', border: '1px solid #E5E5EA' }}
      >
        <h2 className="text-base font-bold mb-4" style={{ color: '#1D1D1F' }}>
          Ранги Олимпа
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { emoji: '⚡', label: 'Адепт',          min: '0',    color: '#8E8E93' },
            { emoji: '⚔️', label: 'Герой',          min: '500',  color: '#0A84FF' },
            { emoji: '🌊', label: 'Полубог',        min: '1 500',color: '#FF9500' },
            { emoji: '🔱', label: 'Бог Олимпа',    min: '3 500',color: '#FF9F0A' },
            { emoji: '👑', label: 'Чемпион',        min: '7 000',color: '#BF5AF2' },
          ].map(r => (
            <div
              key={r.label}
              className="rounded-xl p-3 text-center"
              style={{ background: '#F9F9FB', border: '1px solid #E5E5EA' }}
            >
              <div className="text-2xl mb-1">{r.emoji}</div>
              <div className="font-semibold text-xs" style={{ color: r.color }}>{r.label}</div>
              <div className="text-xs mt-0.5" style={{ color: '#AEAEB2' }}>{r.min}+ 🍃</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
