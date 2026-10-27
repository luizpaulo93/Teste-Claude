/**
 * Configuração pública do Firebase (pode ir para o navegador).
 * Aceita o bloco `firebaseConfig` inteiro colado em NEXT_PUBLIC_FIREBASE_CONFIG
 * (em JSON ou do jeito que o console mostra), ou as variáveis separadas.
 */
export interface FirebasePublicConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  storageBucket?: string;
  messagingSenderId?: string;
}

const KEYS = ['apiKey', 'authDomain', 'projectId', 'appId', 'storageBucket', 'messagingSenderId'] as const;

function parseLoose(raw: string): Partial<FirebasePublicConfig> {
  const out: Record<string, string> = {};
  for (const k of KEYS) {
    const m = raw.match(new RegExp(`["']?${k}["']?\\s*:\\s*["']([^"']+)["']`));
    if (m) out[k] = m[1].trim();
  }
  return out;
}

const fromBlock = parseLoose(process.env.NEXT_PUBLIC_FIREBASE_CONFIG ?? '');
const clean = (v?: string) => (v ?? '').trim().replace(/^["']|["']$/g, '');

export const firebaseConfig: FirebasePublicConfig = {
  apiKey: clean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY) || fromBlock.apiKey || '',
  authDomain: clean(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN) || fromBlock.authDomain || '',
  projectId: clean(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) || fromBlock.projectId || '',
  appId: clean(process.env.NEXT_PUBLIC_FIREBASE_APP_ID) || fromBlock.appId || '',
  storageBucket: fromBlock.storageBucket,
  messagingSenderId: fromBlock.messagingSenderId,
};

/** Só para testes locais com o Firebase Emulator. */
export const useEmulator = process.env.NEXT_PUBLIC_FIREBASE_EMULATOR === '1';

export function publicConfigProblem(): string | null {
  const missing = (['apiKey', 'authDomain', 'projectId', 'appId'] as const).filter((k) => !firebaseConfig[k]);
  if (missing.length === 4) return 'A variável NEXT_PUBLIC_FIREBASE_CONFIG não foi encontrada. Cole nela o bloco firebaseConfig do console do Firebase.';
  if (missing.length) return `Faltam estes campos na configuração do Firebase: ${missing.join(', ')}. Copie o bloco firebaseConfig completo de novo.`;
  if (!firebaseConfig.apiKey.startsWith('AIza') && !useEmulator) return 'O apiKey do Firebase parece errado (ele começa com "AIza"). Copie o bloco firebaseConfig de novo.';
  return null;
}
