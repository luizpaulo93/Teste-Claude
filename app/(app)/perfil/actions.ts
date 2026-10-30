'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { sql } from '@/lib/db';
import { emailKey } from '@/lib/db';
import { missingProfile, requireViewer, validCpf } from '@/lib/session';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const okBirth = (d: string) => DATE.test(d) && d >= '1920-01-01' && d <= new Date(Date.now() - 5 * 365 * 86400_000).toISOString().slice(0, 10);

export async function updateProfile(_: unknown, form: FormData) {
  const viewer = await requireViewer();
  const full_name = String(form.get('full_name') ?? '').trim().slice(0, 120);
  const phone = String(form.get('phone') ?? '').replace(/[^\d+()\s-]/g, '').slice(0, 30);
  const birth = String(form.get('birth_date') ?? '');
  if (full_name.length < 2) return { error: 'Informe seu nome completo.' };
  if (birth && !okBirth(birth)) return { error: 'Data de nascimento inválida.' };
  try {
    await sql.exec(
      `insert into users (id, email, full_name, phone, birth_date, role) values ($1, $2, $3, $4, $5, $6)
       on conflict (id) do update set full_name = excluded.full_name, phone = excluded.phone, birth_date = excluded.birth_date`,
      [viewer.userId, viewer.email, full_name, phone, okBirth(birth) ? birth : null, viewer.profile.role],
    );
  } catch {
    return { error: 'Não foi possível salvar.' };
  }
  updateTag(`viewer-${viewer.userId}`);
  revalidatePath('/', 'layout');
  return { ok: true };
}

/**
 * Completar o perfil (pedido a partir do 3º dia): nome completo, nascimento e CPF.
 * O CPF só é aceito se ainda não houver um: depois, só o mentor muda (e o e-mail também).
 */
export async function completeProfile(_: unknown, form: FormData) {
  const viewer = await requireViewer();
  const full_name = String(form.get('full_name') ?? '').trim().replace(/\s+/g, ' ').slice(0, 120);
  const birth = String(form.get('birth_date') ?? '');
  const current = viewer.student?.cpf || viewer.profile.cpf || '';
  const cpf = validCpf(current) ? current.replace(/\D/g, '') : String(form.get('cpf') ?? '').replace(/\D/g, '');
  if (full_name.split(' ').length < 2) return { error: 'Informe seu nome completo (nome e sobrenome).' };
  if (!okBirth(birth)) return { error: 'Informe uma data de nascimento válida.' };
  if (!validCpf(cpf)) return { error: 'CPF inválido. Confira os números.' };
  // O mesmo CPF não pode estar em outra conta
  const other = await sql.one(
    `select 1 from users where cpf = $1 and id <> $2 union all select 1 from students where cpf = $1 and id <> $3 limit 1`,
    [cpf, viewer.userId, emailKey(viewer.email)],
  );
  if (other) return { error: 'Este CPF já está em outra conta. Fale com o seu mentor.' };
  try {
    await sql.exec(
      `insert into users (id, email, full_name, birth_date, cpf, role) values ($1, $2, $3, $4, $5, $6)
       on conflict (id) do update set full_name = excluded.full_name, birth_date = excluded.birth_date,
         cpf = case when users.cpf = '' then excluded.cpf else users.cpf end`,
      [viewer.userId, viewer.email, full_name, birth, cpf, viewer.profile.role],
    );
    // Cadastro de aluno sem CPF: guarda lá também (é onde o mentor edita)
    await sql.exec(`update students set cpf = $2, updated_at = now() where id = $1 and cpf = ''`, [emailKey(viewer.email), cpf]);
  } catch {
    return { error: 'Não foi possível salvar.' };
  }
  updateTag(`viewer-${viewer.userId}`);
  updateTag('viewers');
  revalidatePath('/', 'layout');
  return { ok: true, missing: missingProfile({ full_name, birth_date: birth }, cpf) };
}
