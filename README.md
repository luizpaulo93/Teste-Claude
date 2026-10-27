# Vértice — Área de Membros

Plataforma de área de membros para cursos (Enem e vestibulares), inspirada no projeto
[MemberClass — Vértice](https://github.com/luizpaulo93/MemberClass---V-rtice), reconstruída para
**Supabase + Vercel**, com foco em velocidade, design responsivo e muitos acessos simultâneos.

**Stack:** Next.js 16 (App Router, Server Components, Server Actions) · React 19 · TypeScript ·
Tailwind CSS 4 · Supabase (Postgres, Auth, RLS) · Cloudflare R2 (arquivos).

## O que tem

**Para o aluno**
- Início estilo streaming: destaque, "continuar assistindo", trilhos de cursos com progresso.
- Cursos → módulos → aulas, com player próprio sobre o YouTube (controles personalizados,
  velocidade, atalhos de teclado, tela cheia inclusive no iPhone, marca d'água com nome/e-mail
  e retomada de onde parou).
- PDFs das aulas em bucket privado no Cloudflare R2 (link temporário assinado de 1 hora).
- Favoritas e histórico de aulas concluídas.
- Simulados no padrão ENEM: caderno em PDF, cartão-resposta com salvamento automático,
  cronômetro com entrega automática, nota estimada pela TRI, coerência pedagógica,
  desempenho por dificuldade, comparativo com a turma e gráfico de evolução.
- Fórum de dúvidas com fotos, curtidas, respostas e selo de professor.
- Mentoria individual: plano semanal de tarefas, check-in semanal, feedback do mentor,
  gráfico de horas e encontros (individuais e em grupo).
- Calendário com eventos do curso + feriados nacionais (e do Pará) automáticos.
- Início no estilo streaming: abertura em tela cheia com carrossel dos cursos em destaque e
  fileiras de capas por categoria.
- Comentários em cada aula.
- **Aulas ao vivo** pelo YouTube (não listado): contagem regressiva, player com selo AO VIVO,
  chat da turma e gravação depois. Só alunos com acesso ao curso escolhido veem a live.
- Tema claro/escuro, menu inferior no celular e botão **Instalar aplicativo** (ícone do Vértice
  na tela inicial do celular; no iPhone mostra o passo a passo).
- Página de apresentação para visitantes, com botão **Entrar** no canto que abre o login.

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
   Depois rode também [`0002_lesson_comments.sql`](supabase/migrations/0002_lesson_comments.sql)
   (comentários nas aulas) e [`0003_live_sessions.sql`](supabase/migrations/0003_live_sessions.sql)
   (aulas ao vivo).
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

### 3. Cloudflare R2 (arquivos)
Siga o passo a passo em [`docs/CLOUDFLARE-R2.md`](docs/CLOUDFLARE-R2.md): criar os buckets
`vertice-media` (público) e `vertice-materials` (privado), liberar CORS, gerar a chave e cadastrar
as variáveis `R2_*` na Vercel. Sem elas, a plataforma usa o Supabase Storage.

### 4. Primeiros passos no painel
1. Entre com o e-mail de administrador.
2. **Admin → Cursos**: crie cursos, módulos e aulas.
3. **Admin → Turmas**: crie uma turma e marque os cursos liberados.
4. **Admin → Alunos**: cadastre ou importe os e-mails dos alunos na turma.

Com "Restringir à lista de alunos" ligado (padrão), só os e-mails cadastrados, ativos e com
turma acessam conteúdo pago. Cursos ou aulas marcados como **gratuitos** ficam abertos para
qualquer pessoa logada.

## Aulas ao vivo (YouTube não listado)

1. No YouTube Studio, crie a transmissão como **Não listado**, com **Permitir incorporação**
   ligado e "Conteúdo para crianças" desligado (senão o YouTube bloqueia o player e o chat).
2. No painel: **Admin → Ao vivo → Agendar transmissão**, cole o link da live e escolha quem
   pode assistir (todos os alunos liberados ou só as turmas de um curso).
3. Na hora, clique em **Iniciar**. Os alunos veem o selo AO VIVO no menu e na tela inicial.
4. Ao terminar, clique em **Encerrar**. Com "Mostrar gravação" ligado, a live vira replay.

O link do vídeo só é entregue a quem tem acesso (regra no banco). Como em qualquer vídeo não
listado do YouTube, alguém com acesso ainda poderia copiar o link — por isso o player mostra o
nome e o e-mail do aluno como marca d'água.

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
