import 'server-only';
import { unstable_cache } from 'next/cache';
import type { DocumentSnapshot, QuerySnapshot } from 'firebase-admin/firestore';
import { adminDb } from './firebase/admin';
import type { ClassGroup, Course, Lesson, Module, PlatformSettings } from './types';

export const db = () => adminDb();
export const nowIso = () => new Date().toISOString();
export const newId = () => adminDb().collection('_').doc().id;

/** ID de documento a partir do e-mail (minúsculo, sem "/"). */
export function emailKey(email: string) {
  return email.trim().toLowerCase().replace(/\//g, '_');
}

export function fromDoc<T>(snap: DocumentSnapshot): T | null {
  return snap.exists ? ({ id: snap.id, ...snap.data() } as T) : null;
}

export function fromQuery<T>(snap: QuerySnapshot): T[] {
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T);
}

export const byPosition = <T extends { position?: number; created_at?: string }>(a: T, b: T) =>
  (a.position ?? 0) - (b.position ?? 0) || String(a.created_at ?? '').localeCompare(String(b.created_at ?? ''));

/** Divide listas grandes para consultas "in" (o Firestore aceita até 30 valores). */
export async function getMany<T>(collection: string, ids: string[]): Promise<T[]> {
  const unique = [...new Set(ids)].filter(Boolean);
  if (!unique.length) return [];
  const refs = unique.map((id) => adminDb().collection(collection).doc(id));
  const snaps = await adminDb().getAll(...refs);
  return snaps.map((s) => fromDoc<T>(s)).filter(Boolean) as T[];
}

export const DEFAULT_SETTINGS: PlatformSettings = {
  brand_name: 'CURSO VÉRTICE',
  hero_title: 'Sua plataforma para Enem e vestibulares',
  hero_subtitle: 'Especialista em física, química e matemática',
  hero_cta: 'Começar agora',
  hero_bg_url: '',
  restrict_to_student_list: true,
};

export const LESSON_SUMMARY_FIELDS = [
  'module_id',
  'course_id',
  'title',
  'duration',
  'thumbnail_url',
  'youtube_id',
  'position',
  'is_free',
  'is_published',
  'created_at',
] as const;

export type LessonSummary = Pick<
  Lesson,
  'id' | 'module_id' | 'course_id' | 'title' | 'duration' | 'thumbnail_url' | 'youtube_id' | 'position' | 'is_free' | 'is_published' | 'created_at'
>;

/**
 * Configurações e catálogo ficam em cache no servidor (não custam leituras do Firestore a cada
 * acesso). O cache é renovado sempre que o admin altera algo (tags "settings" e "catalog").
 */
export const getSettings = unstable_cache(
  async (): Promise<PlatformSettings> => {
    try {
      const snap = await adminDb().doc('settings/platform').get();
      return { ...DEFAULT_SETTINGS, ...(snap.data() ?? {}) } as PlatformSettings;
    } catch {
      return DEFAULT_SETTINGS;
    }
  },
  ['settings-v1'],
  { tags: ['settings'], revalidate: 3600 },
);

export const getCatalogData = unstable_cache(
  async () => {
    const d = adminDb();
    const [c, m, l, cl] = await Promise.all([
      d.collection('courses').get(),
      d.collection('modules').get(),
      d.collection('lessons').select(...LESSON_SUMMARY_FIELDS).get(),
      d.collection('classes').get(),
    ]);
    return {
      courses: fromQuery<Course>(c).sort(byPosition),
      modules: fromQuery<Module>(m).sort(byPosition),
      lessons: fromQuery<LessonSummary>(l).sort(byPosition),
      classes: fromQuery<ClassGroup>(cl).map((x) => ({ ...x, course_ids: x.course_ids ?? [] })),
    };
  },
  ['catalog-v1'],
  { tags: ['catalog'], revalidate: 3600 },
);
