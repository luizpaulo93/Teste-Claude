/**
 * Conteúdos de Matemática e Ciências da Natureza para o ENEM, por disciplina e frente.
 * Nomes concretos (o que o aluno estuda de fato), no padrão dos cronogramas de cursinho,
 * cobrindo os objetos de conhecimento da Matriz de Referência.
 * Prioridade (levantamentos de incidência do ENEM — Aprova Total, Estratégia, Projeto Medicina):
 * 3 = mais cobrado, 2 = cobrado com frequência, 1 = cobrado às vezes.
 */

export interface MatrizItem {
  key: string;
  title: string;
  priority: number;
}
export interface MatrizBlock {
  title: string;
  items: MatrizItem[];
}
export interface MatrizDiscipline {
  key: string;
  name: string;
  blocks: MatrizBlock[];
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
        blocks: [
          {
            title: "Matemática básica",
            items: [
              {
                key: "matematica.operacoes-com-fracoes-e-numeros-decimais",
                title: "Operações com frações e números decimais",
                priority: 2,
              },
              {
                key: "matematica.potenciacao-e-radiciacao",
                title: "Potenciação e radiciação",
                priority: 2,
              },
              {
                key: "matematica.notacao-cientifica",
                title: "Notação científica",
                priority: 2,
              },
              {
                key: "matematica.divisibilidade-mmc-e-mdc",
                title: "Divisibilidade, MMC e MDC",
                priority: 2,
              },
              {
                key: "matematica.razao-e-proporcao",
                title: "Razão e proporção",
                priority: 3,
              },
              {
                key: "matematica.regra-de-tres-simples-e-composta",
                title: "Regra de três simples e composta",
                priority: 3,
              },
              {
                key: "matematica.porcentagem",
                title: "Porcentagem",
                priority: 3,
              },
              {
                key: "matematica.juros-simples-e-compostos",
                title: "Juros simples e compostos",
                priority: 2,
              },
              {
                key: "matematica.grandezas-e-unidades-de-medida",
                title: "Grandezas e unidades de medida",
                priority: 3,
              },
              {
                key: "matematica.escalas",
                title: "Escalas",
                priority: 3,
              },
            ],
          },
          {
            title: "Álgebra e funções",
            items: [
              {
                key: "matematica.equacoes-do-1o-grau",
                title: "Equações do 1º grau",
                priority: 2,
              },
              {
                key: "matematica.equacoes-do-2o-grau",
                title: "Equações do 2º grau",
                priority: 2,
              },
              {
                key: "matematica.sistemas-de-equacoes",
                title: "Sistemas de equações",
                priority: 2,
              },
              {
                key: "matematica.inequacoes",
                title: "Inequações",
                priority: 1,
              },
              {
                key: "matematica.leitura-e-interpretacao-de-graficos",
                title: "Leitura e interpretação de gráficos",
                priority: 3,
              },
              {
                key: "matematica.funcao-afim-1o-grau",
                title: "Função afim (1º grau)",
                priority: 3,
              },
              {
                key: "matematica.funcao-quadratica-2o-grau",
                title: "Função quadrática (2º grau)",
                priority: 3,
              },
              {
                key: "matematica.funcao-exponencial",
                title: "Função exponencial",
                priority: 2,
              },
              {
                key: "matematica.logaritmo-e-funcao-logaritmica",
                title: "Logaritmo e função logarítmica",
                priority: 2,
              },
              {
                key: "matematica.progressao-aritmetica-pa",
                title: "Progressão aritmética (PA)",
                priority: 2,
              },
              {
                key: "matematica.progressao-geometrica-pg",
                title: "Progressão geométrica (PG)",
                priority: 2,
              },
              {
                key: "matematica.matrizes-e-determinantes",
                title: "Matrizes e determinantes",
                priority: 1,
              },
            ],
          },
          {
            title: "Estatística e probabilidade",
            items: [
              {
                key: "matematica.tabelas-e-graficos-estatisticos",
                title: "Tabelas e gráficos estatísticos",
                priority: 3,
              },
              {
                key: "matematica.media-aritmetica-e-ponderada",
                title: "Média aritmética e ponderada",
                priority: 3,
              },
              {
                key: "matematica.moda-e-mediana",
                title: "Moda e mediana",
                priority: 3,
              },
              {
                key: "matematica.desvio-padrao-e-variancia",
                title: "Desvio padrão e variância",
                priority: 2,
              },
              {
                key: "matematica.principio-fundamental-da-contagem",
                title: "Princípio fundamental da contagem",
                priority: 3,
              },
              {
                key: "matematica.permutacao",
                title: "Permutação",
                priority: 2,
              },
              {
                key: "matematica.arranjo-e-combinacao",
                title: "Arranjo e combinação",
                priority: 2,
              },
              {
                key: "matematica.probabilidade",
                title: "Probabilidade",
                priority: 3,
              },
            ],
          },
          {
            title: "Geometria plana",
            items: [
              {
                key: "matematica.angulos-e-retas-paralelas",
                title: "Ângulos e retas paralelas",
                priority: 1,
              },
              {
                key: "matematica.semelhanca-de-triangulos-e-teorema-de-tales",
                title: "Semelhança de triângulos e Teorema de Tales",
                priority: 2,
              },
              {
                key: "matematica.teorema-de-pitagoras",
                title: "Teorema de Pitágoras",
                priority: 3,
              },
              {
                key: "matematica.relacoes-metricas-no-triangulo-retangulo",
                title: "Relações métricas no triângulo retângulo",
                priority: 2,
              },
              {
                key: "matematica.trigonometria-no-triangulo-retangulo",
                title: "Trigonometria no triângulo retângulo",
                priority: 2,
              },
              {
                key: "matematica.areas-de-figuras-planas",
                title: "Áreas de figuras planas",
                priority: 3,
              },
              {
                key: "matematica.circunferencia-e-circulo-comprimento-e-area",
                title: "Circunferência e círculo: comprimento e área",
                priority: 3,
              },
              {
                key: "matematica.simetria-e-transformacoes-geometricas",
                title: "Simetria e transformações geométricas",
                priority: 1,
              },
            ],
          },
          {
            title: "Geometria espacial",
            items: [
              {
                key: "matematica.planificacao-e-vistas-de-solidos",
                title: "Planificação e vistas de sólidos",
                priority: 3,
              },
              {
                key: "matematica.prismas-e-cubos-area-e-volume",
                title: "Prismas e cubos: área e volume",
                priority: 3,
              },
              {
                key: "matematica.cilindro-area-e-volume",
                title: "Cilindro: área e volume",
                priority: 3,
              },
              {
                key: "matematica.piramides-e-cones",
                title: "Pirâmides e cones",
                priority: 2,
              },
              {
                key: "matematica.esfera",
                title: "Esfera",
                priority: 2,
              },
              {
                key: "matematica.poliedros-e-relacao-de-euler",
                title: "Poliedros e relação de Euler",
                priority: 1,
              },
            ],
          },
          {
            title: "Geometria analítica e trigonometria",
            items: [
              {
                key: "matematica.plano-cartesiano-e-distancia-entre-pontos",
                title: "Plano cartesiano e distância entre pontos",
                priority: 2,
              },
              {
                key: "matematica.equacao-da-reta",
                title: "Equação da reta",
                priority: 1,
              },
              {
                key: "matematica.equacao-da-circunferencia",
                title: "Equação da circunferência",
                priority: 1,
              },
              {
                key: "matematica.ciclo-trigonometrico-e-funcoes-trigonometricas",
                title: "Ciclo trigonométrico e funções trigonométricas",
                priority: 1,
              },
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
        blocks: [
          {
            title: "Fundamentos",
            items: [
              {
                key: "fisica.notacao-cientifica-e-ordem-de-grandeza",
                title: "Notação científica e ordem de grandeza",
                priority: 2,
              },
              {
                key: "fisica.sistema-internacional-de-unidades",
                title: "Sistema Internacional de Unidades",
                priority: 2,
              },
              {
                key: "fisica.vetores",
                title: "Vetores",
                priority: 1,
              },
            ],
          },
          {
            title: "Cinemática",
            items: [
              {
                key: "fisica.velocidade-media",
                title: "Velocidade média",
                priority: 3,
              },
              {
                key: "fisica.movimento-uniforme-mu",
                title: "Movimento uniforme (MU)",
                priority: 3,
              },
              {
                key: "fisica.movimento-uniformemente-variado-muv",
                title: "Movimento uniformemente variado (MUV)",
                priority: 3,
              },
              {
                key: "fisica.graficos-do-movimento",
                title: "Gráficos do movimento",
                priority: 3,
              },
              {
                key: "fisica.queda-livre-e-lancamentos",
                title: "Queda livre e lançamentos",
                priority: 2,
              },
              {
                key: "fisica.movimento-circular",
                title: "Movimento circular",
                priority: 2,
              },
            ],
          },
          {
            title: "Dinâmica e energia",
            items: [
              {
                key: "fisica.leis-de-newton",
                title: "Leis de Newton",
                priority: 3,
              },
              {
                key: "fisica.forca-peso-normal-e-tracao",
                title: "Força peso, normal e tração",
                priority: 2,
              },
              {
                key: "fisica.forca-de-atrito",
                title: "Força de atrito",
                priority: 2,
              },
              {
                key: "fisica.plano-inclinado",
                title: "Plano inclinado",
                priority: 1,
              },
              {
                key: "fisica.forca-centripeta",
                title: "Força centrípeta",
                priority: 2,
              },
              {
                key: "fisica.trabalho-de-uma-forca",
                title: "Trabalho de uma força",
                priority: 3,
              },
              {
                key: "fisica.energia-cinetica-e-potencial",
                title: "Energia cinética e potencial",
                priority: 3,
              },
              {
                key: "fisica.conservacao-da-energia-mecanica",
                title: "Conservação da energia mecânica",
                priority: 3,
              },
              {
                key: "fisica.potencia-e-rendimento",
                title: "Potência e rendimento",
                priority: 3,
              },
              {
                key: "fisica.impulso-e-quantidade-de-movimento",
                title: "Impulso e quantidade de movimento",
                priority: 2,
              },
              {
                key: "fisica.colisoes",
                title: "Colisões",
                priority: 1,
              },
              {
                key: "fisica.gravitacao-universal-e-leis-de-kepler",
                title: "Gravitação universal e Leis de Kepler",
                priority: 2,
              },
            ],
          },
          {
            title: "Estática e hidrostática",
            items: [
              {
                key: "fisica.equilibrio-torque-e-alavancas",
                title: "Equilíbrio, torque e alavancas",
                priority: 2,
              },
              {
                key: "fisica.pressao-e-densidade",
                title: "Pressão e densidade",
                priority: 2,
              },
              {
                key: "fisica.teorema-de-stevin",
                title: "Teorema de Stevin",
                priority: 2,
              },
              {
                key: "fisica.principio-de-pascal",
                title: "Princípio de Pascal",
                priority: 2,
              },
              {
                key: "fisica.empuxo-principio-de-arquimedes",
                title: "Empuxo (Princípio de Arquimedes)",
                priority: 2,
              },
            ],
          },
          {
            title: "Termologia",
            items: [
              {
                key: "fisica.temperatura-e-escalas-termometricas",
                title: "Temperatura e escalas termométricas",
                priority: 2,
              },
              {
                key: "fisica.calorimetria-calor-sensivel-e-latente",
                title: "Calorimetria: calor sensível e latente",
                priority: 3,
              },
              {
                key: "fisica.mudancas-de-estado-fisico",
                title: "Mudanças de estado físico",
                priority: 3,
              },
              {
                key: "fisica.propagacao-do-calor-conducao-conveccao-e-irradia",
                title: "Propagação do calor: condução, convecção e irradiação",
                priority: 3,
              },
              {
                key: "fisica.dilatacao-termica",
                title: "Dilatação térmica",
                priority: 2,
              },
              {
                key: "fisica.estudo-dos-gases",
                title: "Estudo dos gases",
                priority: 2,
              },
              {
                key: "fisica.termodinamica-e-maquinas-termicas",
                title: "Termodinâmica e máquinas térmicas",
                priority: 3,
              },
            ],
          },
          {
            title: "Ondulatória",
            items: [
              {
                key: "fisica.caracteristicas-das-ondas-frequencia-periodo-e-c",
                title:
                  "Características das ondas: frequência, período e comprimento",
                priority: 3,
              },
              {
                key: "fisica.equacao-fundamental-da-onda",
                title: "Equação fundamental da onda",
                priority: 3,
              },
              {
                key: "fisica.fenomenos-ondulatorios-reflexao-refracao-difraca",
                title:
                  "Fenômenos ondulatórios: reflexão, refração, difração e interferência",
                priority: 3,
              },
              {
                key: "fisica.acustica-e-som",
                title: "Acústica e som",
                priority: 3,
              },
              {
                key: "fisica.espectro-eletromagnetico",
                title: "Espectro eletromagnético",
                priority: 2,
              },
              {
                key: "fisica.efeito-doppler",
                title: "Efeito Doppler",
                priority: 2,
              },
            ],
          },
          {
            title: "Óptica",
            items: [
              {
                key: "fisica.principios-da-optica-geometrica",
                title: "Princípios da óptica geométrica",
                priority: 2,
              },
              {
                key: "fisica.espelhos-planos-e-esfericos",
                title: "Espelhos planos e esféricos",
                priority: 2,
              },
              {
                key: "fisica.refracao-da-luz",
                title: "Refração da luz",
                priority: 3,
              },
              {
                key: "fisica.lentes-e-instrumentos-opticos",
                title: "Lentes e instrumentos ópticos",
                priority: 3,
              },
              {
                key: "fisica.olho-humano-e-defeitos-da-visao",
                title: "Olho humano e defeitos da visão",
                priority: 3,
              },
            ],
          },
          {
            title: "Eletricidade",
            items: [
              {
                key: "fisica.carga-eletrica-e-processos-de-eletrizacao",
                title: "Carga elétrica e processos de eletrização",
                priority: 2,
              },
              {
                key: "fisica.lei-de-coulomb-e-campo-eletrico",
                title: "Lei de Coulomb e campo elétrico",
                priority: 2,
              },
              {
                key: "fisica.corrente-eletrica",
                title: "Corrente elétrica",
                priority: 3,
              },
              {
                key: "fisica.resistores-e-lei-de-ohm",
                title: "Resistores e Lei de Ohm",
                priority: 3,
              },
              {
                key: "fisica.associacao-de-resistores",
                title: "Associação de resistores",
                priority: 3,
              },
              {
                key: "fisica.potencia-eletrica-e-consumo-de-energia-kwh",
                title: "Potência elétrica e consumo de energia (kWh)",
                priority: 3,
              },
              {
                key: "fisica.circuitos-eletricos-e-medidores",
                title: "Circuitos elétricos e medidores",
                priority: 3,
              },
              {
                key: "fisica.geradores-e-receptores",
                title: "Geradores e receptores",
                priority: 2,
              },
              {
                key: "fisica.capacitores",
                title: "Capacitores",
                priority: 1,
              },
            ],
          },
          {
            title: "Magnetismo",
            items: [
              {
                key: "fisica.imas-e-campo-magnetico",
                title: "Ímãs e campo magnético",
                priority: 2,
              },
              {
                key: "fisica.forca-magnetica",
                title: "Força magnética",
                priority: 1,
              },
              {
                key: "fisica.inducao-eletromagnetica-e-transformadores",
                title: "Indução eletromagnética e transformadores",
                priority: 2,
              },
            ],
          },
        ],
      },
      {
        key: "quimica",
        name: "Química",
        blocks: [
          {
            title: "Química geral",
            items: [
              {
                key: "quimica.propriedades-da-materia",
                title: "Propriedades da matéria",
                priority: 2,
              },
              {
                key: "quimica.substancias-e-misturas",
                title: "Substâncias e misturas",
                priority: 3,
              },
              {
                key: "quimica.separacao-de-misturas",
                title: "Separação de misturas",
                priority: 3,
              },
              {
                key: "quimica.modelos-atomicos",
                title: "Modelos atômicos",
                priority: 2,
              },
              {
                key: "quimica.estrutura-do-atomo-numero-atomico-massa-e-isotop",
                title: "Estrutura do átomo: número atômico, massa e isótopos",
                priority: 2,
              },
              {
                key: "quimica.tabela-periodica-e-propriedades-periodicas",
                title: "Tabela periódica e propriedades periódicas",
                priority: 2,
              },
              {
                key: "quimica.ligacoes-ionicas-covalentes-e-metalicas",
                title: "Ligações iônicas, covalentes e metálicas",
                priority: 3,
              },
              {
                key: "quimica.polaridade-das-moleculas",
                title: "Polaridade das moléculas",
                priority: 3,
              },
              {
                key: "quimica.forcas-intermoleculares",
                title: "Forças intermoleculares",
                priority: 3,
              },
              {
                key: "quimica.funcoes-inorganicas-acidos-e-bases",
                title: "Funções inorgânicas: ácidos e bases",
                priority: 3,
              },
              {
                key: "quimica.funcoes-inorganicas-sais-e-oxidos",
                title: "Funções inorgânicas: sais e óxidos",
                priority: 2,
              },
              {
                key: "quimica.reacoes-quimicas-e-balanceamento",
                title: "Reações químicas e balanceamento",
                priority: 3,
              },
              {
                key: "quimica.numero-de-oxidacao",
                title: "Número de oxidação",
                priority: 2,
              },
              {
                key: "quimica.radioatividade",
                title: "Radioatividade",
                priority: 2,
              },
            ],
          },
          {
            title: "Estequiometria",
            items: [
              {
                key: "quimica.mol-massa-molar-e-constante-de-avogadro",
                title: "Mol, massa molar e constante de Avogadro",
                priority: 3,
              },
              {
                key: "quimica.calculo-estequiometrico",
                title: "Cálculo estequiométrico",
                priority: 3,
              },
              {
                key: "quimica.reagente-limitante-pureza-e-rendimento",
                title: "Reagente limitante, pureza e rendimento",
                priority: 3,
              },
              {
                key: "quimica.gases-equacao-de-clapeyron",
                title: "Gases: equação de Clapeyron",
                priority: 2,
              },
            ],
          },
          {
            title: "Físico-química",
            items: [
              {
                key: "quimica.solucoes-e-concentracao-g-l-mol-l-e",
                title: "Soluções e concentração (g/L, mol/L e %)",
                priority: 3,
              },
              {
                key: "quimica.diluicao-e-mistura-de-solucoes",
                title: "Diluição e mistura de soluções",
                priority: 2,
              },
              {
                key: "quimica.propriedades-coligativas",
                title: "Propriedades coligativas",
                priority: 2,
              },
              {
                key: "quimica.termoquimica-entalpia-e-lei-de-hess",
                title: "Termoquímica: entalpia e Lei de Hess",
                priority: 3,
              },
              {
                key: "quimica.cinetica-quimica",
                title: "Cinética química",
                priority: 2,
              },
              {
                key: "quimica.equilibrio-quimico",
                title: "Equilíbrio químico",
                priority: 2,
              },
              {
                key: "quimica.ph-poh-e-equilibrio-ionico",
                title: "pH, pOH e equilíbrio iônico",
                priority: 3,
              },
              {
                key: "quimica.hidrolise-salina-e-solucao-tampao",
                title: "Hidrólise salina e solução-tampão",
                priority: 1,
              },
              {
                key: "quimica.eletroquimica-pilhas",
                title: "Eletroquímica: pilhas",
                priority: 3,
              },
              {
                key: "quimica.eletrolise",
                title: "Eletrólise",
                priority: 2,
              },
            ],
          },
          {
            title: "Química orgânica",
            items: [
              {
                key: "quimica.cadeias-carbonicas",
                title: "Cadeias carbônicas",
                priority: 2,
              },
              {
                key: "quimica.hidrocarbonetos",
                title: "Hidrocarbonetos",
                priority: 2,
              },
              {
                key: "quimica.funcoes-oxigenadas-alcool-aldeido-cetona-acido-e",
                title:
                  "Funções oxigenadas: álcool, aldeído, cetona, ácido e éster",
                priority: 3,
              },
              {
                key: "quimica.funcoes-nitrogenadas-aminas-e-amidas",
                title: "Funções nitrogenadas: aminas e amidas",
                priority: 2,
              },
              {
                key: "quimica.isomeria",
                title: "Isomeria",
                priority: 2,
              },
              {
                key: "quimica.reacoes-organicas-combustao-esterificacao-e-sapo",
                title:
                  "Reações orgânicas: combustão, esterificação e saponificação",
                priority: 3,
              },
              {
                key: "quimica.polimeros",
                title: "Polímeros",
                priority: 3,
              },
              {
                key: "quimica.petroleo-e-combustiveis",
                title: "Petróleo e combustíveis",
                priority: 3,
              },
              {
                key: "quimica.bioquimica-carboidratos-lipidios-e-proteinas",
                title: "Bioquímica: carboidratos, lipídios e proteínas",
                priority: 2,
              },
            ],
          },
          {
            title: "Química ambiental",
            items: [
              {
                key: "quimica.poluicao-do-ar-chuva-acida-e-efeito-estufa",
                title: "Poluição do ar, chuva ácida e efeito estufa",
                priority: 3,
              },
              {
                key: "quimica.tratamento-de-agua-e-esgoto",
                title: "Tratamento de água e esgoto",
                priority: 3,
              },
              {
                key: "quimica.quimica-verde-e-reciclagem",
                title: "Química verde e reciclagem",
                priority: 2,
              },
            ],
          },
        ],
      },
      {
        key: "biologia",
        name: "Biologia",
        blocks: [
          {
            title: "Ecologia",
            items: [
              {
                key: "biologia.cadeias-e-teias-alimentares",
                title: "Cadeias e teias alimentares",
                priority: 3,
              },
              {
                key: "biologia.fluxo-de-energia-e-piramides-ecologicas",
                title: "Fluxo de energia e pirâmides ecológicas",
                priority: 3,
              },
              {
                key: "biologia.ciclos-biogeoquimicos-carbono-nitrogenio-e-agua",
                title: "Ciclos biogeoquímicos: carbono, nitrogênio e água",
                priority: 3,
              },
              {
                key: "biologia.relacoes-ecologicas",
                title: "Relações ecológicas",
                priority: 3,
              },
              {
                key: "biologia.dinamica-de-populacoes",
                title: "Dinâmica de populações",
                priority: 2,
              },
              {
                key: "biologia.sucessao-ecologica",
                title: "Sucessão ecológica",
                priority: 2,
              },
              {
                key: "biologia.biomas-brasileiros",
                title: "Biomas brasileiros",
                priority: 3,
              },
              {
                key: "biologia.impactos-ambientais-e-poluicao",
                title: "Impactos ambientais e poluição",
                priority: 3,
              },
              {
                key: "biologia.aquecimento-global-e-efeito-estufa",
                title: "Aquecimento global e efeito estufa",
                priority: 3,
              },
              {
                key: "biologia.conservacao-e-desenvolvimento-sustentavel",
                title: "Conservação e desenvolvimento sustentável",
                priority: 2,
              },
            ],
          },
          {
            title: "Citologia e bioenergética",
            items: [
              {
                key: "biologia.membrana-plasmatica-e-transportes",
                title: "Membrana plasmática e transportes",
                priority: 2,
              },
              {
                key: "biologia.organelas-celulares",
                title: "Organelas celulares",
                priority: 2,
              },
              {
                key: "biologia.nucleo-dna-e-rna",
                title: "Núcleo, DNA e RNA",
                priority: 3,
              },
              {
                key: "biologia.sintese-de-proteinas",
                title: "Síntese de proteínas",
                priority: 3,
              },
              {
                key: "biologia.mitose-e-meiose",
                title: "Mitose e meiose",
                priority: 2,
              },
              {
                key: "biologia.respiracao-celular-e-fermentacao",
                title: "Respiração celular e fermentação",
                priority: 3,
              },
              {
                key: "biologia.fotossintese",
                title: "Fotossíntese",
                priority: 3,
              },
            ],
          },
          {
            title: "Genética e biotecnologia",
            items: [
              {
                key: "biologia.1a-lei-de-mendel",
                title: "1ª Lei de Mendel",
                priority: 3,
              },
              {
                key: "biologia.heredogramas",
                title: "Heredogramas",
                priority: 2,
              },
              {
                key: "biologia.grupos-sanguineos-sistema-abo-e-fator-rh",
                title: "Grupos sanguíneos: sistema ABO e fator Rh",
                priority: 3,
              },
              {
                key: "biologia.heranca-ligada-ao-sexo",
                title: "Herança ligada ao sexo",
                priority: 2,
              },
              {
                key: "biologia.mutacoes",
                title: "Mutações",
                priority: 2,
              },
              {
                key: "biologia.dna-recombinante-e-transgenicos",
                title: "DNA recombinante e transgênicos",
                priority: 3,
              },
              {
                key: "biologia.clonagem-e-celulas-tronco",
                title: "Clonagem e células-tronco",
                priority: 2,
              },
              {
                key: "biologia.testes-de-dna-e-paternidade",
                title: "Testes de DNA e paternidade",
                priority: 2,
              },
            ],
          },
          {
            title: "Evolução",
            items: [
              {
                key: "biologia.origem-da-vida",
                title: "Origem da vida",
                priority: 1,
              },
              {
                key: "biologia.teorias-evolutivas-lamarck-e-darwin",
                title: "Teorias evolutivas: Lamarck e Darwin",
                priority: 2,
              },
              {
                key: "biologia.selecao-natural-e-adaptacao",
                title: "Seleção natural e adaptação",
                priority: 3,
              },
              {
                key: "biologia.teoria-sintetica-e-especiacao",
                title: "Teoria sintética e especiação",
                priority: 2,
              },
            ],
          },
          {
            title: "Fisiologia humana",
            items: [
              {
                key: "biologia.sistema-digestorio",
                title: "Sistema digestório",
                priority: 2,
              },
              {
                key: "biologia.sistema-respiratorio",
                title: "Sistema respiratório",
                priority: 2,
              },
              {
                key: "biologia.sistema-circulatorio",
                title: "Sistema circulatório",
                priority: 2,
              },
              {
                key: "biologia.sistema-excretor",
                title: "Sistema excretor",
                priority: 2,
              },
              {
                key: "biologia.sistema-nervoso",
                title: "Sistema nervoso",
                priority: 2,
              },
              {
                key: "biologia.sistema-endocrino-e-hormonios",
                title: "Sistema endócrino e hormônios",
                priority: 2,
              },
              {
                key: "biologia.sistema-imunologico-e-vacinas",
                title: "Sistema imunológico e vacinas",
                priority: 3,
              },
              {
                key: "biologia.reproducao-humana-e-metodos-contraceptivos",
                title: "Reprodução humana e métodos contraceptivos",
                priority: 2,
              },
              {
                key: "biologia.embriologia",
                title: "Embriologia",
                priority: 1,
              },
            ],
          },
          {
            title: "Seres vivos e saúde",
            items: [
              {
                key: "biologia.virus-e-viroses",
                title: "Vírus e viroses",
                priority: 3,
              },
              {
                key: "biologia.bacterias-e-bacterioses",
                title: "Bactérias e bacterioses",
                priority: 3,
              },
              {
                key: "biologia.protozoarios-e-protozooses",
                title: "Protozoários e protozooses",
                priority: 3,
              },
              {
                key: "biologia.verminoses",
                title: "Verminoses",
                priority: 2,
              },
              {
                key: "biologia.doencas-e-saneamento-basico",
                title: "Doenças e saneamento básico",
                priority: 3,
              },
              {
                key: "biologia.fungos",
                title: "Fungos",
                priority: 1,
              },
              {
                key: "biologia.grupos-de-plantas",
                title: "Grupos de plantas",
                priority: 2,
              },
              {
                key: "biologia.fisiologia-vegetal",
                title: "Fisiologia vegetal",
                priority: 2,
              },
              {
                key: "biologia.invertebrados",
                title: "Invertebrados",
                priority: 1,
              },
              {
                key: "biologia.vertebrados",
                title: "Vertebrados",
                priority: 1,
              },
            ],
          },
        ],
      },
    ],
  },
];

export const DISCIPLINES = MATRIZ.flatMap((a) => a.disciplines);

export interface Assunto {
  key: string;
  discipline: string;
  disciplineName: string;
  block: string;
  title: string;
  /** posição na lista (do primeiro ao último conteúdo) */
  index: number;
  priority: number;
}

export const ASSUNTOS: Assunto[] = DISCIPLINES.flatMap((d) => {
  let index = 0;
  return d.blocks.flatMap((b) =>
    b.items.map((i) => ({
      key: i.key,
      discipline: d.key,
      disciplineName: d.name,
      block: b.title,
      title: i.title,
      index: index++,
      priority: i.priority,
    })),
  );
});

export const ASSUNTO_BY_KEY = new Map(ASSUNTOS.map((a) => [a.key, a]));
