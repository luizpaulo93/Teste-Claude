/**
 * Assuntos da Matriz de Referência do ENEM (Anexo — objetos de conhecimento)
 * de Matemática e Ciências da Natureza, por disciplina.
 * Chave de cada assunto: "<disciplina>.<bloco>.<item>".
 */

export interface MatrizTopic {
  title: string;
  items: string[];
}
export interface MatrizDiscipline {
  key: string;
  name: string;
  topics: MatrizTopic[];
}
export interface MatrizArea {
  area: "MT" | "CN";
  name: string;
  disciplines: MatrizDiscipline[];
}

export const MATRIZ: MatrizArea[] = [
  {
    area: "MT",
    name: "Matemática e suas Tecnologias",
    disciplines: [
      {
        key: "matematica",
        name: "Matemática",
        topics: [
          {
            title: "Conhecimentos numéricos",
            items: [
              "Operações em conjuntos numéricos (naturais, inteiros, racionais e reais)",
              "Desigualdades",
              "Divisibilidade",
              "Fatoração",
              "Razões e proporções",
              "Porcentagem e juros",
              "Relações de dependência entre grandezas",
              "Sequências e progressões",
              "Princípios de contagem",
            ],
          },
          {
            title: "Conhecimentos geométricos",
            items: [
              "Características das figuras geométricas planas e espaciais",
              "Grandezas",
              "Unidades de medida e escalas",
              "Comprimentos",
              "Áreas e volumes",
              "Ângulos",
              "Posições de retas",
              "Simetrias de figuras planas ou espaciais",
              "Congruência e semelhança de triângulos",
              "Teorema de Tales",
              "Relações métricas nos triângulos",
              "Circunferências",
              "Trigonometria do ângulo agudo",
            ],
          },
          {
            title: "Conhecimentos de estatística e probabilidade",
            items: [
              "Representação e análise de dados",
              "Medidas de tendência central (médias, moda e mediana)",
              "Desvios e variância",
              "Noções de probabilidade",
            ],
          },
          {
            title: "Conhecimentos algébricos",
            items: [
              "Gráficos e funções",
              "Funções algébricas do 1.º e do 2.º graus",
              "Polinomiais",
              "Racionais",
              "Exponenciais e logarítmicas",
              "Equações e inequações",
              "Relações no ciclo trigonométrico e funções trigonométricas",
            ],
          },
          {
            title: "Conhecimentos algébricos/geométricos",
            items: [
              "Plano cartesiano",
              "Retas",
              "Circunferências",
              "Paralelismo e perpendicularidade",
              "Sistemas de equações",
            ],
          },
        ],
      },
    ],
  },
  {
    area: "CN",
    name: "Ciências da Natureza e suas Tecnologias",
    disciplines: [
      {
        key: "fisica",
        name: "Física",
        topics: [
          {
            title: "Conhecimentos básicos e fundamentais",
            items: [
              "Noções de ordem de grandeza",
              "Notação Científica",
              "Sistema Internacional de Unidades",
              "Metodologia de investigação: a procura de regularidades e de sinais na interpretação física do mundo",
              "Observações e mensurações: representação de grandezas físicas como grandezas mensuráveis",
              "Ferramentas básicas: gráficos e vetores",
              "Conceituação de grandezas vetoriais e escalares",
              "Operações básicas com vetores",
            ],
          },
          {
            title: "O movimento, o equilíbrio e a descoberta de leis físicas",
            items: [
              "Grandezas fundamentais da mecânica: tempo, espaço, velocidade e aceleração",
              "Relação histórica entre força e movimento",
              "Descrições do movimento e sua interpretação: quantificação do movimento e sua descrição matemática e gráfica",
              "Casos especiais de movimentos e suas regularidades observáveis",
              "Conceito de inércia",
              "Noção de sistemas de referência inerciais e não inerciais",
              "Noção dinâmica de massa e quantidade de movimento (momento linear)",
              "Força e variação da quantidade de movimento",
              "Leis de Newton",
              "Centro de massa e a idéia de ponto material",
              "Conceito de forças externas e internas",
              "Lei da conservação da quantidade de movimento (momento linear) e teorema do impulso",
              "Momento de uma força (torque)",
              "Condições de equilíbrio estático de ponto material e de corpos rígidos",
              "Força de atrito, força peso, força normal de contato e tração",
              "Diagramas de forças",
              "Identificação das forças que atuam nos movimentos circulares",
              "Noção de força centrípeta e sua quantificação",
              "A hidrostática: aspectos históricos e variáveis relevantes",
              "Empuxo",
              "Princípios de Pascal, Arquimedes e Stevin: condições de flutuação, relação entre diferença de nível e pressão hidrostática",
            ],
          },
          {
            title: "Energia, trabalho e potência",
            items: [
              "Conceituação de trabalho, energia e potência",
              "Conceito de energia potencial e de energia cinética",
              "Conservação de energia mecânica e dissipação de energia",
              "Trabalho da força gravitacional e energia potencial gravitacional",
              "Forças conservativas e dissipativas",
            ],
          },
          {
            title: "A Mecânica e o funcionamento do Universo",
            items: [
              "Força peso",
              "Aceleração gravitacional",
              "Lei da Gravitação Universal",
              "Leis de Kepler",
              "Movimentos de corpos celestes",
              "Influência na Terra: marés e variações climáticas",
              "Concepções históricas sobre a origem do universo e sua evolução",
            ],
          },
          {
            title: "Fenômenos Elétricos e Magnéticos",
            items: [
              "Carga elétrica e corrente elétrica",
              "Lei de Coulomb",
              "Campo elétrico e potencial elétrico",
              "Linhas de campo",
              "Superfícies equipotenciais",
              "Poder das pontas",
              "Blindagem",
              "Capacitores",
              "Efeito Joule",
              "Lei de Ohm",
              "Resistência elétrica e resistividade",
              "Relações entre grandezas elétricas: tensão, corrente, potência e energia",
              "Circuitos elétricos simples",
              "Correntes contínua e alternada",
              "Medidores elétricos",
              "Representação gráfica de circuitos",
              "Símbolos convencionais",
              "Potência e consumo de energia em dispositivos elétricos",
              "Campo magnético",
              "Imãs permanentes",
              "Linhas de campo magnético",
              "Campo magnético terrestre",
            ],
          },
          {
            title: "Oscilações, ondas, óptica e radiação",
            items: [
              "Feixes e frentes de ondas",
              "Reflexão e refração",
              "Óptica geométrica: lentes e espelhos",
              "Formação de imagens",
              "Instrumentos ópticos simples",
              "Fenômenos ondulatórios",
              "Pulsos e ondas",
              "Período, frequência, ciclo",
              "Propagação: relação entre velocidade, frequência e comprimento de onda",
              "Ondas em diferentes meios de propagação",
            ],
          },
          {
            title: "O calor e os fenômenos térmicos",
            items: [
              "Conceitos de calor e de temperatura",
              "Escalas termométricas",
              "Transferência de calor e equilíbrio térmico",
              "Capacidade calorífica e calor específico",
              "Condução do calor",
              "Dilatação térmica",
              "Mudanças de estado físico e calor latente de transformação",
              "Comportamento de Gases ideais",
              "Máquinas térmicas",
              "Ciclo de Carnot",
              "Leis da Termodinâmica",
              "Aplicações e fenômenos térmicos de uso cotidiano",
              "Compreensão de fenômenos climáticos relacionados ao ciclo da água",
            ],
          },
        ],
      },
      {
        key: "quimica",
        name: "Química",
        topics: [
          {
            title: "Transformações Químicas",
            items: [
              "Evidências de transformações químicas",
              "Interpretando transformações químicas",
              "Sistemas Gasosos: Lei dos gases",
              "Equação geral dos gases ideais, Princípio de Avogadro, conceito de molécula; massa molar, volume molar dos gases",
              "Teoria cinética dos gases",
              "Misturas gasosas",
              "Modelo corpuscular da matéria",
              "Modelo atômico de Dalton",
              "Natureza elétrica da matéria: Modelo Atômico de Thomson, Rutherford, Rutherford-Bohr",
              "Átomos e sua estrutura",
              "Número atômico, número de massa, isótopos, massa atômica",
              "Elementos químicos e Tabela Periódica",
              "Reações químicas",
            ],
          },
          {
            title: "Representação das transformações químicas",
            items: [
              "Fórmulas químicas",
              "Balanceamento de equações químicas",
              "Aspectos quantitativos das transformações químicas",
              "Leis ponderais das reações químicas",
              "Determinação de fórmulas químicas",
              "Grandezas Químicas: massa, volume, mol, massa molar, constante de Avogadro",
              "Cálculos estequiométricos",
            ],
          },
          {
            title: "Materiais, suas propriedades e usos",
            items: [
              "Propriedades de materiais",
              "Estados físicos de materiais",
              "Mudanças de estado",
              "Misturas: tipos e métodos de separação",
              "Substâncias químicas: classificação e características gerais",
              "Metais e Ligas metálicas",
              "Ferro, cobre e alumínio",
              "Ligações metálicas",
              "Substâncias iônicas: características e propriedades",
              "Substâncias iônicas do grupo: cloreto, carbonato, nitrato e sulfato",
              "Ligação iônica",
              "Substâncias moleculares: características e propriedades",
              "Substâncias moleculares: H2, O2, N2, Cl2, NH3, H2O, HCl, CH4",
              "Ligação Covalente",
              "Polaridade de moléculas",
              "Forças intermoleculares",
              "Relação entre estruturas, propriedade e aplicação das substâncias",
            ],
          },
          {
            title: "Água",
            items: [
              "Ocorrência e importância na vida animal e vegetal",
              "Ligação, estrutura e propriedades",
              "Sistemas em Solução Aquosa: Soluções verdadeiras, soluções coloidais e suspensões",
              "Solubilidade",
              "Concentração das soluções",
              "Aspectos qualitativos das propriedades coligativas das soluções",
              "Ácidos, Bases, Sais e Óxidos: definição, classificação, propriedades, formulação e nomenclatura",
              "Conceitos de ácidos e base",
              "Principais propriedades dos ácidos e bases: indicadores, condutibilidade elétrica, reação com metais, reação de neutralização",
            ],
          },
          {
            title: "Transformações Químicas e Energia",
            items: [
              "Transformações químicas e energia calorífica",
              "Calor de reação",
              "Entalpia",
              "Equações termoquímicas",
              "Lei de Hess",
              "Transformações químicas e energia elétrica",
              "Reação de oxirredução",
              "Potenciais padrão de redução",
              "Pilha",
              "Eletrólise",
              "Leis de Faraday",
              "Transformações nucleares",
              "Conceitos fundamentais da radioatividade",
              "Reações de fissão e fusão nuclear",
              "Desintegração radioativa e radioisótopos",
            ],
          },
          {
            title: "Dinâmica das Transformações Químicas",
            items: [
              "Transformações Químicas e velocidade",
              "Velocidade de reação",
              "Energia de ativação",
              "Fatores que alteram a velocidade de reação: concentração, pressão, temperatura e catalisador",
            ],
          },
          {
            title: "Transformação Química e Equilíbrio",
            items: [
              "Caracterização do sistema em equilíbrio",
              "Constante de equilíbrio",
              "Produto iônico da água, equilíbrio ácido-base e pH. Solubilidade dos sais e hidrólise",
              "Fatores que alteram o sistema em equilíbrio",
              "Aplicação da velocidade e do equilíbrio químico no cotidiano",
            ],
          },
          {
            title: "Compostos de Carbono",
            items: [
              "Características gerais dos compostos orgânicos",
              "Principais funções orgânicas",
              "Estrutura e propriedades de Hidrocarbonetos",
              "Estrutura e propriedades de compostos orgânicos oxigenados",
              "Fermentação",
              "Estrutura e propriedades de compostos orgânicos nitrogenados",
              "Macromoléculas naturais e sintéticas",
              "Noções básicas sobre polímeros",
              "Amido, glicogênio e celulose",
              "Borracha natural e sintética",
              "Polietileno, poliestireno, PVC, Teflon, náilon",
              "Óleos e gorduras, sabões e detergentes sintéticos",
              "Proteínas e enzimas",
            ],
          },
          {
            title:
              "Relações da Química com as Tecnologias, a Sociedade e o Meio Ambiente",
            items: [
              "Química no cotidiano",
              "Química na agricultura e na saúde",
              "Química nos alimentos",
              "Química e ambiente",
              "Aspectos científico-tecnológicos, socioeconômicos e ambientais associados à obtenção ou produção de substâncias químicas",
              "Indústria Química: obtenção e utilização do cloro, hidróxido de sódio, ácido sulfúrico, amônia e ácido nítrico",
              "Mineração e Metalurgia",
              "Poluição e tratamento de água",
              "Poluição atmosférica",
              "Contaminação e proteção do ambiente",
            ],
          },
          {
            title: "Energias Químicas no Cotidiano",
            items: [
              "Petróleo, gás natural e carvão",
              "Madeira e hulha",
              "Biomassa",
              "Biocombustíveis",
              "Impactos ambientais de combustíveis fosseis",
              "Energia nuclear",
              "Lixo atômico",
              "Vantagens e desvantagens do uso de energia nuclear",
            ],
          },
        ],
      },
      {
        key: "biologia",
        name: "Biologia",
        topics: [
          {
            title: "Moléculas, células e tecidos",
            items: [
              "Estrutura e fisiologia celular: membrana, citoplasma e núcleo",
              "Divisão celular",
              "Aspectos bioquímicos das estruturas celulares",
              "Aspectos gerais do metabolismo celular",
              "Metabolismo energético: fotossíntese e respiração",
              "Codificação da informação genética",
              "Síntese protéica",
              "Diferenciação celular",
              "Principais tecidos animais e vegetais",
              "Origem e evolução das células",
              "Noções sobre células-tronco, clonagem e tecnologia do DNA recombinante",
              "Aplicações de biotecnologia na produção de alimentos, fármacos e componentes biológicos",
              "Aplicações de tecnologias relacionadas ao DNA a investigações científicas, determinação da paternidade, investigação criminal e identificação de indivíduos",
              "Aspectos éticos relacionados ao desenvolvimento biotecnológico",
              "Biotecnologia e sustentabilidade",
            ],
          },
          {
            title: "Hereditariedade e diversidade da vida",
            items: [
              "Princípios básicos que regem a transmissão de características hereditárias",
              "Concepções pré-mendelianas sobre a hereditariedade",
              "Aspectos genéticos do funcionamento do corpo humano",
              "Antígenos e anticorpos",
              "Grupos sanguíneos, transplantes e doenças auto-imunes",
              "Neoplasias e a influência de fatores ambientais",
              "Mutações gênicas e cromossômicas",
              "Aconselhamento genético",
              "Fundamentos genéticos da evolução",
              "Aspectos genéticos da formação e manutenção da diversidade biológica",
            ],
          },
          {
            title: "Identidade dos seres vivos",
            items: [
              "Níveis de organização dos seres vivos",
              "Vírus, procariontes e eucariontes",
              "Autótrofos e heterótrofos",
              "Seres unicelulares e pluricelulares",
              "Sistemática e as grandes linhas da evolução dos seres vivos",
              "Tipos de ciclo de vida",
              "Evolução e padrões anatômicos e fisiológicos observados nos seres vivos",
              "Funções vitais dos seres vivos e sua relação com a adaptação desses organismos a diferentes ambientes",
              "Embriologia, anatomia e fisiologia humana",
              "Evolução humana",
              "Biotecnologia e sistemática",
            ],
          },
          {
            title: "Ecologia e ciências ambientais",
            items: [
              "Ecossistemas",
              "Fatores bióticos e abióticos",
              "Habitat e nicho ecológico",
              "A comunidade biológica: teia alimentar, sucessão e comunidade clímax",
              "Dinâmica de populações",
              "Interações entre os seres vivos",
              "Ciclos biogeoquímicos",
              "Fluxo de energia no ecossistema",
              "Biogeografia",
              "Biomas brasileiros",
              "Exploração e uso de recursos naturais",
              "Problemas ambientais: mudanças climáticas, efeito estufa; desmatamento; erosão; poluição da água, do solo e do ar",
              "Conservação e recuperação de ecossistemas",
              "Conservação da biodiversidade",
              "Tecnologias ambientais",
              "Noções de saneamento básico",
              "Noções de legislação ambiental: água, florestas, unidades de conservação; biodiversidade",
            ],
          },
          {
            title: "Origem e evolução da vida",
            items: [
              "A biologia como ciência: história, métodos, técnicas e experimentação",
              "Hipóteses sobre a origem do Universo, da Terra e dos seres vivos",
              "Teorias de evolução",
              "Explicações pré-darwinistas para a modificação das espécies",
              "A teoria evolutiva de Charles Darwin",
              "Teoria sintética da evolução",
              "Seleção artificial e seu impacto sobre ambientes naturais e sobre populações humanas",
            ],
          },
          {
            title: "Qualidade de vida das populações humanas",
            items: [
              "Aspectos biológicos da pobreza e do desenvolvimento humano",
              "Indicadores sociais, ambientais e econômicos",
              "Índice de desenvolvimento humano",
              "Principais doenças que afetam a população brasileira: caracterização, prevenção e profilaxia",
              "Noções de primeiros socorros",
              "Doenças sexualmente transmissíveis",
              "Aspectos sociais da biologia: uso indevido de drogas; gravidez na adolescência; obesidade",
              "Violência e segurança pública",
              "Exercícios físicos e vida saudável",
              "Aspectos biológicos do desenvolvimento sustentável",
              "Legislação e cidadania",
            ],
          },
        ],
      },
    ],
  },
];

