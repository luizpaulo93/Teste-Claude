/**
 * Objetos de conhecimento da Matriz de Referência do ENEM (Anexo), por área e disciplina.
 * Ciências Humanas vem na matriz por eixos temáticos; aqui cada item foi colocado na disciplina mais próxima.
 * Chave de cada conteúdo: "<disciplina>.<tópico>.<item>".
 */

export interface MatrizTopic {
  title: string;
  subtitle?: string;
  items: string[];
}
export interface MatrizDiscipline {
  key: string;
  name: string;
  /** matéria correspondente na mentoria (cronograma, cronômetro) */
  subject: string;
  topics: MatrizTopic[];
}
export interface MatrizArea {
  area: "LC" | "MT" | "CN" | "CH";
  name: string;
  disciplines: MatrizDiscipline[];
}

export const MATRIZ: MatrizArea[] = [
  {
    area: "LC",
    name: "Linguagens, Códigos e suas Tecnologias",
    disciplines: [
      {
        key: "portugues",
        name: "Português",
        subject: "Português",
        topics: [
          {
            title: "Estudo do texto",
            subtitle:
              "as sequências discursivas e os gêneros textuais no sistema de comunicação e informação",
            items: [
              "Modos de organização da composição textual",
              "Atividades de produção escrita e de leitura de textos gerados nas diferentes esferas sociais - públicas e privadas",
            ],
          },
          {
            title: "Estudo dos aspectos linguísticos em diferentes textos",
            subtitle:
              "recursos expressivos da língua, procedimentos de construção e recepção de textos",
            items: [
              "Organização da macroestrutura semântica e a articulação entre idéias e proposições (relações lógico- semânticas)",
            ],
          },
          {
            title: "Estudo dos aspectos linguísticos da língua portuguesa",
            subtitle: "usos da língua: norma culta e variação linguística",
            items: [
              "Uso dos recursos linguísticos em relação ao contexto em que o texto é constituído: elementos de referência pessoal, temporal, espacial, registro linguístico, grau de formalidade, seleção lexical, tempos e modos verbais",
              "Uso dos recursos linguísticos em processo de coesão textual: elementos de articulação das sequências dos textos ou à construção da micro estrutura do texto",
            ],
          },
          {
            title: "Estudo dos gêneros digitais",
            subtitle:
              "tecnologia da comunicação e informação: impacto e função social",
            items: [
              "O texto literário típico da cultura de massa: o suporte textual em gêneros digitais",
              "A caracterização dos interlocutores na comunicação tecnológica",
              "Os recursos linguísticos e os gêneros digitais",
              "A função social das novas tecnologias",
            ],
          },
        ],
      },
      {
        key: "literatura",
        name: "Literatura",
        subject: "Literatura",
        topics: [
          {
            title: "Estudo do texto literário",
            subtitle:
              "relações entre produção literária e processo social, concepções artísticas, procedimentos de construção e recepção de textos",
            items: [
              "Produção literária e processo social",
              "Processos de formação literária e de formação nacional",
              "Produção de textos literários, sua recepção e a constituição do patrimônio literário nacional",
              "Relações entre a dialética cosmopolitismo/localismo e a produção literária nacional",
              "Elementos de continuidade e ruptura entre os diversos momentos da literatura brasileira",
              "Associações entre concepções artísticas e procedimentos de construção do texto literário em seus gêneros (épico/narrativo, lírico e dramático) e formas diversas",
              "Articulações entre os recursos expressivos e estruturais do texto literário e o processo social relacionado ao momento de sua produção",
              "Representação literária: natureza, função, organização e estrutura do texto literário",
              "Relações entre literatura, outras artes e outros saberes",
            ],
          },
        ],
      },
      {
        key: "redacao",
        name: "Redação (texto argumentativo)",
        subject: "Redação",
        topics: [
          {
            title:
              "Estudo do texto argumentativo, seus gêneros e recursos linguísticos",
            subtitle: "argumentação: tipo, gêneros e usos em língua portuguesa",
            items: [
              "Formas de apresentação de diferentes pontos de vista",
              "Organização e progressão textual",
              "Papéis sociais e comunicativos dos interlocutores, relação entre usos e propósitos comunicativos, função sociocomunicativa do gênero, aspectos da dimensão espaçotemporal em que se produz o texto",
            ],
          },
        ],
      },
      {
        key: "lem",
        name: "Inglês / Espanhol",
        subject: "Inglês/Espanhol",
        topics: [
          {
            title: "Leitura em língua estrangeira (Inglês ou Espanhol)",
            items: [
              "Associar vocábulos e expressões de um texto em língua estrangeira ao seu tema",
              "Usar a língua estrangeira para ampliar o acesso a informações, tecnologias e culturas",
              "Relacionar o texto em língua estrangeira, suas estruturas linguísticas, função e uso social",
              "Reconhecer a produção cultural em língua estrangeira como representação da diversidade cultural e linguística",
            ],
          },
        ],
      },
      {
        key: "artes",
        name: "Artes",
        subject: "",
        topics: [
          {
            title: "Produção e recepção de textos artísticos",
            subtitle:
              "interpretação e representação do mundo para o fortalecimento dos processos de identidade e cidadania",
            items: [
              "Artes Visuais: estrutura morfológica, sintática, o contexto da obra artística, o contexto da comunidade",
              "Teatro: estrutura morfológica, sintática, o contexto da obra artística, o contexto da comunidade, as fontes de criação",
              "Música: estrutura morfológica, sintática, o contexto da obra artística, o contexto da comunidade, as fontes de criação",
              "Dança: estrutura morfológica, sintática, o contexto da obra artística, o contexto da comunidade, as fontes de criação",
              "Conteúdos estruturantes das linguagens artísticas (Artes Visuais, Dança, Música, Teatro), elaborados a partir de suas estruturas morfológicas e sintáticas",
              "Inclusão, diversidade e multiculturalidade: a valorização da pluralidade expressada nas produções estéticas e artísticas das minorias sociais e dos portadores de necessidades especiais educacionais",
            ],
          },
        ],
      },
      {
        key: "edfisica",
        name: "Educação Física",
        subject: "",
        topics: [
          {
            title: "Estudo das práticas corporais",
            subtitle:
              "a linguagem corporal como integradora social e formadora de identidade",
            items: [
              "Performance corporal e identidades juvenis",
              "Possibilidades de vivência crítica e emancipada do lazer",
              "Mitos e verdades sobre os corpos masculino e feminino na sociedade atual",
              "Exercício físico e saúde",
              "O corpo e a expressão artística e cultural",
              "O corpo no mundo dos símbolos e como produção da cultura",
              "Práticas corporais e autonomia",
              "Condicionamentos e esforços físicos",
              "O esporte",
              "A dança",
              "As lutas",
              "Os jogos",
              "As brincadeiras",
            ],
          },
        ],
      },
    ],
  },
  {
    area: "MT",
    name: "Matemática e suas Tecnologias",
    disciplines: [
      {
        key: "matematica",
        name: "Matemática",
        subject: "Matemática",
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
        subject: "Física",
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
        subject: "Química",
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
        subject: "Biologia",
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
  {
    area: "CH",
    name: "Ciências Humanas e suas Tecnologias",
    disciplines: [
      {
        key: "historia",
        name: "História",
        subject: "História",
        topics: [
          {
            title: "Diversidade cultural, conflitos e vida em sociedade",
            items: [
              "A Conquista da América. Conflitos entre europeus e indígenas na América colonial. A escravidão e formas de resistência indígena e africana na América",
              "História cultural dos povos africanos. A luta dos negros no Brasil e o negro na formação da sociedade brasileira",
              "História dos povos indígenas e a formação sócio-cultural brasileira",
              "Movimentos culturais no mundo ocidental e seus impactos na vida política e social",
            ],
          },
          {
            title:
              "Formas de organização social, movimentos sociais, pensamento político e ação do Estado",
            items: [
              "Revoluções sociais e políticas na Europa Moderna",
              "As lutas pela conquista da independência política das colônias da América",
              "Grupos sociais em conflito no Brasil imperial e a construção da nação",
              "A atuação dos grupos sociais e os grandes processos revolucionários do século XX: Revolução Bolchevique, Revolução Chinesa, Revolução Cubana",
              "Geopolítica e conflitos entre os séculos XIX e XX: Imperialismo, a ocupação da Ásia e da África, as Guerras Mundiais e a Guerra Fria",
              "Os sistemas totalitários na Europa do século XX: nazi-fascista, franquismo, salazarismo e stalinismo. Ditaduras políticas na América Latina: Estado Novo no Brasil e ditaduras na América",
            ],
          },
          {
            title: "Características e transformações das estruturas produtivas",
            items: [
              "Economia agro-exportadora brasileira: complexo açucareiro; a mineração no período colonial; a economia cafeeira; a borracha na Amazônia",
              "Revolução Industrial: criação do sistema de fábrica na Europa e transformações no processo de produção. Formação do espaço urbano-industrial. Transformações na estrutura produtiva no século XX: o fordismo, o toyotismo, as novas técnicas de produção e seus impactos",
              "A industrialização brasileira, a urbanização e as transformações sociais e trabalhistas",
            ],
          },
        ],
      },
      {
        key: "geografia",
        name: "Geografia",
        subject: "Geografia",
        topics: [
          {
            title:
              "Formas de organização social, movimentos sociais, pensamento político e ação do Estado",
            items: [
              "Formação territorial brasileira; as regiões brasileiras; políticas de reordenamento territorial",
              "Políticas de colonização, migração, imigração e emigração no Brasil nos séculos XIX e XX",
              "Conflitos político-culturais pós-Guerra Fria, reorganização política internacional e os organismos multilaterais nos séculos XX e XXI",
              "Vida urbana: redes e hierarquia nas cidades, pobreza e segregação espacial",
            ],
          },
          {
            title: "Características e transformações das estruturas produtivas",
            items: [
              "A globalização e as novas tecnologias de telecomunicação e suas consequências econômicas, políticas e sociais",
              "Produção e transformação dos espaços agrários. Modernização da agricultura e estruturas agrárias tradicionais. O agronegócio, a agricultura familiar, os assalariados do campo e as lutas sociais no campo. A relação campo-cidade",
            ],
          },
          {
            title:
              "Os domínios naturais e a relação do ser humano com o ambiente",
            items: [
              "Relação homem-natureza, a apropriação dos recursos naturais pelas sociedades ao longo do tempo. Impacto ambiental das atividades econômicas no Brasil. Recursos minerais e energéticos: exploração e impactos. Recursos hídricos; bacias hidrográficas e seus aproveitamentos",
              "As questões ambientais contemporâneas: mudança climática, ilhas de calor, efeito estufa, chuva ácida, a destruição da camada de ozônio. A nova ordem ambiental internacional; políticas territoriais ambientais; uso e conservação dos recursos naturais, unidades de conservação, corredores ecológicos, zoneamento ecológico e econômico",
              "Origem e evolução do conceito de sustentabilidade",
              "Estrutura interna da terra. Estruturas do solo e do relevo; agentes internos e externos modeladores do relevo",
              "Situação geral da atmosfera e classificação climática. As características climáticas do território brasileiro",
              "Os grandes domínios da vegetação no Brasil e no mundo",
            ],
          },
          {
            title: "Representação espacial",
            items: [
              "Projeções cartográficas; leitura de mapas temáticos, físicos e políticos; tecnologias modernas aplicadas à cartografia",
            ],
          },
        ],
      },
      {
        key: "filosofia",
        name: "Filosofia",
        subject: "Filosofia",
        topics: [
          {
            title:
              "Formas de organização social, movimentos sociais, pensamento político e ação do Estado",
            items: [
              "Cidadania e democracia na Antiguidade; Estado e direitos do cidadão a partir da Idade Moderna; democracia direta, indireta e representativa",
              "O desenvolvimento do pensamento liberal na sociedade capitalista e seus críticos nos séculos XIX e XX",
            ],
          },
        ],
      },
      {
        key: "sociologia",
        name: "Sociologia",
        subject: "Sociologia",
        topics: [
          {
            title: "Diversidade cultural, conflitos e vida em sociedade",
            items: [
              "Cultura Material e imaterial; patrimônio e diversidade cultural no Brasil",
            ],
          },
          {
            title:
              "Formas de organização social, movimentos sociais, pensamento político e ação do Estado",
            items: [
              "A luta pela conquista de direitos pelos cidadãos: direitos civis, humanos, políticos e sociais. Direitos sociais nas constituições brasileiras. Políticas afirmativas",
            ],
          },
          {
            title: "Características e transformações das estruturas produtivas",
            items: [
              "Diferentes formas de organização da produção: escravismo antigo, feudalismo, capitalismo, socialismo e suas diferentes experiências",
            ],
          },
        ],
      },
    ],
  },
];

export const itemKey = (d: string, t: number, i: number) => `${d}.${t}.${i}`;

export const ALL_ITEM_KEYS = MATRIZ.flatMap((a) =>
  a.disciplines.flatMap((d) =>
    d.topics.flatMap((t, ti) => t.items.map((_, ii) => itemKey(d.key, ti, ii))),
  ),
);

/** Próximo tópico ainda não estudado de uma matéria (para o cronograma). */
export function nextTopic(subject: string, status: Record<string, number>) {
  for (const a of MATRIZ)
    for (const d of a.disciplines) {
      if (d.subject !== subject) continue;
      for (let ti = 0; ti < d.topics.length; ti++) {
        const t = d.topics[ti];
        if (t.items.some((_, ii) => !status[itemKey(d.key, ti, ii)]))
          return t.title;
      }
    }
  return "";
}
