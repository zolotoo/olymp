import Link from 'next/link'
import { RANK_CONFIG } from '@/lib/ranks'
import type { MemberRank } from '@/lib/types'
import ActivityChart from '@/components/ActivityChart'
import SummaryButton from '@/components/SummaryButton'
import type { ProfileData, BotEvent, TgMessageRow, DeliveryRow, ReactionRow } from '@/lib/profile-loader'

const card = {
  background: 'rgba(255,255,255,0.70)',
  backdropFilter: 'blur(28px) saturate(160%)',
  WebkitBackdropFilter: 'blur(28px) saturate(160%)',
  border: '1px solid rgba(255,255,255,0.55)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)',
}

const reasonLabels: Record<string, string> = {
  message: 'За сообщения (+1)',
  reaction_given: 'За реакцию (+1)',
  reaction_received: 'Реакции на посты (+3)',
  poll_vote: 'За голосование (+5)',
  subscription_renewal: 'Продление подписки',
}

function fmtTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  if (sameDay) return d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleString('ru', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function fmtEventType(t: string): string {
  if (t.startsWith('command:')) return t.replace('command:', '⌨ ')
  if (t === 'message:private') return '💬 DM боту'
  if (t === 'message:group') return '💬 в группе'
  if (t === 'callback') return '🔘 callback'
  if (t === 'link_click') return '🔗 клик по ссылке'
  if (t === 'join_request') return '🚪 заявка в канал'
  if (t === 'reaction:added') return '👍 поставил реакцию'
  if (t === 'reaction:removed') return '↩︎ убрал реакцию'
  return t
}

export default function ProfileCard({ data, backHref, backLabel }: {
  data: ProfileData
  backHref: string
  backLabel: string
}) {
  const { member, botUser, botEvents, incomingMessages, outgoingDeliveries, reactionsGiven, reactionsReceived, memories, eventsLog, pointsLog, activity, totalMessages, tgId } = data

  const name = member?.tg_first_name || member?.tg_username || botUser?.tg_first_name || botUser?.tg_username || `id:${tgId}`
  const last = member?.tg_last_name || botUser?.tg_last_name || ''
  const username = member?.tg_username || botUser?.tg_username || null
  const rank = member ? RANK_CONFIG[member.rank as MemberRank] : null

  const joinedAt = member?.joined_at || botUser?.first_seen_at || null
  const daysSinceJoin = joinedAt
    ? Math.floor((Date.now() - new Date(joinedAt).getTime()) / (1000 * 60 * 60 * 24))
    : null
  const lastActive = member?.last_active || botUser?.last_seen_at || null

  const pointsByReason = (pointsLog || []).reduce((acc: Record<string, number>, r) => {
    acc[r.reason] = (acc[r.reason] || 0) + r.points
    return acc
  }, {})

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <Link
          href={backHref}
          className="text-sm font-medium inline-flex items-center gap-1 transition-opacity hover:opacity-70"
          style={{ color: '#0A84FF' }}
        >
          ← {backLabel}
        </Link>
        {member && <SummaryButton memberId={member.id} />}
      </div>

      {/* Header */}
      <div className="rounded-2xl p-6 mb-5" style={card}>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#1D1D1F', letterSpacing: '-0.4px' }}>
              {name}{last ? ` ${last}` : ''}
            </h1>
            {username && (
              <a
                href={`https://t.me/${username}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium transition-opacity hover:opacity-70 mt-0.5 inline-block"
                style={{ color: '#0A84FF' }}
              >
                @{username}
              </a>
            )}
            <div className="mt-1 text-xs font-mono" style={{ color: '#AEAEB2' }}>tg_id: {tgId}</div>
            {rank && (
              <div className="mt-2 text-base font-semibold" style={{ color: rank.color }}>
                {rank.emoji} {rank.label}
              </div>
            )}
            {!member && (
              <div className="mt-2 text-xs font-semibold uppercase tracking-wide"
                   style={{ color: '#FF9500' }}>
                🌱 только аудитория (не клубный участник)
              </div>
            )}
          </div>
          <div className="text-right">
            {member ? (
              <>
                <div className="text-4xl font-bold" style={{ color: '#1D1D1F', letterSpacing: '-1px' }}>
                  {member.points.toLocaleString()}
                </div>
                <div className="text-sm mt-0.5" style={{ color: '#6E6E73' }}>фантиков</div>
              </>
            ) : (
              <>
                <div className="text-4xl font-bold" style={{ color: '#1D1D1F', letterSpacing: '-1px' }}>
                  {botUser?.events_count ?? 0}
                </div>
                <div className="text-sm mt-0.5" style={{ color: '#6E6E73' }}>событий</div>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5 pt-5" style={{ borderTop: '1px solid rgba(28,28,30,0.08)' }}>
          <Stat
            label={member ? 'Вступил' : 'Первый визит'}
            value={joinedAt ? new Date(joinedAt).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
          />
          <Stat label={member ? 'Дней в клубе' : 'Дней с ботом'} value={daysSinceJoin ?? '—'} />
          <Stat label="Всего сообщений (клуб)" value={totalMessages} />
          <Stat
            label="Последняя активность"
            value={lastActive ? new Date(lastActive).toLocaleDateString('ru') : 'никогда'}
            highlight={!lastActive || Date.now() - new Date(lastActive).getTime() > 7 * 24 * 60 * 60 * 1000}
          />
        </div>

        {botUser && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4 pt-4" style={{ borderTop: '1px solid rgba(28,28,30,0.06)' }}>
            <Stat label="Событий в боте" value={botUser.events_count} />
            <Stat label="Входящих" value={incomingMessages.length} />
            <Stat label="Рассылок получил" value={outgoingDeliveries.length} />
            <Stat
              label="В канале"
              value={botUser.is_channel_member === true ? 'да' : botUser.is_channel_member === false ? 'нет' : '?'}
              highlight={botUser.is_channel_member === false}
            />
            <Stat
              label="В группе"
              value={botUser.is_group_member === true ? 'да' : botUser.is_group_member === false ? 'нет' : '?'}
              highlight={botUser.is_group_member === false}
            />
          </div>
        )}
      </div>

      {/* Activity chart */}
      {activity.length > 0 && (
        <div className="rounded-2xl p-6 mb-5" style={card}>
          <h2 className="font-semibold mb-4" style={{ color: '#1D1D1F' }}>Активность по неделям</h2>
          <ActivityChart data={[...activity].reverse()} />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Mem0 memory */}
        <Section title="Память участника (mem0)">
          {!(memories?.results?.length) ? (
            <p className="text-sm" style={{ color: '#AEAEB2' }}>Память пока пуста, накапливается по мере активности</p>
          ) : (
            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {memories.results!.map((m) => (
                <div
                  key={m.id}
                  className="text-sm py-0.5"
                  style={{ color: '#1C1C1E', borderLeft: '2px solid rgba(10,132,255,0.5)', paddingLeft: 10 }}
                >
                  {m.memory}
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Points breakdown — only for members */}
        {member && (
          <Section title="Откуда фантики">
            {Object.keys(pointsByReason).length === 0 ? (
              <p className="text-sm" style={{ color: '#AEAEB2' }}>Нет данных</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(pointsByReason).map(([reason, pts]) => (
                  <div key={reason} className="flex items-center justify-between">
                    <span className="text-sm" style={{ color: '#6E6E73' }}>{reasonLabels[reason] || reason}</span>
                    <div className="flex items-center gap-2">
                      <div
                        className="h-1.5 rounded-full"
                        style={{
                          background: '#0A84FF',
                          width: `${Math.min((pts / Math.max(member.points, 1)) * 120, 120)}px`,
                        }}
                      />
                      <span className="text-sm font-mono w-12 text-right" style={{ color: '#1D1D1F' }}>{pts}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        )}

        {/* Все события в боте */}
        <Section title={`События в боте · ${botEvents.length}`}>
          {botEvents.length === 0 ? (
            <p className="text-sm" style={{ color: '#AEAEB2' }}>Нет событий</p>
          ) : (
            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
              {botEvents.map((e) => <BotEventRow key={e.id} e={e} />)}
            </div>
          )}
        </Section>

        {/* Lifecycle events (members only) */}
        {member && eventsLog.length > 0 && (
          <Section title={`История триггеров · ${eventsLog.length}`}>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {eventsLog.map((e) => (
                <div key={e.id} className="flex items-start justify-between gap-2 text-sm">
                  <span className="font-mono" style={{ color: '#1D1D1F' }}>{e.event_type}</span>
                  <span className="text-xs whitespace-nowrap" style={{ color: '#AEAEB2' }}>
                    {new Date(e.triggered_at).toLocaleDateString('ru', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Входящие сообщения (написал пользователь) */}
        <Section title={`Входящие сообщения · ${incomingMessages.length}`}>
          {incomingMessages.length === 0 ? (
            <p className="text-sm" style={{ color: '#AEAEB2' }}>Нет сообщений</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {incomingMessages.map((m) => <MessageRow key={`${m.chat_id}:${m.message_id}`} m={m} />)}
            </div>
          )}
        </Section>

        {/* Исходящие рассылки боту */}
        <Section title={`От бота (рассылки, welcome, и т.п.) · ${outgoingDeliveries.length}`}>
          {outgoingDeliveries.length === 0 ? (
            <p className="text-sm" style={{ color: '#AEAEB2' }}>Ничего не отправлялось через трекер</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {outgoingDeliveries.map((d) => <DeliveryRowView key={d.id} d={d} />)}
            </div>
          )}
        </Section>

        {/* Реакции поставленные */}
        <Section title={`Реакции поставил · ${reactionsGiven.length}`}>
          {reactionsGiven.length === 0 ? (
            <p className="text-sm" style={{ color: '#AEAEB2' }}>Нет данных</p>
          ) : (
            <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
              {reactionsGiven.map((r) => <ReactionRowView key={r.id} r={r} kind="given" />)}
            </div>
          )}
        </Section>

        {/* Реакции полученные */}
        <Section title={`Реакции получил · ${reactionsReceived.length}`}>
          {reactionsReceived.length === 0 ? (
            <p className="text-sm" style={{ color: '#AEAEB2' }}>Нет данных</p>
          ) : (
            <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
              {reactionsReceived.map((r) => <ReactionRowView key={r.id} r={r} kind="received" />)}
            </div>
          )}
        </Section>

        {/* Weekly table (members only) */}
        {member && activity.length > 0 && (
          <Section title="Сообщения по неделям">
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {activity.map((row) => (
                <div key={row.id} className="flex items-center justify-between text-sm">
                  <span style={{ color: '#6E6E73' }}>неделя с {row.week_start}</span>
                  <div className="flex items-center gap-2">
                    <div
                      className="h-1.5 rounded-full"
                      style={{ background: '#30D158', width: `${Math.min(row.message_count * 3, 80)}px` }}
                    />
                    <span className="font-mono w-8 text-right" style={{ color: '#1D1D1F' }}>{row.message_count}</span>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-6" style={card}>
      <h2 className="font-semibold mb-4" style={{ color: '#1D1D1F' }}>{title}</h2>
      {children}
    </div>
  )
}

function Stat({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div>
      <div className="text-xs mb-0.5" style={{ color: '#AEAEB2' }}>{label}</div>
      <div className="text-sm font-medium" style={{ color: highlight ? '#FF9500' : '#1D1D1F' }}>{value}</div>
    </div>
  )
}

function BotEventRow({ e }: { e: BotEvent }) {
  const label = fmtEventType(e.event_type)
  const payloadText = e.payload
    ? (typeof (e.payload as { text?: unknown }).text === 'string'
        ? ((e.payload as { text?: string }).text || '').slice(0, 80)
        : typeof (e.payload as { data?: unknown }).data === 'string'
          ? ((e.payload as { data?: string }).data || '').slice(0, 80)
          : '')
    : ''
  return (
    <div className="flex items-start justify-between gap-2 text-sm">
      <div className="min-w-0 flex-1">
        <span className="font-mono text-xs" style={{ color: '#1D1D1F' }}>{label}</span>
        {payloadText && (
          <span className="ml-2 text-xs" style={{ color: '#8E8E93' }}>{payloadText}</span>
        )}
      </div>
      <span className="text-xs whitespace-nowrap" style={{ color: '#AEAEB2' }}>
        {fmtTime(e.created_at)}
      </span>
    </div>
  )
}

function MessageRow({ m }: { m: TgMessageRow }) {
  const preview = (m.text || (m.media_kind ? `[${m.media_kind}]` : '[без текста]')).slice(0, 160)
  const where = m.chat_type === 'private' ? 'DM' : (m.chat_title || m.chat_type || 'chat')
  return (
    <div className="text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs" style={{ color: '#8E8E93' }}>{where}{m.edited_at ? ' · (edited)' : ''}</span>
        <span className="text-xs whitespace-nowrap" style={{ color: '#AEAEB2' }}>{fmtTime(m.sent_at)}</span>
      </div>
      <div style={{ color: '#1D1D1F', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{preview}</div>
    </div>
  )
}

function DeliveryRowView({ d }: { d: DeliveryRow }) {
  return (
    <div className="text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-mono" style={{ color: '#8E8E93' }}>
          {d.campaign || d.template_key || 'ad-hoc'}
          {!d.delivered && <span style={{ color: '#FF3B30' }}> · не доставлено</span>}
          {d.engaged_at && <span style={{ color: '#30D158' }}> · {d.engagement_kind}</span>}
        </span>
        <span className="text-xs whitespace-nowrap" style={{ color: '#AEAEB2' }}>{fmtTime(d.sent_at)}</span>
      </div>
      <div style={{ color: '#1D1D1F', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {(d.text || '').slice(0, 200)}
      </div>
      {d.error_text && <div className="text-xs mt-0.5" style={{ color: '#FF3B30' }}>{d.error_text}</div>}
    </div>
  )
}

function ReactionRowView({ r, kind }: { r: ReactionRow; kind: 'given' | 'received' }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span>
        <span style={{ fontSize: 15 }}>{r.emoji || '·'}</span>
        <span className="ml-2 text-xs" style={{ color: r.action === 'added' ? '#30D158' : '#FF3B30' }}>
          {r.action}
        </span>
        {kind === 'given' && r.author_tg_id && (
          <span className="ml-2 text-xs" style={{ color: '#8E8E93' }}>→ {r.author_tg_id}</span>
        )}
        {kind === 'received' && (
          <span className="ml-2 text-xs" style={{ color: '#8E8E93' }}>от {r.reactor_tg_id}</span>
        )}
      </span>
      <span className="text-xs whitespace-nowrap" style={{ color: '#AEAEB2' }}>
        {fmtTime(r.created_at)}
      </span>
    </div>
  )
}
