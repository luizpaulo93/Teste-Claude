'use server';

import { revalidatePath } from 'next/cache';
import { bool, dateOrNull, fail, refreshCatalog, requireAdminAction, str, type ActionResult } from '@/lib/admin/guard';
import { emailKey, newId, sql, tx } from '@/lib/db';
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
    const values = [
      emailKey(email),
      email,
      str(fd, 'name', 160),
      str(fd, 'phone', 30),
      str(fd, 'cpf', 20).replace(/\D/g, ''),
      dateOrNull(fd, 'birth_date'),
      isDocId(classId) ? classId : null,
      str(fd, 'status', 10) === 'blocked' ? 'blocked' : 'active',
    ];
    if (id) {
      // Editar (também move o registro se o e-mail mudou)
      if (id !== values[0] && (await sql.one(`select 1 from students where id = $1`, [values[0]]))) return { error: 'Já existe um aluno com esse e-mail.' };
      const n = await sql.exec(
        `update students set id = $2, email = $3, name = $4, phone = $5, cpf = $6, birth_date = $7, class_id = $8, status = $9, updated_at = now() where id = $1`,
        [id, ...values],
      );
      if (!n) return { error: 'Aluno não encontrado.' };
    } else {
      const n = await sql.exec(
        `insert into students (id, email, name, phone, cpf, birth_date, class_id, status) values ($1, $2, $3, $4, $5, $6, $7, $8) on conflict do nothing`,
        values,
      );
      if (!n) return { error: 'Já existe um aluno com esse e-mail.' };
    }
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
    const rows = new Map<string, { id: string; email: string; name: string; phone: string }>();
    for (const line of lines) {
      const parts = line.split(/[;,\t]/).map((p) => p.trim());
      const email = parts.find((p) => EMAIL_RE.test(p))?.toLowerCase();
      if (!email) continue;
      const others = parts.filter((p) => p && p.toLowerCase() !== email);
      const phone = others.find((p) => /^[\d()+\s-]{8,}$/.test(p)) ?? '';
      const name = others.find((p) => p !== phone) ?? '';
      rows.set(email, { id: emailKey(email), email, name: name.slice(0, 160), phone: phone.slice(0, 30) });
    }
    if (!rows.size) return { error: 'Nenhum e-mail válido encontrado.' };
    const list = [...rows.values()];
    await tx(async (t) => {
      for (let i = 0; i < list.length; i += 1000) {
        // Já cadastrado: não apaga nome/telefone; só atualiza a turma e reativa
        await t.exec(
          `insert into students (id, email, name, phone, class_id, status)
           select r.id, r.email, r.name, r.phone, $2, 'active' from jsonb_to_recordset($1::jsonb) as r(id text, email text, name text, phone text)
           on conflict (id) do update set
             class_id = coalesce($2, students.class_id),
             status = case when $2::text is null then students.status else 'active' end,
             updated_at = now()`,
          [JSON.stringify(list.slice(i, i + 1000)), class_id],
        );
      }
    });
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
    if (op.remove) await sql.exec(`delete from students where id = any($1)`, [safe]);
    else {
      const setClass = op.class_id !== undefined;
      const classId = op.class_id && isDocId(op.class_id) ? op.class_id : null;
      const status = op.status ? (op.status === 'blocked' ? 'blocked' : 'active') : null;
      await sql.exec(
        `update students set
           class_id = case when $2 then $3 else class_id end,
           status = coalesce($4, status),
           updated_at = now()
         where id = any($1)`,
        [safe, setClass, classId, status],
      );
    }
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
    const name = str(fd, 'name', 120);
    if (!name) return { error: 'Informe o nome da turma.' };
    const values = [
      name,
      str(fd, 'description', 1000),
      bool(fd, 'access_all'),
      fd.getAll('course_ids').map(String).filter((x) => isDocId(x)).slice(0, 500),
    ];
    let classId = id;
    if (id) {
      if (!isDocId(id)) return { error: 'Inválido.' };
      await sql.exec(`update classes set name = $2, description = $3, access_all = $4, course_ids = $5, updated_at = now() where id = $1`, [id, ...values]);
    } else {
      classId = newId();
      await sql.exec(`insert into classes (id, name, description, access_all, course_ids) values ($1, $2, $3, $4, $5)`, [classId, ...values]);
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
    await sql.exec(`delete from classes where id = $1`, [id]); // alunos ficam sem turma (on delete set null)
    refreshCatalog();
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e, 'Não foi possível excluir.');
  }
}
