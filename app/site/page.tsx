import {
  ArrowRight,
  Atom,
  CalendarDays,
  ClipboardCheck,
  FileText,
  FlaskConical,
  MessageCircleQuestion,
  PlayCircle,
  Plus,
  Ruler,
  ShieldCheck,
  Sparkles,
  Target,
  Zap,
} from 'lucide-react';
import type { Metadata } from 'next';
import { AnimatedBubbles, Counter, LandingNav, LandingRoot, LoginButton } from '@/components/landing/interactive';
import { AppIconTap, DesktopMockup, LaptopPhoneMockup, TriCard } from '@/components/landing/mockups';
import { Formulas } from '@/components/brand/formulas';
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
  { icon: Atom, name: 'Física', formula: 'F = m · a', topics: ['Mecânica', 'Eletricidade', 'Termologia', 'Óptica e ondas'] },
  { icon: FlaskConical, name: 'Química', formula: 'pV = nRT', topics: ['Química geral', 'Físico-química', 'Orgânica', 'Química ambiental'] },
  { icon: Ruler, name: 'Matemática', formula: 'Δ = b² − 4ac', topics: ['Matemática básica', 'Funções', 'Geometria', 'Estatística e probabilidade'] },
];

const FAQ = [
  ['Como acesso a plataforma?', 'Clique em “Entrar” e use sua conta Google. Não precisa criar nem decorar senha.'],
  ['Posso estudar pelo celular?', 'Sim. A plataforma foi pensada primeiro para o celular e também pode ser instalada na tela inicial como um aplicativo.'],
  ['Como funciona a nota TRI dos simulados?', 'Depois que a turma entrega a prova, calculamos sua nota com base na dificuldade de cada questão e na coerência das suas respostas — o mesmo princípio usado no ENEM.'],
  ['Já sou aluno, mas não consigo ver as aulas.', 'Seu acesso é liberado pelo e-mail cadastrado na matrícula. Entre com a conta Google desse mesmo e-mail ou fale com a coordenação.'],
  ['Existe conteúdo gratuito?', 'Sim. Ao entrar você já encontra aulas abertas para conhecer a metodologia do Vértice.'],
];

