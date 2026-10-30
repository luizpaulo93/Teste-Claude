import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { unstable_cache } from 'next/cache';
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
  /** Participa da mentoria (individual, em grupo ou pela turma). */
  hasMentoria: boolean;
  /** Grupos de mentoria de que participa */
  mentoriaGroups: string[];
}

type UserRow = { profile: Partial<Profile> | null; student: Student | null; mentoria: boolean; groups: string[] } | null;

/**
 * Dados do usuário guardados por 5 min. São renovados na hora quando o admin muda alunos,
 * turmas, mentorias ou administradores (tag "viewers") ou quando o próprio usuário edita o perfil.
 */
function userRow(uid: string, key: string): Promise<UserRow> {
  return unstable_cache(
    () =>
      sql.one<NonNullable<UserRow>>(
        `select (select to_jsonb(u) from users u where u.id = $1) as profile,
                (select to_jsonb(s) from students s where s.id = $2) as student,
                exists(select 1 from mentorias m where m.id = $2 and m.status = 'active') as mentoria,
                coalesce((select array_agg(g.id) from mentoria_groups g
                           where $2 = any(g.student_emails)
                              or (select s.class_id from students s where s.id = $2 and s.status = 'active') = any(g.class_ids)), '{}') as groups`,
        [uid, key],
      ),
    ['viewer-v2', uid, key],
    { tags: ['viewers', `viewer-${uid}`], revalidate: 300 },
  )();
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

  // Perfil, cadastro de aluno e mentoria: em cache (trocar de página não vai ao banco)
  const [row, settings, catalog] = await Promise.all([userRow(uid, emailKey(email || '-')), getSettings(), getCatalogData()]);

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
    hasMentoria: isAdmin || Boolean(row?.mentoria) || Boolean(row?.groups?.length),
    mentoriaGroups: row?.groups ?? [],
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
