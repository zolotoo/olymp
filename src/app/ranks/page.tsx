import RanksWeeklyEditor from '@/components/RanksWeeklyEditor'
import RanksOnJoinList, { type OnJoinItem } from '@/components/RanksOnJoinList'

export const metadata = { title: 'Ранги — AI Олимп' }

const RANKS: {
  key: string
  label: string
  minPoints: number
  maxPoints: number | null
  minMonths: number
  color: string
  dotColor: string
  description: string
  onJoin: OnJoinItem[]
  weekly: string[]
}[] = [
  {
    key: 'newcomer',
    label: 'Адепт',
    minPoints: 0,
    maxPoints: 499,
    minMonths: 0,
    color: '#636366',
    dotColor: '#C7C7CC',
    description: 'Начальный уровень. Участник только познакомился с клубом.',
    onJoin: [
      {
        key: 'rank_newcomer_video',
        label: 'Приветственный кружок от Сергея',
        type: 'video',
        defaultContent: '',
      },
      {
        key: 'rank_newcomer_welcome',
        label: 'Приветственное сообщение с описанием клуба, рангов и системы листиков',
        type: 'message',
        defaultContent: '',
      },
      {
        key: 'rank_newcomer_day1',
        label: 'День 1 — Ранги: что такое Адепт, Герой, Полубог…',
        type: 'message',
        defaultContent: '',
      },
      {
        key: 'rank_newcomer_day2',
        label: 'День 2 — Листики: как зарабатывать и на что тратить',
        type: 'message',
        defaultContent: '',
      },
      {
        key: 'rank_newcomer_day3',
        label: 'День 3 — Про клуб: правила, ценности, форматы',
        type: 'message',
        defaultContent: '',
      },
      {
        key: 'rank_newcomer_task',
        label: 'Первое задание для новичка',
        type: 'message',
        defaultContent: '',
      },
    ],
    weekly: [
      'Кружок от Сергея (еженедельный)',
      'Дайджест недели',
      'Персональное сообщение по сегменту активности',
    ],
  },
  {
    key: 'member',
    label: 'Герой',
    minPoints: 500,
    maxPoints: 1499,
    minMonths: 0,
    color: '#0A84FF',
    dotColor: '#0A84FF',
    description: 'Участник освоился, начал активно участвовать.',
    onJoin: [
      {
        key: 'rank_member_rank_up',
        label: 'DM-уведомление: «Ты достиг ранга Герой»',
        type: 'message',
        defaultContent: '',
      },
      {
        key: 'rank_member_title',
        label: 'Обновление Telegram-титула в группе',
        type: 'action',
        defaultContent: '',
      },
    ],
    weekly: [
      'Кружок от Сергея',
      'Дайджест недели',
      'Персональное сообщение по сегменту',
    ],
  },
  {
    key: 'active',
    label: 'Полубог',
    minPoints: 1500,
    maxPoints: 3499,
    minMonths: 2,
    color: '#FF9500',
    dotColor: '#FF9500',
    description: 'Постоянный участник, 2+ месяца в клубе.',
    onJoin: [
      {
        key: 'rank_active_rank_up',
        label: 'DM-уведомление: «Ты достиг ранга Полубог»',
        type: 'message',
        defaultContent: '',
      },
      {
        key: 'rank_active_title',
        label: 'Обновление Telegram-титула в группе',
        type: 'action',
        defaultContent: '',
      },
    ],
    weekly: [
      'Кружок от Сергея',
      'Дайджест недели',
      'Персональное сообщение по сегменту',
    ],
  },
  {
    key: 'champion',
    label: 'Бог Олимпа',
    minPoints: 3500,
    maxPoints: 6999,
    minMonths: 3,
    color: '#FF9F0A',
    dotColor: '#FF9F0A',
    description: 'Лидер сообщества, 3+ месяца активного участия.',
    onJoin: [
      {
        key: 'rank_champion_rank_up',
        label: 'DM-уведомление: «Ты достиг ранга Бог Олимпа»',
        type: 'message',
        defaultContent: '',
      },
      {
        key: 'rank_champion_title',
        label: 'Обновление Telegram-титула в группе',
        type: 'action',
        defaultContent: '',
      },
    ],
    weekly: [
      'Кружок от Сергея',
      'Дайджест недели',
      'Персональное сообщение по сегменту',
    ],
  },
  {
    key: 'legend',
    label: 'Чемпион Олимпа',
    minPoints: 7000,
    maxPoints: null,
    minMonths: 6,
    color: '#BF5AF2',
    dotColor: '#BF5AF2',
    description: 'Легенда клуба. Высший уровень. 6+ месяцев, максимальная вовлечённость.',
    onJoin: [
      {
        key: 'rank_legend_rank_up',
        label: 'DM-уведомление: «Ты достиг ранга Чемпион Олимпа»',
        type: 'message',
        defaultContent: '',
      },
      {
        key: 'rank_legend_title',
        label: 'Обновление Telegram-титула в группе',
        type: 'action',
        defaultContent: '',
      },
    ],
    weekly: [
      'Кружок от Сергея',
      'Дайджест недели',
      'Персональное сообщение по сегменту',
    ],
  },
]

