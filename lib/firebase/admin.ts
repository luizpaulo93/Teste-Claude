import 'server-only';
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

import { adminConfigProblem, readServiceAccount } from './admin-config';

export { adminConfigProblem };

const emulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

let app: App | null = null;
let db: Firestore | null = null;

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

export function adminDb() {
  if (!db) {
    db = getFirestore(adminApp());
    try {
      db.settings({ ignoreUndefinedProperties: true });
    } catch {
      /* já configurado */
    }
  }
  return db;
}
