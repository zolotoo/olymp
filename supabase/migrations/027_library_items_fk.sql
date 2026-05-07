-- 027: foreign key library_items → tg_messages.
--
-- В 026 я завёл library_items с (chat_id, message_id), но без FK.
-- Это сломало Supabase-вые nested-joins вида
--   .from('library_items').select('tg_messages:tg_messages!inner(...)')
-- — PostgREST не находит связь между таблицами и возвращает ошибку.
--
-- tg_messages имеет UNIQUE(message_id, chat_id) (порядок важен!), поэтому
-- FK ссылается в том же порядке.
--
-- ON DELETE CASCADE: если когда-то всё же удалим tg_message — карточка
-- библиотеки тоже исчезнет (а не превратится в висяк с NULL-текстом).

ALTER TABLE public.library_items
  DROP CONSTRAINT IF EXISTS library_items_message_fkey;

ALTER TABLE public.library_items
  ADD CONSTRAINT library_items_message_fkey
  FOREIGN KEY (message_id, chat_id)
  REFERENCES public.tg_messages(message_id, chat_id)
  ON DELETE CASCADE;

NOTIFY pgrst, 'reload schema';
