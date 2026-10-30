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

-- ============================================================================
-- Versão 5: mentoria completa (diagnóstico, cronograma automático, cronômetro,
-- registro de questões, caderno de erros com revisão espaçada e mensagens).
-- ============================================================================
alter table mentorias add column if not exists target_course text not null default '';
alter table mentorias add column if not exists target_score int not null default 0;
alter table mentorias add column if not exists exam_date date;
-- minutos disponíveis por dia (seg..dom)
alter table mentorias add column if not exists availability jsonb not null default '[120,120,120,120,120,60,0]'::jsonb;
-- nível 1 (fraco) a 5 (forte) por matéria
alter table mentorias add column if not exists subject_levels jsonb not null default '{}'::jsonb;
alter table mentorias add column if not exists diagnosed_at timestamptz;

alter table mentoria_tasks add column if not exists subject text not null default '';
alter table mentoria_tasks add column if not exists minutes int not null default 0;
alter table mentoria_tasks add column if not exists auto boolean not null default false;

-- Sessões de estudo (cronômetro ou registro manual) e questões feitas
create table if not exists mentoria_sessions (
  id text primary key,
  mentoria_id text not null references mentorias (id) on delete cascade,
  subject text not null default '',
  minutes int not null default 0,
  questions int not null default 0,
  correct int not null default 0,
  studied_on date not null default current_date,
  created_at timestamptz not null default now()
);
create index if not exists msessions_idx on mentoria_sessions (mentoria_id, studied_on desc);

-- Caderno de erros com revisão espaçada (1, 7, 15 e 30 dias)
create table if not exists mentoria_errors (
  id text primary key,
  mentoria_id text not null references mentorias (id) on delete cascade,
  subject text not null default '',
  topic text not null default '',
  question text not null default '',
  reason text not null default 'conteudo',
  answer text not null default '',
  image_url text not null default '',
  stage int not null default 0,
  next_review date not null default current_date,
  mastered boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists merrors_idx on mentoria_errors (mentoria_id, mastered, next_review);

-- Conversa aluno ↔ mentor
create table if not exists mentoria_messages (
  id text primary key,
  mentoria_id text not null references mentorias (id) on delete cascade,
  from_mentor boolean not null default false,
  author_name text not null default '',
  text text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists mmessages_idx on mentoria_messages (mentoria_id, created_at desc);

-- ============================================================================
-- Versão 6: conteúdos da Matriz de Referência do ENEM marcados pelo aluno
-- status: 1 = estudado, 2 = dominado (sem linha = ainda não estudado)
-- ============================================================================
create table if not exists mentoria_topics (
  mentoria_id text not null references mentorias (id) on delete cascade,
  item_key text not null,
  status smallint not null default 1,
  updated_at timestamptz not null default now(),
  primary key (mentoria_id, item_key)
);

-- ============================================================================
-- Versão 7: cronograma por assuntos (quadro estilo Trello).
-- Cada assunto da matriz vira um card: estudar → resolver questões → marcar desempenho;
-- depois revisões 1, 2 e 3. Acerto baixo faz o assunto voltar até melhorar.
-- level: 0 não estudado, 1 estudado, 2 revisão 01, 3 revisão 02, 4 revisão 03 (concluído)
-- ============================================================================
create table if not exists mentoria_cards (
  id text primary key,
  mentoria_id text not null references mentorias (id) on delete cascade,
  item_key text not null,
  discipline text not null,
  title text not null,
  priority int not null default 1,
  ord int not null default 0,
  level int not null default 0,
  step text not null default 'study',
  due_on date,
  scheduled_on date,
  last_acc int,
  attempts int not null default 0,
  history jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  unique (mentoria_id, item_key)
);
create index if not exists mcards_idx on mentoria_cards (mentoria_id, scheduled_on);

alter table mentorias add column if not exists plan_disciplines text[] not null default '{}';
alter table mentorias add column if not exists plan_order text not null default 'prioridade';

-- ============================================================================
-- Versão 8: mentoria em grupo, dúvidas da mentoria e lives só para a mentoria.
-- "space" separa onde a dúvida/live aparece: vazio = plataforma; m:<mentoria>; g:<grupo>.
-- ============================================================================
create table if not exists mentoria_groups (
  id text primary key,
  name text not null,
  description text not null default '',
  student_emails text[] not null default '{}',
  class_ids text[] not null default '{}',
  exam_target text not null default '',
  exam_date date,
  start_date date not null default current_date,
  end_date date,
  plan_disciplines text[] not null default '{}',
  plan_order text not null default 'prioridade',
  plan_keys text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table mentorias add column if not exists group_id text references mentoria_groups (id) on delete set null;
alter table doubts add column if not exists space text;
create index if not exists doubts_space_idx on doubts (space, created_at desc);
alter table live_sessions add column if not exists space text;
