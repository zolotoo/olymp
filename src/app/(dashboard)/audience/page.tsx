import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase'

export const metadata = { title: 'Аудитория бота · AI Олимп' }
export const dynamic = 'force-dynamic'

interface BotUser {
  tg_id: number
  tg_username: string | null
  tg_first_name: string | null
  tg_last_name: string | null
  language_code: string | null
  is_channel_member: boolean | null
  first_seen_at: string
  last_seen_at: string
  last_event_type: string | null
  events_count: number
  source: string | null
}

const SOURCE_LABELS: Record<string, string> = {
  main: 'MAIN',
  hochy: 'ХОЧУ',
  promts: 'ПРОМТЫ',
  claude: 'КЛОД',
}
const SOURCE_COLORS: Record<string, string> = {
  main: '#8E8E93',
  hochy: '#FF9500',
  promts: '#0A84FF',
  claude: '#BF5AF2',
}

const SOURCES = ['main', 'hochy', 'promts', 'claude'] as const

// Статус оплаты — производное поле, не из БД, считаем из members
type PayStatus = 'paid' | 'churned' | 'none'
// Фильтр в URL: ?pay=paid | clicked | no_click
type PayFilter = 'paid' | 'clicked' | 'no_click' | null

async function loadData(sourceFilter: string | null, payFilter: PayFilter) {
  let usersQ = supabaseAdmin
    .from('bot_users')
    .select('*')
    .order('last_seen_at', { ascending: false })
    .limit(500)
  if (sourceFilter) usersQ = usersQ.eq('source', sourceFilter)

  const sourceCountsQ = Promise.all(
    SOURCES.map(s =>
      supabaseAdmin
        .from('bot_users')
        .select('tg_id', { count: 'exact', head: true })
        .eq('source', s)
        .then(r => [s, r.count ?? 0] as const),
    ),
  ).then(pairs => Object.fromEntries(pairs) as Record<string, number>)

  const [{ data: users }, { count: total }, sourceCounts] = await Promise.all([
    usersQ as unknown as Promise<{ data: BotUser[] | null }>,
    supabaseAdmin.from('bot_users').select('tg_id', { count: 'exact', head: true }),
    sourceCountsQ,
  ])

  const { count: channelMembers } = await supabaseAdmin
    .from('bot_users')
    .select('tg_id', { count: 'exact', head: true })
    .eq('is_channel_member', true)

  const { count: clubMembers } = await supabaseAdmin
    .from('members')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active')

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count: active24h } = await supabaseAdmin
    .from('bot_users')
    .select('tg_id', { count: 'exact', head: true })
    .gte('last_seen_at', since24h)

  // Карты «оплатил / кликал по кнопке» по выгруженной странице юзеров
  const baseUsers = users ?? []
  const tgIds = baseUsers.map(u => u.tg_id)
  let payStatus = new Map<number, PayStatus>()
  let clickedSet = new Set<number>()

  if (tgIds.length) {
    const [membersRes, clicksRes] = await Promise.all([
      supabaseAdmin
        .from('members')
        .select('tg_id, status')
        .in('tg_id', tgIds),
      supabaseAdmin
        .from('bot_events')
        .select('tg_id')
        .eq('event_type', 'link_click')
        .in('tg_id', tgIds),
    ])
    payStatus = new Map(
      ((membersRes.data ?? []) as { tg_id: number; status: string }[])
        .map(m => [m.tg_id, m.status === 'active' ? 'paid' : m.status === 'churned' ? 'churned' : 'none' as PayStatus]),
    )
    clickedSet = new Set((clicksRes.data ?? []).map((r: { tg_id: number }) => r.tg_id))
  }

  // Фильтрация по статусу оплаты — на стороне сервера, после получения карт
  const filteredUsers = baseUsers.filter(u => {
    const st = payStatus.get(u.tg_id) ?? 'none'
    const clicked = clickedSet.has(u.tg_id)
    if (payFilter === 'paid')     return st === 'paid'
    if (payFilter === 'clicked')  return clicked && st !== 'paid'
    if (payFilter === 'no_click') return !clicked && st !== 'paid'
    return true
  })

  // Глобальные счётчики (без учёта sourceFilter, чтобы чипы показывали всю картину)
  const [{ count: paidTotal }, { count: clickedTotalRows }] = await Promise.all([
    supabaseAdmin.from('members').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabaseAdmin.from('bot_events').select('tg_id', { count: 'exact', head: true }).eq('event_type', 'link_click'),
  ])
  // clickedTotalRows — это количество событий, не уникальных юзеров.
  // Для чипа достаточно — но честнее посчитать уникальных. Делаем дополнительный запрос
  // только если есть смысл (у нас ограничение лимитом — пока ок, можно жить с rows).
  void clickedTotalRows

  return {
    users: filteredUsers,
    payStatus,
    clickedSet,
    total: total ?? 0,
    channelMembers: channelMembers ?? 0,
    clubMembers: clubMembers ?? 0,
    active24h: active24h ?? 0,
    paidTotal: paidTotal ?? 0,
    sourceCounts,
  }
}

