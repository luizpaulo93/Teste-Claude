// Sem dependências: pode ser usado no proxy.

/** Endereço do banco Neon. Aceita os nomes que a integração Neon da Vercel cria. */
export function databaseUrl(): string {
  const raw =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.NEON_DATABASE_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.POSTGRES_URL_NON_POOLING ||
    '';
  // Aceita o comando copiado inteiro do Neon (psql 'postgresql://...') e aspas por engano
  return raw
    .trim()
    .replace(/^psql\s+/, '')
    .replace(/^['"]|['"]$/g, '')
    .trim();
}

export function databaseConfigProblem(): string | null {
  const url = databaseUrl();
  if (!url)
    return 'A variável DATABASE_URL não foi encontrada. No Neon, clique em "Connect", copie a "Connection string" (começa com postgresql://) e cole como valor de DATABASE_URL na Vercel.';
  if (!/^postgres(ql)?:\/\//.test(url))
    return 'DATABASE_URL não parece um endereço do Neon. Ela deve começar com postgresql:// (copie a "Connection string" no botão "Connect" do Neon).';
  return null;
}
