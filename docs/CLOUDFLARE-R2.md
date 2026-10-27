# Como conectar o Cloudflare R2

O R2 guarda os **arquivos** da plataforma: capas, banners, fotos das dúvidas e PDFs das aulas e
dos simulados. O **Firebase** cuida do banco de dados e do login (veja [`FIREBASE.md`](FIREBASE.md)).

Vantagens: armazenamento barato (os primeiros 10 GB por mês são grátis) e **sem cobrança de
download**. Não importa quantos alunos baixem os PDFs ao mesmo tempo.

> Enquanto o R2 não estiver configurado, o site funciona normalmente, mas o envio de capas, PDFs
> e fotos mostra o aviso "Armazenamento não configurado" dizendo qual variável falta.

---

## Visão geral

Você vai criar **2 buckets** (pastas na nuvem):

| Bucket | Acesso | Guarda |
|---|---|---|
| `vertice-media` | **Público** (qualquer um com o link vê) | capas, banners, fotos das dúvidas |
| `vertice-materials` | **Privado** | PDFs das aulas e dos simulados |

Os PDFs só abrem por um **link temporário (1 hora)** que a plataforma gera depois de conferir que
o aluno tem acesso àquela aula ou simulado.

---

## Passo 1 — Ativar o R2

1. Entre em [dash.cloudflare.com](https://dash.cloudflare.com) (crie a conta se não tiver).
2. No menu lateral, abra **R2 Object Storage**.
3. Clique para ativar o R2. A Cloudflare pede um **cartão ou PayPal** mesmo no plano grátis;
   você só paga se passar da cota gratuita.

## Passo 2 — Criar os dois buckets

1. Em **R2 Object Storage → Create bucket**:
   - Nome: `vertice-media`
   - Location: **Automatic**
   - Clique em **Create bucket**.
2. Repita para `vertice-materials`.

## Passo 3 — Deixar o `vertice-media` público

Abra o bucket `vertice-media` → aba **Settings** → seção **Public access** e escolha **uma** opção:

- **Domínio próprio (recomendado):** em **Custom Domains → Connect Domain**, use algo como
  `arquivos.seudominio.com.br`. O domínio precisa estar na Cloudflare. Esse endereço é o seu
  `R2_PUBLIC_URL` (ex.: `https://arquivos.seudominio.com.br`).
- **Endereço r2.dev (rápido para testar):** em **R2.dev subdomain → Allow**, digite `allow` e
  confirme. Copie a URL que aparece (ex.: `https://pub-1234abcd.r2.dev`). A Cloudflare limita a
  velocidade desse endereço, então use o domínio próprio quando for para produção.

⚠️ **Não** ative acesso público no `vertice-materials`.

## Passo 4 — Liberar o envio pelo navegador (CORS)

Os arquivos vão direto do navegador para o R2. Para isso, em **cada um dos dois buckets** abra
**Settings → CORS Policy → Add CORS policy** e cole (troque pelo seu domínio):

```json
[
  {
    "AllowedOrigins": [
      "https://seu-app.vercel.app",
      "https://www.seudominio.com.br",
      "http://localhost:3000"
    ],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Salve. Se o upload der erro de "CORS" no navegador, quase sempre é o domínio que faltou aqui.

## Passo 5 — Criar a chave de acesso (API token)

1. Volte para **R2 Object Storage** (página inicial do R2).
2. Clique em **Manage API tokens** (ou "Manage R2 API Tokens") → **Create API token**.
   Se aparecer a escolha entre token de conta e de usuário, use **Account API token**.
3. Configure:
   - **Token name:** `vertice-plataforma`
   - **Permissions:** **Object Read & Write**
   - **Specify bucket(s):** *Apply to specific buckets only* → marque `vertice-media` e
     `vertice-materials`
   - TTL: *Forever*
4. Clique em **Create API Token** e **copie agora** (o segredo só aparece uma vez):
   - **Access Key ID**
   - **Secret Access Key**
5. Copie também o **Account ID**. Ele aparece na página do R2 (ou dentro do endereço
   `https://ID-DA-CONTA.r2.cloudflarestorage.com`).

## Passo 6 — Colocar as variáveis na Vercel

Na Vercel: seu projeto → **Settings → Environment Variables**. Adicione para **Production**,
**Preview** e **Development**:

| Nome | Valor |
|---|---|
| `R2_ACCOUNT_ID` | o Account ID |
| `R2_ACCESS_KEY_ID` | o Access Key ID |
| `R2_SECRET_ACCESS_KEY` | o Secret Access Key |
| `R2_BUCKET_MEDIA` | `vertice-media` |
| `R2_BUCKET_MATERIALS` | `vertice-materials` |
| `R2_PUBLIC_URL` | o endereço público do passo 3, **sem barra no final** |

Essas variáveis **não** começam com `NEXT_PUBLIC_`, então ficam só no servidor e o aluno nunca
vê as chaves.

Depois vá em **Deployments → ⋯ no último deploy → Redeploy** para valer.

## Passo 7 — Testar

1. Entre como admin → **Admin → Cursos** → edite um curso e envie uma capa.
2. No Cloudflare, abra o bucket `vertice-media` → **Objects**: o arquivo aparece em `courses/`.
3. Crie uma aula com um PDF e abra como aluno: o PDF deve abrir normalmente.
4. Abra o endereço do PDF numa aba anônima depois de 1 hora (ou sem os parâmetros `?X-Amz-…`):
   o R2 deve negar o acesso. É o comportamento esperado.

---

## Perguntas comuns

**Quanto custa?** Aproximadamente (confira no site da Cloudflare): 10 GB grátis por mês, depois
cerca de US$ 0,015 por GB/mês. Download é **grátis**. Operações têm cota gratuita grande
(milhões por mês), mais do que suficiente para uma escola.

**Meus dados precisam ficar na Europa?** Crie os buckets com jurisdição UE e adicione a
variável `R2_ENDPOINT=https://ID-DA-CONTA.eu.r2.cloudflarestorage.com`.

**Deu erro "Armazenamento indisponível"?** Confira se as 6 variáveis estão na Vercel, sem
espaços no começo ou no fim, e se o token tem permissão de leitura e escrita nos dois buckets.
