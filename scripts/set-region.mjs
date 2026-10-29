// Roda antes do build na Vercel: coloca as funções na mesma região do banco Neon.
// Servidor e banco lado a lado = cada consulta leva ~1-5 ms em vez de ~120 ms.
import { readFileSync, writeFileSync } from 'node:fs';

const NEON_TO_VERCEL = {
  'sa-east-1': 'gru1', // São Paulo
  'us-east-1': 'iad1', // Washington
  'us-east-2': 'cle1', // Ohio
  'us-west-2': 'pdx1', // Oregon
  'eu-central-1': 'fra1', // Frankfurt
  'eu-west-2': 'lhr1', // Londres
  'ap-southeast-1': 'sin1', // Singapura
  'ap-southeast-2': 'syd1', // Sydney
};

if (!process.env.VERCEL) process.exit(0); // só no build da Vercel

const url =
  process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NEON_DATABASE_URL || process.env.DATABASE_URL_UNPOOLED || '';
const neon = url.match(/\.([a-z]{2}-[a-z]+-\d)\.aws\.neon\.tech/)?.[1];
const region = process.env.FUNCTION_REGION || (neon && NEON_TO_VERCEL[neon]);
if (!region || !/^[a-z]{3}\d$/.test(region)) {
  console.log('[região] não identificada; mantendo a padrão da Vercel');
  process.exit(0);
}

// Layout raiz (vale para todas as páginas) + rotas de API
const files = ['app/layout.tsx', 'app/api/session/route.ts', 'app/api/storage/upload/route.ts', 'app/api/storage/download/route.ts'];
for (const f of files) {
  const file = new URL(`../${f}`, import.meta.url);
  let src;
  try {
    src = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  src = src.replace(/\nexport const preferredRegion = .*\n/g, '\n').trimEnd();
  writeFileSync(file, `${src}\n\nexport const preferredRegion = '${region}';\n`);
}
console.log(`[região] banco Neon em ${neon ?? '?'} → funções da Vercel em ${region}`);
