-- =====================================================================
-- Aulas ao vivo (YouTube não listado) — rode depois do 0001 e 0002
-- =====================================================================
create table if not exists public.live_sessions (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 160),
  description text not null default '' check (char_length(description) <= 2000),
  youtube_id text not null default '' check (char_length(youtube_id) <= 64),
  cover_url text not null default '',
  course_id uuid references public.courses (id) on delete set null, -- null = todos os alunos liberados
  starts_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'ended')),
  show_replay boolean not null default true,
  chat_enabled boolean not null default true,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists live_sessions_starts_idx on public.live_sessions (starts_at desc);

create table if not exists public.live_messages (
  id bigint generated always as identity primary key,
  live_id uuid not null references public.live_sessions (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade,
  text text not null check (char_length(text) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists live_messages_live_idx on public.live_messages (live_id, id);

alter table public.live_sessions enable row level security;
alter table public.live_messages enable row level security;

drop policy if exists live_select on public.live_sessions;
drop policy if exists live_admin on public.live_sessions;
drop policy if exists live_msg_select on public.live_messages;
drop policy if exists live_msg_insert on public.live_messages;
drop policy if exists live_msg_delete on public.live_messages;

-- Só vê a transmissão (e o código do vídeo) quem tem a turma liberada
create policy live_select on public.live_sessions for select to authenticated
  using (
    (select public.is_admin())
    or (
      is_published
      and (select public.is_active_student())
      and (course_id is null or public.can_access_course(course_id))
    )
  );
create policy live_admin on public.live_sessions for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Chat: quem vê a live lê e escreve (enquanto o chat estiver ligado e a live não acabou)
create policy live_msg_select on public.live_messages for select to authenticated
  using (exists (select 1 from public.live_sessions s where s.id = live_id));
create policy live_msg_insert on public.live_messages for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (select 1 from public.live_sessions s where s.id = live_id and s.chat_enabled and s.status <> 'ended')
  );
create policy live_msg_delete on public.live_messages for delete to authenticated
  using (author_id = (select auth.uid()) or (select public.is_admin()));
