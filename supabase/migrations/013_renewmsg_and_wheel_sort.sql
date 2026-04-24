-- 013:
-- 1) l_renewmsg теперь включает поздравление с новым титулом и список бонусов
--    прямо в сообщении о продлении. Отдельная ветка про достижение титула убрана.
-- 2) Сегменты колеса удачи пересортированы по группам: фантики → награды от
--    Сергея → эксклюзивный контент. Внутри групп — по возрастанию ценности.

-- ─── l_renewmsg: перезаписываем с новыми плейсхолдерами ──────────────────────
-- Старый шаблон использовал {title_msg} (больше не передаётся). Сбрасываем на
-- актуальный текст — админ в /flow при желании может отредактировать заново.
UPDATE public.bot_messages
SET content = E'Спасибо за доверие и за то, что выбираешь нас.\n\n' ||
              E'Теперь твой титул — <b>{rank_label}</b>\n' ||
              E'Подписка активна до {expires_at}\n\n' ||
              E'В честь благодарности начислили +{renewal_bonus} фантиков и открыли ещё один спин в Колесе удачи 🎡\n\n' ||
              E'<b>Бонусы твоего титула:</b>\n{perks}',
    label = 'Продление + новый титул'
WHERE key = 'l_renewmsg';

-- ─── wheel_prizes: группируем по смыслу ──────────────────────────────────────
-- Группа 1 (10–30) — фантики по возрастанию: 10 → 15 → 20
-- Группа 2 (40–60) — награды от Сергея: ответ → разбор IG → консультация
-- Группа 3 (70–90) — эксклюзивный контент: гайд → секрет → промокод VeoSee
UPDATE public.wheel_prizes SET sort = 10 WHERE key = 'leaves_10';
UPDATE public.wheel_prizes SET sort = 20 WHERE key = 'leaves_15';
UPDATE public.wheel_prizes SET sort = 30 WHERE key = 'leaves_20';
UPDATE public.wheel_prizes SET sort = 40 WHERE key = 'detailed_q';
UPDATE public.wheel_prizes SET sort = 50 WHERE key = 'ig_review';
UPDATE public.wheel_prizes SET sort = 60 WHERE key = 'consult';
UPDATE public.wheel_prizes SET sort = 70 WHERE key = 'guide';
UPDATE public.wheel_prizes SET sort = 80 WHERE key = 'secret';
UPDATE public.wheel_prizes SET sort = 90 WHERE key = 'veoseebot';

NOTIFY pgrst, 'reload schema';