export const DISCIPLINES = MATRIZ.flatMap((a) => a.disciplines);

export const itemKey = (d: string, t: number, i: number) => `${d}.${t}.${i}`;

export interface Assunto {
  key: string;
  discipline: string; // chave
  disciplineName: string;
  block: string; // bloco da matriz
  title: string;
  /** posição na matriz (do primeiro ao último assunto) */
  index: number;
  /** 3 = mais cobrado, 2 = cobrado com frequência, 1 = demais */
  priority: number;
}

/**
 * Assuntos mais cobrados no ENEM (levantamentos de incidência 2009–2025: Aprova Total,
 * Projeto Medicina, Vestibulando Web). Matemática básica, estatística, geometria e funções;
 * eletrodinâmica, termologia, ondulatória, cinemática e óptica; estequiometria, propriedades
 * das substâncias, soluções, orgânica e eletroquímica; ecologia, fisiologia humana, genética,
 * biotecnologia e bioenergética.
 */
const HIGH: Record<string, RegExp> = {
  matematica:
    /porcentagem|raz(õ|o)es e propor|grandezas|escala|operações em conjuntos|médias|mediana|representação e análise de dados|comprimentos, áreas e volumes|figuras geométricas planas e espaciais|gráficos e funções|funções algébricas|probabilidade|princípios de contagem/i,
  fisica:
    /corrente|ohm|potência e consumo|circuitos|efeito joule|tensão, corrente|calor|temperatura|termodinâmica|mudanças de estado|ondas|ondulat|frequência|grandezas fundamentais da mecânica|descrições do movimento|casos especiais de movimentos|energia mecânica|trabalho, energia e potência|lentes e espelhos|reflexão e refração|leis de newton|força de atrito/i,
  quimica:
    /estequiom|mol, massa molar|balanceamento|forças intermoleculares|polaridade|ligação|misturas: tipos|concentração das soluções|solubilidade|funções orgânicas|polímeros|pilha|eletrólise|oxirredução|entalpia|\bph\b|poluição|química e ambiente|biocombust|petróleo/i,
  biologia:
    /ecossistem|teia alimentar|ciclos biogeoquímicos|fluxo de energia|biomas|problemas ambientais|interações entre os seres|dinâmica de populações|anatomia e fisiologia humana|fotossíntese e respiração|metabolismo energético|dna recombinante|biotecnologia|síntese protéica|transmissão de características hereditárias|grupos sanguíneos|principais doenças|darwin|teoria sintética|vírus/i,
};
const MEDIUM: Record<string, RegExp> = {
  matematica:
    /semelhança|tales|relações métricas|trigonometria|sequências e progressões|exponenciais|juros|plano cartesiano|desvios e variância/i,
  fisica:
    /hidrostática|empuxo|pascal|gravitação|kepler|campo elétrico|campo magnético|dilatação|gases ideais|máquinas térmicas|vetores|quantidade de movimento/i,
  quimica:
    /equilíbrio|velocidade de reação|catalisador|ácidos, bases|radioatividade|fissão|tabela periódica|modelo atômico|gases|propriedades coligativas|óleos e gorduras|sabões/i,
  biologia:
    /divisão celular|membrana|mutações|diferenciação celular|embriologia|sucessão|conservação|saneamento|evolução|tecidos|sistemática|antígenos/i,
};

export const ASSUNTOS: Assunto[] = DISCIPLINES.flatMap((d) => {
  let index = 0;
  return d.topics.flatMap((t, ti) =>
    t.items.map((title, ii) => ({
      key: itemKey(d.key, ti, ii),
      discipline: d.key,
      disciplineName: d.name,
      block: t.title,
      title,
      index: index++,
      priority: HIGH[d.key]?.test(title)
        ? 3
        : MEDIUM[d.key]?.test(title)
          ? 2
          : 1,
    })),
  );
});

export const ASSUNTO_BY_KEY = new Map(ASSUNTOS.map((a) => [a.key, a]));
