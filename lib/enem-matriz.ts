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
                key: "matematica.conjuntos-numericos-e-intervalos",
                title: "Conjuntos numéricos e intervalos",
                priority: 1,
              },
              {
                key: "matematica.operacoes-com-fracoes-e-numeros-decimais",
                title: "Operações com frações e números decimais",
                priority: 2,
              },
              {
                key: "matematica.expressoes-numericas",
                title: "Expressões numéricas",
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
                key: "matematica.numeros-primos-e-fatoracao",
                title: "Números primos e fatoração",
                priority: 1,
              },
              {
                key: "matematica.razao-e-proporcao",
                title: "Razão e proporção",
                priority: 3,
              },
              {
                key: "matematica.grandezas-diretamente-e-inversamente-proporciona",
                title: "Grandezas diretamente e inversamente proporcionais",
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
                key: "matematica.aumentos-e-descontos-sucessivos",
                title: "Aumentos e descontos sucessivos",
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
                key: "matematica.conversao-de-unidades-de-area-volume-e-capacidad",
                title: "Conversão de unidades de área, volume e capacidade",
                priority: 3,
              },
              {
                key: "matematica.escalas",
                title: "Escalas",
                priority: 3,
              },
              {
                key: "matematica.media-velocidade-e-taxas-de-variacao",
                title: "Média, velocidade e taxas de variação",
                priority: 2,
              },
            ],
          },
          {
            title: "Álgebra",
            items: [
              {
                key: "matematica.expressoes-algebricas-e-fatoracao",
                title: "Expressões algébricas e fatoração",
                priority: 1,
              },
              {
                key: "matematica.produtos-notaveis",
                title: "Produtos notáveis",
                priority: 1,
              },
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
                key: "matematica.sistemas-de-equacoes-do-1o-grau",
                title: "Sistemas de equações do 1º grau",
                priority: 2,
              },
              {
                key: "matematica.inequacoes-do-1o-e-2o-grau",
                title: "Inequações do 1º e 2º grau",
                priority: 1,
              },
              {
                key: "matematica.polinomios",
                title: "Polinômios",
                priority: 1,
              },
              {
                key: "matematica.matrizes",
                title: "Matrizes",
                priority: 1,
              },
              {
                key: "matematica.determinantes",
                title: "Determinantes",
                priority: 1,
              },
              {
                key: "matematica.sistemas-lineares",
                title: "Sistemas lineares",
                priority: 1,
              },
              {
                key: "matematica.numeros-complexos",
                title: "Números complexos",
                priority: 1,
              },
            ],
          },
          {
            title: "Funções",
            items: [
              {
                key: "matematica.conceito-de-funcao-dominio-e-imagem",
                title: "Conceito de função, domínio e imagem",
                priority: 2,
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
                key: "matematica.maximo-e-minimo-da-funcao-quadratica",
                title: "Máximo e mínimo da função quadrática",
                priority: 3,
              },
              {
                key: "matematica.funcao-modular",
                title: "Função modular",
                priority: 1,
              },
              {
                key: "matematica.funcao-exponencial",
                title: "Função exponencial",
                priority: 2,
              },
              {
                key: "matematica.logaritmo-e-propriedades",
                title: "Logaritmo e propriedades",
                priority: 2,
              },
              {
                key: "matematica.funcao-logaritmica",
                title: "Função logarítmica",
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
            ],
          },
          {
            title: "Estatística",
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
                key: "matematica.boxplot-e-quartis",
                title: "Boxplot e quartis",
                priority: 1,
              },
            ],
          },
          {
            title: "Análise combinatória e probabilidade",
            items: [
              {
                key: "matematica.principio-fundamental-da-contagem",
                title: "Princípio fundamental da contagem",
                priority: 3,
              },
              {
                key: "matematica.fatorial-e-permutacao",
                title: "Fatorial e permutação",
                priority: 2,
              },
              {
                key: "matematica.permutacao-com-repeticao",
                title: "Permutação com repetição",
                priority: 2,
              },
              {
                key: "matematica.arranjo-e-combinacao",
                title: "Arranjo e combinação",
                priority: 2,
              },
              {
                key: "matematica.probabilidade-simples",
                title: "Probabilidade simples",
                priority: 3,
              },
              {
                key: "matematica.probabilidade-condicional-e-eventos-independente",
                title: "Probabilidade condicional e eventos independentes",
                priority: 2,
              },
              {
                key: "matematica.binomio-de-newton",
                title: "Binômio de Newton",
                priority: 1,
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
                key: "matematica.triangulos-classificacao-e-propriedades",
                title: "Triângulos: classificação e propriedades",
                priority: 2,
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
                key: "matematica.lei-dos-senos-e-dos-cossenos",
                title: "Lei dos senos e dos cossenos",
                priority: 1,
              },
              {
                key: "matematica.poligonos-regulares-e-angulos-internos",
                title: "Polígonos regulares e ângulos internos",
                priority: 2,
              },
              {
                key: "matematica.quadrilateros-notaveis",
                title: "Quadriláteros notáveis",
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
              {
                key: "matematica.ladrilhamento-e-mosaicos",
                title: "Ladrilhamento e mosaicos",
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
                key: "matematica.piramide-area-e-volume",
                title: "Pirâmide: área e volume",
                priority: 2,
              },
              {
                key: "matematica.cone-area-e-volume",
                title: "Cone: área e volume",
                priority: 2,
              },
              {
                key: "matematica.esfera-area-e-volume",
                title: "Esfera: área e volume",
                priority: 2,
              },
              {
                key: "matematica.troncos-de-piramide-e-cone",
                title: "Troncos de pirâmide e cone",
                priority: 1,
              },
              {
                key: "matematica.poliedros-e-relacao-de-euler",
                title: "Poliedros e relação de Euler",
                priority: 1,
              },
              {
                key: "matematica.semelhanca-de-solidos-e-razao-entre-volumes",
                title: "Semelhança de sólidos e razão entre volumes",
                priority: 2,
              },
            ],
          },
          {
            title: "Geometria analítica",
            items: [
              {
                key: "matematica.plano-cartesiano-e-distancia-entre-pontos",
                title: "Plano cartesiano e distância entre pontos",
                priority: 2,
              },
              {
                key: "matematica.ponto-medio-e-alinhamento-de-tres-pontos",
                title: "Ponto médio e alinhamento de três pontos",
                priority: 1,
              },
              {
                key: "matematica.equacao-da-reta-e-coeficiente-angular",
                title: "Equação da reta e coeficiente angular",
                priority: 1,
              },
              {
                key: "matematica.retas-paralelas-e-perpendiculares",
                title: "Retas paralelas e perpendiculares",
                priority: 1,
              },
              {
                key: "matematica.equacao-da-circunferencia",
                title: "Equação da circunferência",
                priority: 1,
              },
            ],
          },
          {
            title: "Trigonometria",
            items: [
              {
                key: "matematica.arcos-e-angulos-em-radianos",
                title: "Arcos e ângulos em radianos",
                priority: 1,
              },
              {
                key: "matematica.ciclo-trigonometrico",
                title: "Ciclo trigonométrico",
                priority: 1,
              },
              {
                key: "matematica.funcoes-seno-e-cosseno-e-fenomenos-periodicos",
                title: "Funções seno e cosseno e fenômenos periódicos",
                priority: 2,
              },
              {
                key: "matematica.relacoes-trigonometricas-fundamentais",
                title: "Relações trigonométricas fundamentais",
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
                key: "fisica.analise-dimensional",
                title: "Análise dimensional",
                priority: 1,
              },
              {
                key: "fisica.grandezas-escalares-e-vetoriais",
                title: "Grandezas escalares e vetoriais",
                priority: 1,
              },
              {
                key: "fisica.operacoes-com-vetores",
                title: "Operações com vetores",
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
                key: "fisica.queda-livre-e-lancamento-vertical",
                title: "Queda livre e lançamento vertical",
                priority: 2,
              },
              {
                key: "fisica.lancamento-horizontal-e-obliquo",
                title: "Lançamento horizontal e oblíquo",
                priority: 2,
              },
              {
                key: "fisica.movimento-circular-uniforme-mcu",
                title: "Movimento circular uniforme (MCU)",
                priority: 2,
              },
              {
                key: "fisica.transmissao-de-movimento-polias-e-engrenagens",
                title: "Transmissão de movimento: polias e engrenagens",
                priority: 2,
              },
            ],
          },
          {
            title: "Dinâmica",
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
                key: "fisica.forca-elastica-e-lei-de-hooke",
                title: "Força elástica e Lei de Hooke",
                priority: 2,
              },
              {
                key: "fisica.forca-centripeta",
                title: "Força centrípeta",
                priority: 2,
              },
              {
                key: "fisica.impulso-e-quantidade-de-movimento",
                title: "Impulso e quantidade de movimento",
                priority: 2,
              },
              {
                key: "fisica.conservacao-da-quantidade-de-movimento-e-colisoe",
                title: "Conservação da quantidade de movimento e colisões",
                priority: 2,
              },
              {
                key: "fisica.gravitacao-universal",
                title: "Gravitação universal",
                priority: 2,
              },
              {
                key: "fisica.leis-de-kepler-e-satelites",
                title: "Leis de Kepler e satélites",
                priority: 1,
              },
            ],
          },
          {
            title: "Energia",
            items: [
              {
                key: "fisica.trabalho-de-uma-forca",
                title: "Trabalho de uma força",
                priority: 3,
              },
              {
                key: "fisica.energia-cinetica",
                title: "Energia cinética",
                priority: 3,
              },
              {
                key: "fisica.energia-potencial-gravitacional-e-elastica",
                title: "Energia potencial gravitacional e elástica",
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
                key: "fisica.fontes-e-transformacoes-de-energia",
                title: "Fontes e transformações de energia",
                priority: 3,
              },
            ],
          },
          {
            title: "Estática e hidrostática",
            items: [
              {
                key: "fisica.equilibrio-do-ponto-material",
                title: "Equilíbrio do ponto material",
                priority: 1,
              },
              {
                key: "fisica.torque-e-equilibrio-do-corpo-extenso",
                title: "Torque e equilíbrio do corpo extenso",
                priority: 2,
              },
              {
                key: "fisica.maquinas-simples-e-alavancas",
                title: "Máquinas simples e alavancas",
                priority: 2,
              },
              {
                key: "fisica.densidade-e-massa-especifica",
                title: "Densidade e massa específica",
                priority: 2,
              },
              {
                key: "fisica.pressao-e-pressao-atmosferica",
                title: "Pressão e pressão atmosférica",
                priority: 2,
              },
              {
                key: "fisica.teorema-de-stevin",
                title: "Teorema de Stevin",
                priority: 2,
              },
              {
                key: "fisica.principio-de-pascal-e-prensa-hidraulica",
                title: "Princípio de Pascal e prensa hidráulica",
                priority: 2,
              },
              {
                key: "fisica.empuxo-principio-de-arquimedes",
                title: "Empuxo (Princípio de Arquimedes)",
                priority: 2,
              },
              {
                key: "fisica.hidrodinamica-vazao-e-equacao-da-continuidade",
                title: "Hidrodinâmica: vazão e equação da continuidade",
                priority: 1,
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
                key: "fisica.dilatacao-termica-dos-solidos-e-liquidos",
                title: "Dilatação térmica dos sólidos e líquidos",
                priority: 2,
              },
              {
                key: "fisica.dilatacao-anomala-da-agua",
                title: "Dilatação anômala da água",
                priority: 1,
              },
              {
                key: "fisica.calorimetria-calor-sensivel",
                title: "Calorimetria: calor sensível",
                priority: 3,
              },
              {
                key: "fisica.calor-latente-e-mudancas-de-estado-fisico",
                title: "Calor latente e mudanças de estado físico",
                priority: 3,
              },
              {
                key: "fisica.diagrama-de-fases",
                title: "Diagrama de fases",
                priority: 1,
              },
              {
                key: "fisica.propagacao-do-calor-conducao-conveccao-e-irradia",
                title: "Propagação do calor: condução, convecção e irradiação",
                priority: 3,
              },
              {
                key: "fisica.estudo-dos-gases-ideais",
                title: "Estudo dos gases ideais",
                priority: 2,
              },
              {
                key: "fisica.1a-lei-da-termodinamica",
                title: "1ª Lei da Termodinâmica",
                priority: 3,
              },
              {
                key: "fisica.2a-lei-da-termodinamica-e-maquinas-termicas",
                title: "2ª Lei da Termodinâmica e máquinas térmicas",
                priority: 3,
              },
              {
                key: "fisica.ciclo-de-carnot-e-rendimento",
                title: "Ciclo de Carnot e rendimento",
                priority: 2,
              },
            ],
          },
          {
            title: "Ondulatória",
            items: [
              {
                key: "fisica.movimento-harmonico-simples-e-pendulo",
                title: "Movimento harmônico simples e pêndulo",
                priority: 1,
              },
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
                key: "fisica.reflexao-e-refracao-de-ondas",
                title: "Reflexão e refração de ondas",
                priority: 2,
              },
              {
                key: "fisica.difracao-e-interferencia",
                title: "Difração e interferência",
                priority: 2,
              },
              {
                key: "fisica.ressonancia-e-ondas-estacionarias",
                title: "Ressonância e ondas estacionárias",
                priority: 2,
              },
              {
                key: "fisica.acustica-qualidades-do-som",
                title: "Acústica: qualidades do som",
                priority: 3,
              },
              {
                key: "fisica.intensidade-sonora-e-nivel-sonoro-decibel",
                title: "Intensidade sonora e nível sonoro (decibel)",
                priority: 2,
              },
              {
                key: "fisica.efeito-doppler",
                title: "Efeito Doppler",
                priority: 2,
              },
              {
                key: "fisica.espectro-eletromagnetico",
                title: "Espectro eletromagnético",
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
                key: "fisica.sombra-penumbra-e-camara-escura",
                title: "Sombra, penumbra e câmara escura",
                priority: 1,
              },
              {
                key: "fisica.reflexao-e-espelhos-planos",
                title: "Reflexão e espelhos planos",
                priority: 2,
              },
              {
                key: "fisica.espelhos-esfericos",
                title: "Espelhos esféricos",
                priority: 2,
              },
              {
                key: "fisica.refracao-da-luz-e-indice-de-refracao",
                title: "Refração da luz e índice de refração",
                priority: 3,
              },
              {
                key: "fisica.reflexao-total-e-fibra-optica",
                title: "Reflexão total e fibra óptica",
                priority: 2,
              },
              {
                key: "fisica.dispersao-da-luz-e-cores",
                title: "Dispersão da luz e cores",
                priority: 2,
              },
              {
                key: "fisica.lentes-esfericas",
                title: "Lentes esféricas",
                priority: 3,
              },
              {
                key: "fisica.instrumentos-opticos",
                title: "Instrumentos ópticos",
                priority: 2,
              },
              {
                key: "fisica.olho-humano-e-defeitos-da-visao",
                title: "Olho humano e defeitos da visão",
                priority: 3,
              },
            ],
          },
          {
            title: "Eletrostática",
            items: [
              {
                key: "fisica.carga-eletrica-e-processos-de-eletrizacao",
                title: "Carga elétrica e processos de eletrização",
                priority: 2,
              },
              {
                key: "fisica.lei-de-coulomb",
                title: "Lei de Coulomb",
                priority: 2,
              },
              {
                key: "fisica.campo-eletrico",
                title: "Campo elétrico",
                priority: 2,
              },
              {
                key: "fisica.potencial-eletrico-e-energia-potencial-eletrica",
                title: "Potencial elétrico e energia potencial elétrica",
                priority: 1,
              },
              {
                key: "fisica.condutores-em-equilibrio-e-poder-das-pontas",
                title: "Condutores em equilíbrio e poder das pontas",
                priority: 1,
              },
              {
                key: "fisica.capacitores",
                title: "Capacitores",
                priority: 1,
              },
            ],
          },
          {
            title: "Eletrodinâmica",
            items: [
              {
                key: "fisica.corrente-eletrica",
                title: "Corrente elétrica",
                priority: 3,
              },
              {
                key: "fisica.resistores-e-1a-lei-de-ohm",
                title: "Resistores e 1ª Lei de Ohm",
                priority: 3,
              },
              {
                key: "fisica.2a-lei-de-ohm-e-resistividade",
                title: "2ª Lei de Ohm e resistividade",
                priority: 2,
              },
              {
                key: "fisica.associacao-de-resistores",
                title: "Associação de resistores",
                priority: 3,
              },
              {
                key: "fisica.potencia-eletrica-e-efeito-joule",
                title: "Potência elétrica e efeito Joule",
                priority: 3,
              },
              {
                key: "fisica.consumo-de-energia-eletrica-kwh-e-conta-de-luz",
                title: "Consumo de energia elétrica (kWh) e conta de luz",
                priority: 3,
              },
              {
                key: "fisica.circuitos-eletricos-e-leis-de-kirchhoff",
                title: "Circuitos elétricos e Leis de Kirchhoff",
                priority: 2,
              },
              {
                key: "fisica.amperimetro-e-voltimetro",
                title: "Amperímetro e voltímetro",
                priority: 2,
              },
              {
                key: "fisica.geradores-e-receptores-eletricos",
                title: "Geradores e receptores elétricos",
                priority: 2,
              },
              {
                key: "fisica.seguranca-eletrica-fusiveis-disjuntores-e-choque",
                title: "Segurança elétrica: fusíveis, disjuntores e choque",
                priority: 2,
              },
            ],
          },
          {
            title: "Eletromagnetismo",
            items: [
              {
                key: "fisica.imas-e-campo-magnetico",
                title: "Ímãs e campo magnético",
                priority: 2,
              },
              {
                key: "fisica.campo-magnetico-gerado-por-corrente",
                title: "Campo magnético gerado por corrente",
                priority: 1,
              },
              {
                key: "fisica.forca-magnetica-sobre-cargas-e-fios",
                title: "Força magnética sobre cargas e fios",
                priority: 1,
              },
              {
                key: "fisica.inducao-eletromagnetica-faraday-e-lenz",
                title: "Indução eletromagnética (Faraday e Lenz)",
                priority: 2,
              },
              {
                key: "fisica.transformadores-e-geracao-de-energia-eletrica",
                title: "Transformadores e geração de energia elétrica",
                priority: 2,
              },
              {
                key: "fisica.motores-eletricos",
                title: "Motores elétricos",
                priority: 1,
              },
            ],
          },
          {
            title: "Física moderna",
            items: [
              {
                key: "fisica.efeito-fotoeletrico-e-fotons",
                title: "Efeito fotoelétrico e fótons",
                priority: 1,
              },
              {
                key: "fisica.dualidade-onda-particula",
                title: "Dualidade onda-partícula",
                priority: 1,
              },
              {
                key: "fisica.radioatividade-e-fisica-nuclear",
                title: "Radioatividade e física nuclear",
                priority: 2,
              },
              {
                key: "fisica.relatividade-restrita",
                title: "Relatividade restrita",
                priority: 1,
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
                key: "quimica.estados-fisicos-e-mudancas-de-estado",
                title: "Estados físicos e mudanças de estado",
                priority: 2,
              },
              {
                key: "quimica.substancias-simples-e-compostas",
                title: "Substâncias simples e compostas",
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
                key: "quimica.fenomenos-fisicos-e-quimicos",
                title: "Fenômenos físicos e químicos",
                priority: 2,
              },
              {
                key: "quimica.alotropia",
                title: "Alotropia",
                priority: 1,
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
                key: "quimica.distribuicao-eletronica",
                title: "Distribuição eletrônica",
                priority: 1,
              },
              {
                key: "quimica.tabela-periodica",
                title: "Tabela periódica",
                priority: 2,
              },
              {
                key: "quimica.propriedades-periodicas",
                title: "Propriedades periódicas",
                priority: 2,
              },
              {
                key: "quimica.ligacao-ionica",
                title: "Ligação iônica",
                priority: 3,
              },
              {
                key: "quimica.ligacao-covalente",
                title: "Ligação covalente",
                priority: 3,
              },
              {
                key: "quimica.ligacao-metalica-e-ligas",
                title: "Ligação metálica e ligas",
                priority: 2,
              },
              {
                key: "quimica.geometria-molecular",
                title: "Geometria molecular",
                priority: 2,
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
                key: "quimica.solubilidade-e-semelhante-dissolve-semelhante",
                title: "Solubilidade e semelhante dissolve semelhante",
                priority: 3,
              },
            ],
          },
          {
            title: "Química inorgânica",
            items: [
              {
                key: "quimica.acidos",
                title: "Ácidos",
                priority: 3,
              },
              {
                key: "quimica.bases",
                title: "Bases",
                priority: 3,
              },
              {
                key: "quimica.sais",
                title: "Sais",
                priority: 2,
              },
              {
                key: "quimica.oxidos",
                title: "Óxidos",
                priority: 2,
              },
              {
                key: "quimica.reacoes-de-neutralizacao",
                title: "Reações de neutralização",
                priority: 3,
              },
              {
                key: "quimica.reacoes-quimicas-e-balanceamento",
                title: "Reações químicas e balanceamento",
                priority: 3,
              },
              {
                key: "quimica.tipos-de-reacoes-inorganicas",
                title: "Tipos de reações inorgânicas",
                priority: 2,
              },
              {
                key: "quimica.numero-de-oxidacao",
                title: "Número de oxidação",
                priority: 2,
              },
              {
                key: "quimica.indicadores-acido-base",
                title: "Indicadores ácido-base",
                priority: 2,
              },
            ],
          },
          {
            title: "Estequiometria",
            items: [
              {
                key: "quimica.leis-ponderais-lavoisier-e-proust",
                title: "Leis ponderais: Lavoisier e Proust",
                priority: 2,
              },
              {
                key: "quimica.massa-atomica-massa-molecular-e-mol",
                title: "Massa atômica, massa molecular e mol",
                priority: 3,
              },
              {
                key: "quimica.constante-de-avogadro-e-volume-molar",
                title: "Constante de Avogadro e volume molar",
                priority: 3,
              },
              {
                key: "quimica.formulas-quimicas-percentual-minima-e-molecular",
                title: "Fórmulas químicas: percentual, mínima e molecular",
                priority: 1,
              },
              {
                key: "quimica.calculo-estequiometrico",
                title: "Cálculo estequiométrico",
                priority: 3,
              },
              {
                key: "quimica.reagente-limitante-e-em-excesso",
                title: "Reagente limitante e em excesso",
                priority: 3,
              },
              {
                key: "quimica.pureza-e-rendimento",
                title: "Pureza e rendimento",
                priority: 3,
              },
              {
                key: "quimica.gases-equacao-de-clapeyron-e-misturas-gasosas",
                title: "Gases: equação de Clapeyron e misturas gasosas",
                priority: 2,
              },
            ],
          },
          {
            title: "Físico-química",
            items: [
              {
                key: "quimica.solucoes-e-coeficiente-de-solubilidade",
                title: "Soluções e coeficiente de solubilidade",
                priority: 3,
              },
              {
                key: "quimica.concentracao-comum-g-l",
                title: "Concentração comum (g/L)",
                priority: 3,
              },
              {
                key: "quimica.concentracao-em-mol-l",
                title: "Concentração em mol/L",
                priority: 3,
              },
              {
                key: "quimica.titulo-porcentagem-e-ppm",
                title: "Título, porcentagem e ppm",
                priority: 3,
              },
              {
                key: "quimica.diluicao-e-mistura-de-solucoes",
                title: "Diluição e mistura de soluções",
                priority: 2,
              },
              {
                key: "quimica.titulacao",
                title: "Titulação",
                priority: 1,
              },
              {
                key: "quimica.propriedades-coligativas",
                title: "Propriedades coligativas",
                priority: 2,
              },
              {
                key: "quimica.coloides",
                title: "Coloides",
                priority: 1,
              },
              {
                key: "quimica.termoquimica-reacoes-exotermicas-e-endotermicas",
                title: "Termoquímica: reações exotérmicas e endotérmicas",
                priority: 3,
              },
              {
                key: "quimica.entalpia-e-lei-de-hess",
                title: "Entalpia e Lei de Hess",
                priority: 3,
              },
              {
                key: "quimica.energia-de-ligacao",
                title: "Energia de ligação",
                priority: 2,
              },
              {
                key: "quimica.cinetica-quimica-e-fatores-da-velocidade",
                title: "Cinética química e fatores da velocidade",
                priority: 2,
              },
              {
                key: "quimica.catalisadores",
                title: "Catalisadores",
                priority: 2,
              },
              {
                key: "quimica.equilibrio-quimico-e-constante-de-equilibrio",
                title: "Equilíbrio químico e constante de equilíbrio",
                priority: 2,
              },
              {
                key: "quimica.deslocamento-de-equilibrio-le-chatelier",
                title: "Deslocamento de equilíbrio (Le Chatelier)",
                priority: 2,
              },
              {
                key: "quimica.ph-e-poh",
                title: "pH e pOH",
                priority: 3,
              },
              {
                key: "quimica.equilibrio-ionico-e-hidrolise-salina",
                title: "Equilíbrio iônico e hidrólise salina",
                priority: 1,
              },
              {
                key: "quimica.solucao-tampao",
                title: "Solução-tampão",
                priority: 1,
              },
              {
                key: "quimica.eletroquimica-pilhas-e-potenciais-de-reducao",
                title: "Eletroquímica: pilhas e potenciais de redução",
                priority: 3,
              },
              {
                key: "quimica.corrosao-e-protecao-de-metais",
                title: "Corrosão e proteção de metais",
                priority: 2,
              },
              {
                key: "quimica.eletrolise",
                title: "Eletrólise",
                priority: 2,
              },
              {
                key: "quimica.radioatividade-e-meia-vida",
                title: "Radioatividade e meia-vida",
                priority: 2,
              },
              {
                key: "quimica.fissao-e-fusao-nuclear",
                title: "Fissão e fusão nuclear",
                priority: 2,
              },
            ],
          },
          {
            title: "Química orgânica",
            items: [
              {
                key: "quimica.caracteristicas-do-carbono-e-cadeias-carbonicas",
                title: "Características do carbono e cadeias carbônicas",
                priority: 2,
              },
              {
                key: "quimica.nomenclatura-organica",
                title: "Nomenclatura orgânica",
                priority: 2,
              },
              {
                key: "quimica.hidrocarbonetos",
                title: "Hidrocarbonetos",
                priority: 2,
              },
              {
                key: "quimica.funcoes-oxigenadas-alcool-fenol-e-eter",
                title: "Funções oxigenadas: álcool, fenol e éter",
                priority: 3,
              },
              {
                key: "quimica.funcoes-oxigenadas-aldeido-e-cetona",
                title: "Funções oxigenadas: aldeído e cetona",
                priority: 3,
              },
              {
                key: "quimica.funcoes-oxigenadas-acido-carboxilico-e-ester",
                title: "Funções oxigenadas: ácido carboxílico e éster",
                priority: 3,
              },
              {
                key: "quimica.funcoes-nitrogenadas-aminas-e-amidas",
                title: "Funções nitrogenadas: aminas e amidas",
                priority: 2,
              },
              {
                key: "quimica.haletos-organicos",
                title: "Haletos orgânicos",
                priority: 1,
              },
              {
                key: "quimica.propriedades-fisicas-dos-compostos-organicos",
                title: "Propriedades físicas dos compostos orgânicos",
                priority: 2,
              },
              {
                key: "quimica.isomeria-plana",
                title: "Isomeria plana",
                priority: 2,
              },
              {
                key: "quimica.isomeria-espacial-geometrica-e-optica",
                title: "Isomeria espacial: geométrica e óptica",
                priority: 2,
              },
              {
                key: "quimica.reacoes-de-combustao",
                title: "Reações de combustão",
                priority: 3,
              },
              {
                key: "quimica.reacoes-de-substituicao-e-adicao",
                title: "Reações de substituição e adição",
                priority: 1,
              },
              {
                key: "quimica.reacoes-de-oxidacao",
                title: "Reações de oxidação",
                priority: 1,
              },
              {
                key: "quimica.esterificacao-e-saponificacao",
                title: "Esterificação e saponificação",
                priority: 3,
              },
              {
                key: "quimica.saboes-e-detergentes",
                title: "Sabões e detergentes",
                priority: 2,
              },
              {
                key: "quimica.polimeros-de-adicao-e-condensacao",
                title: "Polímeros de adição e condensação",
                priority: 3,
              },
              {
                key: "quimica.petroleo-e-derivados",
                title: "Petróleo e derivados",
                priority: 3,
              },
              {
                key: "quimica.biocombustiveis",
                title: "Biocombustíveis",
                priority: 3,
              },
              {
                key: "quimica.bioquimica-carboidratos",
                title: "Bioquímica: carboidratos",
                priority: 2,
              },
              {
                key: "quimica.bioquimica-lipidios",
                title: "Bioquímica: lipídios",
                priority: 2,
              },
              {
                key: "quimica.bioquimica-proteinas-e-aminoacidos",
                title: "Bioquímica: proteínas e aminoácidos",
                priority: 2,
              },
            ],
          },
          {
            title: "Química ambiental",
            items: [
              {
                key: "quimica.poluicao-atmosferica",
                title: "Poluição atmosférica",
                priority: 3,
              },
              {
                key: "quimica.chuva-acida",
                title: "Chuva ácida",
                priority: 3,
              },
              {
                key: "quimica.efeito-estufa-e-camada-de-ozonio",
                title: "Efeito estufa e camada de ozônio",
                priority: 3,
              },
              {
                key: "quimica.tratamento-de-agua",
                title: "Tratamento de água",
                priority: 3,
              },
              {
                key: "quimica.tratamento-de-esgoto-e-eutrofizacao",
                title: "Tratamento de esgoto e eutrofização",
                priority: 3,
              },
              {
                key: "quimica.lixo-reciclagem-e-quimica-verde",
                title: "Lixo, reciclagem e química verde",
                priority: 2,
              },
              {
                key: "quimica.quimica-dos-metais-mineracao-e-metalurgia",
                title: "Química dos metais: mineração e metalurgia",
                priority: 2,
              },
              {
                key: "quimica.fertilizantes-e-agrotoxicos",
                title: "Fertilizantes e agrotóxicos",
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
            title: "Bioquímica",
            items: [
              {
                key: "biologia.agua-e-sais-minerais",
                title: "Água e sais minerais",
                priority: 2,
              },
              {
                key: "biologia.carboidratos",
                title: "Carboidratos",
                priority: 2,
              },
              {
                key: "biologia.lipidios",
                title: "Lipídios",
                priority: 2,
              },
              {
                key: "biologia.proteinas",
                title: "Proteínas",
                priority: 2,
              },
              {
                key: "biologia.enzimas",
                title: "Enzimas",
                priority: 2,
              },
              {
                key: "biologia.vitaminas",
                title: "Vitaminas",
                priority: 2,
              },
              {
                key: "biologia.acidos-nucleicos-dna-e-rna",
                title: "Ácidos nucleicos: DNA e RNA",
                priority: 3,
              },
            ],
          },
          {
            title: "Citologia",
            items: [
              {
                key: "biologia.celulas-procariontes-e-eucariontes",
                title: "Células procariontes e eucariontes",
                priority: 2,
              },
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
                key: "biologia.nucleo-e-cromossomos",
                title: "Núcleo e cromossomos",
                priority: 2,
              },
              {
                key: "biologia.duplicacao-do-dna-e-transcricao",
                title: "Duplicação do DNA e transcrição",
                priority: 3,
              },
              {
                key: "biologia.codigo-genetico-e-sintese-de-proteinas",
                title: "Código genético e síntese de proteínas",
                priority: 3,
              },
              {
                key: "biologia.ciclo-celular-e-mitose",
                title: "Ciclo celular e mitose",
                priority: 2,
              },
              {
                key: "biologia.meiose-e-gametogenese",
                title: "Meiose e gametogênese",
                priority: 2,
              },
            ],
          },
          {
            title: "Bioenergética",
            items: [
              {
                key: "biologia.respiracao-celular",
                title: "Respiração celular",
                priority: 3,
              },
              {
                key: "biologia.fermentacao",
                title: "Fermentação",
                priority: 3,
              },
              {
                key: "biologia.fotossintese",
                title: "Fotossíntese",
                priority: 3,
              },
              {
                key: "biologia.quimiossintese",
                title: "Quimiossíntese",
                priority: 1,
              },
            ],
          },
          {
            title: "Histologia",
            items: [
              {
                key: "biologia.tecido-epitelial",
                title: "Tecido epitelial",
                priority: 1,
              },
              {
                key: "biologia.tecido-conjuntivo",
                title: "Tecido conjuntivo",
                priority: 1,
              },
              {
                key: "biologia.tecido-muscular",
                title: "Tecido muscular",
                priority: 1,
              },
              {
                key: "biologia.tecido-nervoso",
                title: "Tecido nervoso",
                priority: 1,
              },
              {
                key: "biologia.tecidos-vegetais",
                title: "Tecidos vegetais",
                priority: 1,
              },
            ],
          },
          {
            title: "Genética",
            items: [
              {
                key: "biologia.conceitos-basicos-de-genetica",
                title: "Conceitos básicos de genética",
                priority: 2,
              },
              {
                key: "biologia.1a-lei-de-mendel",
                title: "1ª Lei de Mendel",
                priority: 3,
              },
              {
                key: "biologia.probabilidade-em-genetica",
                title: "Probabilidade em genética",
                priority: 3,
              },
              {
                key: "biologia.heredogramas",
                title: "Heredogramas",
                priority: 2,
              },
              {
                key: "biologia.codominancia-e-dominancia-incompleta",
                title: "Codominância e dominância incompleta",
                priority: 1,
              },
              {
                key: "biologia.alelos-multiplos",
                title: "Alelos múltiplos",
                priority: 1,
              },
              {
                key: "biologia.grupos-sanguineos-sistema-abo-e-fator-rh",
                title: "Grupos sanguíneos: sistema ABO e fator Rh",
                priority: 3,
              },
              {
                key: "biologia.2a-lei-de-mendel",
                title: "2ª Lei de Mendel",
                priority: 2,
              },
              {
                key: "biologia.interacao-genica",
                title: "Interação gênica",
                priority: 1,
              },
              {
                key: "biologia.heranca-ligada-ao-sexo",
                title: "Herança ligada ao sexo",
                priority: 2,
              },
              {
                key: "biologia.mutacoes-genicas-e-cromossomicas",
                title: "Mutações gênicas e cromossômicas",
                priority: 2,
              },
              {
                key: "biologia.doencas-geneticas",
                title: "Doenças genéticas",
                priority: 2,
              },
            ],
          },
          {
            title: "Biotecnologia",
            items: [
              {
                key: "biologia.dna-recombinante-e-transgenicos",
                title: "DNA recombinante e transgênicos",
                priority: 3,
              },
              {
                key: "biologia.clonagem",
                title: "Clonagem",
                priority: 2,
              },
              {
                key: "biologia.celulas-tronco",
                title: "Células-tronco",
                priority: 2,
              },
              {
                key: "biologia.testes-de-dna-e-paternidade",
                title: "Testes de DNA e paternidade",
                priority: 2,
              },
              {
                key: "biologia.terapia-genica-e-vacinas-de-rna",
                title: "Terapia gênica e vacinas de RNA",
                priority: 2,
              },
              {
                key: "biologia.bioetica",
                title: "Bioética",
                priority: 1,
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
                key: "biologia.evidencias-da-evolucao",
                title: "Evidências da evolução",
                priority: 2,
              },
              {
                key: "biologia.lamarckismo-e-darwinismo",
                title: "Lamarckismo e darwinismo",
                priority: 2,
              },
              {
                key: "biologia.selecao-natural-e-adaptacao",
                title: "Seleção natural e adaptação",
                priority: 3,
              },
              {
                key: "biologia.teoria-sintetica-da-evolucao",
                title: "Teoria sintética da evolução",
                priority: 2,
              },
              {
                key: "biologia.especiacao",
                title: "Especiação",
                priority: 2,
              },
              {
                key: "biologia.genetica-de-populacoes",
                title: "Genética de populações",
                priority: 1,
              },
              {
                key: "biologia.evolucao-humana",
                title: "Evolução humana",
                priority: 1,
              },
            ],
          },
          {
            title: "Ecologia",
            items: [
              {
                key: "biologia.conceitos-de-ecologia-habitat-e-nicho",
                title: "Conceitos de ecologia: habitat e nicho",
                priority: 2,
              },
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
                key: "biologia.ciclo-do-carbono",
                title: "Ciclo do carbono",
                priority: 3,
              },
              {
                key: "biologia.ciclo-do-nitrogenio",
                title: "Ciclo do nitrogênio",
                priority: 3,
              },
              {
                key: "biologia.ciclo-da-agua",
                title: "Ciclo da água",
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
                key: "biologia.biomas-do-mundo",
                title: "Biomas do mundo",
                priority: 1,
              },
              {
                key: "biologia.poluicao-e-impactos-ambientais",
                title: "Poluição e impactos ambientais",
                priority: 3,
              },
              {
                key: "biologia.aquecimento-global-e-efeito-estufa",
                title: "Aquecimento global e efeito estufa",
                priority: 3,
              },
              {
                key: "biologia.desmatamento-e-queimadas",
                title: "Desmatamento e queimadas",
                priority: 3,
              },
              {
                key: "biologia.eutrofizacao",
                title: "Eutrofização",
                priority: 3,
              },
              {
                key: "biologia.bioacumulacao",
                title: "Bioacumulação",
                priority: 3,
              },
              {
                key: "biologia.especies-exoticas-e-invasoras",
                title: "Espécies exóticas e invasoras",
                priority: 2,
              },
              {
                key: "biologia.conservacao-da-biodiversidade-e-unidades-de-cons",
                title:
                  "Conservação da biodiversidade e unidades de conservação",
                priority: 2,
              },
              {
                key: "biologia.desenvolvimento-sustentavel",
                title: "Desenvolvimento sustentável",
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
                key: "biologia.sistema-linfatico",
                title: "Sistema linfático",
                priority: 1,
              },
              {
                key: "biologia.sistema-imunologico",
                title: "Sistema imunológico",
                priority: 3,
              },
              {
                key: "biologia.vacinas-e-soros",
                title: "Vacinas e soros",
                priority: 3,
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
                key: "biologia.orgaos-dos-sentidos",
                title: "Órgãos dos sentidos",
                priority: 1,
              },
              {
                key: "biologia.sistema-endocrino-e-hormonios",
                title: "Sistema endócrino e hormônios",
                priority: 2,
              },
              {
                key: "biologia.sistema-reprodutor",
                title: "Sistema reprodutor",
                priority: 2,
              },
              {
                key: "biologia.metodos-contraceptivos",
                title: "Métodos contraceptivos",
                priority: 2,
              },
              {
                key: "biologia.embriologia",
                title: "Embriologia",
                priority: 1,
              },
              {
                key: "biologia.sistema-locomotor",
                title: "Sistema locomotor",
                priority: 1,
              },
              {
                key: "biologia.nutricao-e-saude",
                title: "Nutrição e saúde",
                priority: 2,
              },
            ],
          },
          {
            title: "Seres vivos",
            items: [
              {
                key: "biologia.classificacao-dos-seres-vivos",
                title: "Classificação dos seres vivos",
                priority: 1,
              },
              {
                key: "biologia.virus",
                title: "Vírus",
                priority: 3,
              },
              {
                key: "biologia.viroses",
                title: "Viroses",
                priority: 3,
              },
              {
                key: "biologia.bacterias",
                title: "Bactérias",
                priority: 3,
              },
              {
                key: "biologia.bacterioses",
                title: "Bacterioses",
                priority: 3,
              },
              {
                key: "biologia.protozoarios",
                title: "Protozoários",
                priority: 2,
              },
              {
                key: "biologia.protozooses",
                title: "Protozooses",
                priority: 3,
              },
              {
                key: "biologia.fungos",
                title: "Fungos",
                priority: 1,
              },
              {
                key: "biologia.algas",
                title: "Algas",
                priority: 1,
              },
              {
                key: "biologia.platelmintos-e-nematelmintos-verminoses",
                title: "Platelmintos e nematelmintos (verminoses)",
                priority: 2,
              },
              {
                key: "biologia.poriferos-e-cnidarios",
                title: "Poríferos e cnidários",
                priority: 1,
              },
              {
                key: "biologia.moluscos-e-anelideos",
                title: "Moluscos e anelídeos",
                priority: 1,
              },
              {
                key: "biologia.artropodes",
                title: "Artrópodes",
                priority: 1,
              },
              {
                key: "biologia.equinodermos",
                title: "Equinodermos",
                priority: 1,
              },
              {
                key: "biologia.peixes-e-anfibios",
                title: "Peixes e anfíbios",
                priority: 1,
              },
              {
                key: "biologia.repteis-aves-e-mamiferos",
                title: "Répteis, aves e mamíferos",
                priority: 1,
              },
            ],
          },
          {
            title: "Botânica",
            items: [
              {
                key: "biologia.briofitas-e-pteridofitas",
                title: "Briófitas e pteridófitas",
                priority: 1,
              },
              {
                key: "biologia.gimnospermas-e-angiospermas",
                title: "Gimnospermas e angiospermas",
                priority: 2,
              },
              {
                key: "biologia.raiz-caule-e-folha",
                title: "Raiz, caule e folha",
                priority: 1,
              },
              {
                key: "biologia.flor-fruto-e-semente",
                title: "Flor, fruto e semente",
                priority: 1,
              },
              {
                key: "biologia.transpiracao-e-transporte-de-seiva",
                title: "Transpiração e transporte de seiva",
                priority: 2,
              },
              {
                key: "biologia.hormonios-vegetais",
                title: "Hormônios vegetais",
                priority: 2,
              },
            ],
          },
          {
            title: "Saúde pública",
            items: [
              {
                key: "biologia.saneamento-basico-e-doencas",
                title: "Saneamento básico e doenças",
                priority: 3,
              },
              {
                key: "biologia.arboviroses-dengue-zika-e-chikungunya",
                title: "Arboviroses: dengue, zika e chikungunya",
                priority: 3,
              },
              {
                key: "biologia.ists",
                title: "ISTs",
                priority: 2,
              },
              {
                key: "biologia.drogas-e-saude",
                title: "Drogas e saúde",
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
