-- 009: синк репозитория с применённым через MCP состоянием БД.
-- Финальные перки титулов + удаление промокода VeoSeeBot из киоска
-- (раздаётся всем автоматически на 2-й неделе, в киоске не нужен).

UPDATE public.titles
SET perks = '["Доступ ко всем материалам","Эфиры с разборами по воскресеньям","4 практикума в месяц","Новые бесплатные ИИ с гайдами","Доступ к материалам для новичков","100+ промтов в месяц"]'::jsonb,
    updated_at = now()
WHERE rank = 'newcomer';

UPDATE public.titles
SET perks = '["Тег Герой в общем чате","+10 фантиков","Практикум: как сделать монтаж на миллион просмотров с помощью ИИ","Участие в розыгрыше консультации с Сергеем"]'::jsonb,
    updated_at = now()
WHERE rank = 'member';

UPDATE public.titles
SET perks = '["Тег Чемпион в общем чате","+20 фантиков","1 разбор Instagram от Сергея с рекомендациями"]'::jsonb,
    updated_at = now()
WHERE rank = 'active';

UPDATE public.titles
SET perks = '["Тег Полубог в общем чате","+30 фантиков","Личный практикум для Полубогов - как я дважды заработал больше 10 000 долларов в ИИ"]'::jsonb,
    updated_at = now()
WHERE rank = 'champion';

UPDATE public.titles
SET perks = '["Тег Бог в общем чате","+40 фантиков","+1 общий созвон в неделю, с практикой и разборами, только для Богов"]'::jsonb,
    updated_at = now()
WHERE rank = 'legend';

-- VeoSeeBot в киоске больше не продаётся: промокод ZOLOTO раздаётся на 2-й неделе.
DELETE FROM public.shop_items WHERE key = 'promo_veoseebot';
DELETE FROM public.promo_codes WHERE item_key = 'promo_veoseebot';

NOTIFY pgrst, 'reload schema';
