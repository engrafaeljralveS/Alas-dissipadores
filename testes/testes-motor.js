// Testes do motor de elementos finitos do Alas.
// Uso: node testes/testes-motor.js [caminho/do/flutuacao/index.html]
//   Sem o caminho, roda só os testes analíticos. Com ele, confere também o
//   modelo da caixa contra o FEengine original do app de flutuação.
const fs = require('fs'), path = require('path');
const { MotorMEF } = require(path.join(__dirname, '../motor/motor-mef.js'));
const { ModeloCaixa } = require(path.join(__dirname, '../motor/modelo-caixa.js'));
const FE = MotorMEF(), Caixa = ModeloCaixa(FE);
let falhas = 0;
const ok = (c, msg) => { if (!c) falhas++; console.log((c ? '  OK    ' : '  FALHA ') + msg); };
const XY = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

// 1) Placa quadrada engastada, carga uniforme (Timoshenko: w = 0,00126 q a⁴/D; M centro = 0,0231 q a², ν = 0,3)
{
  const a = 1, nd = 20, t = 0.01, E = 1e7, nu = 0.3, D = E * t ** 3 / 12 / (1 - nu * nu);
  const mesh = FE.createMesh({ placa: { T: XY } }), us = FE.axis([0, a], a / nd);
  mesh.addSurface('placa', us, us, (u, v) => [u, v, 0], t);
  const edge = p => p[0] < 1e-9 || p[1] < 1e-9 || p[0] > a - 1e-9 || p[1] > a - 1e-9;
  const sys = FE.prepare(mesh, { E, nu }, (n, d) => edge(mesh.nodes[n]) || d < 2 || d === 5);
  const F = FE.areaLoad(mesh, sys.eq, sys.n, () => [0, 0, -1]);
  const U = FE.solveSprings(sys, [], [F], [{ f: [1] }]).results[0].U;
  const c = mesh.nodes.findIndex(p => Math.abs(p[0] - a / 2) < 1e-9 && Math.abs(p[1] - a / 2) < 1e-9);
  const w = -U[sys.eq[6 * c + 2]] * D;
  const rec = FE.recovery(mesh), M = FE.nodal(rec, FE.gaussValues(mesh, sys.eq, U, { E, nu })).placa[8 * rec.surfIdx.placa.get(c)];
  console.log('1) Placa engastada (Timoshenko)');
  ok(Math.abs(w / 0.00126 - 1) < 0.02, `flecha ${w.toFixed(5)} q·a⁴/D (ref. 0,00126)`);
  ok(Math.abs(-M / 0.0231 - 1) < 0.02, `momento no centro ${(-M).toFixed(4)} q·a² (ref. 0,0231)`);
}

// 2) Placa simplesmente apoiada sobre molas só de compressão, com carga de levantamento numa ponta:
//    as molas tracionadas devem desligar e o equilíbrio vertical deve fechar.
{
  const a = 2, t = 0.2, E = 2.5e7, nu = 0.2, kv = 2e4;
  const mesh = FE.createMesh({ placa: { T: XY } }), us = FE.axis([0, a], 0.1);
  mesh.addSurface('placa', us, us, (u, v) => [u, v, 0], t);
  const sys = FE.prepare(mesh, { E, nu }, (n, d) => d === 0 || d === 1 || d === 5);
  const trib = FE.tributary(mesh);
  const springs = mesh.nodes.map((p, i) => ({ node: i, dof: 2, k: kv * trib[i], compOnly: true }));
  const F0 = FE.areaLoad(mesh, sys.eq, sys.n, () => [0, 0, -10]);
  const F1 = new Float64Array(sys.n); const corner = mesh.nodes.findIndex(p => p[0] > a - 1e-9 && p[1] > a - 1e-9);
  FE.nodalLoad(sys.eq, F1, corner, 2, 10);   // 40 kN para baixo no centro, 10 kN para cima no canto: resultante dentro da placa
  const s = FE.solveSprings(sys, springs, [F0, F1], [{ f: [1, 1] }]).results[0];
  const R = s.force.reduce((x, y) => x + y, 0), Fz = -(FE.sumLoad(sys.eq, mesh.nodes.length, F0, 2) + FE.sumLoad(sys.eq, mesh.nodes.length, F1, 2));
  console.log('2) Placa sobre molas só de compressão');
  ok(s.lifted > 0 && !s.floated, `molas desligadas: ${s.lifted} de ${springs.length}, em ${s.it} iterações`);
  ok(Math.abs(R - Fz) / Fz < 1e-6, `equilíbrio: reações ${R.toFixed(3)} kN = cargas ${Fz.toFixed(3)} kN`);
}

