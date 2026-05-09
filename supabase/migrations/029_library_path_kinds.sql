-- 029: тегирование Библиотеки по path_kinds для онбординг-рекомендаций.
--
-- После прохождения анкеты «Мой путь» мы показываем top-1 направление
-- (content/vibecode/media/product/sales) и подборку практикумов под него.
-- Без тегирования подборка == «первые 3 published-практикума» — слишком
-- широко, юзер вайбкодинга получает посты про контент.
--
-- Решение: массив path_kinds в JSONB на каждом library_items. Сергей
-- размечает в админке. Если массив пуст — пост «универсальный», подходит
-- всем (фолбэк-поведение, чтобы не пришлось теггать одним махом).

ALTER TABLE public.library_items
  ADD COLUMN IF NOT EXISTS path_kinds JSONB NOT NULL DEFAULT '[]'::jsonb;

-- GIN-индекс для быстрого containment-фильтра вида path_kinds @> '["vibecode"]'.
-- Если в БД пока пусто — индекс копеечный.
CREATE INDEX IF NOT EXISTS idx_library_items_path_kinds
  ON public.library_items USING GIN (path_kinds);

NOTIFY pgrst, 'reload schema';
