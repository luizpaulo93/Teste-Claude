/**
 * Taxonomia de assuntos do curso (Física, Química, Matemática e Biologia).
 * Assunto geral = título numerado; assunto específico (subassunto) = itens de cada título.
 * Gerado a partir de "Taxonomia de assuntos: Física, Química, Matemática e Biologia" (PDF do professor).
 * Sem imports: também roda direto no Node (scripts de reclassificação).
 */
export type TaxDisc = 'Física' | 'Química' | 'Matemática' | 'Biologia';
export interface TaxTopic {
  assunto: string;
  subs: string[];
}

export const TAXONOMY: Record<TaxDisc, TaxTopic[]> = {
  Física: [
    {
      assunto: 'Mecânica: Cinemática',
      subs: [
        'Conceitos básicos: referencial, posição, deslocamento, trajetória, repouso e movimento',
        'Velocidade média e instantânea, aceleração média',
        'Movimento retilíneo uniforme (MRU)',
        'Movimento retilíneo uniformemente variado (MRUV)',
        'Gráficos da cinemática (s×t, v×t, a×t)',
        'Queda livre e lançamento vertical',
        'Lançamento horizontal e oblíquo',
        'Movimento circular uniforme (período, frequência, velocidade angular, aceleração centrípeta)',
        'Movimento circular uniformemente variado',
        'Transmissão de movimento circular (polias, engrenagens)',
        'Velocidade relativa e composição de movimentos',
        'Grandezas escalares e vetoriais, operações com vetores',
      ],
    },
    {
      assunto: 'Mecânica: Dinâmica',
      subs: [
        'Leis de Newton (inércia, princípio fundamental, ação e reação)',
        'Força peso, normal, tração, elástica (Lei de Hooke)',
        'Força de atrito (estático e cinético)',
        'Plano inclinado',
        'Sistemas de blocos, roldanas e polias',
        'Força resultante centrípeta, curvas e looping',
        'Referenciais não inerciais e forças fictícias',
        'Resistência do ar e velocidade terminal',
        'Máquinas simples (alavancas, polias, plano inclinado, rodas e eixos)',
      ],
    },
    {
      assunto: 'Mecânica: Trabalho, Energia e Potência',
      subs: [
        'Trabalho de uma força (constante e variável)',
        'Energia cinética e teorema trabalho-energia',
        'Energia potencial gravitacional e elástica',
        'Conservação da energia mecânica',
        'Forças conservativas e dissipativas',
        'Potência e rendimento',
        'Fontes e matrizes energéticas, usinas (hidrelétrica, termelétrica, nuclear, solar, eólica)',
        'Consumo de energia e eficiência energética',
      ],
    },
    {
      assunto: 'Mecânica: Impulso e Quantidade de Movimento',
      subs: [
        'Impulso de uma força',
        'Quantidade de movimento (momento linear)',
        'Teorema do impulso',
        'Conservação da quantidade de movimento',
        'Colisões (elásticas, inelásticas, perfeitamente inelásticas)',
        'Centro de massa',
        'Propulsão a jato e explosões',
      ],
    },
    {
      assunto: 'Mecânica: Estática e Equilíbrio',
      subs: [
        'Equilíbrio do ponto material',
        'Momento de uma força (torque)',
        'Equilíbrio do corpo extenso',
        'Centro de gravidade e tipos de equilíbrio (estável, instável, indiferente)',
        'Alavancas e balanças',
      ],
    },
    {
      assunto: 'Mecânica: Gravitação Universal',
      subs: [
        'Leis de Kepler',
        'Lei da gravitação universal de Newton',
        'Aceleração da gravidade e variação com a altitude',
        'Satélites e velocidade orbital, satélites geoestacionários',
        'Energia potencial gravitacional e velocidade de escape',
        'Marés, fases da Lua e eclipses',
        'Estações do ano, movimentos da Terra',
        'Sistema Solar, astronomia básica e cosmologia',
      ],
    },
    {
      assunto: 'Mecânica: Hidrostática',
      subs: [
        'Densidade e massa específica',
        'Pressão e pressão atmosférica',
        'Teorema de Stevin (pressão em fluidos)',
        'Vasos comunicantes',
        'Princípio de Pascal (prensa e freios hidráulicos)',
        'Princípio de Arquimedes (empuxo, flutuação)',
        'Experimento de Torricelli e barômetros',
        'Tensão superficial e capilaridade',
      ],
    },
    {
      assunto: 'Mecânica: Hidrodinâmica',
      subs: ['Vazão e equação da continuidade', 'Equação de Bernoulli', 'Viscosidade e regimes de escoamento'],
    },
    {
      assunto: 'Termologia: Termometria e Dilatação',
      subs: [
        'Temperatura, calor e equilíbrio térmico',
        'Escalas termométricas (Celsius, Fahrenheit, Kelvin) e conversões',
        'Dilatação linear, superficial e volumétrica de sólidos',
        'Dilatação dos líquidos e dilatação anômala da água',
      ],
    },
    {
      assunto: 'Termologia: Calorimetria',
      subs: [
        'Calor sensível, capacidade térmica e calor específico',
        'Calor latente e mudanças de estado físico',
        'Curvas de aquecimento e resfriamento',
        'Trocas de calor e equilíbrio térmico (calorímetro)',
        'Diagramas de fases, ponto triplo, ponto crítico',
        'Evaporação, ebulição, calefação e umidade do ar',
      ],
    },
    {
      assunto: 'Termologia: Propagação de Calor',
      subs: [
        'Condução (condutividade térmica, lei de Fourier)',
        'Convecção',
        'Irradiação e corpo negro',
        'Isolantes térmicos, garrafa térmica, efeito estufa e aquecimento global',
      ],
    },
    {
      assunto: 'Termologia: Gases e Termodinâmica',
      subs: [
        'Gases ideais: equação de Clapeyron e leis dos gases',
        'Transformações gasosas (isotérmica, isobárica, isocórica, adiabática)',
        'Teoria cinética dos gases',
        'Trabalho em transformações gasosas',
        'Primeira lei da Termodinâmica',
        'Segunda lei da Termodinâmica, entropia',
        'Máquinas térmicas e ciclo de Carnot',
        'Refrigeradores e bombas de calor',
      ],
    },
    {
      assunto: 'Óptica Geométrica',
      subs: [
        'Princípios da óptica geométrica, fontes de luz, meios ópticos',
        'Sombra, penumbra e câmara escura',
        'Reflexão da luz e espelhos planos',
        'Espelhos esféricos (côncavos e convexos) e formação de imagens',
        'Refração da luz, índice de refração e lei de Snell',
        'Reflexão total e fibras ópticas',
        'Dioptro plano, lâminas e prismas',
        'Lentes esféricas (convergentes e divergentes), equação de Gauss',
        'Dispersão da luz e arco-íris',
        'Cores dos corpos, adição e subtração de cores',
        'Óptica da visão: olho humano e defeitos (miopia, hipermetropia, astigmatismo, presbiopia)',
        'Instrumentos ópticos (lupa, microscópio, luneta, telescópio, câmera, projetor)',
      ],
    },
    {
      assunto: 'Movimento Harmônico Simples (MHS)',
      subs: [
        'Movimentos periódicos e oscilatórios: período, frequência e amplitude',
        'Funções horárias do MHS (elongação, velocidade e aceleração)',
        'MHS e movimento circular uniforme (projeção)',
        'Oscilador massa-mola',
        'Pêndulo simples',
        'Energia no MHS (cinética, potencial elástica e mecânica)',
        'Oscilações amortecidas e forçadas',
      ],
    },
    {
      assunto: 'Ondulatória e Acústica',
      subs: [
        'Classificação de ondas (mecânicas, eletromagnéticas, transversais, longitudinais)',
        'Elementos de uma onda: amplitude, período, frequência, comprimento de onda, velocidade',
        'Equação fundamental da ondulatória',
        'Ondas em cordas, velocidade de propagação',
        'Fenômenos ondulatórios: reflexão, refração, difração, interferência, polarização',
        'Superposição e ondas estacionárias',
        'Ressonância',
        'Som: velocidade, qualidades fisiológicas (altura, intensidade, timbre)',
        'Nível sonoro, decibel e poluição sonora',
        'Eco, reverberação e reforço',
        'Efeito Doppler',
        'Tubos sonoros e cordas vibrantes',
        'Espectro eletromagnético e aplicações (micro-ondas, rádio, infravermelho, ultravioleta, raios X, raios gama)',
      ],
    },
    {
      assunto: 'Eletrostática',
      subs: [
        'Carga elétrica e quantização',
        'Processos de eletrização (atrito, contato, indução)',
        'Condutores e isolantes',
        'Lei de Coulomb',
        'Campo elétrico e linhas de força',
        'Potencial elétrico e diferença de potencial',
        'Trabalho da força elétrica e energia potencial elétrica',
        'Superfícies equipotenciais',
        'Condutor em equilíbrio eletrostático, poder das pontas, gaiola de Faraday, blindagem',
        'Capacitores e capacitância, associação de capacitores',
        'Raios e para-raios',
      ],
    },
    {
      assunto: 'Eletrodinâmica',
      subs: [
        'Corrente elétrica e intensidade de corrente',
        'Tensão, resistência e leis de Ohm',
        'Resistividade e resistores',
        'Associação de resistores (série, paralelo e mista)',
        'Potência elétrica e efeito Joule',
        'Consumo de energia elétrica (kWh) e conta de luz',
        'Geradores e receptores elétricos, força eletromotriz',
        'Leis de Kirchhoff e circuitos elétricos',
        'Instrumentos de medida (amperímetro, voltímetro, ponte de Wheatstone)',
        'Fusíveis, disjuntores, choque elétrico e segurança',
        'Circuitos residenciais, tomadas e aterramento',
        'Chuveiros, lâmpadas e eletrodomésticos',
      ],
    },
    {
      assunto: 'Eletromagnetismo',
      subs: [
        'Ímãs e campo magnético, campo magnético da Terra, bússola',
        'Campo magnético gerado por corrente (fio, espira, solenoide)',
        'Força magnética sobre cargas e sobre fios',
        'Movimento de cargas em campo magnético',
        'Fluxo magnético e indução eletromagnética',
        'Leis de Faraday e de Lenz',
        'Geradores, motores elétricos, transformadores',
        'Corrente alternada e transmissão de energia elétrica',
        'Ondas eletromagnéticas e equações de Maxwell (noções)',
        'Aplicações: eletroímã, alto-falante, microfone, indução em cooktops, detectores de metal',
      ],
    },
    {
      assunto: 'Física Moderna',
      subs: [
        'Efeito fotoelétrico e quantização da energia',
        'Dualidade onda-partícula',
        'Modelos atômicos sob a ótica da Física',
        'Espectros atômicos e níveis de energia',
        'Laser e LED',
        'Relatividade restrita (dilatação do tempo, contração do comprimento, E = mc²)',
        'Física nuclear: radioatividade, decaimento, meia-vida, fissão e fusão nuclear',
        'Partículas elementares e modelo padrão',
        'Raios X, radiações ionizantes e aplicações médicas',
        'Semicondutores, diodos, transistores, células fotovoltaicas, supercondutividade',
      ],
    },
    {
      assunto: 'Análise Dimensional, Unidades e Metodologia',
      subs: [
        'Sistema Internacional de Unidades e conversões',
        'Notação científica e ordem de grandeza',
        'Algarismos significativos e incerteza de medida',
        'Análise dimensional',
        'Leitura e construção de gráficos e tabelas',
        'Método científico e instrumentos de medida',
      ],
    },
    {
      assunto: 'Física e Tecnologia, Ambiente e Sociedade',
      subs: [
        'Fontes renováveis e não renováveis de energia',
        'Impactos ambientais da geração de energia',
        'Tecnologias do cotidiano (GPS, radar, sonar, ultrassom, ressonância magnética, tomografia)',
        'Física do esporte e do trânsito (segurança veicular, cinto de segurança, airbag)',
        'Telecomunicações, fibras ópticas e redes sem fio',
      ],
    },
  ],
  Química: [
    {
      assunto: 'Química Geral: Matéria e Substâncias',
      subs: [
        'Conceitos fundamentais: matéria, massa, volume, corpo, objeto',
        'Propriedades gerais, específicas, físicas e químicas',
        'Estados físicos e mudanças de estado',
        'Substâncias simples e compostas, alotropia',
        'Misturas homogêneas e heterogêneas, sistemas, fases e componentes',
        'Fenômenos físicos e químicos',
        'Métodos de separação de misturas (filtração, decantação, destilação, centrifugação, flotação, cristalização, cromatografia, levigacão, separação magnética)',
        'Densidade, ponto de fusão e ebulição, critérios de pureza',
        'Tratamento de água e esgoto como aplicação de separação',
        'Unidades de medida, notação científica e algarismos significativos',
      ],
    },
    {
      assunto: 'Química Geral: Atomística',
      subs: [
        'Evolução dos modelos atômicos (Dalton, Thomson, Rutherford, Bohr, modelo atual)',
        'Partículas subatômicas: prótons, nêutrons, elétrons',
        'Número atômico, número de massa, massa atômica',
        'Isótopos, isóbaros, isótonos e isoeletrônicos',
        'Íons: cátions e ânions',
        'Distribuição eletrônica (níveis, subníveis, Diagrama de Pauling)',
        'Números quânticos, princípio de exclusão de Pauli, regra de Hund',
        'Espectros de emissão, teste de chama, fogos de artifício',
        'Orbitais atômicos',
      ],
    },
    {
      assunto: 'Química Geral: Tabela Periódica e Propriedades Periódicas',
      subs: [
        'História e organização da tabela (famílias, períodos, blocos)',
        'Metais, ametais, semimetais, gases nobres, hidrogênio',
        'Metais alcalinos, alcalino-terrosos, halogênios, calcogênios, de transição, lantanídeos e actinídeos',
        'Raio atômico e raio iônico',
        'Energia de ionização',
        'Afinidade eletrônica',
        'Eletronegatividade e eletropositividade',
        'Reatividade e densidade dos elementos',
        'Elementos essenciais, tracos e micronutrientes',
      ],
    },
    {
      assunto: 'Química Geral: Ligações Químicas e Interações',
      subs: [
        'Regra do octeto e exceções',
        'Ligação iônica e propriedades dos compostos iônicos',
        'Ligação covalente (simples, múltipla, dativa) e fórmulas estruturais (Lewis)',
        'Ligação metálica, ligas metálicas e propriedades dos metais',
        'Geometria molecular (teoria da repulsão, VSEPR)',
        'Polaridade de ligações e de moléculas',
        'Hibridização (sp, sp², sp³)',
        'Forças intermoleculares (dipolo induzido, dipolo permanente, ligação de hidrogênio)',
        'Relação entre interações e propriedades físicas (ponto de fusão, ebulição, solubilidade)',
        'Sólidos covalentes, redes cristalinas, alotropia do carbono (diamante, grafite, fulereno, grafeno, nanotubos)',
        'Materiais: cerâmicas, vidros, semicondutores, nanomateriais',
      ],
    },
    {
      assunto: 'Química Inorgânica: Funções Inorgânicas',
      subs: [
        'Ácidos: classificação, nomenclatura, força, propriedades e aplicações',
        'Bases: classificação, nomenclatura, força, propriedades e aplicações',
        'Sais: classificação, nomenclatura, solubilidade, hidrólise salina',
        'Óxidos: ácidos, básicos, anfóteros, neutros, perxóxidos',
        'Hidretos',
        'Teorias ácido-base (Arrhenius, Brønsted-Lowry, Lewis)',
        'Indicadores ácido-base',
        'Neutralização e chuva ácida',
        'Aplicações cotidianas (antiacidos, produtos de limpeza, cal, soda cáustica, sal de cozinha)',
      ],
    },
    {
      assunto: 'Química Inorgânica: Reações Químicas',
      subs: [
        'Equações químicas e balanceamento',
        'Tipos de reação: síntese, análise (decomposição), simples troca (deslocamento), dupla troca',
        'Condições de ocorrência de reações de dupla troca',
        'Fila de reatividade de metais e ametais',
        'Reações de oxirredução: número de oxidação (Nox), agentes oxidante e redutor',
        'Balanceamento por oxirredução',
        'Reações de combustão',
        'Reações de precipitação',
        'Lei de Lavoisier (conservação das massas) e lei de Proust (proporções definidas)',
      ],
    },
    {
      assunto: 'Química Inorgânica: Química Descritiva e Aplicada',
      subs: [
        'Hidrogênio, oxigênio, nitrogênio, carbono, enxofre, fósforo, halogênios (ocorrência, obtenção e usos)',
        'Metais: ferro, alumínio, cobre, zinco, ouro, prata, chumbo, mercúrio',
        'Metalurgia e siderúrgica (obtenção de metais a partir de minérios)',
        'Gases da atmosfera e água (composição e prop.)',
        'Fertilizantes (NPK) e defensivos agrícolas',
        'Cimento, cal, vidro, cerâmica, gesso',
        'Compostos de coordenação e complexos (noções)',
        'Toxicidade de metais pesados',
      ],
    },
    {
      assunto: 'Estequiometria',
      subs: [
        'Massa atômica, massa molecular, massa molar',
        'Mol e constante de Avogadro',
        'Volume molar e CNTP',
        'Cálculos estequiométricos (massa, mol, volume, moléculas)',
        'Reagente limitante e em excesso',
        'Pureza de reagentes',
        'Rendimento de reação',
        'Reações consecutivas',
        'Fórmulas: percentual, mínima e molecular',
        'Estequiometria de gases e de soluções',
        'Leis ponderais e volumétricas (Lavoisier, Proust, Gay-Lussac, Avogadro)',
      ],
    },
    {
      assunto: 'Gases',
      subs: [
        'Variáveis de estado: pressão, volume e temperatura',
        'Transformações gasosas (Boyle, Charles, Gay-Lussac) e lei geral dos gases',
        'Equação de Clapeyron (PV = nRT)',
        'Misturas gasosas, pressões parciais (Dalton), fração em mol',
        'Lei de Graham (difusão e efusão)',
        'Gases reais',
        'Densidade dos gases',
      ],
    },
    {
      assunto: 'Soluções e Propriedades Coligativas',
      subs: [
        'Tipos de soluções e dispersões (solução, colóide, suspensão)',
        'Solubilidade e curvas de solubilidade',
        'Soluções saturadas, insaturadas e supersaturadas',
        'Concentrações: g/L, mol/L, título, porcentagem, ppm, ppb, fração em mol, molalidade',
        'Diluição e mistura de soluções (mesmo soluto e solutos diferentes que reagem)',
        'Titulação ácido-base',
        'Propriedades coligativas: tonoscopia, ebulioscopia, crioscopia e osmose',
        'Pressão osmótica, osmose reversa e dessalinização',
        "Fator de van't Hoff",
        'Diagramas de fases da água e do CO₂',
      ],
    },
    {
      assunto: 'Físico-Química: Termoquímica',
      subs: [
        'Reações exotérmicas e endotérmicas',
        'Entalpia e variação de entalpia (ΔH)',
        'Entalpias de formação, combustão, ligação, neutralização, dissolução',
        'Lei de Hess',
        'Energia de ligação',
        'Entropia e energia livre de Gibbs, espontaneidade',
        'Calor de combustão dos combustíveis, poder calorífico',
        'Combustíveis fósseis e biocombustíveis',
        'Diagramas de entalpia',
      ],
    },
    {
      assunto: 'Físico-Química: Cinética Química',
      subs: [
        'Velocidade média das reações',
        'Teoria das colisões e energia de ativação',
        'Fatores que alteram a velocidade (temperatura, concentração, superfície de contato, pressão)',
        'Catalisadores e catálise (homogênea e heterogênea), enzimas',
        'Lei da velocidade, ordem de reação e mecanismos de reação',
        'Gráficos de cinética e de energia',
        'Conservantes e refrigeração de alimentos',
      ],
    },
    {
      assunto: 'Físico-Química: Equilíbrio Químico',
      subs: [
        'Reações reversíveis e equilíbrio dinâmico',
        'Constantes de equilíbrio (Kc e Kp)',
        'Deslocamento de equilíbrio (Princípio de Le Chatelier)',
        'Equilíbrio iônico, grau de ionização, Ka e Kb',
        'Lei da diluição de Ostwald',
        'Produto iônico da água, pH e pOH',
        'Soluções-tampão',
        'Hidrólise de sais',
        'Produto de solubilidade (Kps)',
        'Equilíbrio heterogêneo',
        'Aplicações: processo Haber-Bosch, amonia, ácido sulfúrico, acidificação dos oceanos, sistema-tampão do sangue',
      ],
    },
    {
      assunto: 'Físico-Química: Eletroquímica',
      subs: [
        'Pilhas e baterias (célula galvânica, ânodo e cátodo)',
        'Potencial de redução e força eletromotriz (ddp)',
        'Equação de Nernst',
        'Pilhas comerciais, baterias recarregáveis, células a combustível',
        'Eletrólise ígnea e aquosa',
        'Leis de Faraday (aspectos quantitativos)',
        'Galvanoplastia e refino eletrolítico',
        'Corrosão e proteção (anodo de sacrifício, galvanização)',
        'Aplicações industriais (produção de alumínio, cloro-soda)',
      ],
    },
    {
      assunto: 'Radioatividade e Química Nuclear',
      subs: [
        'Emissões radioativas alfa, beta e gama',
        'Leis da radioatividade (Soddy e Fajans)',
        'Cinética radioativa e meia-vida',
        'Datacao por carbono-14',
        'Fissão e fusão nuclear',
        'Reações em cadeia, reatores e usinas nucleares',
        'Lixo radioativo e acidentes nucleares',
        'Aplicações na medicina, agricultura e indústria',
      ],
    },
    {
      assunto: 'Química Orgânica: Fundamentos',
      subs: [
        'História e conceitos (vitalismo, síntese de Wöhler)',
        'Características do carbono: tetravalencia, hibridização, ligações',
        'Classificação de carbonos (primário, secundário, terciário, quaternário)',
        'Classificação de cadeias carbônicas',
        'Representações: fórmulas estruturais, de linhas e moleculares',
        'Nomenclatura IUPAC',
        'Fontes de compostos orgânicos: petróleo, gás natural, carvão mineral e biomassa',
        'Refino do petróleo e destilação fracionada, craqueamento, octanagem',
      ],
    },
    {
      assunto: 'Química Orgânica: Funções Orgânicas',
      subs: [
        'Hidrocarbonetos: alcanos, alcenos, alcinos, alcadienos, ciclanos, aromáticos',
        'Álcoois, enois e fenóis',
        'Aldeídos e cetonas',
        'Ácidos carboxílicos e derivados',
        'Ésteres e éteres',
        'Aminas e amidas',
        'Haletos orgânicos',
        'Nitrilas, nitrocompostos',
        'Funções mistas e compostos sulfurados',
        'Propriedades físicas dos compostos orgânicos (polaridade, solubilidade, ponto de ebulição)',
        'Acidez e basicidade de compostos orgânicos',
      ],
    },
    {
      assunto: 'Química Orgânica: Isomeria',
      subs: [
        'Isomeria plana (de cadeia, posição, função, compensação, tautomeria)',
        'Isomeria geométrica (cis-trans, E-Z)',
        'Isomeria óptica (carbono quiral, enantiômeros, mistura racêmica)',
        'Atividade óptica e polarímetro',
        'Aplicações farmacêuticas da quiralidade',
        'Conformações',
      ],
    },
    {
      assunto: 'Química Orgânica: Reações Orgânicas',
      subs: [
        'Reações de substituição (alcanos, aromáticos, halogenação, nitração, sulfonação)',
        'Reações de adição (hidrogenação, halogenação, hidratação, regra de Markovnikov)',
        'Reações de eliminação (desidratação, desidrohalogenação)',
        'Reações de oxidação e redução de compostos orgânicos',
        'Esterificação e hidrólise de ésteres',
        'Saponificação e fabricação de sabões',
        'Transesterificação e produção de biodiesel',
        'Combustão de compostos orgânicos',
        'Fermentação alcoólica, lactica e acética',
        'Reagentes de Grignard e reações de síntese (noções)',
      ],
    },
    {
      assunto: 'Química Orgânica: Polímeros e Materiais',
      subs: [
        'Polímeros de adição (polietileno, polipropileno, PVC, poliestireno, teflon, acrílicos)',
        'Polímeros de condensação (poliésteres, poliamidas, náilon, baquelite)',
        'Borrachas natural e sintética, vulcanização',
        'Plásticos, termoplásticos e termofixos',
        'Reciclagem e identificação de plásticos',
        'Bioplásticos e polímeros biodegradáveis',
        'Fibras têxteis naturais e sintéticas',
      ],
    },
    {
      assunto: 'Bioquímica e Química dos Alimentos',
      subs: [
        'Carboidratos (mono, di e polissacarídeos)',
        'Lipídios, óleos, gorduras, gorduras trans e hidrogenação',
        'Aminoácidos, proteínas e ligação peptídica',
        'Ácidos nucleicos',
        'Vitaminas e sais minerais',
        'Enzimas',
        'Aditivos alimentares e conservantes, corantes, edulcorantes',
        'Calórias e valor energético dos alimentos',
        'Rancificacao, antioxidantes',
      ],
    },
    {
      assunto: 'Química Ambiental e Sustentável',
      subs: [
        'Composição e poluição da atmosfera',
        'Chuva ácida',
        'Efeito estufa e aquecimento global',
        'Camada de ozônio e CFCs',
        'Inversão térmica e smog',
        'Poluição das águas: eutrofização, DBO e DQO, metais pesados, detergentes',
        'Ciclos biogeoquímicos (carbono, nitrogênio, enxofre, fósforo)',
        'Tratamento de água e esgoto',
        'Resíduos sólidos, lixo, aterros, incineração, reciclagem e compostagem',
        'Agrotóxicos e contaminação do solo',
        'Química verde e economia de átomos',
        'Fontes alternativas de energia, hidrogênio verde, biocombustíveis',
        'Petróleo, derramamentos e impactos',
      ],
    },
    {
      assunto: 'Química do Cotidiano e Tecnológica',
      subs: [
        'Produtos de limpeza: sabão, detergente, alvejantes, desinfetantes',
        'Cosméticos e produtos de higiene',
        'Medicamentos e fármacos',
        'Bebidas e alimentos (fermentados, refrigerantes)',
        'Combustíveis de uso automotivo, etanol e gasolina',
        'Polímeros e plásticos no dia a dia',
        'Baterias e dispositivos eletrônicos',
        'Tintas, pigmentos e corantes',
        'Explosivos, fogos de artifício, extintores de incêndio',
        'Química forense e ciência dos materiais',
      ],
    },
    {
      assunto: 'Métodos e Práticas de Laboratório',
      subs: [
        'Vidrarias e equipamentos',
        'Segurança em laboratório e descarte de resíduos',
        'Técnicas de análise (cromatografia, espectroscopia, titulometria)',
        'Leitura e interpretação de rótulos e bulas',
        'Interpretação de gráficos e tabelas químicas',
      ],
    },
  ],
  Matemática: [
    {
      assunto: 'Aritmética e Conjuntos Numéricos',
      subs: [
        'Conjuntos numéricos (naturais, inteiros, racionais, irracionais, reais)',
        'Operações básicas e expressões numéricas',
        'Divisibilidade, critérios de divisibilidade',
        'Números primos, decomposição em fatores primos',
        'MMC e MDC',
        'Frações: operações, equivalência e comparação',
        'Números decimais e dízimas periódicas (fração geratriz)',
        'Potenciação e radiciação, racionalização',
        'Notação científica e ordem de grandeza',
        'Intervalos reais e reta numérica',
        'Aproximação e arredondamento',
        'Sistemas de numeração (bases decimal, binária; numeração romana)',
        'Paridade, restos e congruências (noções)',
      ],
    },
    {
      assunto: 'Teoria dos Conjuntos e Lógica',
      subs: [
        'Pertinência, inclusão, subconjuntos',
        'União, interseção, diferença e complementar',
        'Diagramas de Venn',
        'Problemas com número de elementos',
        'Conjunto das partes',
        'Lógica proposicional, conectivos e tabela-verdade',
        'Raciocínio lógico, quantificadores, negacão e implicação',
        'Raciocínio dedutivo, sequências lógicas e padrões',
      ],
    },
    {
      assunto: 'Álgebra: Expressões e Equações',
      subs: [
        'Expressões algébricas, monômios e polinômios',
        'Produtos notáveis',
        'Fatoração',
        'Equações do 1º grau',
        'Equações do 2º grau (Bhaskara, soma e produto, discriminante)',
        'Equações biquadradas, irracionais e fracionárias',
        'Inequações do 1º e 2º graus, inequações-produto e quociente',
        'Sistemas de equações lineares (substituição, adição, escalonamento)',
        'Equações modulares e módulo',
        'Problemas que envolvem equações (idade, mistura, torneiras)',
      ],
    },
    {
      assunto: 'Razão, Proporção e Grandezas Proporcionais',
      subs: [
        'Razão e proporção',
        'Propriedades das proporções',
        'Divisão proporcional',
        'Grandezas diretamente e inversamente proporcionais',
        'Regra de três simples e composta',
        'Escalas e mapas',
        'Velocidade média, densidade e outras razões especiais',
        'Porcentagem, aumentos e descontos, variações percentuais sucessivas',
        'Mistura e concentração, índices e taxas',
      ],
    },
    {
      assunto: 'Matemática Financeira',
      subs: [
        'Juros simples',
        'Juros compostos',
        'Montante, capital, taxa e prazo',
        'Taxas equivalentes, nominais e efetivas',
        'Desconto simples e composto',
        'Inflação e correção monetária',
        'Sistemas de amortização (SAC, Price)',
        'Financiamentos, parcelamento, entrada e prestações',
        'Investimentos (poupança, CDB, ações), rentabilidade',
        'Impostos, tarifas, salários, lucro e prejuízo',
        'Cartão de crédito, empréstimos e juros rotativos',
      ],
    },
    {
      assunto: 'Funções: Conceitos Gerais',
      subs: [
        'Noção de função, domínio, contradomínio e imagem',
        'Gráficos e leitura de gráficos',
        'Função crescente, decrescente, constante',
        'Funções injetora, sobrejetora e bijetora',
        'Função par e ímpar, periódica',
        'Função composta e função inversa',
        'Transformações de gráficos (translação, reflexão)',
        'Máximos e mínimos',
        'Modelagem de fenômenos com funções',
      ],
    },
    {
      assunto: 'Funções Elementares',
      subs: [
        'Função afim (1º grau): coeficientes angular e linear, zero da função, sinal',
        'Função linear e proporcionalidade',
        'Função quadrática (2º grau): parábola, vértice, raízes, sinal, máximos e mínimos',
        'Função modular',
        'Função exponencial: gráfico, equações e inequações, crescimento e decaimento',
        'Função logarítmica: gráfico, equações e inequações',
        'Funções trigonométricas (seno, cosseno, tangente)',
        'Função definida por partes',
        'Funções polinomiais de grau maior que 2',
        'Função racional e hipérbole',
        'Função por intervalos, tarifas e contas (táxi, água, energia)',
      ],
    },
    {
      assunto: 'Logaritmos e Exponenciais',
      subs: [
        'Potências de expoente racional',
        'Definição de logaritmo, condições de existência',
        'Propriedades operatórias dos logaritmos',
        'Mudança de base',
        'Logaritmos decimais e naturais, característica e mantissa',
        'Equações e inequações exponenciais e logarítmicas',
        'Aplicações: pH, escala Richter, decibéis, juros, meia-vida, crescimento populacional',
      ],
    },
    {
      assunto: 'Sequências e Progressões',
      subs: [
        'Sequências numéricas e leis de formação',
        'Progressão aritmética (termo geral, soma, propriedades)',
        'Progressão geométrica (termo geral, soma finita e infinita, produto)',
        'Relação com funções afim e exponencial',
        'Padrões, regularidades e recorrência',
        'Séries (noções) e Fibonacci',
      ],
    },
    {
      assunto: 'Matrizes, Determinantes e Sistemas Lineares',
      subs: [
        'Tipos de matrizes e operações (soma, produto, transposta, inversa)',
        'Determinantes (ordens 2 e 3, regra de Sarrus, Laplace) e propriedades',
        'Matriz inversa e equações matriciais',
        'Sistemas lineares: classificação, escalonamento, regra de Cramer',
        'Discussão de sistemas (possível determinado, indeterminado, impossível)',
        'Aplicações de matrizes (tabelas, imagens, redes)',
      ],
    },
    {
      assunto: 'Polinômios e Equações Algébricas',
      subs: [
        'Grau, valor numérico e identidade de polinômios',
        'Operações e divisão de polinômios',
        'Dispositivo de Briot-Ruffini',
        "Teorema do resto e teorema de D'Alembert",
        'Raízes, multiplicidade e relações de Girard',
        'Teorema fundamental da Álgebra',
        'Pesquisa de raízes racionais',
      ],
    },
    {
      assunto: 'Números Complexos',
      subs: [
        'Unidade imaginária e forma algébrica',
        'Operações, conjugado, módulo',
        'Plano de Argand-Gauss',
        'Forma trigonométrica (polar)',
        'Fórmulas de De Moivre',
        'Raízes n-ésimas',
        'Interpretação geométrica',
      ],
    },
    {
      assunto: 'Geometria Plana',
      subs: [
        'Ângulos, retas paralelas e transversal',
        'Polígonos, ângulos internos e externos, diagonais',
        'Triângulos: classificação, condição de existência, pontos notáveis',
        'Congruência e semelhança de triângulos',
        'Teorema de Tales e teorema da bissetriz',
        'Relações métricas no triângulo retângulo (Pitágoras)',
        'Relações métricas em triângulos quaisquer (leis dos senos e cossenos)',
        'Quadriláteros notáveis (quadrado, retângulo, losango, paralelogramo, trapézio)',
        'Polígonos regulares',
        'Circunferência e círculo: elementos, ângulos, cordas, tangentes, posições relativas',
        'Polígonos inscritos e circunscritos',
        'Perímetros e comprimento da circunferência',
        'Áreas de figuras planas (triângulo, quadriláteros, círculo, setor, coroa, segmento circular)',
        'Razão entre áreas de figuras semelhantes',
        'Lugares geométricos',
        'Construções geométricas (régua e compasso)',
        'Simetrias, ladrilhamento, transformações no plano',
      ],
    },
    {
      assunto: 'Geometria Espacial',
      subs: [
        'Pontos, retas e planos no espaço (posições relativas, paralelismo, perpendicularismo)',
        'Poliedros, relação de Euler, poliedros regulares (Platão)',
        'Prismas (cubo, paralelepípedo): área e volume',
        'Pirâmides e tronco de pirâmide',
        'Cilindro e tronco de cilindro',
        'Cone e tronco de cone',
        'Esfera, cunha e fuso esférico, calota',
        'Princípio de Cavalieri',
        'Sólidos de revolução',
        'Inscrição e circunscrição de sólidos',
        'Planificação de sólidos e vistas (frontal, lateral, superior)',
        'Capacidade, volume de líquidos e embalagens',
        'Semelhança de sólidos',
        'Geometria da Terra (latitude, longitude, fuso horário)',
      ],
    },
    {
      assunto: 'Geometria Analítica',
      subs: [
        'Plano cartesiano, distância entre dois pontos, ponto médio',
        'Baricentro e área de triângulo (coordenadas)',
        'Condição de alinhamento de três pontos',
        'Estudo da reta: equações geral, reduzida, segmenária, paramétrica',
        'Coeficiente angular, retas paralelas e perpendiculares',
        'Ângulo entre retas',
        'Distância de ponto a reta',
        'Circunferência: equações reduzida e geral, posições relativas',
        'Cônicas: elipse, hipérbole e parábola (elementos e equações)',
        'Inequações e regiões do plano',
        'Geometria analítica no espaço (pontos, retas e planos, noções)',
        'Vetores (operações, produto escalar e vetorial, noções)',
      ],
    },
    {
      assunto: 'Trigonometria',
      subs: [
        'Razões trigonométricas no triângulo retângulo',
        'Ângulos notáveis (30°, 45°, 60°)',
        'Arcos, ângulos e medidas em radianos',
        'Ciclo trigonométrico',
        'Funções seno, cosseno e tangente (gráficos, período, amplitude)',
        'Relações fundamentais e identidades',
        'Redução ao primeiro quadrante',
        'Adição, subtração, arco duplo e metade',
        'Equações e inequações trigonométricas',
        'Lei dos senos e lei dos cossenos',
        'Funções secante, cossecante, cotangente e inversas',
        'Aplicações: altura, distância inacessível, ondas, movimento periódico',
      ],
    },
    {
      assunto: 'Análise Combinatória',
      subs: [
        'Princípio fundamental da contagem (multiplicativo e aditivo)',
        'Fatorial',
        'Permutações simples, com repetição e circulares',
        'Arranjos simples e com repetição',
        'Combinações simples e com repetição',
        'Anagramas',
        'Princípio da casa dos pombos',
        'Binômio de Newton e triângulo de Pascal',
        'Princípio da inclusão-exclusão',
        'Problemas de contagem (senhas, placas, filas, comissões, caminhos)',
      ],
    },
    {
      assunto: 'Probabilidade',
      subs: [
        'Espaço amostral e eventos',
        'Probabilidade clássica',
        'Evento complementar, união e interseção',
        'Eventos independentes e mutuamente exclusivos',
        'Probabilidade condicional',
        'Teorema de Bayes e probabilidade total',
        'Distribuição binomial',
        'Probabilidade geométrica',
        'Esperança matemática e jogos de azar',
        'Aplicações: genética, loterias, seguros, testes diagnósticos',
      ],
    },
    {
      assunto: 'Estatística',
      subs: [
        'População, amostra e variáveis (qualitativas e quantitativas)',
        'Tabelas de frequência e distribuições',
        'Gráficos (barras, colunas, setores, linhas, histograma, pictograma, dispersão, boxplot)',
        'Medidas de tendência central: média (simples e ponderada), mediana e moda',
        'Medidas de dispersão: amplitude, variância, desvio padrão, desvio médio',
        'Quartis, percentis e diagrama de caixa',
        'Distribuição normal (noções)',
        'Correlação e regressão linear (noções)',
        'Pesquisas, amostragem e margem de erro',
        'Interpretação de dados e tabelas de dupla entrada',
        'Estatística em contextos sociais e econômicos (IDH, PIB, índices)',
      ],
    },
    {
      assunto: 'Grandezas e Medidas',
      subs: [
        'Unidades de comprimento, área, volume, capacidade, massa e tempo',
        'Conversões de unidades',
        'Medidas agrárias, do sistema inglês e de informática (bit, byte)',
        'Medidas de tempo e cálculos com horas, fusos horários',
        'Velocidade, vazão, densidade e consumo',
        'Escalas de mapas e plantas',
        'Medidas de ângulos',
        'Temperatura (conversão entre escalas)',
        'Dimensões de objetos e embalagens',
        'Estimativas e ordem de grandeza',
      ],
    },
    {
      assunto: 'Noções de Cálculo e Matemática Avançada',
      subs: [
        'Noção de limite e continuidade',
        'Taxa de variação média e instantânea',
        'Noção de derivada e interpretação geométrica',
        'Otimização (máximos e mínimos)',
        'Noção de integral e área sob a curva',
        'Fractais e geometrias não euclidianas',
        'Teoria dos grafos (noções)',
      ],
    },
    {
      assunto: 'Resolução de Problemas e Modelagem',
      subs: [
        'Interpretação de enunciados e leitura de gráficos',
        'Raciocínio proporcional e estimativa',
        'Modelagem matemática de situações reais',
        'Problemas de otimização e planejamento',
        'Matemática no cotidiano (consumo, trânsito, esportes, arquitetura, tecnologia)',
        'Matemática e ambiente, saúde e sociedade',
        'História da Matemática',
      ],
    },
  ],
  Biologia: [
    {
      assunto: 'Introdução à Biologia e Origem da Vida',
      subs: [
        'Características dos seres vivos e níveis de organização',
        'Método científico e história da Biologia',
        'Origem da vida: abiogênese, biogênese, experimentos de Redi e Pasteur',
        'Hipóteses modernas (Oparin-Haldane, Miller-Urey, panspermía, mundo de RNA)',
        'Hipóteses autotrófica e heterotrófica',
        'Condições da Terra primitiva',
      ],
    },
    {
      assunto: 'Química da Vida (Bioquímica)',
      subs: [
        'Água e sais minerais',
        'Carboidratos',
        'Lipídios (gorduras, fosfolípides, esteroides, ceras)',
        'Proteínas, aminoácidos e estrutura proteica',
        'Enzimas (ação, especificidade, fatores que alteram atividade)',
        'Vitaminas',
        'Ácidos nucleicos (DNA e RNA)',
        'pH, tampões e homeostase química',
      ],
    },
    {
      assunto: 'Citologia: Estrutura Celular',
      subs: [
        'Teoria celular e microscopia',
        'Células procarióticas e eucarióticas, animal e vegetal',
        'Membrana plasmática e glicócalix',
        'Parede celular',
        'Citoplasma e citoesqueleto',
        'Organelas: ribossomos, retículos, complexo de Golgi, lisossomos, peroxissomos, vacúolos, mitocôndrias, cloroplastos, centríolos',
        'Núcleo, envoltório nuclear, nucléolo, cromatina e cromossomos',
        'Junções e especializações celulares',
        'Teoria da endossimbiose',
      ],
    },
    {
      assunto: 'Citologia: Transportes e Metabolismo Celular',
      subs: [
        'Transporte passivo: difusão simples, facilitada, osmose',
        'Transporte ativo, bomba de sódio e potássio',
        'Endocitose (fagocitose, pinocitose) e exocitose',
        'Meio hipotônico, isotônico e hipertônico',
        'Respiração celular (glicólise, ciclo de Krebs, cadeia respiratória)',
        'Fermentação',
        'Fotossíntese (fases clara e escura, fatores limitantes)',
        'Quimiossíntese',
        'ATP e ciclos energéticos',
        'Síntese de proteínas e secreção',
      ],
    },
    {
      assunto: 'Citologia: Divisão Celular',
      subs: [
        'Ciclo celular e pontos de checagem',
        'Mitose',
        'Meiose e crossing-over',
        'Gametogênese (espermatogênese e ovogênese)',
        'Câncer e controle da proliferação celular',
        'Apoptose',
        'Células-tronco',
        'Cariótipo e alterações cromossômicas',
      ],
    },
    {
      assunto: 'Biologia Molecular',
      subs: [
        'Estrutura do DNA e RNA',
        'Replicação do DNA',
        'Transcrição',
        'Código genético e tradução',
        'Síntese proteica',
        'Regulação gênica (operon)',
        'Mutações gênicas e cromossômicas, agentes mutágenos',
        'Reparo do DNA',
        'Genômica, epigenética e transcriptômica',
      ],
    },
    {
      assunto: 'Genética Clássica',
      subs: [
        'Conceitos básicos: gene, alelo, genótipo, fenótipo, dominante, recessivo',
        'Primeira lei de Mendel',
        'Segunda lei de Mendel',
        'Cruzamento-teste, heredogramas e análise de genealogias',
        'Probabilidade em genética',
        'Dominancia incompleta, codominância, alelos múltiplos',
        'Sistema ABO, fator Rh, eritroblastose fetal',
        'Herança ligada ao sexo e determinação do sexo',
        'Herança influenciada e limitada pelo sexo',
        'Epístase, pleiotropia, herança quantitativa (poligenia)',
        'Ligação gênica (linkage), mapas genéticos',
        'Doenças genéticas (fibrose cística, hemofilia, daltonismo, anemia falciforme, fenilcetonúria, albinismo, Down, Turner, Klinefelter)',
        'Genética de populações: equilíbrio de Hardy-Weinberg',
      ],
    },
    {
      assunto: 'Biotecnologia e Engenharia Genética',
      subs: [
        'DNA recombinante, enzimas de restrição e plasmídeos',
        'PCR e eletroforese',
        'Sequenciamento e Projeto Genoma',
        'Organismos transgênicos (OGM) e alimentos transgênicos',
        'Clonagem (reprodutiva e terapêutica)',
        'Terapia gênica e edição gênica (CRISPR)',
        'Testes de paternidade e DNA forense',
        'Vacinas de DNA e RNA, produção de insulina',
        'Biocombustíveis, biorremediação',
        'Bioética, patentes e biossegurança',
      ],
    },
    {
      assunto: 'Evolução',
      subs: [
        'Evidências da evolução (fósseis, homologia, analogia, vestigiais, embriologia, molecular)',
        'Lamarckismo e Darwinismo',
        'Teoria sintética da evolução',
        'Seleção natural, sexual e artificial',
        'Mutação, recombinação, deriva gênica, fluxo gênico',
        'Adaptação, especiação e isolamento reprodutivo',
        'Irradiação adaptativa e convergência evolutiva',
        'Coevolução, extinções em massa',
        'Evolução humana (hominídeos, Homo sapiens)',
        'Escala de tempo geológico',
        'Resistência a antibióticos e a defensivos como exemplo evolutivo',
      ],
    },
    {
      assunto: 'Sistemática e Taxonomia',
      subs: [
        'Categorias taxonômicas e nomenclatura binómia',
        'Cladogramas, árvores filogenéticas',
        'Domínios e reinos (Monera, Protóctista, Fungi, Plantae, Animalia)',
        'Critérios de classificação',
        'Chaves de identificação',
      ],
    },
    {
      assunto: 'Vírus e Microbiologia',
      subs: [
        'Estrutura e replicação dos vírus (ciclos lítico e lisogênico)',
        'Viroses (dengue, zika, chikungunya, febre amarela, gripe, COVID-19, HIV, hepatites, HPV, raiva, sarampo, poliomielite)',
        'Bactérias: estrutura, reprodução, recombinação genética',
        'Bacterioses (tétano, tuberculose, cólera, leptospirose, sífilis, gonorreia, meningite, hanseníase)',
        'Arqueias e cianobactérias',
        'Fungos: características, reprodução, micoses, importância econômica',
        'Fermentção e produção de alimentos',
        'Antibióticos e resistência bacteriana',
        'Priõns e viroides',
        'Microbiota humana e probióticos',
      ],
    },
    {
      assunto: 'Parasitologia e Doenças Tropicais',
      subs: [
        'Protozooses (malária, doença de Chagas, leishmaniose, toxoplasmose, giardíase, amebíase, tricomoníase)',
        'Verminoses (esquistossomose, teniaíse, cisticercose, ascaridíase, ancilostomíase, filaríase, oxiuríase)',
        'Ciclos de vida, hospedeiros e vetores',
        'Profilaxia, saneamento básico e saúde pública',
        'Doenças negligenciadas',
      ],
    },
    {
      assunto: 'Imunologia e Saúde',
      subs: [
        'Barreiras de defesa, imunidade inata e adquirida',
        'Antígenos e anticorpos',
        'Resposta imune primária e secundária',
        'Vacinas e soros (imunidade ativa e passiva)',
        'Alergias e autoimunidade',
        'Transplantes e rejeição',
        'Imunodeficiências (AIDS)',
        'Sistema ABO e Rh na transfusão',
        'Campanhas de vacinação, epidemias, pandemias, endemias',
        'Infecções sexualmente transmissíveis e prevenção',
        'Doenças crônicas, nutrição e saúde pública, drogas lícitas e ilícitas',
      ],
    },
    {
      assunto: 'Zoologia: Invertebrados',
      subs: [
        'Poríferos',
        'Cnidários',
        'Platelmintos',
        'Nematelmintos',
        'Moluscos',
        'Anelídeos',
        'Artrópodes (insetos, aracnídeos, crustáceos, miriápodes)',
        'Equinodermos',
        'Planos corporais: simetria, celoma, embriologia, metameria',
        'Insetos como vetores e pragas',
      ],
    },
    {
      assunto: 'Zoologia: Cordados e Vertebrados',
      subs: [
        'Protocordados',
        'Peixes (agnatos, condrictes, osteíctes)',
        'Anfíbios',
        'Répteis',
        'Aves',
        'Mamíferos',
        'Adaptações ao ambiente terrestre e aquático',
        'Comportamento animal, migração, comunicação e sociabilidade',
        'Anatomia e fisiologia comparadas',
      ],
    },
    {
      assunto: 'Botânica',
      subs: [
        'Algas',
        'Biófitas (musçíneas e hepaticas)',
        'Pteridófitas',
        'Gimnospermas',
        'Angiospermas (mono e dicotiledôneas)',
        'Ciclos de vida e alternação de gerações',
        'Histologia vegetal (meristemas, parênquima, esclerênquima, xilema e floema)',
        'Morfologia: raiz, caule, folha, flor, fruto, semente',
        'Fisiologia vegetal: transpiração, absorção, transporte de seiva, teoria da coesãotensão',
        'Fitormônios (auxina, giberelina, citocinina, etileno, ácido abscísico)',
        'Fotoperiodismo, tropismos e nastismos',
        'Fotossíntese e respiração em vegetais',
        'Polinização, dispersão de sementes e fecundação',
        'Reprodução assexuada e propagação vegetativa',
        'Fitotecnologia, agricultura, importância econômica das plantas',
      ],
    },
    {
      assunto: 'Histologia Animal',
      subs: [
        'Tecido epitelial',
        'Tecido conjuntivo (frouxo, denso, adiposo, cartilaginoso, ósseo, sanguíneo)',
        'Tecido muscular (liso, estriado esquelético e cardíaco)',
        'Tecido nervoso',
        'Hemopoese e células do sangue',
      ],
    },
    {
      assunto: 'Fisiologia Humana: Nutrição e Metabolismo',
      subs: [
        'Sistema digestório e enzimas digestivas',
        'Absorção de nutrientes e hormonios digestivos',
        'Nutrição, dieta equilibrada, desnutrição e obesidade',
        'Metabolismo e taxa metabólica',
        'Sistema respiratório e trocas gasosas',
        'Sistema circulatório (coração, vasos, sangue, linfa), pressão arterial',
        'Sistema excretor, formação da urina, equilíbrio hidrossalino',
        'Termorregulação',
      ],
    },
    {
      assunto: 'Fisiologia Humana: Coordenação e Controle',
      subs: [
        'Sistema nervoso (central e periférico), neurônios, impulso nervoso e sinapse',
        'Sistema nervoso autônomo e atos reflexos',
        'Órgãos dos sentidos (visão, audição, olfato, paladar, tato)',
        'Sistema endócrino e hormônios (insulina, tireoide, adrenalina, sexuais)',
        'Diabetes e outros distúrbios hormonais',
        'Retroalimentação (feedback) e homeostase',
        'Sistema locomotor (ossos, músculos, articulações, contração muscular)',
        'Ritmos biológicos, sono e ciclos circadianos',
        'Drogas e efeitos no sistema nervoso',
      ],
    },
    {
      assunto: 'Reprodução e Desenvolvimento',
      subs: [
        'Reprodução assexuada (bipartição, brotamento, esporulação, fragmentação, partenogênese)',
        'Reprodução sexuada',
        'Sistema reprodutor masculino e feminino',
        'Ciclo menstrual e hormonios sexuais',
        'Fecundação, gestação, placenta, parto e lactação',
        'Métodos contraceptivos e planejamento familiar',
        'Reprodução assistida (fertilização in vitro)',
        'Embriologia: segmentação, gastrulação, neurulação, anexos embrionários',
        'Tipos de ovo e de desenvolvimento (direto e indireto, metamorfose)',
        'Folhetos embrionários e diferenciação',
        'Regeneração e envelhecimento',
      ],
    },
    {
      assunto: 'Ecologia: Conceitos e Populações',
      subs: [
        'Conceitos básicos: ecossistema, habitat, nicho ecológico, população, comunidade, bioma',
        'Dinâmica de populações: crescimento, densidade, capacidade de suporte, curvas de crescimento',
        'Relações ecológicas harmônicas e desarmônicas intra e interespecíficas',
        'Competição, predação, parasitismo, mutualismo, comensalismo, protocooperação, amensalismo',
        'Sucessão ecológica (primária e secundária)',
      ],
    },
    {
      assunto: 'Ecologia: Fluxo de Energia e Ciclos',
      subs: [
        'Cadeias e teias alimentares',
        'Níveis tróficos e pirâmides ecológicas (energia, biomassa, números)',
        'Produtividade primária e secundária',
        'Ciclos biogeoquímicos (água, carbono, nitrogênio, oxigênio, fósforo, enxofre)',
        'Bioacumulação e magnificação trófica',
        'Fluxo unidirecional de energia',
      ],
    },
    {
      assunto: 'Ecologia: Biomas e Ambientes',
      subs: [
        'Biomas terrestres do mundo (floresta tropical, savana, deserto, taiga, tundra, campos)',
        'Biomas brasileiros: Amazônia, Cerrado, Caatinga, Mata Atlântica, Pampa, Pantanal',
        'Ecossistemas aquáticos: marinhos, de água doce, manguezais, estuários, recifes de coral',
        'Zonas costeiras e plankton',
        'Fatores abióticos e bióticos',
        'Distribuição geográfica das espécies',
      ],
    },
    {
      assunto: 'Ecologia: Impactos Ambientais e Sustentabilidade',
      subs: [
        'Desmatamento e queimadas',
        'Perda de biodiversidade e espécies ameaçadas',
        'Espécies invasoras e exóticas',
        'Aquecimento global e mudanças climáticas',
        'Efeito estufa, camada de ozônio, chuva ácida',
        'Poluição do ar, da água e do solo',
        'Eutrofização',
        'Resíduos sólidos, reciclagem e compostagem',
        'Unidades de conservação e legislação ambiental',
        'Desenvolvimento sustentável e agroecologia',
        'Povos tradicionais, agricultura e uso do solo',
        'Energias renováveis e pegada ecológica',
        'Saneamento básico e saúde ambiental',
        'Convenções e acordos internacionais (Rio-92, Protocolo de Kyoto, Acordo de Paris)',
      ],
    },
    {
      assunto: 'Biologia Aplicada e Interdisciplinar',
      subs: [
        'Interpretação de gráficos, tabelas e experimentos biológicos',
        'Planejamento experimental, variáveis e grupos-controle',
        'Biologia e saúde pública',
        'Agropecuária, controle biológico de pragas',
        'Biomimética e tecnologia',
        'Astrobiologia',
        'Biologia forense',
      ],
    },
  ],
};

