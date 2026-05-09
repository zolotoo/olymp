-- Лимит «1 крутка в месяц» больше не соответствует продуктовой логике:
-- welcome-спин при approve и бонус-спин за онбординг легко выдаются в один
-- календарный месяц, плюс ежемесячный спин за продление и покупки в киоске.
-- Кредиты считаются через members.spins_available; UNIQUE(tg_id, month) только
-- ловит легитимные крутки и роняет POST /api/wheel с 23505.
ALTER TABLE public.wheel_spins
  DROP CONSTRAINT IF EXISTS wheel_spins_tg_id_month_key;
