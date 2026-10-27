import { CheckCircle2, ClipboardCheck, Compass, Heart, Home, MessageCircleQuestion, Play, Target, Trophy } from 'lucide-react';
import { Logo } from '@/components/logo';

const POSTERS = [
  { t: 'Física para o ENEM', g: 'from-[#0a1530] via-[#1e3a8a] to-[#2563eb]', p: 72 },
  { t: 'Química Essencial', g: 'from-[#081226] via-[#1e1b4b] to-[#6d28d9]', p: 45 },
  { t: 'Matemática Total', g: 'from-[#03121a] via-[#134e4a] to-[#0d9488]', p: 30 },
  { t: 'Revisão Final', g: 'from-[#1a0b12] via-[#7c2d12] to-[#ea580c]', p: 0 },
  { t: 'Aulão ENEM', g: 'from-[#030712] via-[#0c4a6e] to-[#0891b2]', p: 0 },
];

function Poster({ t, g, p }: { t: string; g: string; p: number }) {
  return (
    <div className={`relative aspect-[2/3] overflow-hidden rounded-xl bg-gradient-to-br ${g} ring-1 ring-white/10`}>
      <div className="absolute inset-0 bg-[image:radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.22),transparent_55%)]" />
      <p className="absolute inset-x-2.5 bottom-3 text-[11px] leading-tight font-extrabold text-white">{t}</p>
      {p > 0 && (
        <div className="absolute inset-x-2.5 bottom-1.5 h-0.5 rounded-full bg-white/20">
          <div className="h-full rounded-full bg-white" style={{ width: `${p}%` }} />
        </div>
      )}
    </div>
  );
}

