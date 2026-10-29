-- Banco de dados da plataforma (Neon / PostgreSQL).
-- Não precisa rodar à mão: a plataforma cria as tabelas sozinha no primeiro acesso.
-- Todos os comandos são "if not exists", então rodar de novo não apaga nada.

create table if not exists users (
  id text primary key,                -- uid do login do Firebase
  email text not null,
  full_name text not null default '',
  avatar_url text not null default '',
  phone text not null default '',
  birth_date date,
  role text not null default 'student',
  created_at timestamptz not null default now()
);
create index if not exists users_email_idx on users (email);
create index if not exists users_created_idx on users (created_at desc);

create table if not exists admins (
  email text primary key,
  created_at timestamptz not null default now()
);

create table if not exists settings (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists courses (
  id text primary key,
  title text not null,
  subtitle text not null default '',
  description text not null default '',
  category text not null default '',
  cover_url text not null default '',
  banner_url text not null default '',
  position int not null default 0,
  featured boolean not null default false,
  is_free boolean not null default false,
  is_published boolean not null default false,
  demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists modules (
  id text primary key,
  course_id text not null references courses (id) on delete cascade,
  title text not null,
  description text not null default '',
  cover_url text not null default '',
  position int not null default 0,
  is_published boolean not null default true,
  demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists modules_course_idx on modules (course_id);

create table if not exists lessons (
  id text primary key,
  module_id text not null references modules (id) on delete cascade,
  course_id text not null references courses (id) on delete cascade,
  title text not null,
  description text not null default '',
  youtube_id text not null default '',
  duration text not null default '',
  thumbnail_url text not null default '',
  position int not null default 0,
  is_free boolean not null default false,
  is_published boolean not null default true,
  materials jsonb not null default '[]'::jsonb,
  material_paths text[] not null default '{}',
  demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists lessons_module_idx on lessons (module_id);
create index if not exists lessons_course_idx on lessons (course_id);
create index if not exists lessons_paths_idx on lessons using gin (material_paths);

create table if not exists lesson_comments (
  id text primary key,
  lesson_id text not null references lessons (id) on delete cascade,
  author_id text not null,
  author_name text not null default '',
  author_avatar text not null default '',
  author_role text not null default 'student',
  text text not null,
  created_at timestamptz not null default now()
);
create index if not exists lesson_comments_idx on lesson_comments (lesson_id, created_at desc);

create table if not exists classes (
  id text primary key,
  name text not null,
  description text not null default '',
  access_all boolean not null default false,
  course_ids text[] not null default '{}',
  demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists students (
  id text primary key,                -- e-mail em minúsculas
  email text not null unique,
  name text not null default '',
  phone text not null default '',
  cpf text not null default '',
  birth_date date,
  class_id text references classes (id) on delete set null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists students_class_idx on students (class_id);
create index if not exists students_created_idx on students (created_at desc);

create table if not exists lesson_progress (
  user_id text not null,
  lesson_id text not null,
  course_id text not null default '',
  completed boolean not null default false,
  position_sec int not null default 0,
  duration_sec int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

create table if not exists favorites (
  user_id text not null,
  lesson_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

create table if not exists calendar_events (
  id text primary key,
  title text not null,
  description text not null default '',
  category text not null default 'evento_curso',
  start_date date not null,
  end_date date not null,
  color text not null default 'blue',
  is_published boolean not null default true,
  demo boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists calendar_end_idx on calendar_events (end_date);

create table if not exists simulados (
  id text primary key,
  title text not null,
  area text not null,
  question_count int not null,
  time_limit_minutes int not null default 0,
  pdf_path text not null default '',
  is_published boolean not null default false,
  results_released boolean not null default false,
  stats jsonb not null default '{}'::jsonb,
  demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists simulados_pdf_idx on simulados (pdf_path);

-- Gabarito separado: nunca vai para a tela do aluno
create table if not exists simulado_keys (
  simulado_id text primary key references simulados (id) on delete cascade,
  answer_key text not null default ''
);

create table if not exists simulado_submissions (
  id text primary key,                -- {simulado}_{usuário}
  simulado_id text not null references simulados (id) on delete cascade,
  user_id text not null,
  answers text not null default '',
  status text not null default 'in_progress',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  duration_seconds int not null default 0,
  updated_at timestamptz not null default now(),
  unique (simulado_id, user_id)
);
create index if not exists submissions_user_idx on simulado_submissions (user_id);

create table if not exists simulado_results (
  simulado_id text not null references simulados (id) on delete cascade,
  user_id text not null,
  correct int not null default 0,
  wrong int not null default 0,
  blank int not null default 0,
  accuracy double precision not null default 0,
  coherence double precision not null default 0,
  tri_score double precision not null default 0,
  tri_min double precision not null default 0,
  tri_mean double precision not null default 0,
  tri_max double precision not null default 0,
  tiers jsonb not null default '{}'::jsonb,
  breakdown jsonb not null default '[]'::jsonb,
  computed_at timestamptz not null default now(),
  primary key (simulado_id, user_id)
);
create index if not exists results_user_idx on simulado_results (user_id);

create table if not exists doubts (
  id text primary key,
  author_id text not null,
  author_name text not null default '',
  author_avatar text not null default '',
  author_role text not null default 'student',
  text text not null,
  image_url text not null default '',
  is_resolved boolean not null default false,
  likes_count int not null default 0,
  replies_count int not null default 0,
  demo boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists doubts_created_idx on doubts (created_at desc);
create index if not exists doubts_author_idx on doubts (author_id, created_at desc);

create table if not exists doubt_replies (
  id text primary key,
  doubt_id text not null references doubts (id) on delete cascade,
  author_id text not null,
  author_name text not null default '',
  author_avatar text not null default '',
  author_role text not null default 'student',
  text text not null,
  image_url text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists doubt_replies_idx on doubt_replies (doubt_id, created_at);

create table if not exists doubt_likes (
  doubt_id text not null references doubts (id) on delete cascade,
  user_id text not null,
  created_at timestamptz not null default now(),
  primary key (doubt_id, user_id)
);

create table if not exists mentorias (
  id text primary key,                -- e-mail do aluno
  student_email text not null,
  student_name text not null default '',
  status text not null default 'active',
  goal text not null default '',
  exam_target text not null default '',
  weekly_hours_target int not null default 20,
  start_date date not null default current_date,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists mentoria_tasks (
  id text primary key,
  mentoria_id text not null references mentorias (id) on delete cascade,
  week_start date not null,
  title text not null,
  description text not null default '',
  kind text not null default 'outro',
  due_date date,
  done boolean not null default false,
  done_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists tasks_week_idx on mentoria_tasks (mentoria_id, week_start);

create table if not exists mentoria_checkins (
  id text primary key,                -- {mentoria}_{semana}
  mentoria_id text not null references mentorias (id) on delete cascade,
  week_start date not null,
  hours_studied double precision not null default 0,
  questions_done int not null default 0,
  focus_rating int not null default 3,
  wins text not null default '',
  difficulties text not null default '',
  mentor_feedback text not null default '',
  feedback_at timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists checkins_idx on mentoria_checkins (mentoria_id, week_start desc);
create index if not exists checkins_week_idx on mentoria_checkins (week_start);

create table if not exists mentoria_meetings (
  id text primary key,
  mentoria_id text references mentorias (id) on delete cascade,  -- vazio = encontro em grupo
  title text not null,
  description text not null default '',
  starts_at timestamptz not null,
  duration_min int not null default 60,
  link text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists meetings_idx on mentoria_meetings (mentoria_id, starts_at desc);

create table if not exists live_sessions (
  id text primary key,
  title text not null,
  description text not null default '',
  youtube_id text not null default '',
  cover_url text not null default '',
  course_id text,
  starts_at timestamptz not null,
  status text not null default 'scheduled',
  show_replay boolean not null default true,
  chat_enabled boolean not null default true,
  is_published boolean not null default true,
  demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists lives_status_idx on live_sessions (status, starts_at desc);

create table if not exists live_messages (
  id text primary key,
  live_id text not null references live_sessions (id) on delete cascade,
  author_id text not null,
  author_name text not null default '',
  author_avatar text not null default '',
  author_role text not null default 'student',
  text text not null,
  created_at timestamptz not null default now()
);
create index if not exists live_messages_idx on live_messages (live_id, created_at desc);

-- ============================================================================
-- Versão 2: banco de aulas com pastas (como no MemberClass).
-- A aula é criada uma vez (com pasta) e pode entrar em vários módulos/cursos.
-- ============================================================================
create table if not exists lesson_folders (
  id text primary key,
  name text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);

alter table lessons add column if not exists folder_id text references lesson_folders (id) on delete set null;
create index if not exists lessons_folder_idx on lessons (folder_id, position);

-- Em que módulos (e em que ordem) cada aula aparece
create table if not exists module_lessons (
  module_id text not null references modules (id) on delete cascade,
  lesson_id text not null references lessons (id) on delete cascade,
  position int not null default 0,
  primary key (module_id, lesson_id)
);
create index if not exists module_lessons_lesson_idx on module_lessons (lesson_id);

-- Aulas antigas: continuam nos mesmos módulos, na mesma ordem
insert into module_lessons (module_id, lesson_id, position)
  select l.module_id, l.id, l.position from lessons l join modules m on m.id = l.module_id
  on conflict do nothing;

-- Apagar um curso ou módulo não apaga mais as aulas (elas ficam no banco de aulas)
alter table lessons drop constraint if exists lessons_module_id_fkey;
alter table lessons drop constraint if exists lessons_course_id_fkey;
alter table lessons alter column module_id drop not null;
alter table lessons alter column course_id drop not null;
update lessons set module_id = null, course_id = null where module_id is not null or course_id is not null;

-- ============================================================================
-- Versão 3: simulado com ou sem TRI (sem TRI: só acertos e dados por questão)
-- ============================================================================
alter table simulados add column if not exists use_tri boolean not null default true;

-- ============================================================================
-- Versão 4: transmissão direto para o YouTube (conta conectada e chaves).
-- Só o servidor lê esta tabela: nunca vai para a tela de ninguém.
-- ============================================================================
create table if not exists integrations (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
