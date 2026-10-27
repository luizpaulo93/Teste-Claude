# Como configurar o Firebase

O Firebase cuida do **login** (Google e link por e-mail) e do **banco de dados** (Firestore).
Os **arquivos** (capas, PDFs, fotos) ficam no Cloudflare R2 — veja [`CLOUDFLARE-R2.md`](CLOUDFLARE-R2.md).

São 2 variáveis do Firebase na Vercel:

| Variável | O que é | Onde pega |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_CONFIG` | Configuração pública do app | Passo 5 |
| `FIREBASE_SERVICE_ACCOUNT` | Chave secreta do servidor | Passo 6 |

---

## Passo 1 — Criar o projeto

1. Acesse [console.firebase.google.com](https://console.firebase.google.com) com sua conta Google.
2. **Criar um projeto** (ou "Adicionar projeto") → nome: `curso-vertice` → continuar.
3. Google Analytics: pode **desativar** → **Criar projeto**.

## Passo 2 — Plano Blaze (recomendado)

No plano grátis (**Spark**) o Firebase envia só **5 e-mails de login por dia**. Para os alunos
entrarem pelo **link no e-mail**, mude para o **Blaze** (paga conforme o uso):

- No menu inferior esquerdo, clique em **Spark → Fazer upgrade → Blaze** e cadastre um cartão.
- Você continua com a **cota grátis** (ex.: 50 mil leituras e 20 mil gravações por dia no
  Firestore, 25 mil e-mails de login por dia) e só paga o que passar disso.
- Crie um **alerta de orçamento** (ex.: R$ 20) em *Uso e faturamento → Detalhes e
  configurações → Alertas de orçamento* para nunca ter surpresa.

> Se preferir ficar no Spark, tudo funciona, mas use **só o login com Google** (sem limite).

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

## Passo 4 — Criar o banco (Firestore)

1. No menu: **Criação → Firestore Database → Criar banco de dados**.
2. Local: **southamerica-east1 (São Paulo)** — não dá para mudar depois.
3. Modo: **produção** → **Criar**.
4. Abra a aba **Regras**, apague tudo, cole o conteúdo do arquivo
   [`firestore.rules`](../firestore.rules) deste repositório e clique em **Publicar**.

As regras deixam o navegador do aluno gravar só o **próprio progresso e favoritos** e ler o
**chat das lives**. Todo o resto passa pelo servidor, que confere as permissões.

## Passo 5 — Configuração pública (`NEXT_PUBLIC_FIREBASE_CONFIG`)

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

## Passo 6 — Chave do servidor (`FIREBASE_SERVICE_ACCOUNT`)

1. **⚙ → Configurações do projeto → Contas de serviço**.
2. Clique em **Gerar nova chave privada → Gerar chave**. Um arquivo `.json` será baixado.
3. Abra o arquivo no **Bloco de Notas**, selecione **tudo** (Ctrl + A) e copie.
4. Cole como valor de `FIREBASE_SERVICE_ACCOUNT` na Vercel.

⚠️ Esse arquivo dá acesso total ao banco. **Não envie para ninguém e não coloque no GitHub.**
Se vazar, apague a chave nessa mesma tela e gere outra.

## Passo 7 — Vercel

Em **Settings → Environments → Production → Environment Variables**:

1. **Apague** as variáveis antigas do Supabase (`NEXT_PUBLIC_SUPABASE_URL` e
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`), se existirem.
2. Adicione:
   - `NEXT_PUBLIC_FIREBASE_CONFIG` → bloco do passo 5
   - `FIREBASE_SERVICE_ACCOUNT` → JSON do passo 6
   - as variáveis `R2_*` do [tutorial do R2](CLOUDFLARE-R2.md)
3. **Deployments → ⋯ → Redeploy**.

Se algo estiver faltando ou colado errado, o site mostra uma página explicando exatamente o que
corrigir.

## Passo 8 — Primeiro acesso

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

**Quanto custa?** Para uma escola, normalmente fica dentro da cota grátis. O catálogo de cursos
fica em cache no servidor, então mil alunos abrindo a página inicial não viram mil leituras no
banco. Configure o alerta de orçamento do passo 2.

**Posso usar outro e-mail como administrador?** Sim: depois de entrar, vá em
**Admin → Configurações → Administradores** e adicione o e-mail.
