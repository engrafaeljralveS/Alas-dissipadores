# Alas

Alas de bueiro em concreto armado: geometria interativa em planta e corte, empuxos ativo e passivo, esforços nas paredes engastadas, tensão no solo, dimensionamento das armaduras (ABNT NBR 6118) e memorial de cálculo em Word.

Programa em um único arquivo HTML (`index.html`), sem dependências: abra no navegador.

## Abas

- **Geometria**: tubo, testa, alas, laje de fundo, engrossamento sob a testa e dente na ponta; planta e corte A redesenhados a cada valor, na altura do painel de dados. Lastro de concreto magro fixo em 5 cm.
- **Esforços**: solo (γ, φ, σ<sub>adm</sub>), empuxo ativo na testa (do fundo da laje sob a testa até o topo) e passivo no dente (laje mais dente), com a verificação E<sub>p</sub> / E<sub>a</sub> ≥ 1; testa e alas engastadas na laje de fundo em faixas de 1 m; tensão no solo pelo peso próprio dividido pela área de apoio.
- **Armaduras**: f<sub>ck</sub>, classe de agressividade e cobrimento; armadura padrão (bitola e espaçamento) da laje de fundo (vale também para o dente), da testa e das paredes, igual nas duas faces e nas duas direções. Flexão, armadura mínima, espaçamento, bitola e cortante sem estribos. Posições N1 a N4 em barras de dobra + reto + dobra, espelhadas para fechar o estribo; armadura horizontal das paredes (N5) correndo alas e testa.
- **Memorial**: objeto e premissas, geometria (planta e corte), solo, esforços, dimensionamento (materiais, flexão e mínima, cortante) e resumo das verificações. Baixa em Word (.docx) ou copia para colar no Word.

## Estrutura

```
index.html            o programa montado (abra este)
app/
  app-template.html   página, estilos e ligação das abas
  desenho.js          geometria e desenho da planta e do corte (SVG)
  esforcos.js         empuxos, paredes engastadas, peso próprio e tensão no solo
  armaduras.js        dimensionamento NBR 6118 e posições das barras
  paredes-mef.js      testa e alas como cascas no motor: momentos horizontais e dimensionamento da N5
  memorial.js         memorial em HTML e geração do .docx
motor/
  motor-mef.js        motor de elementos finitos de casca (extraído do Flutuação em Caixas v3.10)
  modelo-caixa.js     exemplo: o modelo da caixa enterrada sobre o motor
testes/
  testes-motor.js     testes do motor
  testes-paredes.js   testes do modelo de casca das paredes
versoes/              cada versão salva, de v1.0 em diante
layout/               propostas de layout e esboços aprovados
build.js              monta o index.html a partir de app/
```

## Montar e testar

```
node build.js 1.7                      # gera index.html e versoes/alas-v1.7.html
node testes/testes-motor.js            # testes do motor de elementos finitos
node testes/testes-paredes.js          # testes do modelo de casca das paredes
```

## Versões

- **v1.0**: geometria interativa em planta e corte (layout A: dados à esquerda, desenhos à direita).
- **v1.1**: aba Esforços: γ e φ do solo, empuxo ativo na testa e passivo no dente, equilíbrio, alas engastadas na laje com M e V ao longo da ala.
- **v1.2**: tensão no solo (peso próprio ÷ área de apoio, comparada com σ<sub>adm</sub>) e aba Armaduras (f<sub>ck</sub>, CAA, cobrimento; laje de fundo e dente, testa e paredes).
- **v1.3**: primeiro desenho das armaduras em U no corte.
- **v1.4**: barras no padrão aprovado (dobra + reto + dobra, duas barras espelhadas por estribo) e aba Memorial com download em Word.
- **v1.5**: memorial com planta e corte no lugar das tabelas de geometria, 5.3 só com o cortante, sem a seção de armaduras adotadas.
- **v1.6**: planta e corte dividem a altura do painel de dados, meio a meio.
- **v1.8**: verificação da armadura horizontal (N5) com um modelo de casca da testa e das alas pelo motor de elementos finitos (base engastada na laje, furo do tubo, topo da ala em degraus, empuxo ativo): mapa de momentos horizontais na aba Esforços, A<sub>s,nec</sub> à flexo-tração por face e por camada na aba Armaduras, itens 4.6 e 5.4 do memorial.
- **v1.7**: armadura horizontal das paredes (N5): bitola e espaçamento próprios, corre pelas duas alas e pela testa nas duas faces, com camadas, planta e tabela na aba Armaduras e item 5.4 no memorial. Testa e paredes passam a definir só a armadura vertical.

## Premissas

Rankine, solo não coesivo, sem atrito solo-parede e sem sobrecarga no aterro. Esforços característicos majorados por γ<sub>f</sub> = 1,4; γ<sub>c</sub> = 1,4; γ<sub>s</sub> = 1,15; aço CA-50. A laje de fundo recebe no engaste o maior momento das paredes; a flexão da laje sob a reação do solo ainda não é calculada.

Cálculo preliminar: valide coeficientes e hipóteses antes de uso em projeto executivo.