export const TAX_DISCIPLINAS = Object.keys(TAXONOMY) as TaxDisc[];

const isDisc = (d: string): d is TaxDisc => d in TAXONOMY;

/** Assuntos gerais da disciplina, na ordem da taxonomia. */
export const assuntosDe = (disciplina: string) => (isDisc(disciplina) ? TAXONOMY[disciplina].map((t) => t.assunto) : []);

/** Subassuntos de um assunto geral, na ordem da taxonomia. */
export const subassuntosDe = (disciplina: string, assunto: string) =>
  (isDisc(disciplina) ? TAXONOMY[disciplina].find((t) => t.assunto === assunto)?.subs : undefined) ?? [];

/** Posição para ordenar listas de assuntos na ordem da taxonomia (os de fora vão para o fim, em ordem alfabética). */
export function taxOrder(values: string[]) {
  const pos = new Map<string, number>();
  for (const d of TAX_DISCIPLINAS)
    TAXONOMY[d].forEach((t, i) => {
      if (!pos.has(t.assunto)) pos.set(t.assunto, i);
      t.subs.forEach((s, k) => !pos.has(s) && pos.set(s, i * 1000 + k));
    });
  return [...values].sort((a, b) => {
    const pa = pos.get(a) ?? Number.MAX_SAFE_INTEGER;
    const pb = pos.get(b) ?? Number.MAX_SAFE_INTEGER;
    return pa - pb || a.localeCompare(b, 'pt-BR', { numeric: true });
  });
}

