'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { fail, refreshCatalog, requireAdminAction, type ActionResult } from '@/lib/admin/guard';
import { authorOf } from '@/lib/author';
import { sql, tx, type Queryable } from '@/lib/db';

// Vídeos públicos da Khan Academy Brasil (liberados para incorporação), só para teste.
// Troque pelos links das suas aulas quando for usar de verdade.
const LIVE_VIDEO = 'TSn6RPZAMzw';

const DEMO_TABLES = ['lessons', 'modules', 'courses', 'classes', 'calendar_events', 'simulados', 'live_sessions', 'doubts'] as const;
const TABLES = new Set<string>(DEMO_TABLES);

function insert(t: Queryable, table: string, data: Record<string, unknown>) {
  if (!TABLES.has(table)) throw new Error('tabela inválida');
  const cols = Object.keys(data);
  const values = cols.map((c) => (data[c] !== null && typeof data[c] === 'object' && !Array.isArray(data[c]) ? JSON.stringify(data[c]) : data[c]));
  return t.exec(`insert into ${table} (${cols.join(', ')}) values (${cols.map((_, i) => `$${i + 1}`).join(', ')})`, values);
}

/** Cria um conjunto de conteúdo de exemplo (tudo marcado com demo: true) para testar a plataforma. */
export async function loadDemo(): Promise<ActionResult> {
  try {
    const viewer = await requireAdminAction();
    if (await sql.one(`select 1 from courses where id = 'demo_fisica'`)) return { error: 'O conteúdo de exemplo já foi carregado.' };
    const now = Date.now();
    const iso = (ms = 0) => new Date(now + ms).toISOString();
    const day = (n: number) => new Date(now + n * 86400_000).toISOString().slice(0, 10);
    const rows: [string, Record<string, unknown>][] = [];
    const set = (path: string, data: Record<string, unknown>) => {
      const [table, id] = path.split('/');
      rows.push([table, { id, ...data, demo: true }]);
    };

    const course = (id: string, title: string, subtitle: string, category: string, position: number, featured: boolean, is_free: boolean) =>
      set(`courses/${id}`, { title, subtitle, description: `Curso de exemplo de ${category}. Edite ou apague no painel.`, category, cover_url: '', banner_url: '', position, featured, is_free, is_published: true, created_at: iso() });
    course('demo_fisica', 'Física para o ENEM', 'Do zero à nota 800', 'Física', 1, true, false);
    course('demo_quimica', 'Química Essencial', 'Geral, orgânica e físico-química', 'Química', 2, true, false);
    course('demo_gratis', 'Aulão Gratuito ENEM', 'Comece por aqui', 'Gratuito', 0, false, true);

    const mod = (id: string, course_id: string, title: string, position: number) =>
      set(`modules/${id}`, { course_id, title, description: '', cover_url: '', position, is_published: true, created_at: iso() });
    mod('demo_m_cin', 'demo_fisica', 'Cinemática', 0);
    mod('demo_m_din', 'demo_fisica', 'Dinâmica', 1);
    mod('demo_m_qg', 'demo_quimica', 'Química Geral', 0);
    mod('demo_m_est', 'demo_gratis', 'Primeiros passos', 0);

    const lesson = (id: string, module_id: string, course_id: string, title: string, youtube_id: string, position: number, is_free = false) =>
      set(`lessons/${id}`, {
        module_id, course_id, title, youtube_id, position, is_free, is_published: true,
        description: 'Aula de exemplo com vídeo da Khan Academy Brasil. No painel, troque pelo link da sua aula.',
        duration: '', thumbnail_url: '', materials: '[]', material_paths: [], created_at: iso(),
      });
    lesson('demo_l1', 'demo_m_cin', 'demo_fisica', 'Velocidade média e instantânea', 'kDr0yBQLk6g', 0);
    lesson('demo_l2', 'demo_m_cin', 'demo_fisica', 'Escolhendo as equações da cinemática', 'Zwsn-aTwW18', 1);
    lesson('demo_l3', 'demo_m_din', 'demo_fisica', 'Primeira lei de Newton', 'OoGSZc38Svg', 0);
    lesson('demo_l4', 'demo_m_din', 'demo_fisica', 'Atrito: bloco em repouso', 'c7DmSfP6W6k', 1);
    lesson('demo_l5', 'demo_m_qg', 'demo_quimica', 'Introdução ao átomo', 'bOdmcPueiR8', 0);
    lesson('demo_l6', 'demo_m_qg', 'demo_quimica', 'Modelos atômicos', 'odjcyNe_ekQ', 1);
    lesson('demo_l7', 'demo_m_est', 'demo_gratis', 'Introdução à Química', 'xL7TRtHj0Ko', 0, true);

    set('classes/demo_turma', { name: 'Turma de Exemplo', description: 'Acesso aos cursos de exemplo', access_all: false, course_ids: ['demo_fisica', 'demo_quimica'], created_at: iso() });

    set('calendar_events/demo_e1', { title: 'Assunto da semana: Cinemática', description: '', category: 'assunto_semana', start_date: day(0), end_date: day(4), color: 'blue', is_published: true, created_at: iso() });
    set('calendar_events/demo_e2', { title: 'Simulado de exemplo', description: '', category: 'simulado', start_date: day(3), end_date: day(3), color: 'violet', is_published: true, created_at: iso() });

    set('simulados/demo_sim', { title: 'Simulado de exemplo — Ciências da Natureza', area: 'CN', question_count: 10, time_limit_minutes: 30, pdf_path: '', is_published: true, results_released: false, stats: {}, created_at: iso() });

    set('live_sessions/demo_live', { title: 'Aulão ao vivo de exemplo', description: 'Para testar: clique em Iniciar em Admin → Ao vivo.', youtube_id: LIVE_VIDEO, cover_url: '', course_id: null, starts_at: iso(86400_000), status: 'scheduled', show_replay: true, chat_enabled: true, is_published: true, created_at: iso() });

    set('doubts/demo_d1', { author_id: viewer.userId, ...authorOf(viewer), text: 'Bem-vindos ao fórum de dúvidas! Mandem suas perguntas aqui (pode enviar foto da questão).', image_url: '', is_resolved: false, likes_count: 0, replies_count: 0, created_at: iso() });

    await tx(async (t) => {
      for (const [table, data] of rows) await insert(t, table, data);
      await t.exec(`insert into simulado_keys (simulado_id, answer_key) values ('demo_sim', 'ABCDEABCDE')`);
    });
    refreshCatalog();
    updateTag('lives');
    updateTag('viewers');
    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (e) {
    return fail(e, 'Não foi possível criar o conteúdo de exemplo.');
  }
}

/** Apaga tudo o que foi criado pelo conteúdo de exemplo. */
export async function removeDemo(): Promise<ActionResult> {
  try {
    await requireAdminAction();
    // Apagar o curso/simulado/live/dúvida leva junto módulos, aulas, comentários, entregas e mensagens
    await tx(async (t) => {
      for (const table of DEMO_TABLES) await t.exec(`delete from ${table} where demo`);
    });
    refreshCatalog();
    updateTag('lives');
    updateTag('viewers');
    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (e) {
    return fail(e, 'Não foi possível apagar o conteúdo de exemplo.');
  }
}