const glass = {
  background: 'rgba(255,255,255,0.66)',
  backdropFilter: 'blur(28px) saturate(160%)',
  WebkitBackdropFilter: 'blur(28px) saturate(160%)',
  border: '1px solid rgba(255,255,255,0.52)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.07)',
} as const

export default function RanksPage() {
  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="rounded-2xl px-6 py-5 mb-8" style={glass}>
        <div
          className="text-xs font-semibold mb-2 uppercase"
          style={{ color: 'rgba(28,28,30,0.45)', letterSpacing: '0.8px' }}
        >
          Вселенная Олимпа
        </div>
        <h1
          className="text-3xl font-bold mb-1"
          style={{ color: '#1C1C1E', letterSpacing: '-1px', lineHeight: 1.1 }}
        >
          Ранги
        </h1>
        <p className="text-sm" style={{ color: 'rgba(28,28,30,0.55)', letterSpacing: '-0.2px' }}>
          Пять уровней — от Адепта до Чемпиона Олимпа.{' '}
          <span style={{ color: '#0A84FF' }}>
            Нажмите на любой пункт «При достижении» чтобы открыть / отредактировать сообщение.
          </span>
        </p>
      </div>

      {/* Points system */}
      <div className="rounded-2xl p-6 mb-6" style={glass}>
        <h2
          className="text-base font-bold mb-4"
          style={{ color: '#1C1C1E', letterSpacing: '-0.4px' }}
        >
          Система листиков
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { action: 'Голосование в опросе', pts: '+5' },
            { action: 'Реакция на ваше сообщение', pts: '+3' },
            { action: 'Сообщение в чате', pts: '+1' },
            { action: 'Ваша реакция на чужое', pts: '+1' },
          ].map(r => (
            <div
              key={r.action}
              className="rounded-xl p-4"
              style={{ background: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.48)' }}
            >
              <div
                className="text-xl font-bold mb-1"
                style={{ color: '#1C1C1E', letterSpacing: '-0.5px' }}
              >
                {r.pts}
              </div>
              <div
                className="text-xs"
                style={{ color: 'rgba(28,28,30,0.55)', letterSpacing: '-0.1px', lineHeight: 1.4 }}
              >
                {r.action}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Rank cards */}
      <div className="space-y-4 mb-8">
        {RANKS.map((rank, i) => (
          <div key={rank.key} className="rounded-2xl p-6" style={glass}>
            <div className="flex items-start gap-5">
              {/* Number + connector bar */}
              <div className="flex flex-col items-center" style={{ minWidth: 28 }}>
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ background: rank.dotColor, color: '#FFFFFF' }}
                >
                  {i + 1}
                </div>
                {i < RANKS.length - 1 && (
                  <div
                    className="w-0.5 mt-2"
                    style={{ height: 40, background: 'rgba(0,0,0,0.08)' }}
                  />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-3 flex-wrap mb-1">
                  <h3
                    className="text-xl font-bold"
                    style={{ color: rank.color, letterSpacing: '-0.5px' }}
                  >
                    {rank.label}
                  </h3>
                  <span
                    className="text-sm"
                    style={{ color: 'rgba(28,28,30,0.45)', letterSpacing: '-0.2px' }}
                  >
                    {rank.minPoints.toLocaleString()}
                    {rank.maxPoints ? `–${rank.maxPoints.toLocaleString()}` : '+'} листиков
                    {rank.minMonths > 0 ? ` · ${rank.minMonths}+ мес.` : ''}
                  </span>
                </div>
                <p
                  className="text-sm mb-4"
                  style={{ color: 'rgba(28,28,30,0.60)', letterSpacing: '-0.15px' }}
                >
                  {rank.description}
                </p>

                <div className="grid sm:grid-cols-2 gap-4">
                  {/* Clickable / editable onJoin list */}
                  <div>
                    <div
                      className="text-xs font-semibold uppercase mb-2"
                      style={{ color: 'rgba(28,28,30,0.38)', letterSpacing: '0.6px' }}
                    >
                      При достижении
                    </div>
                    <RanksOnJoinList rankColor={rank.color} items={rank.onJoin} />
                  </div>

                  {/* Static weekly list — detail is in RanksWeeklyEditor below */}
                  <div>
                    <div
                      className="text-xs font-semibold uppercase mb-2"
                      style={{ color: 'rgba(28,28,30,0.38)', letterSpacing: '0.6px' }}
                    >
                      Еженедельно
                    </div>
                    <ul className="space-y-1.5">
                      {rank.weekly.map((msg, j) => (
                        <li
                          key={j}
                          className="flex gap-2 text-sm"
                          style={{ color: '#1C1C1E', letterSpacing: '-0.15px', lineHeight: 1.4 }}
                        >
                          <span
                            style={{
                              color: 'rgba(28,28,30,0.35)',
                              flexShrink: 0,
                              marginTop: 2,
                            }}
                          >
                            —
                          </span>
                          {msg}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Weekly by segment — editable */}
      <RanksWeeklyEditor />
    </div>
  )
}
