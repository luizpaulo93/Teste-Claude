// Sem dependências: pode ser usado no proxy.
interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

/** Lê a conta de serviço: o JSON inteiro em FIREBASE_SERVICE_ACCOUNT (texto ou base64) ou 3 variáveis separadas. */
export function readServiceAccount(): { sa: ServiceAccount | null; problem: string | null } {
  const raw = (process.env.FIREBASE_SERVICE_ACCOUNT ?? '').trim();
  if (raw) {
    let text = raw;
    if (!text.startsWith('{')) {
      try {
        text = Buffer.from(text, 'base64').toString('utf8');
      } catch {
        /* segue */
      }
    }
    try {
      const j = JSON.parse(text) as Partial<ServiceAccount> & { type?: string };
      if (!j.client_email || !j.private_key || !j.project_id)
        return { sa: null, problem: 'FIREBASE_SERVICE_ACCOUNT não tem client_email/private_key/project_id. Cole o arquivo JSON da conta de serviço inteiro.' };
      return { sa: { project_id: j.project_id, client_email: j.client_email, private_key: j.private_key.replace(/\\n/g, '\n') }, problem: null };
    } catch {
      return { sa: null, problem: 'FIREBASE_SERVICE_ACCOUNT não é um JSON válido. Abra o arquivo .json baixado do Firebase e cole TODO o conteúdo (de { até }).' };
    }
  }
  const project_id = (process.env.FIREBASE_PROJECT_ID ?? '').trim();
  const client_email = (process.env.FIREBASE_CLIENT_EMAIL ?? '').trim();
  const private_key = (process.env.FIREBASE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n').trim();
  if (project_id && client_email && private_key) return { sa: { project_id, client_email, private_key }, problem: null };
  return { sa: null, problem: 'A variável FIREBASE_SERVICE_ACCOUNT não foi encontrada. Cole nela o JSON da conta de serviço (Configurações do projeto → Contas de serviço → Gerar nova chave privada).' };
}


export function adminConfigProblem(): string | null {
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST) return null;
  return readServiceAccount().problem;
}