export default async function LandingPage() {
  const settings = await getSettings();
  const brand = settings.brand_name || 'CURSO VÉRTICE';

  return (
    <div data-theme="dark" className="min-h-dvh overflow-x-hidden bg-[#0a0a0b] text-white" id="topo">
      <LandingRoot brand={brand}>
        <LandingNav brand={brand} />

        {/* HERO: texto à esquerda, a plataforma à direita; fundo de caderno quadriculado com fórmulas */}
        <section className="relative overflow-hidden pt-28 pb-16 sm:pt-36 lg:pb-24">
          <div className="hero-fallback pointer-events-none absolute inset-0 [mask-image:linear-gradient(to_bottom,black_40%,transparent)]">
            {/* só do lado da prévia: nada passa por trás do título */}
            <Formulas className="hidden opacity-70 [mask-image:linear-gradient(to_right,transparent_45%,black_75%)] lg:block" />
          </div>
          <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:px-8">
            <div>
              <p className="animate-slide-up font-mono text-xs tracking-[0.1em] text-white/55 uppercase">Física · Química · Matemática</p>
              <h1
                className="animate-slide-up mt-5 text-[2.6rem] leading-[1.02] font-semibold tracking-[-0.04em] text-balance sm:text-6xl"
                style={{ animationDelay: '70ms' }}
              >
                Sua aprovação no ENEM começa no Vértice.
              </h1>
              <p className="animate-slide-up mt-6 max-w-xl text-base leading-relaxed text-white/60 sm:text-lg" style={{ animationDelay: '140ms' }}>
                {settings.hero_subtitle && settings.hero_subtitle !== 'Especialista em física, química e matemática'
                  ? settings.hero_subtitle
                  : 'Aulas objetivas, simulados com nota TRI, mentoria individual e plantão de dúvidas, numa plataforma rápida que funciona no celular.'}
              </p>
              <div className="animate-slide-up mt-9 flex flex-col gap-3 sm:flex-row" style={{ animationDelay: '210ms' }}>
                <LoginButton size="lg" className="w-full px-6 !bg-white !text-black !shadow-none hover:!bg-white/90 sm:w-auto">
                  Acessar a plataforma <ArrowRight className="size-4" />
                </LoginButton>
                <a
                  href="#recursos"
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-white/15 px-6 text-sm font-medium text-white/85 transition hover:bg-white/5 sm:w-auto"
                >
                  Conhecer os recursos
                </a>
              </div>
              <ul className="animate-slide-up mt-8 flex flex-wrap gap-x-6 gap-y-2 font-mono text-[11px] tracking-[0.04em] text-white/45 uppercase" style={{ animationDelay: '280ms' }}>
                <li>Acesso pelo Google</li>
                <li>Funciona no celular</li>
                <li>Aulas gratuitas para conhecer</li>
              </ul>
            </div>

            {/* Prévia */}
            <div className="relative">
              <div className="lp-mockup">
                <DesktopMockup />
              </div>
              <div className="lp-float-slow absolute -bottom-6 -left-4 hidden rounded-xl border border-white/10 bg-[#111114]/95 p-4 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.9)] backdrop-blur md:block">
                <p className="font-mono text-[10px] tracking-[0.08em] text-white/45 uppercase">Simulado CN · nota TRI</p>
                <p className="num mt-1 text-3xl font-medium text-white">
                  <Counter to={786} />
                </p>
                <div className="mt-2 h-1 w-40 rounded-full bg-white/10">
                  <div className="h-full w-[78%] rounded-full bg-[#3f7bff]" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Conteúdos: uma faixa de texto correndo, sem caixas */}
        <section className="border-y border-white/[0.07] py-5" aria-label="Conteúdos">
          <div className="relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_10%,black_90%,transparent)]">
            <div className="lp-marquee flex w-max items-center gap-8 font-mono text-sm text-white/45">
              {[...TOPICS, ...TOPICS].map((t, i) => (
                <span key={i} className="flex shrink-0 items-center gap-8">
                  {t}
                  <span className="text-white/20">/</span>
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Números: divididos por linhas, sem cartões */}
        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 divide-white/[0.08] border-y border-white/[0.08] lg:grid-cols-4 lg:divide-x">
            {[
              { v: 3, s: '', l: 'disciplinas com especialista' },
              { v: 45, s: '', l: 'questões por simulado, como no ENEM' },
              { v: 100, s: '%', l: 'online, no celular ou no computador' },
              { v: 24, s: 'h', l: 'por dia para estudar no seu ritmo' },
            ].map((n, i) => (
              <div key={n.l} data-reveal style={{ ['--d' as string]: `${i * 80}ms` }} className="px-2 py-8 sm:px-6">
                <p className="num text-4xl font-medium tracking-[-0.03em] sm:text-5xl">
                  <Counter to={n.v} suffix={n.s} />
                </p>
                <p className="mt-2 max-w-[18ch] text-sm text-white/50">{n.l}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Recursos (grade assimétrica) */}
        <section id="recursos" className="relative mx-auto max-w-7xl scroll-mt-24 px-4 pb-24 sm:px-6 lg:px-8">
          <SectionHead eyebrow="Recursos" title="Tudo o que você precisa para estudar de verdade" text="Uma plataforma pensada para você estudar mais, com menos distração." />
          <div className="mt-12 grid gap-px overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.08] sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f, i) => (
              <div
                key={f.title}
                data-reveal
                style={{ ['--d' as string]: `${(i % 4) * 70}ms` }}
                className={`lp-card-glow group bg-[#0d0d0f] p-7 transition-colors duration-300 hover:bg-[#121215] ${f.span ?? ''}`}
              >
                <f.icon className="size-5 text-white/70" strokeWidth={1.6} />
                <h3 className="mt-8 text-base font-semibold tracking-[-0.01em]">{f.title}</h3>
                <p className="mt-2 max-w-[46ch] text-sm leading-relaxed text-white/50">{f.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Disciplinas: uma por linha, como um índice */}
        <section id="disciplinas" className="relative scroll-mt-24 py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionHead eyebrow="Disciplinas" title="Especialistas nas matérias que mais pesam" text="Do básico às questões mais difíceis, com teoria clara e muita resolução de exercícios." />
            <div className="mt-12 divide-y divide-white/[0.08] border-y border-white/[0.08]">
              {SUBJECTS.map((s, i) => (
                <div
                  key={s.name}
                  data-reveal
                  style={{ ['--d' as string]: `${i * 100}ms` }}
                  className="grid gap-5 py-8 sm:grid-cols-[3rem_minmax(0,14rem)_minmax(0,1fr)_auto] sm:items-center sm:gap-8"
                >
                  <span className="font-mono text-sm text-white/35">{String(i + 1).padStart(2, '0')}</span>
                  <h3 className="flex items-center gap-3 text-3xl font-semibold tracking-[-0.03em]">
                    <s.icon className="size-6 text-white/50" strokeWidth={1.5} />
                    {s.name}
                  </h3>
                  <p className="text-sm leading-relaxed text-white/55">{s.topics.join(' · ')}</p>
                  <span className="font-mono text-sm whitespace-nowrap text-white/35">{s.formula}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Simulados */}
        <section id="simulados" className="relative scroll-mt-24 border-t border-white/[0.07] py-24">
          <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
            <div data-reveal>
              <p className="font-mono text-xs tracking-[0.1em] text-white/45 uppercase">Simulados</p>
              <h2 className="mt-4 text-3xl leading-[1.05] font-semibold tracking-[-0.035em] sm:text-5xl">Treine no formato do ENEM e saiba sua nota de verdade.</h2>
              <p className="mt-5 max-w-xl text-white/55 sm:text-lg">
                Faça a prova com cronômetro, marque no cartão-resposta e receba a nota calculada pela TRI, considerando a dificuldade de cada
                questão para a turma.
              </p>
              <ul className="mt-8 divide-y divide-white/[0.08] border-y border-white/[0.08]">
                {[
                  [Zap, 'Respostas salvas automaticamente, mesmo se a internet cair'],
                  [Sparkles, 'Nota TRI, coerência pedagógica e acerto por dificuldade'],
                  [ShieldCheck, 'Gabarito comentado e comparativo com a turma'],
                ].map(([I, t]) => {
                  const Icon = I as typeof Zap;
                  return (
                    <li key={t as string} className="flex items-center gap-3 py-3.5 text-white/75">
                      <Icon className="size-4 shrink-0 text-white/45" strokeWidth={1.7} />
                      {t as string}
                    </li>
                  );
                })}
              </ul>
            </div>
            <div data-reveal style={{ ['--d' as string]: '150ms' }} className="relative grid items-center gap-5 sm:grid-cols-[auto_1fr]">
              <div className="rounded-xl border border-white/10 bg-[#111114] p-5">
                <p className="mb-3 font-mono text-[10px] tracking-[0.08em] text-white/45 uppercase">Cartão-resposta</p>
                <AnimatedBubbles />
              </div>
              <TriCard />
            </div>
          </div>
        </section>

        {/* Como funciona: três passos numerados, alinhados à esquerda */}
        <section id="como-funciona" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-24 sm:px-6 lg:px-8">
          <SectionHead eyebrow="Como funciona" title="Comece a estudar em minutos" />
          <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
            {[
              ['Entre com o Google', 'Use sua conta Google, com o e-mail da matrícula. Sem senha para esquecer.'],
              ['Siga sua trilha', 'Assista às aulas na ordem certa, baixe os materiais e marque o que já concluiu.'],
              ['Meça sua evolução', 'Faça simulados, acompanhe sua nota TRI e tire dúvidas com o professor.'],
            ].map(([t, d], i) => (
              <li key={t} data-reveal style={{ ['--d' as string]: `${i * 120}ms` }} className="border-t border-white/15 pt-6">
                <span className="font-mono text-sm text-white/40">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="mt-4 text-lg font-semibold tracking-[-0.01em]">{t}</h3>
                <p className="mt-2 max-w-xs text-sm leading-relaxed text-white/50">{d}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Aplicativo */}
        <section id="app" className="relative scroll-mt-24 overflow-hidden border-t border-white/[0.07] py-24">
          <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
            <div data-reveal style={{ ['--d' as string]: '120ms' }} className="lg:order-2">
              <p className="font-mono text-xs tracking-[0.1em] text-white/45 uppercase">Aplicativo</p>
              <h2 className="mt-4 text-3xl leading-[1.05] font-semibold tracking-[-0.035em] sm:text-5xl">O Vértice na tela inicial do seu celular.</h2>
              <p className="mt-5 max-w-xl text-white/55 sm:text-lg">
                Instale com um toque e abra direto nas suas aulas, sem loja de aplicativos, sem ocupar espaço e sempre atualizado.
              </p>
              <ul className="mt-8 grid max-w-md grid-cols-2 gap-x-6 gap-y-3 font-mono text-[12px] text-white/55">
                {['Ícone na tela inicial', 'Abre em tela cheia', 'Retoma de onde parou', 'Tema claro e escuro'].map((t) => (
                  <li key={t} className="flex items-center gap-2">
                    <span className="size-1 rounded-full bg-white/40" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div data-reveal className="lg:order-1">
              <AppIconTap />
            </div>
          </div>
          <div data-reveal className="relative mx-auto mt-20 max-w-7xl px-4 sm:px-6 lg:px-8">
            <LaptopPhoneMockup />
          </div>
        </section>

        {/* Perguntas: só linhas, sem caixas */}
        <section id="duvidas" className="mx-auto max-w-3xl scroll-mt-24 px-4 py-24 sm:px-6">
          <SectionHead eyebrow="Dúvidas frequentes" title="Perguntas comuns" />
          <div className="mt-10 divide-y divide-white/[0.08] border-y border-white/[0.08]">
            {FAQ.map(([q, a], i) => (
              <details key={q} data-reveal style={{ ['--d' as string]: `${i * 50}ms` }} className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 font-medium [&::-webkit-details-marker]:hidden">
                  {q}
                  <Plus className="size-4 shrink-0 text-white/50 transition-transform duration-300 group-open:rotate-45" />
                </summary>
                <p className="pb-5 text-sm leading-relaxed text-white/55">{a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Chamada final */}
        <section className="px-4 pb-24 sm:px-6 lg:px-8">
          <div data-reveal className="hero-fallback relative mx-auto max-w-7xl overflow-hidden rounded-xl border border-white/10 px-6 py-16 sm:px-12 sm:py-20">
            <Formulas />
            <div className="relative flex flex-col items-start gap-8 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <Logo className="size-10" />
                <h2 className="mt-6 max-w-2xl text-3xl leading-[1.05] font-semibold tracking-[-0.035em] sm:text-5xl">Pronto para dar o próximo passo?</h2>
                <p className="mt-4 max-w-xl text-white/60 sm:text-lg">Entre agora e continue sua preparação de onde parou.</p>
              </div>
              <LoginButton size="lg" className="shrink-0 px-7 !bg-white !text-black !shadow-none hover:!bg-white/90">
                Entrar na plataforma <ArrowRight className="size-4" />
              </LoginButton>
            </div>
          </div>
        </section>

        <footer className="border-t border-white/[0.07] py-10">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 text-sm text-white/45 sm:flex-row sm:px-6 lg:px-8">
            <div className="flex items-center gap-2.5 text-white/80">
              <Logo className="size-6" />
              <span className="text-[13px] font-semibold tracking-[0.06em] uppercase">{brand}</span>
            </div>
            <div className="flex gap-5">
              <a href="/site/privacidade" className="hover:text-white/80">
                Privacidade
              </a>
              <a href="/site/termos" className="hover:text-white/80">
                Termos
              </a>
            </div>
            <p className="font-mono text-xs">© {new Date().getFullYear()} {brand}</p>
          </div>
        </footer>
      </LandingRoot>
    </div>
  );
}

function SectionHead({ eyebrow, title, text }: { eyebrow: string; title: string; text?: string }) {
  return (
    <div data-reveal className="max-w-3xl">
      <p className="font-mono text-xs tracking-[0.1em] text-white/45 uppercase">{eyebrow}</p>
      <h2 className="mt-4 text-3xl leading-[1.05] font-semibold tracking-[-0.035em] sm:text-5xl">{title}</h2>
      {text && <p className="mt-4 max-w-2xl text-white/55 sm:text-lg">{text}</p>}
    </div>
  );
}
