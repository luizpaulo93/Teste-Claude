'use server';

import { revalidatePath } from 'next/cache';
import { adminClient, bool, dateOrNull, fail, str, type ActionResult } from '@/lib/admin/guard';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function refresh() {
  revalidatePath('/admin/alunos');
  revalidatePath('/admin/turmas');
  revalidatePath('/', 'layout');
}

export async function saveStudent(fd: FormData): Promise<ActionResult> {
  try {
    const { supabase } = await adminClient();
    const id = str(fd, 'id', 64);
    const email = str(fd, 'email', 200).toLowerCase();
    if (!EMAIL_RE.test(email)) return { error: 'E-mail inválido.' };
    const row = {
      email,
      name: str(fd, 'name', 160),
      phone: str(fd, 'phone', 30),
      cpf: str(fd, 'cpf', 20).replace(/\D/g, ''),
      birth_date: dateOrNull(fd, 'birth_date'),
      class_id: str(fd, 'class_id', 64) || null,
      status: str(fd, 'status', 10) === 'blocked' ? 'blocked' : 'active',
      updated_at: new Date().toISOString(),
    };
    const { error } = id ? await supabase.from('students').update(row).eq('id', id) : await supabase.from('students').insert(row);
    if (error) throw error;
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Importação em lote: uma linha por aluno — "nome; email; telefone" (ou só o e-mail). */
export async function importStudents(fd: FormData): Promise<ActionResult & { count?: number }> {
  try {
    const { supabase } = await adminClient();
    const class_id = str(fd, 'class_id', 64) || null;
    const lines = str(fd, 'lines', 200_000).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const rows = new Map<string, { email: string; name: string; phone: string; class_id: string | null; status: 'active' }>();
    for (const line of lines) {
      const parts = line.split(/[;,\t]/).map((p) => p.trim());
      const email = parts.find((p) => EMAIL_RE.test(p))?.toLowerCase();
      if (!email) continue;
      const others = parts.filter((p) => p && p.toLowerCase() !== email);
      const phone = others.find((p) => /^[\d()+\s-]{8,}$/.test(p)) ?? '';
      const name = others.find((p) => p !== phone) ?? '';
      rows.set(email, { email, name: name.slice(0, 160), phone: phone.slice(0, 30), class_id, status: 'active' });
    }
    if (!rows.size) return { error: 'Nenhum e-mail válido encontrado.' };
    const list = [...rows.values()];
    // Evita sobrescrever nomes já cadastrados com vazio: atualiza só turma/status para quem já existe
    const { data: existing } = await supabase.from('students').select('id,email').in('email', list.map((r) => r.email));
    const existingSet = new Map((existing ?? []).map((s: { id: string; email: string }) => [s.email.toLowerCase(), s.id]));
    const toInsert = list.filter((r) => !existingSet.has(r.email));
    const toUpdate = list.filter((r) => existingSet.has(r.email));
    for (let i = 0; i < toInsert.length; i += 500) {
      const { error } = await supabase.from('students').insert(toInsert.slice(i, i + 500));
      if (error) throw error;
    }
    if (toUpdate.length && class_id) {
      await supabase
        .from('students')
        .update({ class_id, status: 'active' })
        .in('id', toUpdate.map((r) => existingSet.get(r.email)!));
    }
    refresh();
    return { ok: true, count: list.length };
  } catch (e) {
    return fail(e, 'Falha na importação.');
  }
}

export async function setStudentStatus(id: string, status: 'active' | 'blocked'): Promise<ActionResult> {
  try {
    const { supabase } = await adminClient();
    const { error } = await supabase.from('students').update({ status }).eq('id', id);
    if (error) throw error;
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function bulkStudents(ids: string[], op: { class_id?: string | null; status?: 'active' | 'blocked'; remove?: boolean }): Promise<ActionResult> {
  try {
    const { supabase } = await adminClient();
    const safe = ids.filter((x) => /^[0-9a-f-]{36}$/i.test(x)).slice(0, 2000);
    if (!safe.length) return { ok: true };
    const { error } = op.remove
      ? await supabase.from('students').delete().in('id', safe)
      : await supabase
          .from('students')
          .update({ ...(op.class_id !== undefined ? { class_id: op.class_id } : {}), ...(op.status ? { status: op.status } : {}) })
          .in('id', safe);
    if (error) throw error;
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteStudent(id: string): Promise<ActionResult> {
  return bulkStudents([id], { remove: true });
}

// ---------------- Turmas
export async function saveClass(fd: FormData): Promise<ActionResult> {
  try {
    const { supabase } = await adminClient();
    const id = str(fd, 'id', 64);
    const row = { name: str(fd, 'name', 120), description: str(fd, 'description', 1000), access_all: bool(fd, 'access_all'), updated_at: new Date().toISOString() };
    if (!row.name) return { error: 'Informe o nome da turma.' };
    const courseIds = fd.getAll('course_ids').map(String).filter((x) => /^[0-9a-f-]{36}$/i.test(x));
    let classId = id;
    if (id) {
      const { error } = await supabase.from('classes').update(row).eq('id', id);
      if (error) throw error;
    } else {
      const { data, error } = await supabase.from('classes').insert(row).select('id').single();
      if (error) throw error;
      classId = data.id;
    }
    await supabase.from('class_courses').delete().eq('class_id', classId);
    if (courseIds.length) {
      const { error } = await supabase.from('class_courses').insert(courseIds.map((course_id) => ({ class_id: classId, course_id })));
      if (error) throw error;
    }
    refresh();
    return { ok: true, id: classId };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteClass(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await adminClient();
    const { error } = await supabase.from('classes').delete().eq('id', id);
    if (error) throw error;
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e, 'Não foi possível excluir.');
  }
}
