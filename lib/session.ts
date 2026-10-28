import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { emailKey, getCatalogData, getSettings, sql } from './db';
import { adminAuth } from './firebase/admin';
import type { ClassGroup, Course, Lesson, Profile, Student } from './types';

export { getSettings } from './db';

export const SESSION_COOKIE = '__session';
export const BOOTSTRAP_ADMIN = 'luizpaulofisica@gmail.com';

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

/** Usuário logado (cookie de sessão do Firebase) — carregado 1x por requisição. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const cookie = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!cookie) return null;
  let uid: string;
  let email: string;
  let tokenName = '';
  let tokenPicture = '';
  try {
    const decoded = await adminAuth().verifySessionCookie(cookie);
    uid = decoded.uid;
    email = String(decoded.email ?? '').toLowerCase();
    tokenName = String(decoded.name ?? '');
    tokenPicture = String(decoded.picture ?? '');
  } catch {
    return null;
  }

  // Perfil e cadastro de aluno numa consulta só
  const [row, settings, catalog] = await Promise.all([
    sql.one<{ profile: Partial<Profile> | null; student: Student | null }>(
      `select (select to_jsonb(u) from users u where u.id = $1) as profile,
              (select to_jsonb(s) from students s where s.id = $2) as student`,
      [uid, emailKey(email || '-')],
    ),
    getSettings(),
    getCatalogData(),
  ]);

  const profile: Profile = {
    id: uid,
    email,
    full_name: tokenName || email.split('@')[0],
    avatar_url: tokenPicture,
    phone: '',
    birth_date: null,
    role: email === BOOTSTRAP_ADMIN ? 'admin' : 'student',
    ...(row?.profile ?? {}),
  };
  const student = email ? (row?.student ?? null) : null;
  const classGroup = student?.class_id ? (catalog.classes.find((c) => c.id === student.class_id) ?? null) : null;
  const isAdmin = profile.role === 'admin';
  const isMember =
    isAdmin || !settings.restrict_to_student_list || Boolean(student && student.status === 'active' && classGroup);

  return {
    userId: uid,
    email,
    profile,
    isAdmin,
    student,
    classGroup,
    classCourseIds: classGroup?.course_ids ?? [],
    isMember,
  };
});

export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect('/auth/expirado');
  return viewer;
}

export async function requireAdmin(): Promise<Viewer> {
  const viewer = await requireViewer();
  if (!viewer.isAdmin) redirect('/');
  return viewer;
}

export function canAccessCourse(viewer: Viewer, course: Pick<Course, 'id' | 'is_free'>, restrict: boolean) {
  if (viewer.isAdmin || course.is_free || !restrict) return true;
  if (!viewer.student || viewer.student.status !== 'active' || !viewer.classGroup) return false;
  return viewer.classGroup.access_all || viewer.classCourseIds.includes(course.id);
}

/** Mesmo critério que a regra do banco tinha: admin, ou aula publicada de curso publicado e (grátis ou curso liberado). */
export function canSeeLesson(
  viewer: Viewer,
  lesson: Pick<Lesson, 'is_published' | 'is_free' | 'course_id'>,
  course: Pick<Course, 'id' | 'is_free' | 'is_published'> | undefined,
  restrict: boolean,
) {
  if (viewer.isAdmin) return true;
  if (!course || !course.is_published || !lesson.is_published) return false;
  return lesson.is_free || canAccessCourse(viewer, course, restrict);
}
