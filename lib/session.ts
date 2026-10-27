import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from './supabase/server';
import type { ClassGroup, PlatformSettings, Profile, Student } from './types';
import { likeExact } from './utils';

export const DEFAULT_SETTINGS: PlatformSettings = {
  brand_name: 'CURSO VÉRTICE',
  hero_title: 'Sua plataforma para Enem e vestibulares',
  hero_subtitle: 'Especialista em física, química e matemática',
  hero_cta: 'Começar agora',
  hero_bg_url: '',
  restrict_to_student_list: true,
};

export const getSettings = cache(async (): Promise<PlatformSettings> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from('platform_settings')
    .select('brand_name,hero_title,hero_subtitle,hero_cta,hero_bg_url,restrict_to_student_list')
    .eq('id', 1)
    .maybeSingle();
  return { ...DEFAULT_SETTINGS, ...(data ?? {}) };
});

export interface Viewer {
  userId: string;
  email: string;
  profile: Profile;
  isAdmin: boolean;
  student: Student | null;
  classGroup: ClassGroup | null;
  classCourseIds: string[];
  /** Aluno liberado (ativo e com turma) ou admin, ou plataforma aberta. */
  isMember: boolean;
}

/** Contexto do usuário logado — carregado 1x por requisição, em paralelo. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (!claims?.sub) return null;
  const userId = claims.sub as string;
  const email = String(claims.email ?? '').toLowerCase();

  const [{ data: profile }, { data: student }, settings] = await Promise.all([
    supabase.from('profiles').select('id,email,full_name,avatar_url,phone,birth_date,role').eq('id', userId).maybeSingle(),
    supabase.from('students').select('*').ilike('email', likeExact(email)).limit(1).maybeSingle(),
    getSettings(),
  ]);

  let classGroup: ClassGroup | null = null;
  let classCourseIds: string[] = [];
  if (student?.class_id) {
    const [{ data: cg }, { data: cc }] = await Promise.all([
      supabase.from('classes').select('id,name,description,access_all').eq('id', student.class_id).maybeSingle(),
      supabase.from('class_courses').select('course_id').eq('class_id', student.class_id),
    ]);
    classGroup = cg;
    classCourseIds = (cc ?? []).map((r: { course_id: string }) => r.course_id);
  }

  const safeProfile: Profile = profile ?? {
    id: userId,
    email,
    full_name: email.split('@')[0],
    avatar_url: '',
    phone: '',
    birth_date: null,
    role: 'student',
  };
  const isAdmin = safeProfile.role === 'admin';
  const isMember =
    isAdmin ||
    !settings.restrict_to_student_list ||
    Boolean(student && student.status === 'active' && student.class_id);

  return { userId, email, profile: safeProfile, isAdmin, student, classGroup, classCourseIds, isMember };
});

export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect('/login');
  return viewer;
}

export async function requireAdmin(): Promise<Viewer> {
  const viewer = await requireViewer();
  if (!viewer.isAdmin) redirect('/');
  return viewer;
}

export function canAccessCourse(viewer: Viewer, course: { id: string; is_free: boolean }, restrict: boolean) {
  if (viewer.isAdmin || course.is_free || !restrict) return true;
  if (!viewer.student || viewer.student.status !== 'active' || !viewer.classGroup) return false;
  return viewer.classGroup.access_all || viewer.classCourseIds.includes(course.id);
}
