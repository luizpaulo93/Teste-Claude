import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { syncClaims } from '@/lib/claims';
import { emailKey, nowIso } from '@/lib/db';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { BOOTSTRAP_ADMIN, SESSION_COOKIE } from '@/lib/session';

const MAX_AGE = 60 * 60 * 24 * 14; // 14 dias

/** Troca o token do login do Firebase por um cookie de sessão seguro (httpOnly) e cria/atualiza o perfil. */
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

  const db = adminDb();
  const ref = db.doc(`users/${decoded.uid}`);
  const [snap, adminSnap] = await Promise.all([ref.get(), db.doc(`admins/${emailKey(email)}`).get()]);
  const listedAdmin = email === BOOTSTRAP_ADMIN || adminSnap.exists;
  const current = snap.data() as { role?: string; avatar_url?: string; full_name?: string } | undefined;
  const role = listedAdmin ? 'admin' : current?.role === 'admin' ? 'admin' : 'student';

  if (!current) {
    await ref.set({
      email,
      full_name: String(decoded.name ?? '') || email.split('@')[0],
      avatar_url: String(decoded.picture ?? ''),
      phone: '',
      birth_date: null,
      role,
      created_at: nowIso(),
    });
  } else if (current.role !== role || (!current.avatar_url && decoded.picture)) {
    await ref.update({ role, ...(!current.avatar_url && decoded.picture ? { avatar_url: String(decoded.picture) } : {}) });
  }

  const refresh = await syncClaims(decoded.uid, email, role === 'admin', decoded as unknown as Record<string, unknown>);
  const sessionCookie = await adminAuth().createSessionCookie(idToken, { expiresIn: MAX_AGE * 1000 });
  (await cookies()).set(SESSION_COOKIE, sessionCookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' && !process.env.FIRESTORE_EMULATOR_HOST,
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE,
  });
  return NextResponse.json({ ok: true, refresh });
}

export async function DELETE() {
  (await cookies()).delete(SESSION_COOKIE);
  return NextResponse.json({ ok: true });
}
