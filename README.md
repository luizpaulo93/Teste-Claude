# Vértice — Área de Membros

Plataforma de área de membros para cursos (Enem e vestibulares), inspirada no projeto
[MemberClass — Vértice](https://github.com/luizpaulo93/MemberClass---V-rtice), reconstruída para
**Supabase + Vercel**, com foco em velocidade, design responsivo e muitos acessos simultâneos.

**Stack:** Next.js 16 (App Router, Server Components, Server Actions) · React 19 · TypeScript ·
Tailwind CSS 4 · Supabase (Postgres, Auth, Storage, RLS).

## O que tem

**Para o aluno**
- Início estilo streaming: destaque, "continuar assistindo", trilhos de cursos com progresso.
- Cursos → módulos → aulas, com player próprio sobre o YouTube (controles personalizados,
  velocidade, atalhos de teclado, tela cheia inclusive no iPhone, marca d'água com nome/e-mail
  e retomada de onde parou).
- PDFs das aulas em bucket privado (link temporário assinado).
- Favoritas e histórico de aulas concluídas.
- Simulados no padrão ENEM: caderno em PDF, cartão-resposta com salvamento automático,
  cronômetro com entrega automática, nota estimada pela TRI, coerência pedagógica,
  desempenho por dificuldade, comparativo com a turma e gráfico de evolução.
- Fórum de dúvidas com fotos, curtidas, respostas e selo de professor.
- Mentoria individual: plano semanal de tarefas, check-in semanal, feedback do mentor,
  gráfico de horas e encontros (individuais e em grupo).
- Calendário com eventos do curso + feriados nacionais (e do Pará) automáticos.
- Tema claro/escuro, menu inferior no celular, instalável como app (PWA).

**Para o administrador** (`/admin`)
- Visão geral com números da plataforma.
- Cursos, módulos e aulas (upload de capas, PDFs, reordenação, publicar/ocultar, aula grátis).
- Alunos: lista de liberação por e-mail, busca, filtros, ações em lote e importação colando do Excel.
- Turmas: definem quais cursos cada grupo acessa (ou acesso total).
- Simulados: PDF + gabarito, acompanhamento das entregas e botão **Liberar resultados**,
  que calcula a nota TRI de todos de uma vez.
- Calendário, mentoria (tarefas, feedback, encontros) e configurações (marca, textos, fundo,
  regra de acesso e administradores).

## Por que aguenta muitos acessos

- **Regras de acesso no banco (RLS):** cada consulta já volta filtrada pelo Postgres; não há
  "baixar tudo e filtrar no navegador" como no app antigo.
- **Nota TRI calculada uma única vez** no servidor quando o admin libera o resultado e gravada
  em `simulado_results`. Os alunos só leem a própria linha.
- **Escritas frequentes vão direto ao Supabase** (progresso do vídeo, respostas do simulado,
  curtidas), sem passar por função da Vercel. Progresso do vídeo é salvo a cada 15 s, e as
  respostas do simulado são agrupadas (debounce) e reenviadas se a internet cair.
- **Contadores mantidos por gatilhos** (curtidas e respostas), índices em todas as chaves usadas
  em filtro e funções de acesso avaliadas uma vez por consulta.
- **Páginas renderizadas no servidor** com pouco JavaScript no cliente, carregamento com
  skeletons e imagens comprimidas no navegador antes do upload (WebP).

## Como colocar no ar

### 1. Supabase
1. Crie um projeto em [supabase.com](https://supabase.com) (de preferência na região **São Paulo**).
2. Abra **SQL Editor**, cole todo o conteúdo de
   [`supabase/migrations/0001_schema.sql`](supabase/migrations/0001_schema.sql) e clique em **Run**.
   Isso cria tabelas, regras de segurança, gatilhos e os buckets `media` e `materials`.
3. O e-mail `luizpaulofisica@gmail.com` já vira administrador no primeiro login.
   Para outro e-mail, rode: `insert into admin_emails (email) values ('seu@email.com');`
4. **Authentication → Providers → Google**: ative e cole o Client ID/Secret do Google Cloud
   (no Google Cloud, a URL de redirecionamento autorizada é
   `https://SEU-PROJETO.supabase.co/auth/v1/callback`).
5. **Authentication → URL Configuration**:
   - *Site URL*: o domínio da Vercel (ex.: `https://seu-app.vercel.app`).
   - *Redirect URLs*: `https://seu-app.vercel.app/auth/callback` e, para previews,
     `https://*.vercel.app/auth/callback`.

### 2. Vercel
1. Importe este repositório na Vercel (framework detectado: Next.js).
2. Variáveis de ambiente (a integração Supabase da Vercel já cria as duas):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (ou `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`)
3. Em **Settings → Functions → Region**, escolha a mesma região do Supabase
   (ex.: `gru1` para São Paulo) — reduz a latência de cada página.
4. Deploy.

### 3. Primeiros passos no painel
1. Entre com o e-mail de administrador.
2. **Admin → Cursos**: crie cursos, módulos e aulas.
3. **Admin → Turmas**: crie uma turma e marque os cursos liberados.
4. **Admin → Alunos**: cadastre ou importe os e-mails dos alunos na turma.

Com "Restringir à lista de alunos" ligado (padrão), só os e-mails cadastrados, ativos e com
turma acessam conteúdo pago. Cursos ou aulas marcados como **gratuitos** ficam abertos para
qualquer pessoa logada.

## Rodar localmente

```bash
cp .env.example .env.local   # preencha com as chaves do Supabase
npm install
npm run dev                  # http://localhost:3000
```

Adicione `http://localhost:3000/auth/callback` nas *Redirect URLs* do Supabase.

## Estrutura

```
app/
  login/                tela de entrada (Google ou link mágico por e-mail)
  auth/                 callback do login e saída
  (app)/                área logada (menu lateral + barra inferior no celular)
    page.tsx            início
    cursos/ aula/       catálogo, curso e player
    simulados/          lista, prova e resultado
    duvidas/ mentoria/ calendario/ minhas-aulas/ perfil/
    admin/              painel administrativo + server actions
components/             UI, player de vídeo, uploads
lib/                    sessão, consultas, motor TRI, utilitários
supabase/migrations/    schema completo do banco
proxy.ts                renova a sessão e protege as rotas
```

## Observações
- Os dados do projeto antigo (Firebase) não são migrados automaticamente.
- O vídeo continua hospedado no YouTube (pode ser "não listado"); o player esconde a interface do
  YouTube, mas nenhuma solução baseada no YouTube impede 100% a cópia do link por alguém técnico.
