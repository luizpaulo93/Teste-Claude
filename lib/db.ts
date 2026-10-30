import 'server-only';
import { randomBytes } from 'node:crypto';
import { unstable_cache } from 'next/cache';
import { Pool, types, type PoolClient } from 'pg';
import { databaseConfigProblem, databaseUrl } from './db-config';
import { SCHEMA_SQL, SCHEMA_VERSION } from './schema-sql';
import type { ClassGroup, Course, CourseTag, Lesson, Module, PlatformSettings } from './types';

// Datas sempre como texto ISO (igual ao que as telas esperam)
const toIso = (v: string) => new Date(v.replace(' ', 'T').replace(/([+-]\d\d)$/, '$1:00')).toISOString();
types.setTypeParser(1184, toIso); // timestamptz
types.setTypeParser(1114, (v) => toIso(`${v}+00`)); // timestamp
types.setTypeParser(1082, (v) => v); // date → "AAAA-MM-DD"
types.setTypeParser(20, (v) => Number(v)); // count(*)
types.setTypeParser(1700, (v) => Number(v)); // numeric

const g = globalThis as unknown as { __pgPool?: Pool; __pgReady?: Promise<void> | null };

function cleanUrl(url: string) {
  // O driver "pg" não usa o channel_binding que o Neon coloca no link; "require" vira a verificação completa do certificado
  return url
    .replace(/([?&])channel_binding=[^&]*&?/, '$1')
    .replace(/[?&]$/, '')
    .replace(/sslmode=require\b/, 'sslmode=verify-full');
}

function pool() {
  if (g.__pgPool) return g.__pgPool;
  const problem = databaseConfigProblem();
  if (problem) throw new Error(problem);
  const p = new Pool({
    connectionString: cleanUrl(databaseUrl()),
    max: Number(process.env.DATABASE_POOL_MAX) || 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 15_000,
  });
  p.on('error', (e) => console.error('[db]', e.message));
  // Na Vercel (Fluid compute) fecha conexões ociosas antes da função ser suspensa
  if (process.env.VERCEL) {
    import('@vercel/functions')
      .then(({ attachDatabasePool }) => attachDatabasePool(p))
      .catch(() => null);
  }
  g.__pgPool = p;
  return p;
}

/** Cria/atualiza as tabelas uma única vez por servidor (rápido quando já está tudo pronto). */
function ensureSchema() {
  if (g.__pgReady) return g.__pgReady;
  g.__pgReady = (async () => {
    const p = pool();
    try {
      const r = await p.query<{ value: string }>(`select value from _meta where key = 'schema'`);
      if (Number(r.rows[0]?.value) >= SCHEMA_VERSION) return;
    } catch {
      /* tabela ainda não existe */
    }
    const c = await p.connect();
    try {
      await c.query('begin');
      await c.query('select pg_advisory_xact_lock(727274)');
      await c.query(`create table if not exists _meta (key text primary key, value text not null)`);
      await c.query(SCHEMA_SQL);
      await c.query(
        `insert into _meta (key, value) values ('schema', $1) on conflict (key) do update set value = excluded.value`,
        [String(SCHEMA_VERSION)],
      );
      await c.query('commit');
    } catch (e) {
      await c.query('rollback').catch(() => null);
      throw e;
    } finally {
      c.release();
    }
  })().catch((e) => {
    g.__pgReady = null;
    throw e;
  });
  return g.__pgReady;
}

export interface Queryable {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
  one<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T | null>;
  exec(text: string, params?: unknown[]): Promise<number>;
}

function wrap(run: (text: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number | null }>): Queryable {
  return {
    query: async <T,>(text: string, params?: unknown[]) => (await run(text, params)).rows as T[],
    one: async <T,>(text: string, params?: unknown[]) => ((await run(text, params)).rows[0] as T | undefined) ?? null,
    exec: async (text: string, params?: unknown[]) => (await run(text, params)).rowCount ?? 0,
  };
}

/** Consultas simples (cada uma pega uma conexão do pool e devolve na hora). */
export const sql: Queryable = wrap(async (text, params) => {
  await ensureSchema();
  return pool().query(text, params as unknown[]);
});

