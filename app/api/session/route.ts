import { cookies } from 'next/headers';
import { revalidateTag } from 'next/cache';
import { NextResponse, type NextRequest } from 'next/server';
import { sql } from '@/lib/db';
import { adminAuth } from '@/lib/firebase/admin';
import { BOOTSTRAP_ADMIN, SESSION_COOKIE } from '@/lib/session';

const MAX_AGE = 60 * 60 * 24 * 14; // 14 dias

/** Troca o token do login do Firebase por um cookie de sessão seguro (httpOnly) e cria/atualiza o perfil no Neon. */
export async function POST(req: NextRequest) {
  const { idToken } = (await req.json().catch(() => ({}))) as { idToken?: string };
  if (!idToken) return NextResponse.json({ error: 'Token ausente.' }, { status: 400 });

  let decoded;
  try {
    decoded = await adminAuth().verifyIdToken(idToken);
  } catch {
    return NextResponse.json({ error: 'Login inválido. Tente de novo.' }, { status: 401 });
  }
  if (Date.now() / 1000 - decoded.auth_time > 10 * 60) return NextResponse.json({ error: 'Login expirado. Entre de novo.' }, { status: 401 });
  const email = String(decoded.email ?? '').toLowerCase();
  if (!email) return NextResponse.json({ error: 'Sua conta não tem e-mail.' }, { status: 400 });

  try {
    const listed = await sql.one<{ ok: boolean }>(`select exists(select 1 from admins where email = $1) as ok`, [email]);
    const isListedAdmin = email === BOOTSTRAP_ADMIN || Boolean(listed?.ok);
    // Cria o perfil no primeiro acesso; depois só ajusta o papel e a foto (se ainda não tiver)
    await sql.exec(
      `insert into users (id, email, full_name, avatar_url, role)
       values ($1, $2, $3, $4, $5)
       on conflict (id) do update set
         email = excluded.email,
         role = case when $6 then 'admin' else users.role end,
         avatar_url = case when users.avatar_url = '' then excluded.avatar_url else users.avatar_url end`,
      [decoded.uid, email, String(decoded.name ?? '') || email.split('@')[0], String(decoded.picture ?? ''), isListedAdmin ? 'admin' : 'student', isListedAdmin],
    );
    revalidateTag(`viewer-${decoded.uid}`, { expire: 0 }); // perfil novo/atualizado aparece na hora
  } catch (e) {
    console.error('[session]', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Não foi possível acessar o banco de dados. Tente de novo em instantes.' }, { status: 503 });
  }

  const sessionCookie = await adminAuth().createSessionCookie(idToken, { expiresIn: MAX_AGE * 1000 });
  (await cookies()).set(SESSION_COOKIE, sessionCookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' && !process.env.FIREBASE_AUTH_EMULATOR_HOST,
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  (await cookies()).delete(SESSION_COOKIE);
  return NextResponse.json({ ok: true });
}
