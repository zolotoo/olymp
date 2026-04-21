import { supabaseAdmin } from '@/lib/supabase'

export const metadata = { title: 'Лента сообщений — AI Олимп' }
export const dynamic = 'force-dynamic'

const REASON_LABELS: Record<string, string> = {
  welcome:        'Приветствие',
  rank_up:        'Повышение ранга',
  weekly_bonus:   'Недельный бонус',
  inactive:       'Напоминание (неактивен)',
  milestone:      'Веха',
  sales_pitch:    'Продающее сообщение',
  wheel_spin:     'Колесо фортуны',
  weekly_digest:  'Дайджест недели',
}

function reasonLabel(reason: string): string {
  if (reason.startsWith('test:')) return `Проверка: ${reason.slice(5)}`
  if (reason.startsWith('milestone_week_')) return `Веха (неделя ${reason.slice(15)})`
  return REASON_LABELS[reason] ?? reason
}

function reasonColor(reason: string): string {
  if (reason.startsWith('test:')) return '#0A84FF'
  if (reason === 'rank_up') return '#BF5AF2'
  if (reason === 'weekly_bonus') return '#30D158'
  if (reason === 'welcome') return '#FF9500'
  if (reason === 'inactive') return '#FF375F'
  return '#636366'
}

const glass = {
  background: 'rgba(255,255,255,0.66)',
  backdropFilter: 'blur(28px) saturate(160%)',
  WebkitBackdropFilter: 'blur(28px) saturate(160%)',
  border: '1px solid rgba(255,255,255,0.52)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.10)',
} as const

export default async function FeedPage() {
  const { data: logs } = await supabaseAdmin
    .from('messages_log')
    .select('*')
    .order('sent_at', { ascending: false })
    .limit(200)

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="rounded-2xl px-6 py-5 mb-6" style={glass}>
        <div className="text-xs font-semibold mb-2 uppercase" style={{ color: 'rgba(28,28,30,0.45)', letterSpacing: '0.8px' }}>
          Бот
        </div>
        <h1 className="text-3xl font-bold mb-1" style={{ color: '#1C1C1E', letterSpacing: '-1px', lineHeight: 1.1 }}>
          Лента сообщений
        </h1>
        <p className="text-sm" style={{ color: 'rgba(28,28,30,0.55)', letterSpacing: '-0.2px' }}>
          Все сообщения, отправленные ботом — с датой, временем, получателем и причиной
        </p>
      </div>

      {!logs?.length && (
        <div className="rounded-2xl px-6 py-10 text-center" style={glass}>
          <p style={{ color: 'rgba(28,28,30,0.45)', fontSize: 15 }}>Сообщений пока нет</p>
          <p className="text-xs mt-1" style={{ color: 'rgba(28,28,30,0.30)' }}>
            Сообщения появятся здесь после применения миграции 002 к Supabase
          </p>
        </div>
      )}

      {logs && logs.length > 0 && (
        <div className="flex flex-col gap-3">
          {logs.map((log: {
            id: string; tg_id: number | null; tg_username: string | null;
            tg_first_name: string | null; chat_id: number; message_text: string;
            reason: string; sent_at: string
          }) => {
            const color = reasonColor(log.reason)
            const sentAt = new Date(log.sent_at)
            const dateStr = sentAt.toLocaleDateString('ru', { day: 'numeric', month: 'short' })
            const timeStr = sentAt.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })

            return (
              <div key={log.id} className="rounded-2xl px-5 py-4" style={glass}>
                <div className="flex items-start gap-3">
                  {/* Reason badge */}
                  <span
                    className="text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 mt-0.5"
                    style={{ background: `${color}15`, color, border: `1px solid ${color}28` }}
                  >
                    {reasonLabel(log.reason)}
                  </span>

                  <div className="flex-1 min-w-0">
                    {/* Recipient */}
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="text-sm font-semibold" style={{ color: '#1C1C1E', letterSpacing: '-0.2px' }}>
                        {log.tg_first_name || log.tg_username
                          ? `${log.tg_first_name || ''} ${log.tg_username ? `@${log.tg_username}` : ''}`.trim()
                          : log.tg_id ? `tg:${log.tg_id}` : `chat:${log.chat_id}`}
                      </span>
                      <span className="text-xs" style={{ color: 'rgba(28,28,30,0.38)' }}>
                        {dateStr} · {timeStr}
                      </span>
                    </div>

                    {/* Message text preview */}
                    <p
                      className="text-sm"
                      style={{
                        color: 'rgba(28,28,30,0.65)',
                        lineHeight: 1.55,
                        letterSpacing: '-0.15px',
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {log.message_text.replace(/<[^>]+>/g, '')}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