// ---------------------------------------------------------------- classificação automática
const STOP = new Set(
  'para com sem por uma uns umas dos das nos nas que como mais entre sobre seus suas sua seu pelo pela pelos pelas este esta esse essa isso aos ate tambem ser sao foi tem mesmo cada outro outra outros outras quando onde qual quais pode podem deve devem muito muita apenas ainda assim entao porque pois tipo tipos geral gerais basico basicos nocoes aplicacoes aplicacao estudo'.split(
    ' ',
  ),
);
const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
/** palavras (raiz de 5 letras) para comparar textos com e sem flexão: "ecológicas" ~ "ecologia" */
const roots = (s: string) =>
  norm(s)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !STOP.has(w))
    .map((w) => w.slice(0, 5));

let index:
  | {
      disc: TaxDisc;
      assunto: string;
      sub: string;
      words: Set<string>;
      head: Set<string>;
    }[]
  | null = null;
function idx() {
  if (index) return index;
  index = [];
  for (const d of TAX_DISCIPLINAS)
    for (const t of TAXONOMY[d])
      for (const s of t.subs)
        index.push({
          disc: d,
          assunto: t.assunto,
          sub: s,
          words: new Set(roots(s)),
          head: new Set(roots(t.assunto)),
        });
  return index;
}

/**
 * Encaixa uma questão na taxonomia: compara o assunto que veio (geral e específico) e o começo do enunciado
 * com cada subassunto da disciplina. Devolve null se a disciplina não estiver na taxonomia.
 */
