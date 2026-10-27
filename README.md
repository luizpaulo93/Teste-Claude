# Vértice — Área de Membros

Plataforma de área de membros para cursos (Enem e vestibulares), inspirada no projeto
[MemberClass — Vértice](https://github.com/luizpaulo93/MemberClass---V-rtice), feita para rodar na
**Vercel** com **Firebase** (login e banco) e **Cloudflare R2** (arquivos), com foco em
velocidade, design responsivo e muitos acessos simultâneos.

**Stack:** Next.js 16 (App Router, Server Components, Server Actions) · React 19 · TypeScript ·
Tailwind CSS 4 · Firebase Auth + Firestore · Cloudflare R2.

## O que tem

**Para o aluno**
- Página de apresentação para visitantes, com botão **Entrar** no canto que abre o login.
- Login com **Google** ou **link por e-mail** (sem senha).
- Início no estilo streaming: abertura em tela cheia com carrossel dos destaques, "continuar
  assistindo" e fileiras de capas por categoria.
- Cursos → módulos → aulas, com player próprio sobre o YouTube (controles personalizados,
  velocidade, atalhos, tela cheia inclusive no iPhone, marca d'água com nome/e-mail e retomada
  de onde parou), comentários em cada aula e PDFs privados (link temporário de 1 hora).
- Favoritas e histórico de aulas concluídas.
- Simulados no padrão ENEM: caderno em PDF, cartão-resposta com salvamento automático,
  cronômetro com entrega automática e nota estimada pela TRI.
- **Aulas ao vivo** pelo YouTube (não listado) com chat da turma em tempo real.
- Fórum de dúvidas com fotos, curtidas e respostas; mentoria individual; calendário com feriados.
- Tema claro/escuro, menu inferior no celular e botão **Instalar aplicativo**.

**Para o administrador** (`/admin`): visão geral, cursos/módulos/aulas, alunos (importação do
Excel e ações em lote), turmas, aulas ao vivo, simulados (liberação da nota TRI), calendário,
mentoria e configurações.

## Por que aguenta muitos acessos

- **Catálogo em cache no servidor:** cursos, aulas, turmas e configurações ficam em cache e só
  são relidos quando o admin muda algo. Mil alunos abrindo a página inicial não viram mil
  leituras no banco.
- **Escritas frequentes vão direto do navegador ao Firestore** (progresso do vídeo, favoritos),
  protegidas pelas regras de segurança, sem passar pela Vercel.
- **Chat e status das lives em tempo real** pelo Firestore (sem ficar consultando o servidor).
- **Nota TRI calculada uma única vez** quando o admin libera o resultado.
- **Arquivos vão direto do navegador para o R2** e o download do R2 não é cobrado.

## Como colocar no ar

1. **Firebase** (login e banco): siga [`docs/FIREBASE.md`](docs/FIREBASE.md).
2. **Cloudflare R2** (arquivos): siga [`docs/CLOUDFLARE-R2.md`](docs/CLOUDFLARE-R2.md).
3. **Vercel:** importe este repositório e cadastre as variáveis em
   **Settings → Environments → Production → Environment Variables**:

   | Variável | Onde pega |
   |---|---|
   | `NEXT_PUBLIC_FIREBASE_CONFIG` | Firebase, passo 5 |
   | `FIREBASE_SERVICE_ACCOUNT` | Firebase, passo 6 |
   | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | R2, passo 5 |
   | `R2_BUCKET_MEDIA`, `R2_BUCKET_MATERIALS`, `R2_PUBLIC_URL` | R2, passos 2 e 3 |

   Depois: **Deployments → ⋯ → Redeploy**. Se algo estiver errado, o site mostra uma página
   dizendo exatamente qual variável corrigir.
4. Entre com **luizpaulofisica@gmail.com** (vira administrador automaticamente), crie cursos e
   turmas e cadastre os e-mails dos alunos.

Com "Restringir à lista de alunos" ligado (padrão), só os e-mails cadastrados, ativos e com turma
acessam conteúdo pago. Cursos ou aulas marcados como **gratuitos** ficam abertos para qualquer
pessoa logada.

## Aulas ao vivo (YouTube não listado)

1. No YouTube Studio, crie a transmissão como **Não listado**, com **Permitir incorporação**
   ligado e "Conteúdo para crianças" desligado.
2. No painel: **Admin → Ao vivo → Agendar transmissão**, cole o link e escolha quem assiste.
3. Na hora, clique em **Iniciar**; ao terminar, **Encerrar** (vira gravação se você quiser).

O link do vídeo só é entregue a quem tem acesso. Como em qualquer vídeo não listado, alguém com
acesso ainda poderia copiar o link — por isso o player mostra o nome e o e-mail do aluno.

## Rodar localmente

```bash
cp .env.example .env.local   # preencha com os dados do Firebase e do R2
npm install
npm run dev                  # http://localhost:3000
```

Adicione `localhost` em Firebase → Authentication → Configurações → Domínios autorizados.

## Estrutura

```
app/
  site/                 página de apresentação (visitantes)
  login/                entrar (Google ou link por e-mail) e /login/finalizar
  api/session/          cria o cookie de sessão a partir do login do Firebase
  api/storage/          URLs assinadas do R2 (upload e download)
  (app)/                área logada: início, cursos, aula, simulados, ao vivo, dúvidas,
                        mentoria, calendário, perfil e admin (+ server actions)
components/             UI, player de vídeo, uploads
lib/                    sessão, Firebase (cliente e admin), cache do catálogo, TRI, R2
firestore.rules         regras de segurança do Firestore
proxy.ts                protege as rotas que exigem login
```
