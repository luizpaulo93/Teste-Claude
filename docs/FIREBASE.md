# Como configurar o Firebase

O Firebase cuida **só do login** (Google e link por e-mail). O **banco de dados** fica no Neon
(veja [`NEON.md`](NEON.md)) e os **arquivos** no Cloudflare R2 (veja [`CLOUDFLARE-R2.md`](CLOUDFLARE-R2.md)).

São 2 variáveis do Firebase na Vercel:

| Variável | O que é | Onde pega |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_CONFIG` | Configuração pública do app | Passo 4 |
| `FIREBASE_SERVICE_ACCOUNT` | Chave secreta do servidor | Passo 5 |

---

## Passo 1 — Criar o projeto

1. Acesse [console.firebase.google.com](https://console.firebase.google.com) com sua conta Google.
2. **Criar um projeto** (ou "Adicionar projeto") → nome: `curso-vertice` → continuar.
3. Google Analytics: pode **desativar** → **Criar projeto**.

## Passo 2 — Plano (Spark ou Blaze)

O plano grátis (**Spark**) serve, mas envia só **5 e-mails de login por dia**. Opções:

- **Ficar no Spark** e usar o **login com Google** (sem limite).
- **Mudar para o Blaze** (paga conforme o uso) para os alunos entrarem pelo **link no e-mail**.
  Como o Firebase agora cuida só do login, o custo fica perto de zero. No menu inferior esquerdo:
  **Spark → Fazer upgrade → Blaze**. Crie um **alerta de orçamento** (ex.: R$ 20) em *Uso e
  faturamento → Detalhes e configurações → Alertas de orçamento*.

## Passo 3 — Ligar o login

No menu: **Criação → Authentication → Vamos começar**. Na aba **Método de login**:

1. **Google** → **Ativar** → escolha seu e-mail de suporte → **Salvar**.
2. **E-mail/senha** → **Ativar** → ative também **Link do e-mail (login sem senha)** → **Salvar**.

Depois, na aba **Configurações → Domínios autorizados → Adicionar domínio**, adicione:

- `teste-claude-lilac.vercel.app` (o endereço do seu site na Vercel)
- seu domínio próprio, se tiver (ex.: `www.cursovertice.com.br`)

Sem isso, o login dá erro de "domínio não autorizado".

> Dica: em **Configurações → Limites de cotas** dá para aumentar o limite de novas contas por
> hora por IP (100 por padrão). Útil se uma turma inteira for se cadastrar ao mesmo tempo no
> mesmo Wi-Fi.

## Passo 4 — Configuração pública (`NEXT_PUBLIC_FIREBASE_CONFIG`)

1. Clique na **engrenagem ⚙ → Configurações do projeto → Geral**.
2. Em **Seus apps**, clique no ícone **`</>`** (Web).
3. Apelido: `vertice-web` → **Registrar app** (não precisa marcar Hosting).
4. Vai aparecer um bloco assim:

   ```js
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "curso-vertice.firebaseapp.com",
     projectId: "curso-vertice",
     storageBucket: "curso-vertice.firebasestorage.app",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abc123"
   };
   ```

5. Copie **do `{` até o `}`** e cole como valor de `NEXT_PUBLIC_FIREBASE_CONFIG` na Vercel.
   (Pode colar do jeito que está; a plataforma entende.)

## Passo 5 — Chave do servidor (`FIREBASE_SERVICE_ACCOUNT`)

1. **⚙ → Configurações do projeto → Contas de serviço**.
2. Clique em **Gerar nova chave privada → Gerar chave**. Um arquivo `.json` será baixado.
3. Abra o arquivo no **Bloco de Notas**, selecione **tudo** (Ctrl + A) e copie.
4. Cole como valor de `FIREBASE_SERVICE_ACCOUNT` na Vercel.

⚠️ Esse arquivo dá acesso total ao seu projeto do Firebase. **Não envie para ninguém e não coloque no GitHub.**
Se vazar, apague a chave nessa mesma tela e gere outra.

## Passo 6 — Vercel

Em **Settings → Environments → Production → Environment Variables**:

1. **Apague** as variáveis antigas do Supabase (`NEXT_PUBLIC_SUPABASE_URL` e
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`), se existirem.
2. Adicione:
   - `NEXT_PUBLIC_FIREBASE_CONFIG` → bloco do passo 4
   - `FIREBASE_SERVICE_ACCOUNT` → JSON do passo 5
   - `DATABASE_URL` do [tutorial do Neon](NEON.md)
   - as variáveis `R2_*` do [tutorial do R2](CLOUDFLARE-R2.md)
3. **Deployments → ⋯ → Redeploy**.

Se algo estiver faltando ou colado errado, o site mostra uma página explicando exatamente o que
corrigir.

## Passo 7 — Primeiro acesso

1. Abra o site e entre com **luizpaulofisica@gmail.com** — esse e-mail vira administrador
   automaticamente.
2. No painel: crie os **cursos**, as **turmas** e cadastre os **alunos** (pelo e-mail que eles
   usam para entrar).

---

## Perguntas comuns

**O link por e-mail não chega.** Veja o spam. No plano Spark o limite é de 5 envios por dia
(passo 2). Confira também se o "Link do e-mail" está ativado (passo 3).

**"Domínio não autorizado".** Adicione o endereço do site em Authentication → Configurações →
Domínios autorizados (passo 3).

**Quanto custa?** Só o login usa o Firebase: com Google é grátis; com link por e-mail, o Blaze
cobra centavos (e só acima da cota grátis). Configure o alerta de orçamento do passo 2.

**Posso usar outro e-mail como administrador?** Sim: depois de entrar, vá em
**Admin → Configurações → Administradores** e adicione o e-mail.