// 3) Caixa longa (L = 20 m) só com pressão lateral uniforme p = 10: deve reproduzir o pórtico plano
{
  const L0 = { K: 0, gd: 0, gp: 0, gw: 0, dw: 99, cT: 0, dA: 1, dB: 3, qtSelf: 0, qtSoil: 0, qChim: 0, qbSelf: 0, uBase: 0, qAba: 0, wallW: 0, q: 0, Kq: 10 };
  const r = Caixa.analyze({ geo: { Bc: 2, Lc: 20, Hc: 2, ep: 0.2, es: 0.2, ei: 0.2, ba: 0, bo: 0, lo: 0, chimH: 0, h: 0.15 }, mat: { E: 2.5e7, nu: 0.2 }, kv: 3e4, loads: L0, combos: [{ f: [0, 0, 0, 1], lin: true }] });
  const res = r.results[0].res;
  const val = (s, x, y, z, k) => { let best = null, dmin = Infinity; r.surfNodes[s].forEach((i, j) => { const p = r.nodes[i], d = Math.hypot(p[0] - x, p[1] - y, p[2] - z); if (d < dmin) { dmin = d; best = res[s][8 * j + k]; } }); return best; };
  const topM = val('top', 0, 0, 2, 0), wallMid = val('wx', 1, 0, 1, 1), wallFace = val('wx', 1, 0, 1.9, 1);
  console.log('3) Caixa longa × pórtico plano');
  ok(Math.abs(topM / 1.6667 - 1) < 0.02, `laje de topo ${topM.toFixed(3)} (ref. 1,667)`);
  ok(Math.abs(-wallMid / 3.3333 - 1) < 0.02, `meio da parede ${(-wallMid).toFixed(3)} (ref. 3,333)`);
  ok(Math.abs(wallFace / 0.7167 - 1) < 0.03, `parede na face da laje ${wallFace.toFixed(3)} (ref. 0,717)`);
}

// 4) Equivalência com o app original (FEengine da v3.10) na caixa padrão, operação e etapa construtiva
const orig = process.argv[2];
if (orig) {
  const html = fs.readFileSync(orig, 'utf8');
  new Function(html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>')))();
  const { Calc, Arm, FEengine, DEFAULTS } = globalThis.__test;
  const FEo = FEengine();
  const m = Calc.compute(Object.assign({}, DEFAULTS));
  const { inp } = Arm.feInput(m);
  console.log('4) Caixa padrão × app de flutuação original');
  ['operação', 'etapa construtiva'].forEach((nome, k) => {
    const a = FEo.analyze(inp[k]), b = Caixa.analyze(inp[k]);
    let dRes = 0, dU = 0, dP = 0, ref = 0, refU = 0, refP = 0, dR = 0, iguais = a.results.length === b.results.length && a.stats.nEq === b.stats.nEq && a.stats.nFact === b.stats.nFact;
    a.results.forEach((ra, i) => {
      const rb = b.results[i];
      Object.keys(ra.res).forEach(s => ra.res[s].forEach((v, j) => { dRes = Math.max(dRes, Math.abs(v - rb.res[s][j])); ref = Math.max(ref, Math.abs(v)); }));
      ra.disp.forEach((v, j) => { dU = Math.max(dU, Math.abs(v - rb.disp[j])); refU = Math.max(refU, Math.abs(v)); });
      ra.press.forEach((v, j) => { dP = Math.max(dP, Math.abs(v - rb.press[j])); refP = Math.max(refP, Math.abs(v)); });
      dR = Math.max(dR, Math.abs(ra.R - rb.R) / Math.max(1, Math.abs(ra.R)), Math.abs(ra.Fz - rb.Fz) / Math.max(1, Math.abs(ra.Fz)));
      if (ra.lifted !== rb.lifted || ra.floated !== rb.floated || ra.it !== rb.it) iguais = false;
    });
    // mesmas contas, só diferenças de arredondamento (relativas ≤ 1e-9)
    ok(iguais && dRes <= 1e-9 * ref && dU <= 1e-9 * refU && dP <= 1e-9 * refP && dR < 1e-9,
      `${nome}: ${a.results.length} combinações, ${b.stats.nEq} equações; maior diferença relativa: esforços ${(dRes / ref).toExponential(1)}, deslocamentos ${(dU / refU).toExponential(1)}, pressões ${(dP / refP).toExponential(1)}`);
  });
}
console.log(falhas ? `\n${falhas} teste(s) falharam.` : '\nTodos os testes passaram.');
process.exit(falhas ? 1 : 0);
