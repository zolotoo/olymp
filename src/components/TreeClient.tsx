'use client'
import { useState } from 'react'

type NodeType = 'root' | 'section' | 'trigger' | 'condition' | 'message' | 'video' | 'action' | 'points'

interface Node {
  id: string
  label: string
  type: NodeType
  detail?: string
  children?: Node[]
}

// ─── Tree data with full message content ──────────────────────────────────────
const TREE: Node = {
  id: 'root', label: 'AI Олимп Бот', type: 'root',
  children: [
    {
      id: 's1', label: '1-я неделя в клубе', type: 'section',
      children: [
        {
          id: 't_start', label: '/start', type: 'trigger', detail: 'Первый контакт пользователя с ботом',
          children: [
            {
              id: 'c_notmember', label: 'Не участник', type: 'condition', detail: 'Пользователь не найден в базе members',
              children: [
                {
                  id: 'l_sales', label: 'Продающее сообщение', type: 'message',
                  detail: 'Привет! Клуб AI Олимп — закрытое сообщество людей, которые используют AI для роста бизнеса.\n\nЧто внутри:\n— Разборы реальных кейсов от Сергея\n— Закрытые инструменты и шаблоны\n— Система рангов и листиков\n— Еженедельные эфиры\n\nПодключиться: [ссылка Tribute]',
                },
              ],
            },
            {
              id: 'c_nowelcome', label: 'Без приветствия', type: 'condition', detail: 'Участник в базе, welcome_sent = false',
              children: [
                {
                  id: 'l_wvideo', label: 'Кружок от Сергея', type: 'video',
                  detail: 'Личное видео-приветствие от Сергея. Отправляется один раз при первом входе. Хранится в TELEGRAM_WELCOME_VIDEO_NOTE_ID.',
                },
                {
                  id: 'l_wmsg', label: 'Приветственное сообщение', type: 'message',
                  detail: '[Имя], добро пожаловать в AI Олимп!\n\nТы — Адепт. Вот как работает клуб:\n\n🍃 Листики — твоя активность\nСообщение +1 · Реакция +1 · На тебя среагировали +3 · Голосование +5\n\nРанги: Адепт → Герой → Полубог → Бог Олимпа → Чемпион\n\nЖди приглашения в канал!',
                },
              ],
            },
            {
              id: 'c_active', label: 'Активный участник', type: 'condition', detail: 'Участник в базе, welcome_sent = true',
              children: [
                {
                  id: 'l_profile', label: 'Профиль участника', type: 'message',
                  detail: 'Ранг: [Ранг]\nЛистики: [N] 🍃\nДней в клубе: [N]\n\nДо следующего ранга: [X] листиков',
                },
              ],
            },
          ],
        },
        {
          id: 't_joinreq', label: 'Заявка в канал', type: 'trigger', detail: 'Событие chat_join_request',
          children: [
            {
              id: 'l_approve', label: 'Авто-одобрение', type: 'action',
              detail: 'Вызов approveChatJoinRequest для заявки.\nПользователь автоматически получает доступ в канал без подтверждения вручную.',
            },
            {
              id: 'l_jrvideo', label: 'Кружок в DM', type: 'video',
              detail: 'Личное видео-приветствие от Сергея + краткое приветственное сообщение.\n\nЕсли DM пользователя заблокированы — шаг пропускается без ошибки.',
            },
          ],
        },
        {
          id: 't_newmem', label: 'Вступление в группу', type: 'trigger', detail: 'Событие new_chat_members',
          children: [
            {
              id: 'l_grpwel', label: 'Приветствие в группе', type: 'message',
              detail: '[Имя], добро пожаловать в AI Олимп! Рады видеть тебя здесь.',
            },
            {
              id: 'l_dmwel', label: 'Приветствие в DM', type: 'message',
              detail: '[Имя], ты в группе AI Олимп!\n\nСистема листиков уже запущена — каждое твоё сообщение, реакция и голос приносят очки.\n\nПиши, участвуй в дискуссиях, расти в рангах. Удачи!\n\n(Отправляется только если welcome ещё не был отправлен)',
            },
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
                {
                  id: 'l_subvideo', label: 'Кружок от Сергея', type: 'video',
                  detail: 'Видео-поздравление от Сергея при оформлении подписки.',
                },
                {
                  id: 'l_subcongrats', label: 'Поздравление', type: 'message',
                  detail: '[Имя], ты официально в AI Олимп!\n\nПодписка активна с [дата].\n\nЧтобы войти в закрытую группу — используй invite-ссылку:\n[ссылка]\n\nУвидимся внутри!',
                },
              ],
            },
            {
              id: 'c_renew', label: 'Продление', type: 'condition', detail: 'event: renewed_subscription',
              children: [
                {
                  id: 'l_renewmsg', label: 'Подписка продлена', type: 'message',
                  detail: '[Имя], ещё один месяц в AI Олимп!\n\n+100 листиков за верность 🍃\n\nТвои листики: [N]\nРанг: [Ранг]\n\nСпасибо, что остаёшься с нами!',
                },
              ],
            },
            {
              id: 'c_cancel', label: 'Отписка', type: 'condition', detail: 'event: cancelled_subscription',
              children: [
                {
                  id: 'l_adminnotif', label: 'Уведомление админу', type: 'action',
                  detail: 'Сообщение в TELEGRAM_ADMIN_CHAT_ID:\n\n❌ Отписался: [Имя] (@username)\nПодписка с: [дата начала]\nДней в клубе: [N]',
                },
                {
                  id: 'l_farewell', label: 'Прощание участнику', type: 'message',
                  detail: '[Имя], жаль, что уходишь из AI Олимп.\n\nЧто пошло не так? Напиши — мне это важно.\n\nЕсли решишь вернуться — буду рад видеть снова через 6 месяцев.\n\nСергей',
                },
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
          id: 't_activity', label: 'Активность → Листики', type: 'trigger',
          children: [
            {
              id: 'l_msgpts', label: 'Сообщение в чате', type: 'points',
              detail: '+1 листик автору за каждое сообщение в группе.\n\nАвтор определяется по from.id сообщения.',
            },
            {
              id: 'l_reactgive', label: 'Поставить реакцию', type: 'points',
              detail: '+1 листик тому, кто поставил реакцию.\n\nОбрабатывается через message_reaction update.',
            },
            {
              id: 'l_reactrecv', label: 'Получить реакцию', type: 'points',
              detail: '+3 листика автору сообщения, на которое поставили реакцию.\n\nАвтор определяется из tg_messages по message_id.',
            },
            {
              id: 'l_poll', label: 'Голосование', type: 'points',
              detail: '+5 листиков проголосовавшему.\n\nОбрабатывается через poll_answer update.',
            },
            {
              id: 'c_rankup', label: 'Новый ранг', type: 'condition', detail: 'Сумма листиков пересекла порог следующего ранга',
              children: [
                {
                  id: 'l_title', label: 'Обновление титула', type: 'action',
                  detail: 'Два API вызова:\n1. promoteChatMember — все права false (только для кастомного титула)\n2. setChatAdministratorCustomTitle — устанавливает название ранга\n\nТитул виден рядом с именем в группе.',
                },
                {
                  id: 'l_ranknotif', label: 'Уведомление в DM', type: 'message',
                  detail: 'Поздравляю! Ты достиг ранга [Ранг]!\n\nНовый титул уже виден в группе.\nТвои листики: [N] 🍃\n\nТак держать!',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 's4', label: 'Еженедельные касания', type: 'section',
      children: [
        {
          id: 'w_video', label: 'Кружок от Сергея', type: 'video',
          detail: 'Еженедельный video note от Сергея. Тема меняется каждую неделю.\n\nОтправляется всем активным участникам каждый понедельник.',
        },
        {
          id: 'w1', label: 'Неделя 1', type: 'trigger', detail: 'Персональное сообщение по сегменту — первая неделя',
          children: [
            {
              id: 'w1_dead', label: 'Мертвяки', type: 'condition', detail: 'Ни одного сообщения за неделю',
              children: [{ id: 'w1_dead_msg', label: 'Бонус за первый шаг', type: 'message', detail: 'Привет! Заметил, что ты ещё не написал ни одного сообщения. Всё ок?\n\nНапиши что-нибудь в группе — за первое сообщение дарим тебе 50 листиков прямо сейчас 🎁' }],
            },
            {
              id: 'w1_silent', label: 'Молчуны', type: 'condition', detail: 'Менее 3 сообщений за неделю',
              children: [{ id: 'w1_silent_msg', label: 'Как получить листики', type: 'message', detail: 'Привет! Вот самый быстрый способ получить первые листики:\n\n— Напиши в чате → +1\n— Поставь реакцию на чей-то пост → +1\n— Проголосуй в опросе → +5\n\nЗанимает 2 минуты. Поехали?' }],
            },
            {
              id: 'w1_medium', label: 'Середняки', type: 'condition', detail: '3–9 сообщений за неделю',
              children: [{ id: 'w1_medium_msg', label: 'До следующего ранга', type: 'message', detail: 'Хорошее начало! Ты на [N]-м месте в таблице.\n\nДо ранга [Следующий ранг] осталось [X] листиков. Ты близко — держи темп!' }],
            },
            {
              id: 'w1_active', label: 'Активные', type: 'condition', detail: '10+ сообщений за неделю',
              children: [{ id: 'w1_active_msg', label: 'Бейдж топа', type: 'message', detail: 'Ты в топе этой недели — [N]-е место! 🏆\n\nВот твой бейдж активного участника. Покажи друзьям, что такое настоящий AI Олимп.' }],
            },
          ],
        },
        {
          id: 'w2', label: 'Неделя 2', type: 'trigger', detail: 'Персональное сообщение по сегменту — вторая неделя',
          children: [
            {
              id: 'w2_dead', label: 'Мертвяки', type: 'condition', detail: 'Ни одного сообщения за неделю',
              children: [{ id: 'w2_dead_msg', label: 'Вопрос про ожидания', type: 'message', detail: '[Имя], пара вопросов:\n\nЧто ты ожидал от клуба?\nЧто мешает участвовать?\n\nОтветь — мне важно понять.\n\nА пока — вот дайджест лучшего из канала за неделю: [ссылка]' }],
            },
            {
              id: 'w2_silent', label: 'Молчуны', type: 'condition', detail: 'Менее 3 сообщений за неделю',
              children: [{ id: 'w2_silent_msg', label: 'Напоминание + дайджест', type: 'message', detail: 'Листики никуда не денутся, но ранг растёт у тех, кто пишет 😊\n\nДайджест недели: [ссылка на канал]' }],
            },
            {
              id: 'w2_medium', label: 'Середняки', type: 'condition', detail: '3–9 сообщений за неделю',
              children: [{ id: 'w2_medium_msg', label: 'Тизер следующей недели', type: 'message', detail: 'Подглядел, что будет на следующей неделе в клубе:\n[анонс]\n\nДайджест этой недели: [ссылка на канал]' }],
            },
            {
              id: 'w2_active', label: 'Активные', type: 'condition', detail: '10+ сообщений за неделю',
              children: [{ id: 'w2_active_msg', label: 'Ранний доступ', type: 'message', detail: 'Для самых активных — ранний доступ к [материал/инструмент] 🔑\n\nДайджест недели: [ссылка на канал]' }],
            },
          ],
        },
        {
          id: 'w3', label: 'Неделя 3', type: 'trigger', detail: 'Персональное сообщение по сегменту — третья неделя',
          children: [
            {
              id: 'w3_dead', label: 'Мертвяки', type: 'condition', detail: 'Ни одного сообщения за неделю',
              children: [{ id: 'w3_dead_msg', label: 'Двойные листики', type: 'message', detail: '[Имя], специально для тебя — двойные листики за любое сообщение прямо сейчас.\n\nТолько сегодня. Напиши что-нибудь в чате 💬' }],
            },
            {
              id: 'w3_silent', label: 'Молчуны', type: 'condition', detail: 'Менее 3 сообщений за неделю',
              children: [{ id: 'w3_silent_msg', label: 'Напоминание о колесе', type: 'message', detail: 'Напоминание: в конце месяца ты получишь колесо фортуны 🎡\n\nЧем больше листиков — тем интереснее призы. Ещё есть время набрать!' }],
            },
            {
              id: 'w3_medium', label: 'Середняки', type: 'condition', detail: '3–9 сообщений за неделю',
              children: [{ id: 'w3_medium_msg', label: 'Итоги за 3 недели', type: 'message', detail: 'За 3 недели ты набрал [N] листиков. Это [место]-е место в таблице.\n\nЕсли напишешь ещё [X] сообщений до конца месяца — достигнешь [Ранг].' }],
            },
            {
              id: 'w3_active', label: 'Активные', type: 'condition', detail: '10+ сообщений за неделю',
              children: [{ id: 'w3_active_msg', label: 'Топ таблицы лидеров', type: 'message', detail: 'Ты [N]-й в таблице лидеров! 🏆\n\nОтличный результат за 3 недели. Держи место до конца месяца!' }],
            },
          ],
        },
        {
          id: 'w4', label: 'Неделя 4 — перед продлением', type: 'trigger', detail: 'За 7 дней до продления подписки',
          children: [
            {
              id: 'w4_dead', label: 'Мертвяки', type: 'condition', detail: 'Ни одного сообщения за неделю',
              children: [{ id: 'w4_dead_msg', label: 'Предупреждение об уходе', type: 'message', detail: '[Имя], подписка продлевается через 7 дней.\n\nЕсли решишь отписаться — знай: вернуться можно не раньше чем через 6 месяцев.\n\nКлуб ценит тех, кто остаётся.' }],
            },
            {
              id: 'w4_silent', label: 'Молчуны', type: 'condition', detail: 'Менее 3 сообщений за неделю',
              children: [{ id: 'w4_silent_msg', label: 'Анонс следующего месяца', type: 'message', detail: 'Подписка через 7 дней.\n\nВот что тебя ждёт в следующем месяце:\n[анонс программы]\n\nСтоит остаться 😊' }],
            },
            {
              id: 'w4_medium', label: 'Середняки', type: 'condition', detail: '3–9 сообщений за неделю',
              children: [{ id: 'w4_medium_msg', label: 'Итоги месяца', type: 'message', detail: 'Месяц подходит к концу!\n\nТвои листики: [N] · Ранг: [Ранг]\n\nВ следующем месяце: [анонс]. Продление подтвердит твоё место.' }],
            },
            {
              id: 'w4_active', label: 'Активные', type: 'condition', detail: '10+ сообщений за неделю',
              children: [{ id: 'w4_active_msg', label: 'Личная благодарность', type: 'message', detail: '[Имя], спасибо за этот месяц — ты один из лучших в клубе.\n\nВ следующем месяце готовим [анонс]. Рад, что ты с нами!\n\nСергей' }],
            },
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
const TYPE_STYLE: Record<NodeType, {
  bg: string; border: string; textColor: string
  badge: string; badgeBg: string; badgeColor: string
}> = {
  root:      { bg: 'rgba(20,20,24,0.72)',  border: 'rgba(255,255,255,0.16)', textColor: '#FFFFFF',          badge: 'бот',       badgeBg: 'rgba(255,255,255,0.15)', badgeColor: 'rgba(255,255,255,0.75)' },
  section:   { bg: 'rgba(26,26,30,0.65)',  border: 'rgba(255,255,255,0.14)', textColor: '#FFFFFF',          badge: 'раздел',    badgeBg: 'rgba(255,255,255,0.13)', badgeColor: 'rgba(255,255,255,0.65)' },
  trigger:   { bg: 'rgba(255,255,255,0.72)', border: 'rgba(255,255,255,0.55)', textColor: '#1C1C1E',        badge: 'триггер',   badgeBg: 'rgba(255,165,0,0.13)',   badgeColor: '#A86200' },
  condition: { bg: 'rgba(255,255,255,0.58)', border: 'rgba(255,255,255,0.44)', textColor: 'rgba(28,28,30,0.72)', badge: 'ветка',  badgeBg: 'rgba(100,100,110,0.10)', badgeColor: '#636366' },
  message:   { bg: 'rgba(255,255,255,0.72)', border: 'rgba(255,255,255,0.55)', textColor: '#1C1C1E',        badge: 'сообщение', badgeBg: 'rgba(10,132,255,0.12)',  badgeColor: '#0A84FF' },
  video:     { bg: 'rgba(255,255,255,0.72)', border: 'rgba(255,255,255,0.55)', textColor: '#1C1C1E',        badge: 'видео',     badgeBg: 'rgba(191,90,242,0.12)',  badgeColor: '#BF5AF2' },
  action:    { bg: 'rgba(255,255,255,0.72)', border: 'rgba(255,255,255,0.55)', textColor: '#1C1C1E',        badge: 'действие',  badgeBg: 'rgba(48,209,88,0.12)',   badgeColor: '#1C8A3C' },
  points:    { bg: 'rgba(255,255,255,0.72)', border: 'rgba(255,255,255,0.55)', textColor: '#1C1C1E',        badge: 'листики',   badgeBg: 'rgba(48,209,88,0.12)',   badgeColor: '#1C8A3C' },
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function TreeClient() {
  const [selected, setSelected] = useState<Node | null>(null)

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

  return (
    <div>
      {/* Header */}
      <div className="inline-block rounded-3xl px-6 py-5 mb-5" style={{
        background: 'rgba(255,255,255,0.72)',
        backdropFilter: 'blur(28px) saturate(160%)',
        WebkitBackdropFilter: 'blur(28px) saturate(160%)',
        border: '1px solid rgba(255,255,255,0.55)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.10)',
      }}>
        <div className="text-xs font-semibold uppercase mb-2" style={{ color: 'rgba(28,28,30,0.42)', letterSpacing: '0.8px' }}>
          Автоматизация
        </div>
        <h1 className="text-3xl font-bold" style={{ color: '#1C1C1E', letterSpacing: '-1px', lineHeight: 1.1 }}>
          Дерево сообщений
        </h1>
        <p className="text-sm mt-1" style={{ color: 'rgba(28,28,30,0.50)', letterSpacing: '-0.2px' }}>
          Нажмите на узел чтобы увидеть текст сообщения
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
      <div style={{ overflowX: 'auto' }}>
        <div style={{ position: 'relative', width: canvasW, height: canvasH, minWidth: canvasW }}>
          <svg
            style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }}
            width={canvasW} height={canvasH}
          >
            {edges.map((e, i) => {
              const cx = Math.abs(e.x2 - e.x1) * 0.44
              return (
                <path
                  key={i}
                  d={`M ${e.x1} ${e.y1} C ${e.x1 + cx} ${e.y1} ${e.x2 - cx} ${e.y2} ${e.x2} ${e.y2}`}
                  fill="none"
                  stroke="rgba(255,255,255,0.55)"
                  strokeWidth={1.5}
                />
              )
            })}
          </svg>

          {placed.map(({ node, x, y }) => {
            const s = TYPE_STYLE[node.type]
            const isDark = node.type === 'root' || node.type === 'section'
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
                  boxShadow: isDark
                    ? '0 8px 24px rgba(0,0,0,0.20)'
                    : '0 2px 10px rgba(0,0,0,0.08)',
                  borderRadius: 14,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0 10px',
                  gap: 5,
                  transition: 'transform 0.12s, box-shadow 0.12s',
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLDivElement
                  el.style.transform = 'scale(1.04)'
                  el.style.boxShadow = '0 6px 20px rgba(0,0,0,0.15)'
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLDivElement
                  el.style.transform = ''
                  el.style.boxShadow = isDark ? '0 8px 24px rgba(0,0,0,0.20)' : '0 2px 10px rgba(0,0,0,0.08)'
                }}
              >
                <span style={{
                  fontSize: 11,
                  fontWeight: 500,
                  color: s.textColor,
                  letterSpacing: '-0.3px',
                  lineHeight: 1.3,
                  overflow: 'hidden',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  minWidth: 0,
                }}>
                  {node.label}
                </span>
                <span style={{
                  fontSize: 9,
                  fontWeight: 600,
                  color: s.badgeColor,
                  background: s.badgeBg,
                  padding: '2px 6px',
                  borderRadius: 50,
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  letterSpacing: '0.1px',
                }}>
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
            background: 'rgba(0,0,0,0.28)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
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
              background: 'rgba(255,255,255,0.88)',
              backdropFilter: 'blur(40px) saturate(180%)',
              WebkitBackdropFilter: 'blur(40px) saturate(180%)',
              border: '1px solid rgba(255,255,255,0.72)',
              boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
              borderRadius: 24,
              padding: '28px 30px',
              maxWidth: 460,
              width: '100%',
              maxHeight: '85vh',
              overflowY: 'auto',
            }}
            onClick={e => e.stopPropagation()}
          >
            <span style={{
              fontSize: 10.5,
              fontWeight: 600,
              letterSpacing: '0.4px',
              textTransform: 'uppercase',
              color: TYPE_STYLE[selected.type].badgeColor,
              background: TYPE_STYLE[selected.type].badgeBg,
              padding: '3px 10px',
              borderRadius: 50,
              display: 'inline-block',
              marginBottom: 12,
            }}>
              {TYPE_STYLE[selected.type].badge}
            </span>
            <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.6px', lineHeight: 1.2, color: '#1C1C1E', marginBottom: 6 }}>
              {selected.label}
            </h2>
            {selected.detail && (
              <>
                <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'rgba(28,28,30,0.38)', marginBottom: 6, marginTop: 14 }}>
                  {selected.type === 'message' ? 'Текст сообщения' : selected.type === 'video' ? 'Описание' : 'Детали'}
                </div>
                <div style={{
                  background: selected.type === 'message' ? 'rgba(10,132,255,0.05)' : 'rgba(28,28,30,0.04)',
                  border: `1px solid ${selected.type === 'message' ? 'rgba(10,132,255,0.12)' : 'rgba(28,28,30,0.08)'}`,
                  borderRadius: 14,
                  padding: '14px 16px',
                  fontSize: 13.5,
                  color: 'rgba(28,28,30,0.75)',
                  letterSpacing: '-0.15px',
                  lineHeight: 1.65,
                  whiteSpace: 'pre-line',
                }}>
                  {selected.detail}
                </div>
              </>
            )}
            {selected.children?.length ? (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'rgba(28,28,30,0.38)', marginBottom: 8 }}>
                  Дочерние узлы ({selected.children.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {selected.children.map(c => (
                    <div
                      key={c.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        background: 'rgba(255,255,255,0.60)',
                        border: '1px solid rgba(255,255,255,0.52)',
                        borderRadius: 12,
                        padding: '8px 12px',
                        cursor: 'pointer',
                        transition: 'background 0.1s',
                      }}
                      onClick={() => setSelected(c)}
                    >
                      <span style={{ fontSize: 13, fontWeight: 500, color: '#1C1C1E', letterSpacing: '-0.2px', flex: 1 }}>
                        {c.label}
                      </span>
                      <span style={{
                        fontSize: 9.5, fontWeight: 600,
                        color: TYPE_STYLE[c.type].badgeColor,
                        background: TYPE_STYLE[c.type].badgeBg,
                        padding: '2px 8px', borderRadius: 50, whiteSpace: 'nowrap',
                      }}>
                        {TYPE_STYLE[c.type].badge}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            <button
              onClick={() => setSelected(null)}
              style={{
                marginTop: 18,
                width: '100%',
                padding: '10px 0',
                background: 'rgba(28,28,30,0.06)',
                border: 'none',
                borderRadius: 12,
                fontSize: 13.5,
                fontWeight: 500,
                color: 'rgba(28,28,30,0.55)',
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
