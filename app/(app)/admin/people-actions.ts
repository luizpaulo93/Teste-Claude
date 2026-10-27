'use server';

import { revalidatePath } from 'next/cache';
import { bool, dateOrNull, fail, refreshCatalog, requireAdminAction, str, type ActionResult } from '@/lib/admin/guard';
import { syncClaimsByEmail } from '@/lib/claims';
import { db, emailKey, nowIso } from '@/lib/db';
import { isDocId } from '@/lib/utils';

const EMAIL_RE = /^[^\s@/]+@[^\s@/]+\.[^\s@/]{2,}$/;

function refresh() {
  revalidatePath('/admin/alunos');
  revalidatePath('/admin/turmas');
  revalidatePath('/', 'layout');
}

/** O ID do aluno é o próprio e-mail (busca instantânea no login). */
export async function saveStudent(fd: FormData): Promise<ActionResult> {
  try {
    await requireAdminAction();
    const id = str(fd, 'id', 200);
    const email = str(fd, 'email', 200).toLowerCase();
    if (!EMAIL_RE.test(email)) return { error: 'E-mail inválido.' };
    const classId = str(fd, 'class_id', 64);
    const row = {
      email,
      name: str(fd, 'name', 160),
      phone: str(fd, 'phone', 30),
      cpf: str(fd, 'cpf', 20).replace(/\D/g, ''),
      birth_date: dateOrNull(fd, 'birth_date'),
      class_id: isDocId(classId) ? classId : null,
      status: str(fd, 'status', 10) === 'blocked' ? 'blocked' : 'active',
      updated_at: nowIso(),
    };
    const newKey = emailKey(email);
    const ref = db().doc(`students/${newKey}`);
    if (id && id !== newKey) {
      // Trocou o e-mail: move o registro
      const old = db().doc(`students/${id}`);
      const snap = await old.get();
      if ((await ref.get()).exists) return { error: 'Já existe um aluno com esse e-mail.' };
      await ref.set({ ...(snap.data() ?? {}), ...row });
      await old.delete();
    } else if (id) {
      await ref.set(row, { merge: true });
    } else {
      if ((await ref.get()).exists) return { error: 'Já existe um aluno com esse e-mail.' };
      await ref.set({ ...row, created_at: nowIso() });
    }
    await syncClaimsByEmail([email]);
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Importação em lote: uma linha por aluno — "nome; email; telefone" (ou só o e-mail). */
export async function importStudents(fd: FormData): Promise<ActionResult & { count?: number }> {
  try {
    await requireAdminAction();
    const cls = str(fd, 'class_id', 64);
    const class_id = isDocId(cls) ? cls : null;
    const lines = str(fd, 'lines', 200_000).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const rows = new Map<string, { email: string; name: string; phone: string }>();
    for (const line of lines) {
      const parts = line.split(/[;,\t]/).map((p) => p.trim());
      const email = parts.find((p) => EMAIL_RE.test(p))?.toLowerCase();
      if (!email) continue;
      const others = parts.filter((p) => p && p.toLowerCase() !== email);
      const phone = others.find((p) => /^[\d()+\s-]{8,}$/.test(p)) ?? '';
      const name = others.find((p) => p !== phone) ?? '';
      rows.set(email, { email, name: name.slice(0, 160), phone: phone.slice(0, 30) });
    }
    if (!rows.size) return { error: 'Nenhum e-mail válido encontrado.' };
    const list = [...rows.values()];
    const d = db();
    for (let i = 0; i < list.length; i += 400) {
      const chunk = list.slice(i, i + 400);
      const snaps = await d.getAll(...chunk.map((r) => d.doc(`students/${emailKey(r.email)}`)));
      const batch = d.batch();
      chunk.forEach((r, k) => {
        const ref = snaps[k].ref;
        if (snaps[k].exists) {
          // Já cadastrado: não apaga nome/telefone; só atualiza turma e reativa
          if (class_id) batch.update(ref, { class_id, status: 'active', updated_at: nowIso() });
        } else {
          batch.set(ref, { ...r, cpf: '', birth_date: null, class_id, status: 'active', created_at: nowIso(), updated_at: nowIso() });
        }
      });
      await batch.commit();
    }
    await syncClaimsByEmail(list.map((r) => r.email));
    refresh();
    return { ok: true, count: list.length };
  } catch (e) {
    return fail(e, 'Falha na importação.');
  }
}

export async function setStudentStatus(id: string, status: 'active' | 'blocked'): Promise<ActionResult> {
  return bulkStudents([id], { status });
}

export async function bulkStudents(ids: string[], op: { class_id?: string | null; status?: 'active' | 'blocked'; remove?: boolean }): Promise<ActionResult> {
  try {
    await requireAdminAction();
    const safe = ids.filter((x) => typeof x === 'string' && x.length <= 200 && !x.includes('/')).slice(0, 2000);
    if (!safe.length) return { ok: true };
    const d = db();
    const update: Record<string, unknown> = { updated_at: nowIso() };
    if (op.class_id !== undefined) update.class_id = op.class_id && isDocId(op.class_id) ? op.class_id : null;
    if (op.status) update.status = op.status === 'blocked' ? 'blocked' : 'active';
    const emails: string[] = [];
    for (let i = 0; i < safe.length; i += 400) {
      const batch = d.batch();
      safe.slice(i, i + 400).forEach((id) => {
        const ref = d.doc(`students/${id}`);
        if (op.remove) batch.delete(ref);
        else batch.set(ref, update, { merge: true });
        emails.push(id);
      });
      await batch.commit();
    }
    await syncClaimsByEmail(emails);
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
    await requireAdminAction();
    const id = str(fd, 'id', 64);
    const row = {
      name: str(fd, 'name', 120),
      description: str(fd, 'description', 1000),
      access_all: bool(fd, 'access_all'),
      course_ids: fd.getAll('course_ids').map(String).filter((x) => isDocId(x)).slice(0, 500),
      updated_at: nowIso(),
    };
    if (!row.name) return { error: 'Informe o nome da turma.' };
    let classId = id;
    if (id) {
      if (!isDocId(id)) return { error: 'Inválido.' };
      await db().doc(`classes/${id}`).update(row);
    } else {
      classId = (await db().collection('classes').add({ ...row, created_at: nowIso() })).id;
    }
    refreshCatalog();
    refresh();
    return { ok: true, id: classId };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteClass(id: string): Promise<ActionResult> {
  try {
    await requireAdminAction();
    if (!isDocId(id)) return { error: 'Inválido.' };
    const d = db();
    const students = await d.collection('students').where('class_id', '==', id).get();
    for (let i = 0; i < students.docs.length; i += 400) {
      const batch = d.batch();
      students.docs.slice(i, i + 400).forEach((s) => batch.update(s.ref, { class_id: null }));
      await batch.commit();
    }
    await d.doc(`classes/${id}`).delete();
    refreshCatalog();
    await syncClaimsByEmail(students.docs.map((s) => String(s.get('email'))));
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e, 'Não foi possível excluir.');
  }
}
