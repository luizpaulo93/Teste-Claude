-- =====================================================================
-- Comentários nas aulas (rode depois do 0001_schema.sql)
-- =====================================================================
create table if not exists public.lesson_comments (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade,
  text text not null check (char_length(text) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists lesson_comments_lesson_idx on public.lesson_comments (lesson_id, created_at desc);

alter table public.lesson_comments enable row level security;

drop policy if exists comments_select on public.lesson_comments;
drop policy if exists comments_insert on public.lesson_comments;
drop policy if exists comments_delete on public.lesson_comments;

-- Quem enxerga a aula (RLS de lessons) enxerga e comenta
create policy comments_select on public.lesson_comments for select to authenticated
  using (exists (select 1 from public.lessons l where l.id = lesson_id));
create policy comments_insert on public.lesson_comments for insert to authenticated
  with check (author_id = (select auth.uid()) and exists (select 1 from public.lessons l where l.id = lesson_id));
create policy comments_delete on public.lesson_comments for delete to authenticated
  using (author_id = (select auth.uid()) or (select public.is_admin()));
