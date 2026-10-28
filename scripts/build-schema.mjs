// Copia db/schema.sql para lib/schema-sql.ts (a plataforma usa esse arquivo para criar as tabelas).
// Depois de mudar o schema, rode "npm run db:schema" e aumente SCHEMA_VERSION.
import { readFileSync, writeFileSync } from 'node:fs';

const sql = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');
const current = readFileSync(new URL('../lib/schema-sql.ts', import.meta.url), 'utf8');
const version = Number(current.match(/SCHEMA_VERSION = (\d+)/)?.[1] ?? 1);
writeFileSync(
  new URL('../lib/schema-sql.ts', import.meta.url),
  `// Gerado a partir de db/schema.sql (npm run db:schema) — a plataforma cria as tabelas sozinha no primeiro acesso.\nexport const SCHEMA_VERSION = ${version};\nexport const SCHEMA_SQL = ${JSON.stringify(sql)};\n`,
);
console.log('lib/schema-sql.ts atualizado (versão', version + ')');
