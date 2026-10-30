'use client';

import { Check, Copy, ExternalLink } from 'lucide-react';
import { useState } from 'react';

function CopyBox({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(text);
        setOk(true);
        setTimeout(() => setOk(false), 1500);
      }}
      className="mt-1 flex w-full items-center gap-2 rounded-lg border border-line bg-bg-elev px-2.5 py-1.5 text-left font-mono text-[11px] break-all text-ink"
    >
      <span className="min-w-0 flex-1">{text}</span>
      {ok ? <Check className="size-3.5 shrink-0 text-success" /> : <Copy className="size-3.5 shrink-0 text-muted" />}
    </button>
  );
}

const A = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 font-semibold text-brand">
    {children} <ExternalLink className="size-3" />
  </a>
);

/** Passo a passo para criar GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET e conectar o canal. */
export function YoutubeGuide({ origin, open }: { origin: string; open?: boolean }) {
  const steps: { title: string; body: React.ReactNode }[] = [
    {
      title: 'Crie um projeto no Google Cloud',
      body: (
        <>
          Entre em <A href="https://console.cloud.google.com/projectcreate">console.cloud.google.com</A> com a <strong>mesma conta Google do canal</strong>. Crie um
          projeto (ex.: “Curso Vértice”). Não precisa cadastrar cartão.
        </>
      ),
    },
    {
      title: 'Ative a YouTube Data API v3',
      body: (
        <>
          Abra <A href="https://console.cloud.google.com/apis/library/youtube.googleapis.com">YouTube Data API v3</A> (com o projeto selecionado no topo) e toque em{' '}
          <strong>Ativar</strong>.
        </>
      ),
    },
    {
      title: 'Configure a tela de consentimento',
      body: (
        <>
          Em <A href="https://console.cloud.google.com/auth/overview">Google Auth Platform</A>, toque em <strong>Começar</strong>: nome do app “Curso Vértice”, seu e-mail de
          suporte, público <strong>Externo</strong>, e-mail de contato e concordar. Depois, em <strong>Público</strong>, toque em <strong>Publicar app</strong> (fica “Em
          produção”). Sem isso, a conexão com o YouTube cai a cada 7 dias.
        </>
      ),
    },
    {
      title: 'Crie o cliente OAuth (o ID e a chave secreta)',
      body: (
        <>
          Em <A href="https://console.cloud.google.com/auth/clients">Clientes</A> → <strong>Criar cliente</strong> → tipo <strong>Aplicativo da Web</strong>. Em
          <strong> Origens JavaScript autorizadas</strong>, cole:
          <CopyBox text={origin} />
          Em <strong>URIs de redirecionamento autorizados</strong>, cole:
          <CopyBox text={`${origin}/api/youtube/callback`} />
          Toque em <strong>Criar</strong> e copie o <strong>ID do cliente</strong> e a <strong>Chave secreta do cliente</strong>. Guarde a chave: ela é mostrada uma vez só.
        </>
      ),
    },
    {
      title: 'Coloque as duas chaves na Vercel',
      body: (
        <>
          No <A href="https://vercel.com/dashboard">painel da Vercel</A>, abra o projeto → <strong>Settings</strong> → <strong>Environment Variables</strong> e crie:
          <CopyBox text="GOOGLE_CLIENT_ID" />
          com o ID do cliente, e
          <CopyBox text="GOOGLE_CLIENT_SECRET" />
          com a chave secreta (marque Production e Preview). Depois vá em <strong>Deployments</strong> → no último, <strong>⋯ → Redeploy</strong>. As chaves só valem depois
          disso.
        </>
      ),
    },
    {
      title: 'Ative as lives no seu canal',
      body: (
        <>
          No <A href="https://studio.youtube.com">YouTube Studio</A>, toque em <strong>Criar → Transmitir ao vivo</strong>. Na primeira vez o YouTube pede a verificação do
          canal por telefone, e a liberação pode levar até 24 horas.
        </>
      ),
    },
    {
      title: 'Conecte aqui',
      body: (
        <>
          Volte nesta página e toque em <strong>Conectar conta do YouTube</strong>. Escolha a conta do canal. Se aparecer “O Google não verificou este app”, toque em{' '}
          <strong>Avançado → Acessar Curso Vértice</strong> (é o seu próprio app) e permita o acesso.
        </>
      ),
    },
  ];
  return (
    <details className="group rounded-xl border border-line" open={open}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-sm font-semibold text-ink select-none [&::-webkit-details-marker]:hidden">
        Como configurar (passo a passo)
        <span className="text-xs text-brand group-open:hidden">Abrir</span>
      </summary>
      <ol className="space-y-3 px-3 pb-3">
        {steps.map((s, i) => (
          <li key={s.title} className="flex gap-2.5">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand/12 text-[11px] font-bold text-brand">{i + 1}</span>
            <div className="min-w-0 text-xs leading-relaxed text-ink-2">
              <p className="mb-0.5 text-[13px] font-bold text-ink">{s.title}</p>
              {s.body}
            </div>
          </li>
        ))}
      </ol>
    </details>
  );
}
