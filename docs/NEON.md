# Como conectar o banco de dados Neon

O **Neon** guarda todos os dados da plataforma: cursos, aulas, alunos, turmas, progresso,
simulados, dúvidas, mentoria e o chat das lives. É um PostgreSQL na nuvem, com plano grátis.

Divisão de tarefas:

| Serviço | Faz o quê | Tutorial |
|---|---|---|
| **Neon** | banco de dados (tudo) | este arquivo |
| **Firebase** | só o login (Google e link por e-mail) | [`FIREBASE.md`](FIREBASE.md) |
| **Cloudflare R2** | arquivos (capas, PDFs, fotos) | [`CLOUDFLARE-R2.md`](CLOUDFLARE-R2.md) |

Você **não precisa criar tabelas**: no primeiro acesso a plataforma cria tudo sozinha.

---

## Jeito 1 — Pela Vercel (mais fácil)

1. Na Vercel, abra seu projeto → aba **Storage** → **Create Database** (ou "Connect Database").
2. Escolha **Neon** → **Continue**.
3. Região: **São Paulo (sa-east-1)** se aparecer; senão, **Washington (us-east-1)**.
4. Plano: **Free** → dê um nome (ex.: `vertice`) → **Create**.
5. Na tela seguinte, deixe marcado **Production**, **Preview** e **Development** e clique em
   **Connect**.

Pronto: a Vercel cria sozinha a variável `DATABASE_URL`. Vá em **Deployments → ⋯ → Redeploy**.

## Jeito 2 — Pelo site do Neon

1. Crie a conta em [neon.tech](https://neon.tech) (pode entrar com o Google).
2. **Create project** → nome `vertice` → Postgres **17** → região **AWS São Paulo
   (sa-east-1)** → **Create**.
3. No painel do projeto, clique em **Connect**.
4. Deixe ligado **Connection pooling** e copie a **Connection string**. Ela é assim:

   ```
   postgresql://neondb_owner:SENHA@ep-xxxx-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require
   ```

5. Na Vercel: **Settings → Environment Variables** → adicione:
   - Nome: `DATABASE_URL`
   - Valor: a connection string copiada
6. **Deployments → ⋯ → Redeploy**.

⚠️ Essa connection string tem a senha do banco. Não mande para ninguém e não coloque no GitHub.

---

## Testar

1. Abra o site e entre com **luizpaulofisica@gmail.com**.
2. **Admin → Configurações → Carregar exemplos** para criar cursos, aulas, simulado e live de teste.
3. No Neon, abra **Tables**: as tabelas `courses`, `lessons`, `students`… aparecem com os dados.

## Perguntas comuns

**Quanto custa?** O plano grátis tem 0,5 GB por projeto. Isso dá para dezenas de milhares
de alunos, porque arquivos pesados (PDFs, imagens) ficam no R2. O banco "dorme" depois de
5 minutos sem uso. O primeiro acesso depois disso demora cerca de meio segundo a mais.

**Aguenta muitos alunos ao mesmo tempo?** Sim. O link com `-pooler` usa o pool de conexões do
Neon, que aceita milhares de conexões. Além disso, o catálogo de cursos fica em cache no
servidor e o chat da live usa um cache de 2 segundos compartilhado entre todos os alunos.

**Deu "Não foi possível acessar o banco de dados"?** Confira se a `DATABASE_URL` está na Vercel,
começa com `postgresql://` e não tem espaços. Depois faça o Redeploy.

**Como faço backup?** O Neon guarda o histórico automaticamente e permite voltar o banco a um
momento anterior (no plano grátis, só as últimas horas). No painel: **Backup & Restore**.

**Posso ver e editar os dados?** Sim, em **Tables** no painel do Neon. Também pode usar o
**SQL Editor**. O esquema completo está em [`db/schema.sql`](../db/schema.sql).
