// Testes do modelo de casca das paredes (testa + alas).
// Uso: node testes/testes-paredes.js
const path = require('path'), R = f => require(path.join(__dirname, '..', f));
global.MotorMEF = R('motor/motor-mef.js').MotorMEF; global.AlasGeo = R('app/desenho.js').AlasGeo;
global.AlasEsf = R('app/esforcos.js').AlasEsf; global.AlasArm = R('app/armaduras.js').AlasArm;
const { AlasMEF } = R('app/paredes-mef.js');
let falhas = 0; const ok = (c, m) => { if (!c) falhas++; console.log((c ? '  OK    ' : '  FALHA ') + m); };
const soil = { gs: 18, phi: 30 }, H = 0.95, t = 0.15, E = 2.5e7, nu = 0.2, D = E * t ** 3 / 12 / (1 - nu * nu), q0 = soil.gs * H / 3;
// 1) Ala longa paralela ao eixo, altura constante: longe das pontas, balanço engastado na base
{
  const p = Object.assign({}, AlasGeo.DEF, { b1: 90, b2: 90, La: 1000, Hp: 95 }), r = AlasMEF.analyze(p, soil, 0.05), m = r.mesh;
  let i0 = null, bd = 1e9; m.nodes.forEach((q, i) => { const d = Math.abs(q[2] - H) + Math.abs(q[1] - 5 - r.Md.yc); if (d < bd) { bd = d; i0 = i; } });
  const w = Math.hypot(r.disp[3 * i0], r.disp[3 * i0 + 1]), wref = q0 * H ** 4 / (30 * D) + q0 * H ** 2 / (6 * 5 / 6 * E / 2 / (1 + nu) * t);
  const b = r.pts.ala.filter(q => Math.abs(q.u - 5) < 0.026 && q.z < 1e-6)[0], Mref = q0 * H * H / 6;
  console.log('1) Muro longo em balanço (empuxo ativo triangular)');
  ok(Math.abs(w / wref - 1) < 0.02, `deslocamento no topo ${w.toExponential(3)} m (ref. flexão + cisalhamento ${wref.toExponential(3)})`);
  ok(Math.abs(b.M2 / Mref - 1) < 0.06, `momento vertical na base ${b.M2.toFixed(3)} kN·m/m (ref. K_a·γ·H³/6 = ${Mref.toFixed(3)})`);
  ok(Math.abs(b.M1 / b.M2 - nu) < 0.01, `momento horizontal na base = ν · M_vertical (${(b.M1 / b.M2).toFixed(3)})`);
}
// 2) Geometria padrão: malha automática e convergência do A_s,nec horizontal
{
  const p = AlasGeo.DEF, a = AlasArm.DEF, hm = AlasMEF.meshSize(p);
  const r1 = AlasMEF.analyze(p, soil, hm), r2 = AlasMEF.analyze(p, soil, hm / 2);
  const Ap = { testa: AlasArm.asBar(a.te_phi) * 100 / a.te_s, ala: AlasArm.asBar(a.pa_phi) * 100 / a.pa_s };
  const d1 = AlasMEF.design(p, r1, a, AlasArm, Ap), d2 = AlasMEF.design(p, r2, a, AlasArm, Ap);
  console.log(`2) Geometria padrão: ${r1.stats.nElem} elementos de ${(hm * 100).toFixed(1)} cm, ${r1.stats.ms} ms`);
  ok(Math.abs(d1.req - d2.req) <= 0.15 * d2.req + 1e-3, `A_s,nec horizontal ${d1.req.toFixed(3)} cm²/m (malha à metade: ${d2.req.toFixed(3)})`);
  const m = d1.out.testa.minParts, esp = Math.max(0.2 * Ap.testa, 0.9, 0.5 * 0.150 * 15);
  ok(Math.abs(d1.AsminMax - esp) < 1e-9, `A_s,mín da N5 (secundária, Tabela 19.1) = ${d1.AsminMax.toFixed(3)} cm²/m: 20 % ${m.p20.toFixed(3)}, 0,9, 0,5 ρmín ${m.rho.toFixed(3)}`);
  ok(d1.ok, `N5 ø${a.ph_phi} c/${a.ph_s}: A_s,ef ${d1.Asef.toFixed(2)} ≥ máx(A_s,nec, A_s,mín ${d1.AsminMax.toFixed(2)}) cm²/m`);
}
console.log(falhas ? `\n${falhas} teste(s) falharam.` : '\nTodos os testes passaram.');
process.exit(falhas ? 1 : 0);