export function classify(q: { disciplina: string; assuntoGeral?: string; assuntoEspecifico?: string; texto?: string }, only?: string) {
  if (!isDisc(q.disciplina)) return null;
  const strong = roots(`${q.assuntoEspecifico ?? ''} ${q.assuntoGeral ?? ''}`);
  const weak = roots((q.texto ?? '').slice(0, 600));
  let best: { assunto: string; sub: string; score: number } | null = null;
  for (const e of idx()) {
    if (e.disc !== q.disciplina || (only && e.assunto !== only)) continue;
    let score = 0;
    for (const w of strong) if (e.words.has(w)) score += 3;
    for (const w of strong) if (e.head.has(w)) score += 1.5;
    for (const w of weak) if (e.words.has(w)) score += 0.4;
    score /= Math.sqrt(e.words.size + 1);
    if (!best || score > best.score) best = { assunto: e.assunto, sub: e.sub, score };
  }
  return best && best.score > 0 ? best : null;
}

/** Assunto do MHS (entrou depois na taxonomia): questões de Física que falam dele vão para lá. */
export const MHS = 'Movimento Harmônico Simples (MHS)';
// no assunto que veio: pêndulo, massa-mola, oscilação…; no enunciado só os termos próprios do MHS
// (um pêndulo numa questão de energia continua em Energia)
const MHS_TOPIC = /p[êe]ndulo|massa[- ]mola|harm[ôo]nic|\bMHS\b|oscila/i;
const MHS_TEXT = /movimento harm[ôo]nico|\bMHS\b|oscilador harm[ôo]nico|sistema massa[- ]mola|per[íi]odo de oscila[çc][ãa]o/i;
export function mhsOf(q: { disciplina: string; assuntoGeral?: string; assuntoEspecifico?: string; texto?: string }) {
  if (q.disciplina !== 'Física') return null;
  if (!MHS_TOPIC.test(`${q.assuntoGeral ?? ''} ${q.assuntoEspecifico ?? ''}`) && !MHS_TEXT.test(q.texto ?? '')) return null;
  const c = classify(q, MHS);
  return { assunto: MHS, sub: c?.sub ?? TAXONOMY['Física'].find((t) => t.assunto === MHS)!.subs[0] };
}