/** Prévia da plataforma (desktop) feita em HTML/CSS. */
export function DesktopMockup() {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b1120] shadow-[0_40px_120px_-20px_rgba(37,99,235,0.45)] ring-1 ring-white/5">
      <div className="flex items-center gap-1.5 border-b border-white/5 bg-[#0a0f1c] px-4 py-2.5">
        <span className="size-2.5 rounded-full bg-[#ff5f57]" />
        <span className="size-2.5 rounded-full bg-[#febc2e]" />
        <span className="size-2.5 rounded-full bg-[#28c840]" />
        <span className="mx-auto rounded-md bg-white/5 px-10 py-1 text-[10px] text-white/40">vertice.app</span>
      </div>
      <div className="flex">
        <div className="hidden w-44 shrink-0 border-r border-white/5 bg-[#0a0f1c] p-3 sm:block">
          <div className="mb-4 flex items-center gap-2 px-1 text-white">
            <Logo className="size-5" />
            <span className="text-[10px] font-extrabold tracking-wide">CURSO VÉRTICE</span>
          </div>
          {[
            [Home, 'Início', true],
            [Compass, 'Cursos'],
            [Heart, 'Minhas aulas'],
            [ClipboardCheck, 'Simulados'],
            [MessageCircleQuestion, 'Dúvidas'],
            [Target, 'Mentoria'],
          ].map(([Icon, label, active]) => {
            const I = Icon as typeof Home;
            return (
              <div key={label as string} className={`mb-0.5 flex items-center gap-2 rounded-lg px-2 py-1.5 text-[10px] font-semibold ${active ? 'bg-blue-500/15 text-blue-400' : 'text-white/50'}`}>
                <I className="size-3" /> {label as string}
              </div>
            );
          })}
        </div>
        <div className="min-w-0 flex-1 p-3 sm:p-4">
          <div className="relative overflow-hidden rounded-xl bg-[image:radial-gradient(500px_200px_at_0%_0%,#2563eb,transparent_60%),radial-gradient(400px_200px_at_100%_100%,#0891b2,transparent_60%)] bg-[#060a16] p-4 sm:p-5">
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-semibold text-white">Olá, Ana</span>
            <p className="mt-2 text-base font-extrabold text-white sm:text-xl">Física para o ENEM</p>
            <p className="text-[10px] text-white/60">Do zero à nota 800</p>
            <span className="lp-shine mt-3 inline-flex items-center gap-1 rounded-lg bg-blue-500 px-3 py-1.5 text-[10px] font-bold text-white">
              <Play className="size-3 fill-current" /> Continuar de onde parei
            </span>
          </div>
          <p className="mt-4 mb-2 text-[11px] font-bold text-white">Meus cursos</p>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
            {POSTERS.map((p, i) => (
              <div key={p.t} className={i === 4 ? 'hidden sm:block' : ''}>
                <Poster {...p} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Prévia no celular. */
export function PhoneMockup() {
  return (
    <div className="relative mx-auto w-[260px] rounded-[2.6rem] border border-white/15 bg-[#0b1120] p-2.5 shadow-[0_30px_90px_-20px_rgba(34,211,238,0.35)]">
      <div className="absolute top-3.5 left-1/2 h-5 w-20 -translate-x-1/2 rounded-full bg-black" />
      <div className="overflow-hidden rounded-[2.1rem] bg-[#070b14]">
        <div className="relative aspect-video bg-gradient-to-br from-[#0f244c] to-[#1d4ed8]">
          <div className="absolute inset-0 grid place-items-center">
            <span className="grid size-11 place-items-center rounded-full bg-white/95 text-black">
              <Play className="ml-0.5 size-4 fill-current" />
            </span>
          </div>
          <div className="absolute inset-x-3 bottom-2 h-1 rounded-full bg-white/20">
            <div className="h-full w-2/5 rounded-full bg-blue-400" />
          </div>
          <span className="absolute top-8 left-3 text-[8px] font-semibold text-white/30">ana@gmail.com</span>
        </div>
        <div className="space-y-2 p-3.5">
          <p className="text-[13px] font-extrabold text-white">Movimento uniforme</p>
          <div className="flex gap-1.5">
            <span className="flex-1 rounded-lg bg-blue-500 py-1.5 text-center text-[9px] font-bold text-white">Marcar como concluída</span>
            <span className="grid w-8 place-items-center rounded-lg bg-white/5 text-white/60">
              <Heart className="size-3" />
            </span>
          </div>
          {['Introdução à cinemática', 'Movimento uniforme', 'MUV e gráficos', 'Lançamento oblíquo'].map((t, i) => (
            <div key={t} className={`flex items-center gap-2 rounded-lg px-2 py-2 text-[10px] ${i === 1 ? 'bg-blue-500/15 font-semibold text-white' : 'text-white/60'}`}>
              {i === 0 ? <CheckCircle2 className="size-3 text-emerald-400" /> : <Play className="size-3" />}
              {t}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-4 border-t border-white/5 py-2 text-white/40">
          {[Home, Compass, ClipboardCheck, MessageCircleQuestion].map((I, i) => (
            <I key={i} className={`mx-auto size-4 ${i === 0 ? 'text-blue-400' : ''}`} />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Cartão de nota TRI com gráfico de evolução que se desenha. */
export function TriCard() {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0b1120]/90 p-5 backdrop-blur">
      <div className="flex items-start justify-between">
        <div>
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-white/50">
            <Trophy className="size-3.5 text-amber-400" /> Nota TRI estimada
          </p>
          <p className="mt-1 text-4xl font-black tracking-tight text-white tabular-nums">812,4</p>
        </div>
        <span className="lp-pop rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-bold text-emerald-400" style={{ animationDelay: '1.2s' }}>
          +64 pts
        </span>
      </div>
      <svg viewBox="0 0 300 90" className="mt-4 w-full" aria-hidden>
        <defs>
          <linearGradient id="tri-f" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#3b82f6" stopOpacity="0.35" />
            <stop offset="1" stopColor="#3b82f6" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M0 75 L50 66 L100 70 L150 48 L200 40 L250 26 L300 12 L300 90 L0 90 Z" fill="url(#tri-f)" />
        <path className="lp-draw" d="M0 75 L50 66 L100 70 L150 48 L200 40 L250 26 L300 12" fill="none" stroke="#60a5fa" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="600" strokeDashoffset="600" />
      </svg>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        {[
          ['Fáceis', '94%', 'text-emerald-400'],
          ['Médias', '71%', 'text-amber-400'],
          ['Difíceis', '38%', 'text-rose-400'],
        ].map(([l, v, c]) => (
          <div key={l} className="rounded-xl bg-white/5 py-2">
            <p className={`text-sm font-extrabold ${c}`}>{v}</p>
            <p className="text-[10px] text-white/45">{l}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
