/* =====================================================================
   Alas · Modelo da caixa enterrada sobre o motor (motor-mef.js)
   Mesma análise do app "Flutuação em Caixas" v3.10 (FEengine.analyze),
   agora usando só a API pública do motor. Serve de exemplo de como montar
   um modelo novo: geometria -> malha -> apoios -> cargas -> molas ->
   solução -> resultantes.

   Caixa pela superfície média, em ¼ (simetria em x = 0 e y = 0).
   Eixos: x ao longo de B, y ao longo de L, z vertical (z = 0 no eixo da
   laje de fundo). Unidades kN e m.
   ===================================================================== */
function ModeloCaixa(FE) {
  // Eixos locais das superfícies (linhas de T); z' aponta para fora da caixa
  const SURF = {
    top: { T: [[1, 0, 0], [0, 1, 0], [0, 0, 1]] },      // x' = x (B), y' = y (L)
    bot: { T: [[0, 1, 0], [1, 0, 0], [0, 0, -1]] },     // x' = y (L), y' = x (B)
    wx: { T: [[0, 1, 0], [0, 0, 1], [1, 0, 0]] },      // parede em x = Bc/2: x' = y (horizontal), y' = z (vertical)
    wy: { T: [[0, 0, 1], [1, 0, 0], [0, 1, 0]] }       // parede em y = Lc/2: x' = z (vertical), y' = x (horizontal)
  };

  /* ----- malha da caixa ----- */
  function buildBox(g) {
    const { Bc, Lc, Hc, ep, es, ei, ba, h } = g;
    const xw = Bc / 2, yw = Lc / 2, xf = xw - ep / 2, yf = yw - ep / 2, xo = xw + ep / 2, yo = yw + ep / 2;
    const bo = Math.min(g.bo || 0, 2 * xf), lo = Math.min(g.lo || 0, 2 * yf), opening = bo > 0 && lo > 0;
    const chim = opening && g.chimH > 0;
    const xk = [0, xf, xw], yk = [0, yf, yw];
    if (opening) { xk.push(bo / 2); yk.push(lo / 2); if (chim) { xk.push(Math.min(bo / 2 + ep, xf)); yk.push(Math.min(lo / 2 + ep, yf)); } }
    // refino junto às ligações: do eixo até uma espessura além da face, passo ≤ t/4
    const hj = t => Math.max(0.02, t / 4);
    const zx = [[xf - ep / 2, xo + ep / 2, hj(ep)]], zy = [[yf - ep / 2, yo + ep / 2, hj(ep)]];
    const zz = [[0, ei, hj(ei)], [Hc - es, Hc, hj(es)]];
    const xs = FE.axis(xk, h, zx), ys = FE.axis(yk, h, zy);
    const xsb = FE.axis(xk.concat(ba > 0 ? [xo, xo + ba] : []), h, zx), ysb = FE.axis(yk.concat(ba > 0 ? [yo, yo + ba] : []), h, zy);
    const zk = [0, ei / 2, Hc - es / 2, Hc].concat(g.zExtra || []).filter(v => v >= 0 && v <= Hc);
    const zs = FE.axis(zk, h, zz);
    const mesh = FE.createMesh(SURF);
    // laje de topo sem rigidez na etapa construtiva (paredes em balanço)
    const extra = name => ({ Ef: (g.noTop && name === 'top') ? 1e-4 : 1 });
    mesh.addSurface('top', xs, ys, (u, v) => [u, v, Hc], es, (u, v) => !(opening && u < bo / 2 && v < lo / 2), extra);
    mesh.addSurface('bot', ysb, xsb, (u, v) => [v, u, 0], ei, null, extra);
    mesh.addSurface('wx', ys, zs, (u, v) => [xw, u, v], ep, null, extra);
    mesh.addSurface('wy', zs, xs, (u, v) => [v, yw, u], ep, null, extra);
    return Object.assign(mesh, { xs, ys, xsb, ysb, zs, geo: { xw, yw, xf, yf, xo, yo, bo, lo, opening, chim, Hc, ep, es, ei, ba } });
  }

  /* ----- análise completa -----
     inp: { geo, mat:{E,nu}, kv, loads:{...}, combos:[{f:[4 ou 5], lin:bool}] }  (mesmo formato do app) */
  function analyze(inp) {
    const t0 = Date.now();
    const L = inp.loads, g = inp.geo;
    const mesh = buildBox(Object.assign({}, g, { zExtra: L.dw > L.dA && L.dw < L.dB ? [L.dB - L.dw] : [] }));
    const G = mesh.geo, nn = mesh.nodes.length;
    // simetria: em x = 0 restringe ux, θy, θz; em y = 0 restringe uy, θx, θz
    const fixed = (nd, d) => { const [x, y] = mesh.nodes[nd]; return (Math.abs(x) < 1e-9 && (d === 0 || d === 4 || d === 5)) || (Math.abs(y) < 1e-9 && (d === 1 || d === 3 || d === 5)); };
    const sys = FE.prepare(mesh, inp.mat, fixed);
    const { eq, n } = sys;
    // molas de Winkler: k = kv × área de influência dos nós da laje de fundo, só compressão
    const trib = FE.tributary(mesh, e => e.s === 'bot');
    const springNodes = []; for (let i = 0; i < nn; i++) if (trib[i] > 0) springNodes.push(i);
    const springs = springNodes.map(i => ({ node: i, dof: 2, k: inp.kv * trib[i], compOnly: true }));

    // ---- cargas (4 componentes): 0 permanentes verticais, 1 empuxo + água, 2 sobrecarga vertical, 3 sobrecarga lateral
    const dS = Math.max(0, L.dw);
    const sh = d => Math.max(0, L.K * (d <= dS ? L.gd * d : L.gd * dS + L.gp * (d - dS)) - L.cT);
    const uw = d => L.gw * Math.max(0, d - L.dw);
    const pg = d => sh(d) + uw(d);
    const depth = z => L.dB - z;
    const inAba = (x, y) => x > G.xo + 1e-9 || y > G.yo + 1e-9;
    const inRing = (x, y) => G.chim && x < G.bo / 2 + g.ep + 1e-9 && y < G.lo / 2 + g.ep + 1e-9;
    const F = [
      FE.areaLoad(mesh, eq, n, (x, y, z, e) => {
        if (e.s === 'top') return [0, 0, -(L.qtSelf + (inRing(e.c[0], e.c[1]) ? L.qChim : L.qtSoil))];
        if (e.s === 'bot') return [0, 0, -L.qbSelf + (L.sepU ? 0 : L.uBase) - (inAba(e.c[0], e.c[1]) ? L.qAba : 0)];
        return [0, 0, -L.wallW];
      }),
      FE.areaLoad(mesh, eq, n, (x, y, z, e) => e.s === 'wx' ? [-pg(depth(z)), 0, 0] : e.s === 'wy' ? [0, -pg(depth(z)), 0] : null),
      FE.areaLoad(mesh, eq, n, (x, y, z, e) => e.s === 'top' ? [0, 0, -L.q] : (e.s === 'bot' && inAba(e.c[0], e.c[1])) ? [0, 0, -L.q] : null),
      FE.areaLoad(mesh, eq, n, (x, y, z, e) => e.s === 'wx' ? [-L.Kq, 0, 0] : e.s === 'wy' ? [0, -L.Kq, 0] : null)
    ];
    // cargas de linha nas bordas: faixa da laje de topo além do eixo da parede (e_p/2) e pressão lateral
    // nas meias espessuras das lajes (do eixo até a face externa)
    const integ = (f, a, b) => { const m = 40, hh = (b - a) / m; let s = 0; for (let i = 0; i <= m; i++) s += f(a + i * hh) * ((i === 0 || i === m) ? 0.5 : 1); return s * hh; };
    const pTop = integ(pg, L.dA - g.es / 2, L.dA), pBot = integ(pg, L.dB, L.dB + g.ei / 2);
    const line = (Fv, pred, along, vec) => FE.lineLoad(mesh, eq, Fv, pred, along, vec);
    const near = (a, b) => Math.abs(a - b) < 1e-7;
    const topEdgeX = p => near(p[0], G.xw) && near(p[2], g.Hc), topEdgeY = p => near(p[1], G.yw) && near(p[2], g.Hc);
    const botEdgeX = p => near(p[0], G.xw) && near(p[2], 0) && p[1] <= G.yw + 1e-9, botEdgeY = p => near(p[1], G.yw) && near(p[2], 0) && p[0] <= G.xw + 1e-9;
    line(F[0], topEdgeX, 1, [0, 0, -(L.qtSelf + L.qtSoil) * g.ep / 2]);
    line(F[0], topEdgeY, 0, [0, 0, -(L.qtSelf + L.qtSoil) * g.ep / 2]);
    line(F[2], topEdgeX, 1, [0, 0, -L.q * g.ep / 2]);
    line(F[2], topEdgeY, 0, [0, 0, -L.q * g.ep / 2]);
    line(F[1], topEdgeX, 1, [-pTop, 0, 0]); line(F[1], topEdgeY, 0, [0, -pTop, 0]);
    line(F[1], botEdgeX, 1, [-pBot, 0, 0]); line(F[1], botEdgeY, 0, [0, -pBot, 0]);
    line(F[3], topEdgeX, 1, [-L.Kq * g.es / 2, 0, 0]); line(F[3], topEdgeY, 0, [0, -L.Kq * g.es / 2, 0]);
    line(F[3], botEdgeX, 1, [-L.Kq * g.ei / 2, 0, 0]); line(F[3], botEdgeY, 0, [0, -L.Kq * g.ei / 2, 0]);
    // subpressão como ação separada (etapa construtiva)
    if (L.sepU) F.push(FE.areaLoad(mesh, eq, n, (x, y, z, e) => e.s === 'bot' ? [0, 0, L.uBase - (inAba(e.c[0], e.c[1]) ? (L.qAbaW || 0) : 0)] : null));
    // carga vertical total aplicada (¼ da caixa), por componente
    const Fz = F.map(Fv => FE.sumLoad(eq, nn, Fv, 2));

    // ---- solução com molas só de compressão
    const sol = FE.solveSprings(sys, springs, F, inp.combos);
    if (sol.error) return { error: 'A matriz de rigidez não é positiva definida. Confira a geometria e o coeficiente de mola.' };

    // ---- resultantes nodais por superfície (recuperação SPR)
    const rec = FE.recovery(mesh), surfNodes = rec.surfNodes;
    const resultants = U => FE.nodal(rec, FE.gaussValues(mesh, eq, U, inp.mat));
    const uzOf = (U, i) => { const q = eq[6 * i + 2]; return q >= 0 ? U[q] : 0; };

    const results = inp.combos.map((cb, ci) => {
      const r = sol.results[ci];
      // pressão de contato p = kv · w (kPa) nos nós com mola ativa; R = reação total (caixa inteira)
      let R = 0; const press = new Float64Array(nn), activeNode = new Uint8Array(nn);
      springNodes.forEach((i, j) => { activeNode[i] = r.active[j]; if (r.active[j]) { const w = uzOf(r.U, i); press[i] = Math.max(0, -inp.kv * w); R += press[i] * trib[i]; } });
      const Fapp = cb.f.reduce((s, c, k) => s + c * Fz[k], 0);
      return { res: resultants(r.U), disp: FE.displacements(eq, nn, r.U), press, R: 4 * R, Fz: -4 * Fapp, lifted: r.lifted, floated: r.floated, it: r.it };
    });
    return {
      nodes: mesh.nodes, elems: mesh.elems.map(e => ({ s: e.s, n: e.n, a: e.a, b: e.b, c: e.c })), geo: G, surfNodes, results,
      stats: { nElem: mesh.elems.length, nNode: nn, nEq: n, nnz: sys.nnz, nFact: sol.nFact, ms: Date.now() - t0 }
    };
  }

  return { SURF, buildBox, analyze };
}

if (typeof module !== 'undefined' && module.exports) module.exports = { ModeloCaixa };
