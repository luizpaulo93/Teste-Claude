-- =====================================================================
-- Vértice — Área de Membros (Supabase / Postgres)
-- Rode este arquivo inteiro no SQL Editor do Supabase (uma vez).
-- Ele é idempotente na medida do possível (IF NOT EXISTS / OR REPLACE).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Perfis (1:1 com auth.users)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '',
  avatar_url text not null default '',
  phone text not null default '',
  birth_date date,
  role text not null default 'student' check (role in ('admin', 'student')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists profiles_email_idx on public.profiles (lower(email));

-- E-mails que viram administradores automaticamente no primeiro login.
create table if not exists public.admin_emails (
  email text primary key
);
insert into public.admin_emails (email) values ('luizpaulofisica@gmail.com')
on conflict do nothing;

-- ---------------------------------------------------------------------
-- Configuração da plataforma (linha única id = 1)
-- ---------------------------------------------------------------------
create table if not exists public.platform_settings (
  id int primary key default 1 check (id = 1),
  brand_name text not null default 'CURSO VÉRTICE',
  hero_title text not null default 'Sua plataforma para Enem e vestibulares',
  hero_subtitle text not null default 'Especialista em física, química e matemática',
  hero_cta text not null default 'Começar agora',
  hero_bg_url text not null default '',
  restrict_to_student_list boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into public.platform_settings (id) values (1) on conflict do nothing;

-- ---------------------------------------------------------------------
-- Conteúdo: cursos > módulos > aulas > materiais
-- ---------------------------------------------------------------------
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 160),
  subtitle text not null default '' check (char_length(subtitle) <= 240),
  description text not null default '' check (char_length(description) <= 3000),
  category text not null default '' check (char_length(category) <= 80),
  cover_url text not null default '',
  banner_url text not null default '',
  position int not null default 0,
  featured boolean not null default false,
  is_free boolean not null default false,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists courses_position_idx on public.courses (position);

create table if not exists public.modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  description text not null default '' check (char_length(description) <= 1500),
  cover_url text not null default '',
  position int not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists modules_course_idx on public.modules (course_id, position);

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  description text not null default '' check (char_length(description) <= 4000),
  youtube_id text not null default '' check (char_length(youtube_id) <= 64),
  duration text not null default '' check (char_length(duration) <= 16),
  thumbnail_url text not null default '',
  position int not null default 0,
  is_free boolean not null default false,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists lessons_module_idx on public.lessons (module_id, position);
create index if not exists lessons_course_idx on public.lessons (course_id);

create table if not exists public.lesson_materials (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  file_path text not null,
  size_label text not null default '',
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists lesson_materials_lesson_idx on public.lesson_materials (lesson_id, position);

-- ---------------------------------------------------------------------
-- Turmas e alunos (lista de liberação por e-mail)
-- ---------------------------------------------------------------------
create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  description text not null default '',
  access_all boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.class_courses (
  class_id uuid not null references public.classes (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  primary key (class_id, course_id)
);
create index if not exists class_courses_course_idx on public.class_courses (course_id);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text not null default '',
  phone text not null default '',
  cpf text not null default '',
  birth_date date,
  class_id uuid references public.classes (id) on delete set null,
  status text not null default 'active' check (status in ('active', 'blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists students_email_uidx on public.students (lower(email));
create index if not exists students_class_idx on public.students (class_id);

-- ---------------------------------------------------------------------
-- Progresso e favoritos
-- ---------------------------------------------------------------------
create table if not exists public.lesson_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  completed boolean not null default false,
  position_sec int not null default 0,
  duration_sec int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);
create index if not exists lesson_progress_recent_idx on public.lesson_progress (user_id, updated_at desc);

create table if not exists public.favorites (
  user_id uuid not null references auth.users (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

-- ---------------------------------------------------------------------
-- Calendário
-- ---------------------------------------------------------------------
create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 160),
  description text not null default '',
  category text not null default 'evento_curso'
    check (category in ('assunto_semana','evento_curso','simulado','revisao','feriado','aviso')),
  start_date date not null,
  end_date date not null,
  color text not null default 'blue',
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);
create index if not exists calendar_events_dates_idx on public.calendar_events (start_date, end_date);

-- ---------------------------------------------------------------------
-- Simulados (gabarito separado e protegido)
-- ---------------------------------------------------------------------
create table if not exists public.simulados (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 160),
  area text not null check (area in ('MT','CN','CH','LC')),
  question_count int not null check (question_count between 1 and 180),
  time_limit_minutes int not null default 0 check (time_limit_minutes between 0 and 600),
  pdf_path text not null default '',
  is_published boolean not null default false,
  results_released boolean not null default false,
  stats jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.simulado_keys (
  simulado_id uuid primary key references public.simulados (id) on delete cascade,
  answer_key text not null default ''
);

create table if not exists public.simulado_submissions (
  id uuid primary key default gen_random_uuid(),
  simulado_id uuid not null references public.simulados (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  answers text not null default '',
  status text not null default 'in_progress' check (status in ('in_progress','completed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  duration_seconds int not null default 0,
  updated_at timestamptz not null default now(),
  unique (simulado_id, user_id)
);
create index if not exists simulado_submissions_user_idx on public.simulado_submissions (user_id);

create table if not exists public.simulado_results (
  simulado_id uuid not null references public.simulados (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  correct int not null,
  wrong int not null,
  blank int not null,
  accuracy int not null,
  coherence int not null,
  tri_score numeric(6,1) not null,
  tri_min numeric(6,1) not null,
  tri_mean numeric(6,1) not null,
  tri_max numeric(6,1) not null,
  tiers jsonb not null default '{}'::jsonb,
  breakdown jsonb not null default '[]'::jsonb,
  computed_at timestamptz not null default now(),
  primary key (simulado_id, user_id)
);
create index if not exists simulado_results_user_idx on public.simulado_results (user_id);

-- ---------------------------------------------------------------------
-- Dúvidas (fórum)
-- ---------------------------------------------------------------------
create table if not exists public.doubts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users (id) on delete cascade,
  text text not null check (char_length(text) between 1 and 4000),
  image_url text not null default '',
  is_resolved boolean not null default false,
  likes_count int not null default 0,
  replies_count int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists doubts_created_idx on public.doubts (created_at desc);

create table if not exists public.doubt_replies (
  id uuid primary key default gen_random_uuid(),
  doubt_id uuid not null references public.doubts (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade,
  text text not null check (char_length(text) between 1 and 4000),
  image_url text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists doubt_replies_doubt_idx on public.doubt_replies (doubt_id, created_at);

create table if not exists public.doubt_likes (
  doubt_id uuid not null references public.doubts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  primary key (doubt_id, user_id)
);

-- ---------------------------------------------------------------------
-- Mentoria
-- ---------------------------------------------------------------------
create table if not exists public.mentorias (
  id uuid primary key default gen_random_uuid(),
  student_email text not null,
  student_name text not null default '',
  status text not null default 'active' check (status in ('active','paused','ended')),
  goal text not null default '' check (char_length(goal) <= 600),
  exam_target text not null default '' check (char_length(exam_target) <= 120),
  weekly_hours_target int not null default 20 check (weekly_hours_target between 0 and 100),
  start_date date not null default current_date,
  end_date date,
  created_at timestamptz not null default now()
);
create unique index if not exists mentorias_email_uidx on public.mentorias (lower(student_email));

create table if not exists public.mentoria_tasks (
  id uuid primary key default gen_random_uuid(),
  mentoria_id uuid not null references public.mentorias (id) on delete cascade,
  week_start date not null,
  title text not null check (char_length(title) between 1 and 200),
  description text not null default '',
  kind text not null default 'aula' check (kind in ('aula','questoes','simulado','revisao','outro')),
  due_date date,
  done boolean not null default false,
  done_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists mentoria_tasks_idx on public.mentoria_tasks (mentoria_id, week_start);

create table if not exists public.mentoria_checkins (
  id uuid primary key default gen_random_uuid(),
  mentoria_id uuid not null references public.mentorias (id) on delete cascade,
  week_start date not null,
  hours_studied numeric(5,1) not null default 0 check (hours_studied between 0 and 168),
  questions_done int not null default 0 check (questions_done between 0 and 5000),
  focus_rating int not null default 3 check (focus_rating between 1 and 5),
  wins text not null default '' check (char_length(wins) <= 1500),
  difficulties text not null default '' check (char_length(difficulties) <= 1500),
  mentor_feedback text not null default '' check (char_length(mentor_feedback) <= 3000),
  feedback_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (mentoria_id, week_start)
);

create table if not exists public.mentoria_meetings (
  id uuid primary key default gen_random_uuid(),
  mentoria_id uuid references public.mentorias (id) on delete cascade, -- null = encontro em grupo
  title text not null check (char_length(title) between 1 and 160),
  description text not null default '',
  starts_at timestamptz not null,
  duration_min int not null default 60 check (duration_min between 5 and 600),
  link text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists mentoria_meetings_idx on public.mentoria_meetings (mentoria_id, starts_at);

-- =====================================================================
-- Funções auxiliares de acesso (SECURITY DEFINER, sem recursão de RLS)
-- =====================================================================
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.my_email()
returns text language sql stable as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

-- Aluno ativo e liberado (está na lista, status ativo e com turma)
create or replace function public.is_active_student()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.students s
    where lower(s.email) = public.my_email() and s.status = 'active' and s.class_id is not null
  ) or not (select restrict_to_student_list from public.platform_settings where id = 1);
$$;

create or replace function public.can_access_course(p_course uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select
    public.is_admin()
    or exists (select 1 from public.courses c where c.id = p_course and c.is_free)
    or not (select restrict_to_student_list from public.platform_settings where id = 1)
    or exists (
      select 1
      from public.students s
      join public.classes cl on cl.id = s.class_id
      where lower(s.email) = public.my_email()
        and s.status = 'active'
        and (cl.access_all or exists (
          select 1 from public.class_courses cc where cc.class_id = cl.id and cc.course_id = p_course
        ))
    );
$$;

create or replace function public.my_mentoria_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.mentorias where lower(student_email) = public.my_email() limit 1;
$$;

-- =====================================================================
-- Gatilhos
-- =====================================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, role)
  values (
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture', ''),
    case when exists (select 1 from public.admin_emails a where lower(a.email) = lower(new.email))
      then 'admin' else 'student' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Impede aluno de se promover a admin pelo próprio perfil
create or replace function public.protect_profile_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    new.role := old.role;
  end if;
  new.email := old.email;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role before update on public.profiles
  for each row execute function public.protect_profile_role();

-- Contadores de curtidas e respostas (evita COUNT(*) em cada leitura)
create or replace function public.doubt_likes_counter()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.doubts set likes_count = likes_count + 1 where id = new.doubt_id;
  elsif tg_op = 'DELETE' then
    update public.doubts set likes_count = greatest(likes_count - 1, 0) where id = old.doubt_id;
  end if;
  return null;
end;
$$;
drop trigger if exists doubt_likes_count on public.doubt_likes;
create trigger doubt_likes_count after insert or delete on public.doubt_likes
  for each row execute function public.doubt_likes_counter();

create or replace function public.doubt_replies_counter()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.doubts set replies_count = replies_count + 1 where id = new.doubt_id;
  elsif tg_op = 'DELETE' then
    update public.doubts set replies_count = greatest(replies_count - 1, 0) where id = old.doubt_id;
  end if;
  return null;
end;
$$;
drop trigger if exists doubt_replies_count on public.doubt_replies;
create trigger doubt_replies_count after insert or delete on public.doubt_replies
  for each row execute function public.doubt_replies_counter();

-- Aluno só altera respostas enquanto a prova está em andamento
create or replace function public.guard_submission()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_limit int;
begin
  if public.is_admin() then
    return new;
  end if;
  if old.status = 'completed' then
    raise exception 'Simulado já entregue';
  end if;
  new.user_id := old.user_id;
  new.simulado_id := old.simulado_id;
  new.started_at := old.started_at;
  new.updated_at := now();
  if new.status = 'completed' then
    new.finished_at := now();
    new.duration_seconds := greatest(0, extract(epoch from (now() - old.started_at))::int);
    select time_limit_minutes into v_limit from public.simulados where id = old.simulado_id;
    if v_limit > 0 then
      new.duration_seconds := least(new.duration_seconds, v_limit * 60);
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists simulado_submissions_guard on public.simulado_submissions;
create trigger simulado_submissions_guard before update on public.simulado_submissions
  for each row execute function public.guard_submission();

-- =====================================================================
-- Row Level Security
-- (as funções são chamadas via (select ...) para o Postgres avaliar 1x por consulta)
-- =====================================================================
alter table public.profiles enable row level security;
alter table public.admin_emails enable row level security;
alter table public.platform_settings enable row level security;
alter table public.courses enable row level security;
alter table public.modules enable row level security;
alter table public.lessons enable row level security;
alter table public.lesson_materials enable row level security;
alter table public.classes enable row level security;
alter table public.class_courses enable row level security;
alter table public.students enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.favorites enable row level security;
alter table public.calendar_events enable row level security;
alter table public.simulados enable row level security;
alter table public.simulado_keys enable row level security;
alter table public.simulado_submissions enable row level security;
alter table public.simulado_results enable row level security;
alter table public.doubts enable row level security;
alter table public.doubt_replies enable row level security;
alter table public.doubt_likes enable row level security;
alter table public.mentorias enable row level security;
alter table public.mentoria_tasks enable row level security;
alter table public.mentoria_checkins enable row level security;
alter table public.mentoria_meetings enable row level security;

-- Recria as policies do zero (permite rodar o script de novo)
do $$
declare r record;
begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public' loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- profiles: cada um vê o seu; admin vê todos. Nome/foto públicos ficam na view profile_cards
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()))
  with check (id = (select auth.uid()) or (select public.is_admin()));

create policy admin_emails_admin on public.admin_emails for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy settings_select on public.platform_settings for select using (true);
create policy settings_admin on public.platform_settings for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Catálogo: cursos e módulos publicados são vitrine (mostrados com cadeado se bloqueados)
create policy courses_select on public.courses for select to authenticated
  using (is_published or (select public.is_admin()));
create policy courses_admin on public.courses for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy modules_select on public.modules for select to authenticated
  using ((is_published and exists (select 1 from public.courses c where c.id = course_id and c.is_published))
         or (select public.is_admin()));
create policy modules_admin on public.modules for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Aulas: só quem tem acesso ao curso (ou aula grátis)
create policy lessons_select on public.lessons for select to authenticated
  using ((select public.is_admin()) or (is_published and (is_free or public.can_access_course(course_id))));
create policy lessons_admin on public.lessons for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy materials_select on public.lesson_materials for select to authenticated
  using (exists (select 1 from public.lessons l where l.id = lesson_id));
create policy materials_admin on public.lesson_materials for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy classes_select on public.classes for select to authenticated using (true);
create policy classes_admin on public.classes for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy class_courses_select on public.class_courses for select to authenticated using (true);
create policy class_courses_admin on public.class_courses for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- students: aluno vê só o próprio registro; admin gerencia
create policy students_select on public.students for select to authenticated
  using (lower(email) = (select public.my_email()) or (select public.is_admin()));
create policy students_admin on public.students for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy progress_own on public.lesson_progress for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy progress_admin_read on public.lesson_progress for select to authenticated
  using ((select public.is_admin()));

create policy favorites_own on public.favorites for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy events_select on public.calendar_events for select to authenticated
  using (is_published or (select public.is_admin()));
create policy events_admin on public.calendar_events for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Simulados
create policy simulados_select on public.simulados for select to authenticated
  using ((is_published and (select public.is_active_student())) or (select public.is_admin()));
create policy simulados_admin on public.simulados for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy keys_admin on public.simulado_keys for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy keys_released on public.simulado_keys for select to authenticated
  using (exists (select 1 from public.simulados s where s.id = simulado_id and s.results_released and s.is_published)
         and (select public.is_active_student()));

create policy subs_select on public.simulado_submissions for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy subs_insert on public.simulado_submissions for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'in_progress' and (select public.is_active_student())
              and exists (select 1 from public.simulados s where s.id = simulado_id and s.is_published and not s.results_released));
create policy subs_update on public.simulado_submissions for update to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()))
  with check (user_id = (select auth.uid()) or (select public.is_admin()));
create policy subs_admin_delete on public.simulado_submissions for delete to authenticated
  using ((select public.is_admin()));

create policy results_select on public.simulado_results for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy results_admin on public.simulado_results for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Dúvidas: alunos liberados
create policy doubts_select on public.doubts for select to authenticated
  using ((select public.is_active_student()));
create policy doubts_insert on public.doubts for insert to authenticated
  with check (author_id = (select auth.uid()) and (select public.is_active_student()));
create policy doubts_update on public.doubts for update to authenticated
  using (author_id = (select auth.uid()) or (select public.is_admin()))
  with check (author_id = (select auth.uid()) or (select public.is_admin()));
create policy doubts_delete on public.doubts for delete to authenticated
  using (author_id = (select auth.uid()) or (select public.is_admin()));

create policy replies_select on public.doubt_replies for select to authenticated
  using ((select public.is_active_student()));
create policy replies_insert on public.doubt_replies for insert to authenticated
  with check (author_id = (select auth.uid()) and (select public.is_active_student()));
create policy replies_delete on public.doubt_replies for delete to authenticated
  using (author_id = (select auth.uid()) or (select public.is_admin()));

create policy likes_select on public.doubt_likes for select to authenticated
  using (user_id = (select auth.uid()));
create policy likes_own on public.doubt_likes for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.is_active_student()));
create policy likes_delete on public.doubt_likes for delete to authenticated
  using (user_id = (select auth.uid()));

-- Mentoria
create policy mentorias_select on public.mentorias for select to authenticated
  using (lower(student_email) = (select public.my_email()) or (select public.is_admin()));
create policy mentorias_admin on public.mentorias for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy tasks_select on public.mentoria_tasks for select to authenticated
  using (mentoria_id = (select public.my_mentoria_id()) or (select public.is_admin()));
create policy tasks_student_update on public.mentoria_tasks for update to authenticated
  using (mentoria_id = (select public.my_mentoria_id())) with check (mentoria_id = (select public.my_mentoria_id()));
create policy tasks_admin on public.mentoria_tasks for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy checkins_select on public.mentoria_checkins for select to authenticated
  using (mentoria_id = (select public.my_mentoria_id()) or (select public.is_admin()));
create policy checkins_student_insert on public.mentoria_checkins for insert to authenticated
  with check (mentoria_id = (select public.my_mentoria_id()) and mentor_feedback = '');
create policy checkins_student_update on public.mentoria_checkins for update to authenticated
  using (mentoria_id = (select public.my_mentoria_id())) with check (mentoria_id = (select public.my_mentoria_id()));
create policy checkins_admin on public.mentoria_checkins for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy meetings_select on public.mentoria_meetings for select to authenticated
  using ((mentoria_id is null and (select public.my_mentoria_id()) is not null)
         or mentoria_id = (select public.my_mentoria_id()) or (select public.is_admin()));
create policy meetings_admin on public.mentoria_meetings for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Aluno não pode mexer em tarefa além de marcar feita; nem no feedback do mentor
create or replace function public.guard_mentoria_student_edits()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() then return new; end if;
  if tg_table_name = 'mentoria_tasks' then
    new.title := old.title; new.description := old.description; new.kind := old.kind;
    new.week_start := old.week_start; new.due_date := old.due_date; new.mentoria_id := old.mentoria_id;
    new.done_at := case when new.done then coalesce(old.done_at, now()) else null end;
  elsif tg_table_name = 'mentoria_checkins' then
    new.mentor_feedback := old.mentor_feedback; new.feedback_at := old.feedback_at;
    new.mentoria_id := old.mentoria_id; new.week_start := old.week_start;
    new.updated_at := now();
  end if;
  return new;
end;
$$;
drop trigger if exists mentoria_tasks_guard on public.mentoria_tasks;
create trigger mentoria_tasks_guard before update on public.mentoria_tasks
  for each row execute function public.guard_mentoria_student_edits();
drop trigger if exists mentoria_checkins_guard on public.mentoria_checkins;
create trigger mentoria_checkins_guard before update on public.mentoria_checkins
  for each row execute function public.guard_mentoria_student_edits();

-- Cartão público (só nome, foto e papel) para mostrar autores no fórum sem expor e-mail/telefone
create or replace view public.profile_cards as
  select id, full_name, avatar_url, role from public.profiles;
grant select on public.profile_cards to authenticated;

-- =====================================================================
-- Storage
--   media     (público): capas, banners, fotos de dúvidas
--   materials (privado): PDFs das aulas e dos simulados (URL assinada)
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit)
values ('media', 'media', true, 10485760)
on conflict (id) do update set public = true;
insert into storage.buckets (id, name, public, file_size_limit)
values ('materials', 'materials', false, 52428800)
on conflict (id) do update set public = false;

drop policy if exists media_read on storage.objects;
drop policy if exists media_admin_write on storage.objects;
drop policy if exists media_user_doubts on storage.objects;
drop policy if exists materials_admin on storage.objects;
drop policy if exists materials_read on storage.objects;

create policy media_read on storage.objects for select
  using (bucket_id = 'media');
create policy media_admin_write on storage.objects for all to authenticated
  using (bucket_id = 'media' and (select public.is_admin()))
  with check (bucket_id = 'media' and (select public.is_admin()));
-- alunos enviam fotos de dúvidas só dentro de doubts/<seu uid>/
create policy media_user_doubts on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = 'doubts'
              and (storage.foldername(name))[2] = (select auth.uid())::text);

create policy materials_admin on storage.objects for all to authenticated
  using (bucket_id = 'materials' and (select public.is_admin()))
  with check (bucket_id = 'materials' and (select public.is_admin()));
create policy materials_read on storage.objects for select to authenticated
  using (
    bucket_id = 'materials' and (
      exists (select 1 from public.lesson_materials m where m.file_path = name)  -- RLS de lesson_materials filtra o acesso
      or exists (select 1 from public.simulados s where s.pdf_path = name)       -- RLS de simulados filtra o acesso
    )
  );
