import { Atom, CheckCircle2, ClipboardCheck, Compass, Heart, Home, MessageCircleQuestion, Play, Target, Trophy } from 'lucide-react';
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
export function DesktopMockup({ bare }: { bare?: boolean } = {}) {
  return (
    <div className={bare ? 'overflow-hidden bg-[#07080c]' : 'overflow-hidden rounded-2xl border border-white/10 bg-[#07080c] shadow-[0_40px_120px_-20px_rgba(37,99,235,0.45)] ring-1 ring-white/5'}>
      <div className={bare ? 'hidden' : 'flex items-center gap-1.5 border-b border-white/5 bg-[#0b0d13] px-4 py-2.5'}>
        <span className="size-2.5 rounded-full bg-[#ff5f57]" />
        <span className="size-2.5 rounded-full bg-[#febc2e]" />
        <span className="size-2.5 rounded-full bg-[#28c840]" />
        <span className="mx-auto rounded-md bg-white/5 px-10 py-1 text-[10px] text-white/40">vertice.app</span>
      </div>
      <div className="flex">
        <div className="hidden w-44 shrink-0 border-r border-white/5 bg-[#0b0d13] p-3 sm:block">
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
          <p className="mt-4 mb-2 text-[11px] font-bold text-white">Exatas para o ENEM</p>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
            {POSTERS.map((p, i) => (
              <div key={p.t} className={i === 4 ? 'hidden sm:block' : ''}>
                <Poster {...p} />
              </div>
            ))}
          </div>
          <p className="mt-4 mb-2 text-[11px] font-bold text-white">Revisões e aulões</p>
          <div className="grid h-14 grid-cols-4 gap-2 overflow-hidden sm:grid-cols-5">
            {[...POSTERS].reverse().map((p, i) => (
              <div key={p.t} className={i === 4 ? 'hidden sm:block' : ''}>
                <Poster {...p} t="" p={0} />
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

/** Tela inicial do app no celular (boas-vindas + aulões ao vivo). */
export function PhoneHomeMockup() {
  return (
    <div className="relative w-[230px] rounded-[2.4rem] border border-white/20 bg-[#0b0d13] p-2 shadow-[0_30px_80px_-10px_rgba(0,0,0,0.8)] ring-1 ring-white/10 sm:w-[250px]">
      <div className="absolute top-3 left-1/2 z-10 h-5 w-20 -translate-x-1/2 rounded-full bg-black" />
      <div className="overflow-hidden rounded-[2rem] bg-[#07080c]">
        <div className="relative h-[250px] bg-[image:radial-gradient(260px_200px_at_70%_20%,#3b82f6,transparent_70%),radial-gradient(240px_180px_at_10%_90%,#0891b2,transparent_70%)] bg-[#0a1020]">
          <div className="absolute top-9 left-4 flex items-center gap-1.5 text-white">
            <Logo className="size-4" />
            <span className="text-[9px] font-extrabold tracking-wide">VÉRTICE</span>
          </div>
          <div className="absolute top-14 right-3 grid size-16 place-items-center rounded-full bg-white/10 text-white/80 ring-1 ring-white/20 backdrop-blur">
            <Atom className="size-8" />
          </div>
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#07080c] via-[#07080c]/70 to-transparent px-4 pt-10 pb-3 text-center">
            <p className="text-[13px] font-extrabold text-white">Seja bem-vindo ao Vértice</p>
            <p className="mt-1 text-[9px] text-white/60">Tudo o que você precisa para gabaritar exatas no ENEM</p>
            <span className="mt-2.5 inline-block rounded-full bg-blue-500 px-4 py-1.5 text-[9px] font-bold text-white">Comece por aqui</span>
            <div className="mt-2 flex justify-center gap-1">
              <span className="h-1 w-3 rounded-full bg-white" />
              <span className="size-1 rounded-full bg-white/40" />
              <span className="size-1 rounded-full bg-white/40" />
            </div>
          </div>
        </div>
        <div className="px-3 pt-2 pb-3">
          <p className="mb-2 text-[10px] font-bold text-white">Aulões ao vivo</p>
          <div className="grid grid-cols-2 gap-2">
            {['AULÃO 1', 'AULÃO 2'].map((t, i) => (
              <div key={t} className={`relative aspect-[3/4] overflow-hidden rounded-xl bg-gradient-to-b ${i ? 'from-indigo-600 to-violet-800' : 'from-blue-600 to-cyan-700'}`}>
                {i === 0 && <span className="absolute top-1.5 left-1.5 rounded bg-rose-500 px-1.5 py-0.5 text-[7px] font-bold text-white">AO VIVO</span>}
                <p className="absolute inset-x-0 bottom-2 text-center text-[11px] font-black text-white">{t}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Notebook com a plataforma + celular sobreposto. */
export function LaptopPhoneMockup() {
  return (
    <div className="relative mx-auto max-w-5xl pb-10 sm:pr-24">
      <div className="relative mx-auto w-full max-w-[860px]">
        <div className="rounded-t-[1.4rem] border border-white/15 bg-[#0d0f14] p-2.5 pb-3 shadow-[0_50px_120px_-30px_rgba(59,130,246,0.45)] sm:p-3.5">
          <div className="overflow-hidden rounded-lg">
            <DesktopMockup bare />
          </div>
        </div>
        <div className="relative mx-[-4%] h-4 rounded-b-2xl bg-gradient-to-b from-[#d4d7de] to-[#8b909b] sm:h-5">
          <div className="absolute top-0 left-1/2 h-1.5 w-24 -translate-x-1/2 rounded-b-lg bg-[#9aa0aa]" />
        </div>
      </div>
      <div className="absolute right-0 bottom-0 origin-bottom-right scale-[0.62] sm:right-2 sm:scale-90 lg:scale-100">
        <PhoneHomeMockup />
      </div>
    </div>
  );
}

/** Ícone do Vértice na tela inicial sendo tocado, com raios de luz. */
export function AppIconTap() {
  return (
    <div className="relative mx-auto grid size-72 place-items-center sm:size-80">
      <div className="lp-rays-spin absolute inset-0">
        <div className="lp-rays absolute inset-0">
          {Array.from({ length: 28 }, (_, i) => (
            <span
              key={i}
              className="absolute top-1/2 left-1/2 h-[2px] w-6 origin-left rounded-full bg-gradient-to-r from-blue-300/0 to-blue-200"
              style={{ transform: `rotate(${(360 / 28) * i}deg) translateX(${i % 2 ? 108 : 118}px)` }}
            />
          ))}
        </div>
      </div>
      <div className="pointer-events-none absolute size-56 rounded-full bg-blue-600/25 blur-3xl" />
      <div className="relative flex flex-col items-center">
        <div className="lp-tap-icon relative grid size-28 place-items-center rounded-[1.9rem] bg-gradient-to-br from-blue-500 via-indigo-500 to-violet-600 text-white shadow-[0_0_60px_rgba(99,102,241,0.75)] ring-1 ring-white/30 sm:size-32">
          <Logo className="size-16 sm:size-[4.5rem]" />
          <span className="lp-tap-ripple absolute top-1/2 left-1/2 -mt-6 -ml-6 size-12 rounded-full border-2 border-white/80" />
        </div>
        <p className="mt-4 text-lg font-bold tracking-wide text-white">VÉRTICE</p>
        <span className="lp-tap-finger pointer-events-none absolute top-1/2 left-1/2 size-12 rounded-full border-2 border-white/90 bg-white/35 shadow-[0_0_25px_rgba(255,255,255,0.6)] backdrop-blur-sm" />
      </div>
    </div>
  );
}
