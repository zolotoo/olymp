export const metadata = { title: 'Поток сообщений — AI Олимп' }

export default function FlowPage() {
  return (
    <div>
      <div className="mb-7">
        <h1 className="text-2xl font-bold mb-1" style={{ color: '#1D1D1F', letterSpacing: '-0.5px' }}>
          Инфраструктура сообщений
        </h1>
        <p className="text-sm" style={{ color: '#6E6E73' }}>
          Все автоматические сообщения бота — когда и почему отправляются
        </p>
      </div>

      <div className="space-y-8">

        {/* /start command */}
        <FlowSection title="/start — первый контакт" color="indigo">
          <FlowNode label="Пользователь нажимает /start" type="trigger" />
          <FlowBranch>
            <FlowPath label="Не участник клуба">
              <FlowNode label="💳 Продающее сообщение" desc="Описание клуба + ссылка на Tribute для оплаты" type="message" />
            </FlowPath>
            <FlowPath label="Участник, welcome не отправлен">
              <FlowNode label="🎥 Кружок от основателя" desc="video note из TELEGRAM_WELCOME_VIDEO_NOTE_ID" type="video" />
              <FlowNode label="👋 Приветственное сообщение" desc="Имя, описание клуба, инструкция по листикам" type="message" />
            </FlowPath>
            <FlowPath label="Активный участник">
              <FlowNode label="📊 Профиль участника" desc="Ранг, листики, дней в клубе" type="message" />
            </FlowPath>
          </FlowBranch>
        </FlowSection>

        {/* Tribute payment */}
        <FlowSection title="Tribute — оплата подписки" color="green">
          <FlowNode label="Tribute: new_subscription" type="trigger" />
          <FlowNode label="🎥 Кружок от основателя" desc="Отправляется сразу после оплаты" type="video" />
          <FlowNode label="🎉 Поздравление со вступлением" desc="Дата окончания подписки + инструкция по invite-ссылке" type="message" />

          <div className="mt-4 border-t border-gray-700 pt-4">
            <FlowNode label="Tribute: renewed_subscription" type="trigger" />
            <FlowNode label="✅ Подписка продлена" desc="+100 листиков бонус за верность" type="message" />
          </div>

          <div className="mt-4 border-t border-gray-700 pt-4">
            <FlowNode label="Tribute: cancelled_subscription" type="trigger" />
            <FlowNode label="❌ Уведомление админу" desc="В TELEGRAM_ADMIN_CHAT_ID — кто отписался" type="message" />
            <FlowNode label="💬 Сообщение участнику" desc="Прощальное + предложение написать" type="message" />
          </div>
        </FlowSection>

        {/* Join request */}
        <FlowSection title="Заявка на вступление в канал" color="blue">
          <FlowNode label="chat_join_request (канал)" type="trigger" />
          <FlowNode label="✅ Авто-одобрение заявки" desc="approveChatJoinRequest" type="action" />
          <FlowNode label="🎥 Кружок + приветствие (DM)" desc="Если DM недоступен — пропускается" type="message" />
        </FlowSection>

        {/* New group member */}
        <FlowSection title="Вступление в группу" color="purple">
          <FlowNode label="new_chat_members в группе" type="trigger" />
          <FlowNode label="👋 Приветствие в группе" desc="Упоминание @username в чате" type="message" />
          <FlowNode label="🎥 Приветствие в DM" desc="Если не было отправлено ранее" type="message" />
        </FlowSection>

        {/* Activity & points */}
        <FlowSection title="Активность → Листики → Ранг" color="yellow">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <PointCard icon="💬" action="Сообщение в чате" points={1} color="blue" />
            <PointCard icon="👍" action="Поставить реакцию" points={1} color="blue" />
            <PointCard icon="❤️" action="Получить реакцию на пост" points={3} color="green" />
            <PointCard icon="🗳️" action="Проголосовать в опросе" points={5} color="purple" />
          </div>

          <div className="mt-6">
            <div className="text-sm text-gray-400 mb-3 font-medium">Ранги (листики → титул в Telegram)</div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                { emoji: '🌱', label: 'Новичок', min: 0, color: '#8E8E93' },
                { emoji: '⭐', label: 'Участник', min: 100, color: '#0A84FF' },
                { emoji: '🔥', label: 'Активный', min: 500, color: '#FF9500' },
                { emoji: '🏆', label: 'Чемпион', min: 1000, color: '#FF9F0A' },
                { emoji: '👑', label: 'Легенда', min: 2500, color: '#BF5AF2' },
              ].map((r) => (
                <div
                  key={r.label}
                  className="rounded-xl p-3 text-center"
                  style={{ background: '#FFFFFF', border: '1px solid #E5E5EA' }}
                >
                  <div className="text-2xl mb-1">{r.emoji}</div>
                  <div className="font-semibold text-sm" style={{ color: r.color }}>{r.label}</div>
                  <div className="text-xs mt-0.5" style={{ color: '#AEAEB2' }}>{r.min}+ 🍃</div>
                </div>
              ))}
            </div>
          </div>

          <div
            className="mt-4 rounded-xl p-4"
            style={{ background: '#FFFFFF', border: '1px solid #E5E5EA' }}
          >
            <div className="text-sm font-medium mb-1" style={{ color: '#1D1D1F' }}>При достижении нового ранга:</div>
            <div className="flex flex-col gap-1.5 text-sm" style={{ color: '#6E6E73' }}>
              <span>→ Telegram присваивает титул-администратора <b style={{ color: '#1D1D1F' }}>(без прав)</b></span>
              <span>→ В чате отображается: <span className="font-mono px-1.5 py-0.5 rounded" style={{ background: '#F2F2F7', color: '#FF9500' }}>🔥 Активный</span></span>
              <span>→ Участнику приходит уведомление о новом ранге в DM</span>
            </div>
          </div>
        </FlowSection>

      </div>
    </div>
  )
}

