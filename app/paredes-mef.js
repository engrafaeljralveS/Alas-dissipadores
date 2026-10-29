/* =====================================================================
   Alas · Paredes por elementos finitos de casca (motor-mef.js)
   Testa e as duas alas pelo plano médio, em metade da estrutura
   (simetria no eixo do tubo, x = 0). Base engastada na laje de fundo
   (z = 0, topo da laje). Furo do tubo retirado da testa. Topo da ala em
   degraus, caindo de H_t junto à testa até H_p na ponta.
   Carga: empuxo ativo p = K_a · γ · (topo − z) na face do solo: a
   montante na testa, a externa nas alas (o aterro acompanha o topo).
   Eixos locais: x' horizontal ao longo da parede, y' vertical, z' para o
   solo. M > 0 traciona a face do solo (+z'). M1 = momento que tensiona
   na direção horizontal (armadura horizontal); N1 > 0 tração horizontal.
   Unidades do motor: kN e m. Entrada e saída da geometria em cm.
   ===================================================================== */
const AlasMEF = (function () {
  const FE = MotorMEF(), G = AlasGeo;
  const E = 2.5e7, NU = 0.2;          // kN/m² (linear: os esforços não dependem de E)

  // Wood-Armer na direção 1, nas duas faces: [face do solo, face oposta] (≥ 0)
  function wa1(M1, M2, M12) {
    const a = Math.abs(M12);
    let e1 = M1 + a, e2 = M2 + a, i1 = M1 - a, i2 = M2 - a;
    if (e1 < 0 && e2 < 0) e1 = 0; else if (e1 < 0) e1 = 0; else if (e2 < 0) e1 = M1 + (Math.abs(M2) > 1e-12 ? M12 * M12 / Math.abs(M2) : 0);
    if (i1 > 0 && i2 > 0) i1 = 0; else if (i1 > 0) i1 = 0; else if (i2 > 0) i1 = M1 - (Math.abs(M2) > 1e-12 ? M12 * M12 / Math.abs(M2) : 0);
    return [Math.max(0, e1), Math.max(0, -i1)];
  }

  function model(p, hm) {
    const m = v => v / 100, d = G.derive(p);
    const et = m(p.et), ea = m(p.ea), Ht = m(p.Ht), Hp = m(p.Hp), La = m(p.La), r = m(p.D) / 2;
    const hb1 = m(p.b1) / 2, hb2 = m(p.b2) / 2, yE = et + La;
    // ala: direção da face interna, normal para fora (lado do solo) e plano médio
    const L0 = Math.hypot(hb2 - hb1, La), dir = [(hb2 - hb1) / L0, La / L0], nrm = [dir[1], -dir[0]];
    const ax = hb1 + nrm[0] * ea / 2, ay = et + nrm[1] * ea / 2;     // ponto do plano médio da ala na cota da face de jusante da testa
    const tC = (et / 2 - ay) / dir[1], xc = ax + tC * dir[0], yc = et / 2;   // encontro dos planos médios
    const Lw = (yE - yc) / dir[1];                                     // comprimento do plano médio da ala até a ponta
    const topW = u => { const y = yc + u * dir[1], t = Math.min(1, Math.max(0, (y - et) / La)); return Ht + (Hp - Ht) * t; };
    const SURF = {
      testa: { T: [[1, 0, 0], [0, 0, 1], [0, -1, 0]] },
      ala: { T: [[dir[0], dir[1], 0], [0, 0, 1], [dir[1], -dir[0], 0]] }
    };
    const mesh = FE.createMesh(SURF);
    const zs = FE.axis([0, r * 2 < Ht ? 2 * r : Ht, Ht, Hp], hm);
    const xs = FE.axis([0, Math.min(r, xc), Math.max(0, xc - ea / 2), xc], hm);
    const us = FE.axis([0, Math.min(et / 2, Lw), Lw], hm);
    mesh.addSurface('testa', xs, zs, (u, v) => [u, yc, v], et, (u, v) => !(u * u + (v - r) * (v - r) < r * r));
    mesh.addSurface('ala', us, zs, (u, v) => [xc + u * dir[0], yc + u * dir[1], v], ea, (u, v) => v < topW(u));
    return { mesh, xc, yc, Lw, dir, topW, et, ea, Ht, Hp, r };
  }

  /* análise: p (cm), soil {gs, phi}; hm = tamanho dos elementos (m) */
  function analyze(p, soil, hm = 0.05) {
    const t0 = Date.now(), Md = model(p, hm), { mesh } = Md;
    const Ka = Math.tan((45 - soil.phi / 2) * Math.PI / 180) ** 2;
    const fixed = (n, dof) => { const q = mesh.nodes[n]; return q[2] < 1e-9 || (Math.abs(q[0]) < 1e-9 && (dof === 0 || dof === 4 || dof === 5)); };
    const sys = FE.prepare(mesh, { E, nu: NU }, fixed);
    // pressão na face do solo empurra a parede para -z'
    const F = FE.areaLoad(mesh, sys.eq, sys.n, (x, y, z, e) => {
      const T = mesh.surf[e.s].T, top = e.s === 'testa' ? Md.Ht : Md.topW(((x - Md.xc) * Md.dir[0] + (y - Md.yc) * Md.dir[1])), pr = Ka * soil.gs * Math.max(0, top - z);
      return [-T[2][0] * pr, -T[2][1] * pr, -T[2][2] * pr];
    });
    const sol = FE.solveSprings(sys, [], [F], [{ f: [1] }]);
    if (sol.error) return { error: sol.error };
    const U = sol.results[0].U, rec = FE.recovery(mesh), res = FE.nodal(rec, FE.gaussValues(mesh, sys.eq, U, { E, nu: NU }));
    // reação vertical de conferência: soma das cargas horizontais = soma das reações (equilíbrio)
    const Fy = FE.sumLoad(sys.eq, mesh.nodes.length, F, 1), Fx = FE.sumLoad(sys.eq, mesh.nodes.length, F, 0);
    const pts = { testa: [], ala: [] };
    ['testa', 'ala'].forEach(s => rec.surfNodes[s].forEach((i, j) => {
      const q = mesh.nodes[i], o = 8 * j, M1 = res[s][o], M2 = res[s][o + 1], M12 = res[s][o + 2], N1 = res[s][o + 5];
      const u = s === 'testa' ? q[0] : (q[0] - Md.xc) * Md.dir[0] + (q[1] - Md.yc) * Md.dir[1];
      pts[s].push({ u, z: q[2], M1, M2, M12, N1, Q1: res[s][o + 3], wa: wa1(M1, M2, M12) });
    }));
    const disp = FE.displacements(sys.eq, mesh.nodes.length, U);
    return { Ka, Md, mesh, pts, disp, gauss: FE.gaussValues(mesh, sys.eq, U, { E, nu: NU }), stats: { nElem: mesh.elems.length, nEq: sys.n, ms: Date.now() - t0 }, Fx, Fy };
  }

  /* ----- dimensionamento da armadura horizontal (N5) -----
     Flexo-tração por face, b = 100 cm, h = espessura da parede, d = h − c − ø/2 (N5 por fora).
     Região de dimensionamento: fora do nó do encontro (testa até a face da ala, ala a partir
     da face da testa). Majoração γf = 1,4. */
  /* Armadura mínima da N5: armadura secundária (de distribuição), NBR 6118, Tabela 19.1:
     A_s/s ≥ 20 % da armadura principal, ≥ 0,9 cm²/m e ρ_s ≥ 0,5 ρ_mín. A principal é a vertical
     adotada em cada parede (asPrinc = { testa, ala } em cm²/m). Espaçamento máximo 33 cm (item 20.1). */
  function design(p, FEres, a, AR, asPrinc) {
    const fcd = a.fck / 10 / 1.4, fyd = 50 / 1.15;
    const flex = (Mkn, d) => { const M = Mkn * 100; if (!(M > 0)) return 0; const rr = 1 - M / (0.425 * 100 * d * d * fcd); if (rr < 0) return NaN; const x = 1.25 * d * (1 - Math.sqrt(rr)); return M / (fyd * (d - 0.4 * x)); };
    const flexN = (Mk, Nk, h, d) => {
      const Md = 1.4 * Mk, Nd = 1.4 * Nk, dl = h - d;
      if (!(Nd > 0)) return flex(Md, d);
      const e0 = Md * 100 / Nd, lim = h / 2 - dl;
      if (e0 <= lim) return Nd * (h / 2 + e0 - dl) / ((d - dl) * fyd);
      return flex(Md - Nd * lim / 100, d) + Nd / fyd;
    };
    const Md = FEres.Md, phi = a.ph_phi, c = a.cob;
    const zone = { testa: q => q.u <= Md.xc - Md.ea / 2 + 1e-9, ala: q => q.u >= Md.et / 2 - 1e-9 };
    const hOf = { testa: p.et, ala: p.ea };
    const out = { testa: null, ala: null }, all = [];
    ['testa', 'ala'].forEach(s => {
      const h = hOf[s], d = h - c - phi / 20;
      let best = [{ As: 0 }, { As: 0 }];
      FEres.pts[s].forEach(q => {
        if (!zone[s](q)) return;
        [0, 1].forEach(f => {
          const Mk = q.wa[f], Nk = q.N1, As = flexN(Mk, Nk, h, d);
          const rec = { s, f, u: q.u, z: q.z, Mk, Nk, As, h, d };
          all.push(rec);
          if (!(best[f].As >= As)) best[f] = rec;
        });
      });
      const Ap = asPrinc && asPrinc[s] != null ? asPrinc[s] : AR.rhoMin(a.fck) * h;      // sem a principal: ρ_mín · b · h
      const m = { p20: 0.2 * Ap, abs: 0.9, rho: 0.5 * AR.rhoMin(a.fck) / 100 * 100 * h };
      out[s] = { h, d, face: best, Ap, minParts: m, Asmin: Math.max(m.p20, m.abs, m.rho) };
    });
    const Asef = AR.asBar(phi) * 100 / a.ph_s;
    // por camada da N5: maior As,nec em cada face na faixa z ± s/2
    const layers = AR.hLayers(p, a).map(L => {
      const z0 = (L.z - a.ph_s / 2) / 100, z1 = (L.z + a.ph_s / 2) / 100;
      const band = all.filter(q => q.z >= z0 - 1e-9 && q.z <= z1 + 1e-9);
      const mx = f => band.filter(q => q.f === f).reduce((b, q) => (q.As > b.As ? q : b), { As: 0 });
      return { z: L.z, soil: mx(0), inner: mx(1) };
    });
    const req = Math.max(out.testa.face[0].As, out.testa.face[1].As, out.ala.face[0].As, out.ala.face[1].As);
    const AsminMax = Math.max(out.testa.Asmin, out.ala.Asmin);
    const ok = isFinite(req) && Asef >= req - 1e-9 && Asef >= AsminMax - 1e-9;
    // cortante horizontal (Q1) na região de dimensionamento: V_Sd = 1,4 · |Q1| ≤ V_Rd1 com a N5
    let V = { Vk: 0 };
    ['testa', 'ala'].forEach(s => FEres.pts[s].forEach(q => { if (zone[s](q) && Math.abs(q.Q1) > V.Vk) V = { Vk: Math.abs(q.Q1), s, u: q.u, z: q.z, h: hOf[s], d: hOf[s] - c - phi / 20 }; }));
    if (V.s) { V.Vd = 1.4 * V.Vk; V.VR = AR.vrd1(Asef, V.d, a.fck); V.rho = Math.min(2, Asef / V.d); V.ok = V.Vd <= V.VR; } else { V.Vd = 0; V.VR = Infinity; V.ok = true; }
    // momento horizontal característico máximo (Wood-Armer, as duas faces) na região de dimensionamento
    const Mx = ['testa', 'ala'].flatMap(s => FEres.pts[s].filter(zone[s]).map(q => ({ s, u: q.u, z: q.z, M: Math.max(q.wa[0], q.wa[1]) }))).reduce((b, q) => (q.M > b.M ? q : b), { M: 0 });
    return { out, layers, Asef, req, AsminMax, V, Mx, ok: ok && V.ok, okFlex: isFinite(req) && Asef >= req - 1e-9, okMin: Asef >= AsminMax - 1e-9 };
  }

  /* ----- mapa de M1 na elevação desenvolvida (testa | ala) ----- */
  function mapSvg(p, FEres, W = 760, H = 320) {
    const Md = FEres.Md, mesh = FEres.mesh, fx = AlasEsf.fx;
    const Lx = Md.xc + Md.Lw, padL = 40, padR = 20, padT = 30, padB = 64;
    const k = Math.min((W - padL - padR) / Lx, (H - padT - padB) / Md.Ht);
    const ox = padL + (W - padL - padR - Lx * k) / 2, oy = padT + Md.Ht * k;
    const X = u => ox + u * k, Z = z => oy - z * k;
    const uOf = (s, q) => s === 'testa' ? q[0] : Md.xc + (q[0] - Md.xc) * Md.dir[0] + (q[1] - Md.yc) * Md.dir[1];
    const key = (s, q) => s + ':' + (s === 'testa' ? q[0] : (q[0] - Md.xc) * Md.dir[0] + (q[1] - Md.yc) * Md.dir[1]).toFixed(5) + ',' + q[2].toFixed(5);
    const val = new Map(); let vmin = 0, vmax = 0;
    ['testa', 'ala'].forEach(s => FEres.pts[s].forEach(q => { val.set(s + ':' + q.u.toFixed(5) + ',' + q.z.toFixed(5), q.M1); vmin = Math.min(vmin, q.M1); vmax = Math.max(vmax, q.M1); }));
    const vabs = Math.max(1e-9, vmax, -vmin);
    const mix = (c, t) => `rgb(${[0, 1, 2].map(i => Math.round(246 + (c[i] - 246) * t)).join(',')})`;
    const color = v => { const t = Math.max(-1, Math.min(1, v / vabs)); return t >= 0 ? mix([194, 83, 27], t) : mix([37, 99, 176], -t); };
    let s = G.STYLE + `<style>.mt{font-size:11.5px;fill:var(--cota,#334155);paint-order:stroke;stroke:var(--fundo,#fff);stroke-width:4px}</style>`;
    mesh.elems.forEach(e => {
      const pts = e.n.map(i => mesh.nodes[i]);
      const v = pts.reduce((a2, q) => a2 + (val.get(key(e.s, q)) || 0), 0) / 4;
      s += `<polygon points="${pts.map(q => `${X(uOf(e.s, q)).toFixed(1)},${Z(q[2]).toFixed(1)}`).join(' ')}" fill="${color(v)}" stroke="${color(v)}" stroke-width=".4"/>`;
    });
    s += `<line class="ln" x1="${X(Md.xc)}" y1="${Z(0)}" x2="${X(Md.xc)}" y2="${Z(Md.Ht)}" stroke-dasharray="5 3"/>`;
    s += `<line class="ln" x1="${X(0) - 4}" y1="${Z(0)}" x2="${X(Lx) + 4}" y2="${Z(0)}" stroke-width="1.6"/>`;
    for (let x = X(0); x < X(Lx); x += 9) s += `<line class="th" x1="${x}" y1="${Z(0)}" x2="${x - 6}" y2="${Z(0) + 7}"/>`;
    s += `<text class="mt" x="${X(Md.xc / 2)}" y="${Z(0) + 22}" text-anchor="middle">testa (metade)</text><text class="mt" x="${X(Md.xc + Md.Lw / 2)}" y="${Z(0) + 22}" text-anchor="middle">ala, desenvolvida</text>`;
    s += `<text class="mt" x="${X(0)}" y="${Z(Md.Ht) - 8}">eixo do tubo</text><text class="mt" x="${X(Md.xc)}" y="${Z(Md.Ht) - 8}" text-anchor="middle">encontro</text><text class="mt" x="${X(Lx)}" y="${Z(0) + 22}" text-anchor="end">ponta</text>`;
    const ly = H - 12;
    s += `<rect x="${ox}" y="${ly - 9}" width="10" height="10" fill="${color(vabs)}"/><text class="mt" x="${ox + 14}" y="${ly}">traciona a face do solo, máx. ${fx(vmax, 3)} kN·m/m</text>`;
    s += `<rect x="${ox + 300}" y="${ly - 9}" width="10" height="10" fill="${color(-vabs)}"/><text class="mt" x="${ox + 314}" y="${ly}">traciona a face oposta, máx. ${fx(-vmin, 3)} kN·m/m</text>`;
    return G.svgWrap(W, H, s);
  }

  // tamanho da malha: cerca de 1800 elementos, entre 2,5 e 10 cm
  function meshSize(p) {
    const Md = model(p, 0.1), area = (Md.xc + Md.Lw) * Md.Ht;
    return Math.min(0.1, Math.max(0.025, Math.sqrt(area / 1800)));
  }

  return { analyze, design, mapSvg, model, meshSize };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = { AlasMEF };
