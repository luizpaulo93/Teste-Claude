import 'server-only';
import { emailKey, getCatalogData, getSettings } from './db';
import { adminAuth, adminDb } from './firebase/admin';

/** Calcula se o e-mail é aluno liberado (mesma regra do servidor). */
export async function isMemberEmail(email: string, isAdmin: boolean) {
  if (isAdmin) return true;
  const [settings, catalog, snap] = await Promise.all([getSettings(), getCatalogData(), adminDb().doc(`students/${emailKey(email)}`).get()]);
  if (!settings.restrict_to_student_list) return true;
  const st = snap.data() as { status?: string; class_id?: string | null } | undefined;
  return Boolean(st && st.status === 'active' && st.class_id && catalog.classes.some((c) => c.id === st.class_id));
}

/**
 * Marca no login do Firebase se a pessoa é admin/aluna liberada.
 * O navegador usa isso nas regras do Firestore (ex.: ler o chat das lives).
 */
export async function syncClaims(uid: string, email: string, isAdmin: boolean, current?: Record<string, unknown>) {
  const want = { admin: isAdmin, member: await isMemberEmail(email, isAdmin) };
  if (current && current.admin === want.admin && current.member === want.member) return false;
  await adminAuth().setCustomUserClaims(uid, want);
  return true;
}

/** Depois que o admin muda um aluno: atualiza a marcação se a pessoa já tem conta. */
export async function syncClaimsByEmail(emails: string[]) {
  await Promise.all(
    emails.map(async (email) => {
      try {
        const user = await adminAuth().getUserByEmail(email);
        const isAdmin = user.customClaims?.admin === true;
        await syncClaims(user.uid, email, isAdmin, user.customClaims);
      } catch {
        /* ainda não tem conta */
      }
    }),
  );
}