/** Transação: tudo ou nada. */
export async function tx<R>(fn: (t: Queryable) => Promise<R>): Promise<R> {
  await ensureSchema();
  const c: PoolClient = await pool().connect();
  try {
    await c.query('begin');
    const result = await fn(wrap((text, params) => c.query(text, params as unknown[])));
    await c.query('commit');
    return result;
  } catch (e) {
    await c.query('rollback').catch(() => null);
    throw e;
  } finally {
    c.release();
  }
}

export const nowIso = () => new Date().toISOString();

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
/** ID curto e aleatório (20 caracteres, só letras e números). */
export function newId() {
  const bytes = randomBytes(20);
  let id = '';
  for (const b of bytes) id += ALPHABET[b % 62];
  return id;
}

/** ID do aluno/mentoria a partir do e-mail (minúsculo, sem "/"). */
export function emailKey(email: string) {
  return email.trim().toLowerCase().replace(/\//g, '_');
}

export const byPosition = <T extends { position?: number; created_at?: string }>(a: T, b: T) =>
  (a.position ?? 0) - (b.position ?? 0) || String(a.created_at ?? '').localeCompare(String(b.created_at ?? ''));

export const DEFAULT_SETTINGS: PlatformSettings = {
  brand_name: 'CURSO VÉRTICE',
  hero_title: 'Sua plataforma para Enem e vestibulares',
  hero_subtitle: 'Especialista em física, química e matemática',
  hero_cta: 'Começar agora',
  hero_bg_url: '',
  restrict_to_student_list: true,
};

export type LessonSummary = Pick<
  Lesson,
  'id' | 'module_id' | 'course_id' | 'title' | 'duration' | 'thumbnail_url' | 'youtube_id' | 'position' | 'is_free' | 'is_published' | 'created_at'
>;

/** Aula + onde ela está (módulo, curso e posição no módulo). Uma aula em 2 módulos vira 2 linhas. */
export const LESSON_PLACEMENT_SQL = `
  select l.id, ml.module_id, m.course_id, l.title, l.duration, l.thumbnail_url, l.youtube_id, ml.position,
         l.is_free, l.is_published, l.created_at
    from module_lessons ml
    join lessons l on l.id = ml.lesson_id
    join modules m on m.id = ml.module_id`;

/**
 * Configurações e catálogo ficam em cache no servidor: mil alunos abrindo a página inicial não
 * viram mil consultas. O cache é renovado sempre que o admin altera algo (tags "settings" e "catalog").
 */
const cachedSettings = unstable_cache(
  async (): Promise<PlatformSettings> => {
    const row = await sql.one<{ data: Partial<PlatformSettings> }>(`select data from settings where id = 'platform'`);
    return { ...DEFAULT_SETTINGS, ...(row?.data ?? {}) };
  },
  ['settings-pg-v1'],
  { tags: ['settings'], revalidate: 3600 },
);

/** Se o banco falhar, usa o padrão naquele acesso (sem guardar a falha no cache). */
export async function getSettings(): Promise<PlatformSettings> {
  try {
    return await cachedSettings();
  } catch (e) {
    console.error('[settings]', e instanceof Error ? e.message : e);
    return DEFAULT_SETTINGS;
  }
}

export const getCatalogData = unstable_cache(
  async () => {
    const [courses, modules, lessons, classes, tags] = await Promise.all([
      sql.query<Course>(`select * from courses order by position, created_at`),
      sql.query<Module>(`select * from modules order by position, created_at`),
      sql.query<LessonSummary>(`${LESSON_PLACEMENT_SQL} order by ml.position, l.created_at`),
      sql.query<ClassGroup>(`select id, name, description, access_all, course_ids from classes order by name`),
      sql.query<CourseTag>(`select id, name, position from course_tags order by position, lower(name)`),
    ]);
    return { courses, modules, lessons, classes, tags };
  },
  ['catalog-pg-v3'],
  { tags: ['catalog'], revalidate: 3600 },
);