function formatRel(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'только что'
  if (min < 60) return `${min} мин назад`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} ч назад`
  const d = Math.floor(h / 24)
  return `${d} дн назад`
}

export default async function AudiencePage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string; pay?: string }>
}) {
  const sp = await searchParams
  const sourceFilter = sp.source && (SOURCES as readonly string[]).includes(sp.source) ? sp.source : null
  const payFilter: PayFilter = sp.pay === 'paid' || sp.pay === 'clicked' || sp.pay === 'no_click' ? sp.pay : null
  const data = await loadData(sourceFilter, payFilter)

  // URL helper — сохраняет другие параметры
  const buildHref = (changes: { source?: string | null; pay?: string | null }) => {
    const params = new URLSearchParams()
    const src = changes.source !== undefined ? changes.source : sourceFilter
    const py  = changes.pay    !== undefined ? changes.pay    : payFilter
    if (src) params.set('source', src)
    if (py)  params.set('pay', py)
    const q = params.toString()
    return q ? `/audience?${q}` : '/audience'
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-1" style={{ color: '#1C1C1E', letterSpacing: '-0.8px' }}>
          Аудитория бота
        </h1>
        <p className="text-sm" style={{ color: 'rgba(28,28,30,0.55)' }}>
          Все, кто хоть раз взаимодействовал с @AI_Olymp_bot
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Всего в боте" value={data.total} />
        <StatCard label="В канале" value={data.channelMembers} />
        <StatCard label="В клубе (members)" value={data.clubMembers} />
        <StatCard label="Активны за 24ч" value={data.active24h} />
      </div>

      {/* Источник трафика — фильтр-чипы */}
      <div className="rounded-2xl p-4" style={{ background: '#FFFFFF', border: '1px solid rgba(28,28,30,0.06)' }}>
        <div className="text-xs font-semibold uppercase mb-2" style={{ color: 'rgba(28,28,30,0.45)', letterSpacing: '0.6px' }}>
          Источник трафика (deep-link)
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={buildHref({ source: null })}
            className="text-xs font-semibold px-3 py-1.5 rounded-full transition-opacity hover:opacity-80"
            style={{
              background: sourceFilter === null ? '#1C1C1E' : 'rgba(28,28,30,0.06)',
              color: sourceFilter === null ? '#FFFFFF' : 'rgba(28,28,30,0.70)',
            }}
          >
            Все · {data.total}
          </Link>
          {SOURCES.map(s => {
            const active = sourceFilter === s
            const color = SOURCE_COLORS[s]
            return (
              <Link
                key={s}
                href={buildHref({ source: s })}
                className="text-xs font-semibold px-3 py-1.5 rounded-full transition-opacity hover:opacity-80"
                style={{
                  background: active ? color : `${color}18`,
                  color: active ? '#FFFFFF' : color,
                }}
              >
                {SOURCE_LABELS[s]} · {data.sourceCounts[s] ?? 0}
              </Link>
            )
          })}
        </div>
      </div>

      {/* Статус оплаты — фильтр-чипы */}
      <div className="rounded-2xl p-4" style={{ background: '#FFFFFF', border: '1px solid rgba(28,28,30,0.06)' }}>
        <div className="text-xs font-semibold uppercase mb-2" style={{ color: 'rgba(28,28,30,0.45)', letterSpacing: '0.6px' }}>
          Статус оплаты
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={buildHref({ pay: null })}
            className="text-xs font-semibold px-3 py-1.5 rounded-full transition-opacity hover:opacity-80"
            style={{
              background: payFilter === null ? '#1C1C1E' : 'rgba(28,28,30,0.06)',
              color: payFilter === null ? '#FFFFFF' : 'rgba(28,28,30,0.70)',
            }}
          >
            Все
          </Link>
          <Link
            href={buildHref({ pay: 'paid' })}
            className="text-xs font-semibold px-3 py-1.5 rounded-full transition-opacity hover:opacity-80"
            style={{
              background: payFilter === 'paid' ? '#30D158' : '#30D15818',
              color: payFilter === 'paid' ? '#FFFFFF' : '#1C8A3C',
            }}
          >
            ✓ Оплатили · {data.paidTotal}
          </Link>
          <Link
            href={buildHref({ pay: 'clicked' })}
            className="text-xs font-semibold px-3 py-1.5 rounded-full transition-opacity hover:opacity-80"
            style={{
              background: payFilter === 'clicked' ? '#FF9500' : '#FF950018',
              color: payFilter === 'clicked' ? '#FFFFFF' : '#B25E00',
            }}
            title="Нажали кнопку «Оплатить», но подписки нет"
          >
            ✗ Кликнул, не оплатил
          </Link>
          <Link
            href={buildHref({ pay: 'no_click' })}
            className="text-xs font-semibold px-3 py-1.5 rounded-full transition-opacity hover:opacity-80"
            style={{
              background: payFilter === 'no_click' ? '#8E8E93' : '#8E8E9318',
              color: payFilter === 'no_click' ? '#FFFFFF' : '#636366',
            }}
            title="Не кликали по кнопке оплаты"
          >
            · Не кликали
          </Link>
        </div>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid rgba(28,28,30,0.08)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'rgba(28,28,30,0.03)' }}>
              <Th>Пользователь</Th>
              <Th>Источник</Th>
              <Th>Оплата</Th>
              <Th>Клик «Оплатить»</Th>
              <Th>В канале</Th>
              <Th>Событий</Th>
              <Th>Последнее</Th>
              <Th>Действие</Th>
              <Th>Первый визит</Th>
            </tr>
          </thead>
          <tbody>
            {data.users.map(u => (
              <tr
                key={u.tg_id}
                style={{ borderTop: '1px solid rgba(28,28,30,0.06)', cursor: 'pointer' }}
                className="hover:bg-black/[0.02] transition-colors"
              >
                <Td>
                  <Link href={`/audience/${u.tg_id}`} className="block">
                    <div style={{ fontWeight: 500, color: '#1C1C1E' }}>
                      {u.tg_first_name || u.tg_username || `id:${u.tg_id}`}
                    </div>
                    {u.tg_username && (
                      <div style={{ fontSize: 12, color: 'rgba(28,28,30,0.45)' }}>@{u.tg_username}</div>
                    )}
                  </Link>
                </Td>
                <Td>
                  {(() => {
                    const src = u.source ?? 'main'
                    const color = SOURCE_COLORS[src] ?? '#8E8E93'
                    return <Badge color={color}>{SOURCE_LABELS[src] ?? src}</Badge>
                  })()}
                </Td>
                <Td>
                  {(() => {
                    const st = data.payStatus.get(u.tg_id) ?? 'none'
                    if (st === 'paid')    return <Badge color="#30D158">✓ оплатил</Badge>
                    if (st === 'churned') return <Badge color="#FF3B30">отписался</Badge>
                    return <Badge color="#8E8E93">—</Badge>
                  })()}
                </Td>
                <Td>
                  {data.clickedSet.has(u.tg_id)
                    ? <Badge color="#BF5AF2">кликнул</Badge>
                    : <Badge color="#8E8E93">—</Badge>}
                </Td>
                <Td>
                  {u.is_channel_member === true ? (
                    <Badge color="#30D158">в канале</Badge>
                  ) : u.is_channel_member === false ? (
                    <Badge color="#FF3B30">нет</Badge>
                  ) : (
                    <Badge color="#8E8E93">?</Badge>
                  )}
                </Td>
                <Td>{u.events_count}</Td>
                <Td style={{ color: 'rgba(28,28,30,0.70)' }}>{formatRel(u.last_seen_at)}</Td>
                <Td style={{ color: 'rgba(28,28,30,0.60)', fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>
                  {u.last_event_type ?? '—'}
                </Td>
                <Td style={{ color: 'rgba(28,28,30,0.55)' }}>
                  {new Date(u.first_seen_at).toLocaleDateString('ru-RU')}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.users.length === 0 && (
          <div className="text-center py-10 text-sm" style={{ color: 'rgba(28,28,30,0.45)' }}>
            Пока никто не взаимодействовал с ботом
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: '#FFFFFF', border: '1px solid rgba(28,28,30,0.06)' }}>
      <div className="text-xs font-semibold uppercase mb-1" style={{ color: 'rgba(28,28,30,0.45)', letterSpacing: '0.6px' }}>
        {label}
      </div>
      <div className="text-2xl font-bold" style={{ color: '#1C1C1E', letterSpacing: '-0.4px' }}>
        {value}
      </div>
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'rgba(28,28,30,0.55)' }}>{children}</th>
}
function Td({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <td style={{ padding: '12px 14px', ...style }}>{children}</td>
}
function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: 8, background: `${color}18`, color, fontSize: 11, fontWeight: 600 }}>
      {children}
    </span>
  )
}
