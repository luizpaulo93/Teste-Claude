import 'server-only';
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

import { adminConfigProblem, readServiceAccount } from './admin-config';

export { adminConfigProblem };

// O Firebase cuida só do login; os dados ficam no Neon (lib/db.ts)
const emulator = Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST);

let app: App | null = null;

function adminApp() {
  if (app) return app;
  if (getApps().length) return (app = getApps()[0]);
  if (emulator) {
    app = initializeApp({ projectId: process.env.GCLOUD_PROJECT || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'demo-vertice' });
  } else {
    const { sa, problem } = readServiceAccount();
    if (!sa) throw new Error(problem ?? 'Firebase Admin não configurado');
    app = initializeApp({ credential: cert({ projectId: sa.project_id, clientEmail: sa.client_email, privateKey: sa.private_key }), projectId: sa.project_id });
  }
  return app;
}

export function adminAuth() {
  return getAuth(adminApp());
}