// ─── UI Components ─────────────────────────────────────────────────────────────

const SECTION_COLORS = {
  indigo: { border: 'rgba(10,132,255,0.15)', bg: 'rgba(10,132,255,0.04)', title: '#0A84FF' },
  green:  { border: 'rgba(48,209,88,0.15)',  bg: 'rgba(48,209,88,0.04)',  title: '#30D158' },
  blue:   { border: 'rgba(10,132,255,0.15)', bg: 'rgba(10,132,255,0.04)', title: '#0A84FF' },
  purple: { border: 'rgba(191,90,242,0.15)', bg: 'rgba(191,90,242,0.04)', title: '#BF5AF2' },
  yellow: { border: 'rgba(255,149,0,0.2)',   bg: 'rgba(255,149,0,0.04)',  title: '#FF9500' },
}

function FlowSection({ title, children, color }: {
  title: string
  children: React.ReactNode
  color: keyof typeof SECTION_COLORS
}) {
  const c = SECTION_COLORS[color]
  return (
    <div
      className="rounded-2xl p-6"
      style={{ border: `1px solid ${c.border}`, background: c.bg, boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}
    >
      <h2 className="text-base font-bold mb-4" style={{ color: c.title }}>{title}</h2>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function FlowNode({ label, desc, type }: {
  label: string
  desc?: string
  type: 'trigger' | 'message' | 'video' | 'action'
}) {
  const styles: Record<string, { bg: string; border: string; labelColor: string }> = {
    trigger: { bg: '#FFFFFF', border: '#E5E5EA', labelColor: '#1D1D1F' },
    message: { bg: '#F9F9FB', border: '#E5E5EA', labelColor: '#1D1D1F' },
    video:   { bg: '#F9F9FB', border: '#E5E5EA', labelColor: '#1D1D1F' },
    action:  { bg: '#F9F9FB', border: '#E5E5EA', labelColor: '#1D1D1F' },
  }
  const badge: Record<string, { label: string; bg: string; color: string }> = {
    trigger: { label: 'триггер',   bg: 'rgba(255,149,0,0.1)',   color: '#FF9500' },
    message: { label: 'сообщение', bg: 'rgba(10,132,255,0.08)', color: '#0A84FF' },
    video:   { label: 'видео',     bg: 'rgba(191,90,242,0.08)', color: '#BF5AF2' },
    action:  { label: 'действие',  bg: 'rgba(48,209,88,0.08)',  color: '#30D158' },
  }
  const s = styles[type]
  const b = badge[type]
  return (
    <div
      className="rounded-xl px-4 py-2.5 flex items-start justify-between gap-3"
      style={{ background: s.bg, border: `1px solid ${s.border}` }}
    >
      <div>
        <span className="text-sm font-medium" style={{ color: s.labelColor }}>{label}</span>
        {desc && <div className="text-xs mt-0.5" style={{ color: '#AEAEB2' }}>{desc}</div>}
      </div>
      <span
        className="text-xs px-2 py-0.5 rounded-full shrink-0 font-medium"
        style={{ background: b.bg, color: b.color }}
      >
        {b.label}
      </span>
    </div>
  )
}

function FlowBranch({ children }: { children: React.ReactNode }) {
  return (
    <div className="ml-4 pl-4 space-y-3 mt-2" style={{ borderLeft: '2px solid #E5E5EA' }}>
      {children}
    </div>
  )
}

function FlowPath({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs mb-1.5 font-medium" style={{ color: '#AEAEB2' }}>↳ {label}</div>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}

function PointCard({ icon, action, points, color }: {
  icon: string
  action: string
  points: number
  color: 'blue' | 'green' | 'purple'
}) {
  const c = {
    blue:   { bg: 'rgba(10,132,255,0.08)',  color: '#0A84FF' },
    green:  { bg: 'rgba(48,209,88,0.08)',   color: '#30D158' },
    purple: { bg: 'rgba(191,90,242,0.08)',  color: '#BF5AF2' },
  }
  return (
    <div
      className="rounded-xl p-3 flex items-center justify-between gap-3"
      style={{ background: '#FFFFFF', border: '1px solid #E5E5EA' }}
    >
      <div className="flex items-center gap-2">
        <span className="text-xl">{icon}</span>
        <span className="text-sm" style={{ color: '#1D1D1F' }}>{action}</span>
      </div>
      <span
        className="text-sm font-bold px-2 py-0.5 rounded-lg"
        style={{ background: c[color].bg, color: c[color].color }}
      >
        +{points} 🍃
      </span>
    </div>
  )
}
