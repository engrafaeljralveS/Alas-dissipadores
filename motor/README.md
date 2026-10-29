# Motor de elementos finitos

Extraído do app **Flutuação em Caixas** (v3.10), separado da caixa para ser reaproveitado.

- `motor-mef.js`: o motor genérico. Elemento retangular de 4 nós com 6 gl por nó (membrana Q4 com modos incompatíveis + placa de Mindlin MITC4), montador de malha, solver skyline LDLᵀ com numeração Cuthill-McKee reversa, cargas de área, linha e nó, molas lineares ou só de compressão, e esforços nodais por recuperação SPR. Não tem nada da caixa.
- `modelo-caixa.js`: o modelo da caixa enterrada (malha em ¼ com simetria, solo, água, sobrecarga, Winkler) reescrito sobre o motor. Dá os mesmos resultados do `FEengine` original e serve de exemplo de modelo.

## Testes

```
node testes/testes-motor.js                                     # testes analíticos
node testes/testes-motor.js ../flutuacao-em-caixas/index.html   # + equivalência com o app original
```

Confere a placa engastada (Timoshenko), a placa sobre molas só de compressão (desligamento e equilíbrio), a caixa longa contra o pórtico plano e, com o caminho do app de flutuação, a caixa padrão contra o `FEengine` da v3.10 (diferenças relativas da ordem de 10⁻¹², só arredondamento).

## Como montar um modelo

```js
const FE = MotorMEF();

// 1. Malha: superfícies com eixos locais (linhas de T = x', y', z' em coordenadas globais)
const mesh = FE.createMesh({ laje: { T: [[1, 0, 0], [0, 1, 0], [0, 0, 1]] } });
const xs = FE.axis([0, 4], 0.10), ys = FE.axis([0, 3], 0.10);   // pontos-chave e passo máximo
mesh.addSurface('laje', xs, ys, (u, v) => [u, v, 0], 0.20);      // espessura 20 cm

// 2. Apoios (gl 0..5 = ux, uy, uz, θx, θy, θz) e montagem da rigidez
const sys = FE.prepare(mesh, { E: 2.5e7, nu: 0.2 }, (no, gl) => gl === 0 || gl === 1 || gl === 5);

// 3. Cargas
const F = FE.areaLoad(mesh, sys.eq, sys.n, (x, y, z, e) => [0, 0, -10]);   // kN/m²

// 4. Molas de Winkler só de compressão e solução
const trib = FE.tributary(mesh);
const molas = mesh.nodes.map((p, i) => ({ node: i, dof: 2, k: 3e4 * trib[i], compOnly: true }));
const sol = FE.solveSprings(sys, molas, [F], [{ f: [1] }]);

// 5. Esforços nodais por superfície: [M1, M2, M12, Q1, Q2, N1, N2, N12] nos eixos locais
const rec = FE.recovery(mesh);
const esf = FE.nodal(rec, FE.gaussValues(mesh, sys.eq, sol.results[0].U, { E: 2.5e7, nu: 0.2 }));
```

Em uma página HTML, basta incluir o `motor-mef.js` num `<script>`. Para rodar em segundo plano, `MotorMEF.toString()` vai inteiro para um Web Worker, como o app de flutuação já faz.
