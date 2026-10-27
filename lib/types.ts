export type Role = 'admin' | 'student';
export type EnemArea = 'MT' | 'CN' | 'CH' | 'LC';

export const ENEM_AREAS: Record<EnemArea, string> = {
  MT: 'Matemática',
  CN: 'Ciências da Natureza',
  CH: 'Ciências Humanas',
  LC: 'Linguagens',
};

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string;
  phone: string;
  birth_date: string | null;
  role: Role;
}

export interface PlatformSettings {
  brand_name: string;
  hero_title: string;
  hero_subtitle: string;
  hero_cta: string;
  hero_bg_url: string;
  restrict_to_student_list: boolean;
}

export interface Course {
  id: string;
  created_at?: string;
  title: string;
  subtitle: string;
  description: string;
  category: string;
  cover_url: string;
  banner_url: string;
  position: number;
  featured: boolean;
  is_free: boolean;
  is_published: boolean;
}

export interface Module {
  id: string;
  created_at?: string;
  course_id: string;
  title: string;
  description: string;
  cover_url: string;
  position: number;
  is_published: boolean;
}

export interface Lesson {
  id: string;
  materials?: LessonMaterial[];
  material_paths?: string[];
  created_at?: string;
  module_id: string;
  course_id: string;
  title: string;
  description: string;
  youtube_id: string;
  duration: string;
  thumbnail_url: string;
  position: number;
  is_free: boolean;
  is_published: boolean;
}

export interface LessonMaterial {
  id: string;
  title: string;
  file_path: string;
  size_label: string;
}

export interface ClassGroup {
  id: string;
  name: string;
  description: string;
  access_all: boolean;
  course_ids: string[];
}

export interface Student {
  id: string;
  email: string;
  name: string;
  phone: string;
  cpf: string;
  birth_date: string | null;
  class_id: string | null;
  status: 'active' | 'blocked';
  created_at: string;
}

export interface LessonProgress {
  lesson_id: string;
  course_id: string;
  completed: boolean;
  position_sec: number;
  duration_sec: number;
  updated_at: string;
}

export type EventCategory = 'assunto_semana' | 'evento_curso' | 'simulado' | 'revisao' | 'feriado' | 'aviso';

export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  category: EventCategory;
  start_date: string;
  end_date: string;
  color: string;
  is_published: boolean;
}

export interface Simulado {
  id: string;
  title: string;
  area: EnemArea;
  question_count: number;
  time_limit_minutes: number;
  pdf_path: string;
  is_published: boolean;
  results_released: boolean;
  stats: SimuladoStats | Record<string, never>;
  created_at: string;
}

export interface SimuladoStats {
  completed: number;
  meanTri: number;
  meanAccuracy: number;
  meanCorrect: number;
  meanCoherence: number;
  items: { q: number; hitPct: number; tier: Tier }[];
}

export type Tier = 'easy' | 'medium' | 'hard';

export interface SimuladoSubmission {
  id: string;
  simulado_id: string;
  user_id: string;
  answers: string;
  status: 'in_progress' | 'completed';
  started_at: string;
  finished_at: string | null;
  duration_seconds: number;
}

export interface SimuladoResult {
  simulado_id: string;
  user_id: string;
  correct: number;
  wrong: number;
  blank: number;
  accuracy: number;
  coherence: number;
  tri_score: number;
  tri_min: number;
  tri_mean: number;
  tri_max: number;
  tiers: Record<Tier, { correct: number; total: number }>;
  breakdown: { q: number; marked: string; official: string; ok: boolean; tier: Tier }[];
}

export interface AuthorInfo {
  author_name: string;
  author_avatar: string;
  author_role: Role;
}

export interface Doubt extends AuthorInfo {
  id: string;
  author_id: string;
  text: string;
  image_url: string;
  is_resolved: boolean;
  likes_count: number;
  replies_count: number;
  created_at: string;
}

export interface DoubtReply extends AuthorInfo {
  id: string;
  doubt_id: string;
  author_id: string;
  text: string;
  image_url: string;
  created_at: string;
}

export interface ProfileCard {
  id: string;
  full_name: string;
  avatar_url: string;
  role: Role;
}

export type MentoriaStatus = 'active' | 'paused' | 'ended';
export type TaskKind = 'aula' | 'questoes' | 'simulado' | 'revisao' | 'outro';

export interface Mentoria {
  id: string;
  student_email: string;
  student_name: string;
  status: MentoriaStatus;
  goal: string;
  exam_target: string;
  weekly_hours_target: number;
  start_date: string;
  end_date: string | null;
}

export interface MentoriaTask {
  id: string;
  mentoria_id: string;
  week_start: string;
  title: string;
  description: string;
  kind: TaskKind;
  due_date: string | null;
  done: boolean;
  done_at: string | null;
  created_at?: string;
}

export interface MentoriaCheckin {
  id: string;
  mentoria_id: string;
  week_start: string;
  hours_studied: number;
  questions_done: number;
  focus_rating: number;
  wins: string;
  difficulties: string;
  mentor_feedback: string;
  feedback_at: string | null;
}

export interface MentoriaMeeting {
  id: string;
  mentoria_id: string | null;
  title: string;
  description: string;
  starts_at: string;
  duration_min: number;
  link: string;
  notes: string;
}

export const TASK_KINDS: Record<TaskKind, string> = {
  aula: 'Aula',
  questoes: 'Questões',
  simulado: 'Simulado',
  revisao: 'Revisão',
  outro: 'Outro',
};

export interface LessonComment extends AuthorInfo {
  id: string;
  lesson_id: string;
  author_id: string;
  text: string;
  created_at: string;
}

export interface LiveSession {
  id: string;
  title: string;
  description: string;
  youtube_id: string;
  cover_url: string;
  course_id: string | null;
  starts_at: string;
  status: 'scheduled' | 'live' | 'ended';
  show_replay: boolean;
  chat_enabled: boolean;
  is_published: boolean;
}

export interface LiveMessage extends AuthorInfo {
  id: string;
  live_id: string;
  author_id: string;
  text: string;
  created_at: string;
}
