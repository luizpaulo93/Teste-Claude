import {
  ArrowRight,
  Atom,
  BellRing,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  FlaskConical,
  MessageCircleQuestion,
  PlayCircle,
  Ruler,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Target,
  Zap,
} from 'lucide-react';
import type { Metadata } from 'next';
import { AnimatedBubbles, Counter, LandingNav, LandingRoot, LoginButton } from '@/components/landing/interactive';
import { AppIconTap, DesktopMockup, LaptopPhoneMockup, TriCard } from '@/components/landing/mockups';
import { Logo } from '@/components/logo';
import { getSettings } from '@/lib/session';

export const metadata: Metadata = {
  title: 'Curso Vértice — Física, Química e Matemática para o ENEM',
  description: 'Aulas, simulados com nota TRI, mentoria e plantão de dúvidas em uma plataforma feita para a sua aprovação.',
};

const TOPICS = [
  'Cinemática', 'Leis de Newton', 'Eletrodinâmica', 'Termologia', 'Óptica', 'Ondulatória',
  'Estequiometria', 'Química Orgânica', 'Soluções', 'Eletroquímica', 'Funções', 'Geometria Plana',
  'Probabilidade', 'Estatística', 'Trigonometria', 'Porcentagem',
];

const FEATURES = [
  { icon: PlayCircle, title: 'Aulas em vídeo sem distrações', text: 'Player próprio com velocidade ajustável, retomada de onde você parou e progresso salvo em cada aula.', span: 'lg:col-span-2' },
  { icon: ClipboardCheck, title: 'Simulados com nota TRI', text: 'Provas no padrão ENEM com cronômetro, cartão-resposta e nota estimada como a do INEP.' },
  { icon: Target, title: 'Mentoria individual', text: 'Plano semanal, check-ins e feedback do professor para manter sua rotina no trilho.' },
  { icon: MessageCircleQuestion, title: 'Plantão de dúvidas', text: 'Mande foto da questão e receba a explicação do professor. Ajude e aprenda com a turma.' },
  { icon: FileText, title: 'Materiais em PDF', text: 'Listas, resumos e mapas mentais organizados junto de cada aula.' },
  { icon: CalendarDays, title: 'Calendário de estudos', text: 'Assunto da semana, datas de simulados e revisões em um só lugar.', span: 'lg:col-span-2' },
];

const SUBJECTS = [
  { icon: Atom, name: 'Física', color: 'from-blue-500 to-indigo-500', topics: ['Mecânica', 'Eletricidade', 'Termologia', 'Óptica e ondas'] },
  { icon: FlaskConical, name: 'Química', color: 'from-violet-500 to-fuchsia-500', topics: ['Química geral', 'Físico-química', 'Orgânica', 'Química ambiental'] },
  { icon: Ruler, name: 'Matemática', color: 'from-cyan-500 to-teal-500', topics: ['Matemática básica', 'Funções', 'Geometria', 'Estatística e probabilidade'] },
];

const FAQ = [
  ['Como acesso a plataforma?', 'Clique em “Entrar” e use sua conta Google ou receba um link de acesso no seu e-mail. Não precisa decorar senha.'],
  ['Posso estudar pelo celular?', 'Sim. A plataforma foi pensada primeiro para o celular e também pode ser instalada na tela inicial como um aplicativo.'],
  ['Como funciona a nota TRI dos simulados?', 'Depois que a turma entrega a prova, calculamos sua nota com base na dificuldade de cada questão e na coerência das suas respostas — o mesmo princípio usado no ENEM.'],
  ['Já sou aluno, mas não consigo ver as aulas.', 'Seu acesso é liberado pelo e-mail cadastrado na matrícula. Entre com esse mesmo e-mail ou fale com a coordenação.'],
  ['Existe conteúdo gratuito?', 'Sim. Ao entrar você já encontra aulas abertas para conhecer a metodologia do Vértice.'],
];

export default async function LandingPage() {
  const settings = await getSettings();
  const brand = settings.brand_name || 'CURSO VÉRTICE';

  return (
    <div data-theme="dark" className="min-h-dvh overflow-x-hidden bg-[#050912] text-white" id="topo">
      <LandingRoot brand={brand}>
        <LandingNav brand={brand} />

        {/* HERO */}
        <section className="relative pt-28 pb-16 sm:pt-36 lg:pb-24">
          <div className="lp-grid-bg pointer-events-none absolute inset-0" />
          <div className="lp-orb pointer-events-none absolute -top-40 left-[10%] size-[520px] rounded-full bg-blue-600/30 blur-[120px]" />
          <div className="lp-orb pointer-events-none absolute top-20 right-[5%] size-[420px] rounded-full bg-cyan-500/20 blur-[120px]" style={{ animationDelay: '-6s' }} />
          <div className="lp-orb pointer-events-none absolute top-[420px] left-[40%] size-[380px] rounded-full bg-violet-600/20 blur-[120px]" style={{ animationDelay: '-12s' }} />

          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-4xl text-center">
              <div className="animate-slide-up inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-semibold text-white/80 backdrop-blur">
                <span className="lp-ping relative inline-block size-2 rounded-full text-emerald-400">
                  <span className="relative block size-2 rounded-full bg-emerald-400" />
                </span>
                Especialista em Física, Química e Matemática
              </div>
              <h1 className="animate-slide-up mt-6 text-[2.6rem] leading-[1.05] font-extrabold tracking-tight sm:text-6xl lg:text-7xl" style={{ animationDelay: '80ms' }}>
                Sua aprovação no ENEM
                <br className="hidden sm:block" /> começa no <span className="lp-gradient-text">Vértice</span>
              </h1>
              <p className="animate-slide-up mx-auto mt-6 max-w-2xl text-base text-white/65 sm:text-lg" style={{ animationDelay: '160ms' }}>
                {settings.hero_subtitle && settings.hero_subtitle !== 'Especialista em física, química e matemática'
                  ? settings.hero_subtitle
                  : 'Aulas objetivas, simulados com nota TRI, mentoria individual e plantão de dúvidas — tudo em uma plataforma rápida, bonita e feita para você estudar de verdade.'}
              </p>
              <div className="animate-slide-up mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row" style={{ animationDelay: '240ms' }}>
                <LoginButton size="lg" className="lp-shine h-13 w-full rounded-full px-8 text-base sm:w-auto">
                  Acessar a plataforma <ArrowRight className="size-4" />
                </LoginButton>
                <a href="#recursos" className="inline-flex h-13 w-full items-center justify-center gap-2 rounded-full border border-white/15 px-8 text-base font-semibold text-white/90 transition hover:bg-white/5 sm:w-auto">
                  Conhecer os recursos
                </a>
              </div>
              <div className="animate-slide-up mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-white/50" style={{ animationDelay: '320ms' }}>
                <span className="flex items-center gap-1.5"><CheckCircle2 className="size-3.5 text-emerald-400" /> Acesso pelo Google</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 className="size-3.5 text-emerald-400" /> Funciona no celular</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 className="size-3.5 text-emerald-400" /> Aulas gratuitas para conhecer</span>
              </div>
            </div>

            {/* Prévia */}
            <div className="relative mx-auto mt-16 max-w-5xl sm:mt-20">
              <div className="lp-mockup">
                <DesktopMockup />
              </div>
              <div className="lp-float absolute top-[18%] -left-2 hidden rounded-2xl border border-white/10 bg-[#0b1120]/90 p-3.5 shadow-2xl backdrop-blur md:block lg:-left-14">
                <p className="flex items-center gap-2 text-xs font-bold text-white">
                  <span className="grid size-7 place-items-center rounded-lg bg-emerald-500/15 text-emerald-400"><CheckCircle2 className="size-4" /></span>
                  Aula concluída!
                </p>
                <p className="mt-1 pl-9 text-[11px] text-white/50">Leis de Newton · 27 min</p>
              </div>
              <div className="lp-float-slow absolute -right-2 bottom-[16%] hidden rounded-2xl border border-white/10 bg-[#0b1120]/90 p-3.5 shadow-2xl backdrop-blur md:block lg:-right-14">
                <p className="text-[11px] font-semibold text-white/50">Simulado CN · nota TRI</p>
                <p className="text-2xl font-black text-white">
                  <Counter to={786} />
                </p>
                <div className="mt-1.5 h-1.5 w-36 rounded-full bg-white/10">
                  <div className="h-full w-[78%] rounded-full bg-gradient-to-r from-blue-500 to-cyan-400" />
                </div>
              </div>
              <div className="lp-float absolute -top-6 right-[12%] hidden rounded-2xl border border-white/10 bg-[#0b1120]/90 px-3.5 py-3 shadow-2xl backdrop-blur lg:block" style={{ animationDelay: '-3s' }}>
                <p className="flex items-center gap-2 text-xs font-bold text-white">
                  <BellRing className="size-4 text-amber-400" /> Professor respondeu sua dúvida
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Marquee de conteúdos */}
        <section className="border-y border-white/5 bg-white/[0.02] py-6" aria-label="Conteúdos">
          <div className="relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_12%,black_88%,transparent)]">
            <div className="lp-marquee flex w-max gap-3">
              {[...TOPICS, ...TOPICS].map((t, i) => (
                <span key={i} className="shrink-0 rounded-full border border-white/10 bg-white/[0.03] px-5 py-2 text-sm font-medium text-white/60">
                  {t}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Números */}
        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              { v: 3, s: '', l: 'disciplinas com especialista' },
              { v: 45, s: '', l: 'questões por simulado, como no ENEM' },
              { v: 100, s: '%', l: 'online, no celular ou computador' },
              { v: 24, s: 'h', l: 'por dia para estudar no seu ritmo' },
            ].map((n, i) => (
              <div key={n.l} data-reveal style={{ ['--d' as string]: `${i * 90}ms` }} className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-center">
                <p className="lp-gradient-text text-4xl font-black sm:text-5xl">
                  <Counter to={n.v} suffix={n.s} />
                </p>
                <p className="mt-2 text-sm text-white/55">{n.l}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Recursos (bento) */}
        <section id="recursos" className="relative mx-auto max-w-7xl scroll-mt-24 px-4 pb-24 sm:px-6 lg:px-8">
          <SectionHead eyebrow="Recursos" title="Tudo o que você precisa para ir além" text="Uma plataforma pensada para você estudar mais, com menos distração." />
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f, i) => (
              <div
                key={f.title}
                data-reveal
                style={{ ['--d' as string]: `${(i % 4) * 80}ms` }}
                className={`lp-card-glow group rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.01] p-6 transition-transform duration-300 hover:-translate-y-1 ${f.span ?? ''}`}
              >
                <div className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-blue-500/25 to-cyan-400/10 text-blue-300 ring-1 ring-white/10 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
                  <f.icon className="size-6" />
                </div>
                <h3 className="mt-5 text-lg font-bold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/55">{f.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Disciplinas */}
        <section id="disciplinas" className="relative scroll-mt-24 overflow-hidden py-24">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionHead eyebrow="Disciplinas" title="Especialistas nas matérias que mais pesam" text="Do básico ao nível das questões mais difíceis, com teoria clara e muita resolução de exercícios." />
            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {SUBJECTS.map((s, i) => (
                <div key={s.name} data-reveal style={{ ['--d' as string]: `${i * 120}ms` }} className="lp-card-glow group relative overflow-hidden rounded-3xl border border-white/10 bg-[#0b1120] p-7">
                  <div className={`pointer-events-none absolute -top-24 -right-24 size-56 rounded-full bg-gradient-to-br ${s.color} opacity-20 blur-3xl transition-opacity duration-500 group-hover:opacity-40`} />
                  <div className={`relative grid size-14 place-items-center rounded-2xl bg-gradient-to-br ${s.color} shadow-lg`}>
                    <s.icon className="size-7 text-white" />
                  </div>
                  <h3 className="relative mt-6 text-2xl font-extrabold">{s.name}</h3>
                  <ul className="relative mt-4 space-y-2.5">
                    {s.topics.map((t) => (
                      <li key={t} className="flex items-center gap-2.5 text-sm text-white/65">
                        <CheckCircle2 className="size-4 text-blue-400" /> {t}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Simulados */}
        <section id="simulados" className="relative scroll-mt-24 py-24">
          <div className="lp-orb pointer-events-none absolute top-1/3 left-[-10%] size-[460px] rounded-full bg-blue-600/15 blur-[120px]" />
          <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
            <div data-reveal>
              <p className="text-sm font-semibold tracking-wider text-blue-400 uppercase">Simulados</p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-5xl">Treine no formato do ENEM e saiba sua nota de verdade</h2>
              <p className="mt-5 text-white/60 sm:text-lg">
                Faça a prova com cronômetro, marque no cartão-resposta e receba sua nota calculada pela TRI, considerando a dificuldade de cada
                questão para a turma.
              </p>
              <ul className="mt-8 space-y-4">
                {[
                  [Zap, 'Respostas salvas automaticamente, mesmo se a internet cair'],
                  [Sparkles, 'Nota TRI, coerência pedagógica e acerto por dificuldade'],
                  [ShieldCheck, 'Gabarito comentado e comparativo com a turma'],
                ].map(([I, t]) => {
                  const Icon = I as typeof Zap;
                  return (
                    <li key={t as string} className="flex items-start gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-blue-500/15 text-blue-300">
                        <Icon className="size-4" />
                      </span>
                      <span className="pt-1.5 text-white/75">{t as string}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div data-reveal style={{ ['--d' as string]: '150ms' }} className="relative grid items-center gap-5 sm:grid-cols-[auto_1fr]">
              <div className="rounded-3xl border border-white/10 bg-[#0b1120]/80 p-5 backdrop-blur">
                <p className="mb-3 text-xs font-bold text-white/70">Cartão-resposta</p>
                <AnimatedBubbles />
              </div>
              <TriCard />
            </div>
          </div>
        </section>

        {/* Como funciona */}
        <section id="como-funciona" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-24 sm:px-6 lg:px-8">
          <SectionHead eyebrow="Como funciona" title="Comece a estudar em minutos" />
          <div className="relative mt-14 grid gap-6 md:grid-cols-3">
            <div className="pointer-events-none absolute top-8 right-[16%] left-[16%] hidden h-px bg-gradient-to-r from-blue-500/0 via-blue-500/60 to-blue-500/0 md:block" />
            {[
              ['Entre com seu e-mail', 'Use sua conta Google ou receba um link de acesso. Sem senha para esquecer.'],
              ['Siga sua trilha', 'Assista às aulas na ordem certa, baixe os materiais e marque o que já concluiu.'],
              ['Meça sua evolução', 'Faça simulados, acompanhe sua nota TRI e tire dúvidas com o professor.'],
            ].map(([t, d], i) => (
              <div key={t} data-reveal style={{ ['--d' as string]: `${i * 140}ms` }} className="relative text-center">
                <div className="relative mx-auto grid size-16 place-items-center rounded-2xl border border-blue-400/30 bg-[#0b1120] text-2xl font-black text-blue-300 shadow-[0_0_40px_-8px_rgba(59,130,246,0.6)]">
                  {i + 1}
                </div>
                <h3 className="mt-6 text-lg font-bold">{t}</h3>
                <p className="mx-auto mt-2 max-w-xs text-sm text-white/55">{d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Aplicativo */}
        <section id="app" className="relative scroll-mt-24 overflow-hidden py-24">
          <div className="pointer-events-none absolute inset-0 bg-[image:radial-gradient(900px_500px_at_50%_30%,rgba(37,99,235,0.28),transparent_70%)]" />
          <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
            <div data-reveal>
              <AppIconTap />
            </div>
            <div data-reveal style={{ ['--d' as string]: '120ms' }}>
              <span className="grid size-12 place-items-center rounded-2xl bg-cyan-500/15 text-cyan-300">
                <Smartphone className="size-6" />
              </span>
              <h2 className="mt-5 text-3xl font-extrabold tracking-tight sm:text-5xl">O Vértice como aplicativo no seu celular</h2>
              <p className="mt-5 text-white/60 sm:text-lg">
                Instale na tela inicial com um toque e abra direto nas suas aulas — sem loja de aplicativos, sem ocupar espaço e sempre
                atualizado. No ônibus, no intervalo ou em casa.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                {['Ícone na tela inicial', 'Abre em tela cheia', 'Retoma de onde parou', 'Tema claro e escuro'].map((t) => (
                  <span key={t} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/75">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div data-reveal className="relative mx-auto mt-20 max-w-7xl px-4 sm:px-6 lg:px-8">
            <LaptopPhoneMockup />
          </div>
        </section>

        {/* FAQ */}
        <section id="duvidas" className="mx-auto max-w-3xl scroll-mt-24 px-4 py-24 sm:px-6">
          <SectionHead eyebrow="Dúvidas frequentes" title="Perguntas comuns" />
          <div className="mt-10 space-y-3">
            {FAQ.map(([q, a], i) => (
              <details key={q} data-reveal style={{ ['--d' as string]: `${i * 60}ms` }} className="group rounded-2xl border border-white/10 bg-white/[0.03] open:bg-white/[0.05]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 font-semibold [&::-webkit-details-marker]:hidden">
                  {q}
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white/5 text-white/60 transition-transform duration-300 group-open:rotate-45">+</span>
                </summary>
                <p className="px-5 pb-5 text-sm leading-relaxed text-white/60">{a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* CTA final */}
        <section className="px-4 pb-24 sm:px-6 lg:px-8">
          <div data-reveal className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-blue-600 via-blue-700 to-cyan-600 px-6 py-16 text-center sm:px-12 sm:py-20">
            <div className="lp-grid-bg pointer-events-none absolute inset-0 opacity-60" />
            <div className="lp-orb pointer-events-none absolute -top-20 -left-20 size-72 rounded-full bg-white/20 blur-3xl" />
            <div className="relative">
              <Logo className="mx-auto size-12" />
              <h2 className="mx-auto mt-6 max-w-2xl text-3xl font-extrabold tracking-tight sm:text-5xl">Pronto para dar o próximo passo?</h2>
              <p className="mx-auto mt-4 max-w-xl text-white/80 sm:text-lg">Entre agora e continue sua preparação de onde parou.</p>
              <LoginButton variant="secondary" size="lg" className="mt-9 h-13 rounded-full border-0 !bg-white px-9 text-base !text-blue-700 hover:!bg-white/90">
                Entrar na plataforma <ArrowRight className="size-4" />
              </LoginButton>
            </div>
          </div>
        </section>

        <footer className="border-t border-white/5 py-10">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 text-sm text-white/45 sm:flex-row sm:px-6 lg:px-8">
            <div className="flex items-center gap-2.5 text-white/80">
              <Logo className="size-6" />
              <span className="font-extrabold tracking-wide">{brand}</span>
            </div>
            <p>© {new Date().getFullYear()} {brand}. Todos os direitos reservados.</p>
          </div>
        </footer>
      </LandingRoot>
    </div>
  );
}

function SectionHead({ eyebrow, title, text }: { eyebrow: string; title: string; text?: string }) {
  return (
    <div data-reveal className="mx-auto max-w-3xl text-center">
      <p className="text-sm font-semibold tracking-wider text-blue-400 uppercase">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-5xl">{title}</h2>
      {text && <p className="mt-4 text-white/60 sm:text-lg">{text}</p>}
    </div>
  );
}
