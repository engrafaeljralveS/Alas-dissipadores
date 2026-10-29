/* =====================================================================
   Alas · Armaduras (NBR 6118)
   Armadura padrão por elemento, a mesma nas duas faces:
     - laje de fundo (vale também para o dente), nas duas direções
     - testa, vertical
     - paredes (alas), vertical
     - paredes, armadura horizontal: corre pelas duas alas e pela testa,
       nas duas faces (N5); sem verificação de esforço nesta versão
   Verificações por faixa de 1 m: flexão simples (CA-50, γc = 1,4,
   γs = 1,15, γf = 1,4), armadura mínima por face, espaçamento máximo,
   bitola máxima e cortante sem estribos (V_Rd1).
   Esforços característicos da aba Esforços. A laje de fundo recebe no
   engaste o maior momento das paredes que nascem nela.
   Unidades: cm, kN, MPa (indicado em cada conta).
   ===================================================================== */
const AlasArm = (function () {
  const G = AlasGeo, fx = AlasEsf.fx, f = G.f0;
  const BITOLAS = [5, 6.3, 8, 10, 12.5, 16, 20];
  const CAA = {
    I: { nome: 'I · fraca (rural, submersa)', fck: 20, cob: 3.0 },
    II: { nome: 'II · moderada (urbana)', fck: 25, cob: 3.0 },
    III: { nome: 'III · forte (marinha, industrial)', fck: 30, cob: 4.0 },
    IV: { nome: 'IV · muito forte (respingos de maré, industrial)', fck: 40, cob: 5.0 }
  };
  const ELEM = [
    ['lf', 'Laje de fundo', 'vale também para o dente'],
    ['te', 'Testa', 'vertical'],
    ['pa', 'Paredes (alas)', 'vertical']
  ];
  const DEF = { fck: 25, caa: 'II', cob: 3.0, lf_phi: 8, lf_s: 20, te_phi: 8, te_s: 20, pa_phi: 8, pa_s: 20, ph_phi: 8, ph_s: 20 };
  // NBR 6118, Tabela 17.3 (seção retangular, CA-50)
  const rhoMin = fck => fck <= 30 ? 0.150 : fck <= 35 ? 0.164 : fck <= 40 ? 0.179 : fck <= 45 ? 0.194 : 0.208;
  const asBar = phi => Math.PI * (phi / 10) ** 2 / 4;           // cm²

  // Flexão simples, b = 100 cm: Md (kN·cm/m), d (cm), fck (MPa) -> As (cm²/m), x/d
  function flex(MdkNm, d, fck) {
    const fcd = fck / 10 / 1.4, fyd = 50 / 1.15, b = 100, Md = MdkNm * 100;
    if (Md <= 0) return { As: 0, xd: 0, ok: true };
    const r = 1 - Md / (0.425 * b * d * d * fcd);
    if (r < 0) return { As: NaN, xd: Infinity, ok: false };
    const x = 1.25 * d * (1 - Math.sqrt(r));
    return { As: Md / (fyd * (d - 0.4 * x)), xd: x / d, ok: x / d <= 0.45 };
  }
  // Cortante sem estribos, NBR 6118 19.4.1: V_Rd1 (kN/m)
  function vrd1(As, d, fck) {
    const fctd = 0.7 * 0.3 * fck ** (2 / 3) / 1.4, tau = 0.25 * fctd;            // MPa
    const k = Math.max(1, 1.6 - d / 100), rho = Math.min(0.02, As / (100 * d));
    return tau * k * (1.2 + 40 * rho) * (d / 100) * 1000;                       // MN/m -> kN/m
  }

  function check(p, R, a) {
    const P = { fck: a.fck, caa: CAA[a.caa], cob: a.cob };
    const warn = [];
    if (a.fck < P.caa.fck) warn.push(`Para a classe ${a.caa}, a NBR 6118 pede f<sub>ck</sub> ≥ ${P.caa.fck} MPa (Tabela 7.1).`);
    if (a.cob < P.caa.cob) warn.push(`Para elementos em contato com o solo na classe ${a.caa}, o cobrimento nominal mínimo é ${f(P.caa.cob)} cm (Tabela 7.2).`);
    const Mw = Math.max(R.testa.M, R.ala0.M), Vw = 0;
    const src = {
      lf: { h: p.el, Mk: Mw, Vk: null, orig: 'engaste das paredes na laje' },
      te: { h: p.et, Mk: R.testa.M, Vk: R.testa.V, orig: 'base da testa' },
      pa: { h: p.ea, Mk: R.ala0.M, Vk: R.ala0.V, orig: 'base da ala, junto à testa' }
    };
    const rows = ELEM.map(([k, nome, obs]) => {
      const phi = a[k + '_phi'], s = a[k + '_s'], e = src[k], h = e.h;
      const d = h - a.cob - phi / 20;                                   // camada externa
      const Asef = asBar(phi) * 100 / s, Md = 1.4 * e.Mk, fl = flex(Md, d, a.fck);
      const Asmin = rhoMin(a.fck) / 100 * 100 * h;
      const sMax = Math.min(2 * h, 20), phiMax = h * 10 / 8;
      const Vd = e.Vk == null ? null : 1.4 * e.Vk, VR = vrd1(Asef, d, a.fck);
      const it = {
        flex: fl.ok && Asef >= fl.As - 1e-9,
        min: Asef >= Asmin - 1e-9,
        esp: s <= sMax + 1e-9,
        bit: phi <= phiMax + 1e-9,
        cort: Vd == null ? true : Vd <= VR,
        d: d > 0
      };
      const ok = Object.values(it).every(Boolean);
      return { k, nome, obs, phi, s, h, d, Mk: e.Mk, Md, As: fl.As, xd: fl.xd, xdOk: fl.ok, Asmin, Asef, sMax, phiMax, Vk: e.Vk, Vd, VR, it, ok, orig: e.orig, asReq: Math.max(fl.As || 0, Asmin) };
    });
    const hz = { phi: a.ph_phi, s: a.ph_s, Asef: asBar(a.ph_phi) * 100 / a.ph_s };
    return { rows, hz, warn, rhoMin: rhoMin(a.fck), ok: rows.every(r => r.ok) };
  }

  /* ----- armadura horizontal N5 -----
     Camadas a z = s/2, s/2 + s, ... acima do topo da laje, até H_t − c. Em cada camada,
     duas barras (face externa e face interna) correm ala, testa e ala a c das faces e
     fecham nas pontas com dobra de e_a − 2c. As camadas de cima param onde o topo
     inclinado da ala chega. Nas camadas que cruzam o tubo (z < D + c), a barra da testa
     é interrompida no furo e fecha com dobra. Planta: x transversal, y ao longo do eixo. */
  function hLayers(p, a) {
    const d = G.derive(p), c = a.cob, sH = a.ph_s, hb1 = p.b1 / 2, hb2 = p.b2 / 2, ex = d.ex, et = p.et, yE = p.et + p.La, Lt2 = d.Lt / 2;
    const lineOff = (A, B, dd) => { const dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L; return [[A[0] + nx * dd, A[1] + ny * dd], [B[0] + nx * dd, B[1] + ny * dd]]; };
    const inter = (l1, l2) => { const [p1, p2] = l1, [p3, p4] = l2, d1 = [p2[0] - p1[0], p2[1] - p1[1]], d2 = [p4[0] - p3[0], p4[1] - p3[1]], den = d1[0] * d2[1] - d1[1] * d2[0]; if (Math.abs(den) < 1e-12) return p2; const t = ((p3[0] - p1[0]) * d2[1] - (p3[1] - p1[1]) * d2[0]) / den; return [p1[0] + d1[0] * t, p1[1] + d1[1] * t]; };
    const offsetPath = (pts, dd, yEnd) => {
      const L = []; for (let i = 0; i < pts.length - 1; i++) L.push(lineOff(pts[i], pts[i + 1], dd));
      const cut = [[-1e4, yEnd], [1e4, yEnd]], out = [inter(L[0], cut)];
      for (let i = 0; i < L.length - 1; i++) out.push(inter(L[i], L[i + 1]));
      out.push(inter(L[L.length - 1], cut)); return out;
    };
    const len = P => P.slice(1).reduce((t, q, i) => t + Math.hypot(q[0] - P[i][0], q[1] - P[i][1]), 0);
    const outerC = [[hb2 + ex, yE], [Lt2, et], [Lt2, 0], [-Lt2, 0], [-Lt2, et], [-hb2 - ex, yE]];
    const innerC = [[hb2, yE], [hb1, et], [-hb1, et], [-hb2, yE]];
    const sgO = lineOff(outerC[0], outerC[1], 1)[0][0] < outerC[0][0] ? 1 : -1, sgI = lineOff(innerC[0], innerC[1], 1)[0][0] > innerC[0][0] ? 1 : -1;
    const out = [];
    for (let z = sH / 2; z <= p.Ht - c + 1e-9; z += sH) {
      const t = z <= p.Hp - c ? 1 : Math.min(1, Math.max(0, (p.Ht - c - z) / (p.Ht - p.Hp)));
      const yEnd = Math.min(yE - c, et + t * p.La);
      const O = offsetPath(outerC, sgO * c, yEnd), I = offsetPath(innerC, sgI * c, yEnd);
      out.push({ z, t, O, I, LO: len(O), LI: len(I), furo: z < p.D + c, dob: p.ea - 2 * c });
    }
    return out;
  }

  /* ----- posições das barras (N1 a N4) -----
     Cada posição é uma barra em colchete: dobra + reto + dobra. A dobra é a espessura do
     elemento menos os dois cobrimentos. A segunda barra é a mesma, espelhada na face oposta;
     as duas juntas fecham o estribo.
       N1 testa: vertical, do topo até o fundo do engrossamento
       N2 laje de fundo: horizontal, de ponta a ponta
       N3 dente: vertical, do topo da laje ao pé do dente
       N4 paredes: vertical, da base da laje ao topo da ala (reto variável)
     Medidas pelas faces externas das barras, sem ganchos nem traspasse. */
  function bars(p, a) {
    const d = G.derive(p), c = a.cob;
    const mk = (n, el, k, dob, reto, form, reto1) => ({ n, el, k, dob, reto, reto1, L: 2 * dob + reto, Lmin: reto1 == null ? null : 2 * dob + reto1, form });
    return [
      mk('N1', 'Testa', 'te', p.et - 2 * c, p.Ht + p.eg - 2 * c, 'vertical, nas duas faces da testa; fecha no topo e no fundo do engrossamento'),
      mk('N2', 'Laje de fundo', 'lf', p.el - 2 * c, d.Ltot - 2 * c, 'horizontal, faces superior e inferior; fecha nas duas extremidades da laje'),
      mk('N3', 'Dente', 'lf', p.bd - 2 * c, p.hd + p.el - 2 * c, 'vertical, nas duas faces do dente; fecha no pé do dente e no topo da laje'),
      mk('N4', 'Paredes (alas)', 'pa', p.ea - 2 * c, p.Ht + p.el - 2 * c, 'vertical, nas duas faces da ala; o reto varia ao longo da ala', p.Hp + p.el - 2 * c)
    ];
  }

  /* ----- corte A com os estribos e o detalhe de cada posição ----- */
  function cutBars(p, A, a, W = 1160, H = 640) {
    const d = G.derive(p), c = a.cob, L = d.Ltot, et = p.et, el = p.el, eg = p.eg, bg = p.bg, ch = Math.max(0, eg - el), bd = p.bd, hd = p.hd;
    const rw = key => A.rows.find(x => x.k === key), lab = key => `ø${f(rw(key).phi)} c/${f(rw(key).s)}`;
    const POS = bars(p, a);
    const padL = 330, padR = 330, padT = 40, padB = 210, zTop = p.Ht, zBot = -(el + hd);
    const k = Math.min((W - padL - padR) / L, (H - padT - padB) / (zTop - zBot));
    const ox = padL + (W - padL - padR - L * k) / 2, oy = padT + zTop * k + 10;
    const X = x => ox + x * k, Z = z => oy - z * k;
    const P = pts => pts.map(([x, z]) => `${X(x).toFixed(1)},${Z(z).toFixed(1)}`).join(' ');
    let s = G.STYLE + `<style>
      .A{fill:none;stroke:var(--aco,#b42318);stroke-width:2.2;stroke-linejoin:round}
      .B{fill:none;stroke:var(--aco-b,#e0662f);stroke-width:2.2;stroke-linejoin:round;stroke-dasharray:7 3}
      .A2{fill:none;stroke:var(--aco2,#2563b0);stroke-width:2.2;stroke-linejoin:round}
      .B2{fill:none;stroke:var(--aco2-b,#5b8fd6);stroke-width:2.2;stroke-linejoin:round;stroke-dasharray:7 3}
      .tg{font:700 12px var(--mono,monospace);paint-order:stroke;stroke:var(--fundo,#fff);stroke-width:4px}
      .ml{font:12px var(--mono,monospace);fill:var(--cota,#334155);paint-order:stroke;stroke:var(--fundo,#fff);stroke-width:4px}
      .ti{font-size:12.5px;font-weight:600;fill:var(--ink,#1d2430)}
      .su{font-size:11.5px;fill:var(--muted,#5b6676)}
    </style>`;
    s += `<polygon class="cv" points="${P([[et, 0], [et, p.Ht], [L, p.Hp], [L, 0]])}"/>`;
    s += `<polygon class="c" points="${P([[0, p.Ht], [et, p.Ht], [et, 0], [L, 0], [L, -el - hd], [L - bd, -el - hd], [L - bd, -el], [bg + ch, -el], [bg, -eg], [0, -eg]])}"/>`;
    const o = 1.4;   // afastamento só de desenho entre a barra e a espelhada
    const vBr = (x, x2, z1, z2, cls) => `<polyline class="${cls}" points="${P([[x2, z2], [x, z2], [x, z1], [x2, z1]])}"/>`;
    const hBr = (z, z2, x1, x2, cls) => `<polyline class="${cls}" points="${P([[x1, z2], [x1, z], [x2, z], [x2, z2]])}"/>`;
    s += vBr(c, et - c, -eg + c, p.Ht - c, 'A') + vBr(et - c, c + o, -eg + c + o, p.Ht - c - o, 'B');
    s += hBr(-c, -el + c, c, L - c, 'A') + hBr(-el + c, -c - o, c + o, L - c - o, 'B');
    s += vBr(L - bd + c, L - c, -el - hd + c, -c, 'A') + vBr(L - c, L - bd + c + o, -el - hd + c + o, -c - o, 'B');
    const s4 = et + 24, b4 = Math.max(p.ea - 2 * c, 3), zt4 = p.Ht + (p.Hp - p.Ht) * ((s4 + b4 - et) / (L - et)) - c;
    s += vBr(s4, s4 + b4, -el + c, zt4, 'A2') + vBr(s4 + b4, s4 + o, -el + c + o, zt4 - o, 'B2');
    // N5: camadas horizontais na vista da ala e pontos nas faces da testa
    hLayers(p, a).forEach(R => {
      const sEnd = R.t >= 1 ? L - c : et + (p.Ht - c - R.z) / (p.Ht - p.Hp) * (L - et);
      s += `<line x1="${X(et + 1)}" y1="${Z(R.z)}" x2="${X(sEnd)}" y2="${Z(R.z)}" stroke="var(--hz,#7a3fb0)" stroke-width="1.8"/>`;
      if (R.z > p.D) [c + 1, et - c - 1].forEach(x => { s += `<circle cx="${X(x)}" cy="${Z(R.z)}" r="2.4" fill="var(--hz,#7a3fb0)"/>`; });
    });
    const tg = (x, y, t, col) => `<text class="tg" x="${x}" y="${y}" text-anchor="middle" fill="var(--${col})">${t}</text>`;
    s += tg(X(L) - 22, Z(p.Hp) - 10, 'N5', 'hz') + tg(X(et / 2), Z(p.Ht) - 8, 'N1', 'aco') + tg(X(L * 0.5), Z(-c) - 8, 'N2', 'aco') + tg(X(L - bd / 2), Z(-el - hd) + 18, 'N3', 'aco') + tg(X(s4 + b4 / 2), Z(zt4) - 8, 'N4', 'aco2');
    s += `<text class="su" x="${X(et + 4)}" y="${Z(p.Ht) - 26}">vista da ala</text>`;
    // ---- detalhe: as duas barras de cada posição, lado a lado
    const kd = Math.min(1.25, 230 / Math.max(POS[0].reto, POS[3].reto), 420 / POS[1].reto);
    const piece = (x0, y0, reto, dob, vertical, mirror, cls) => {
      const sg = mirror ? -1 : 1;
      const pts = vertical ? [[x0 + sg * dob * kd, y0], [x0, y0], [x0, y0 + reto * kd], [x0 + sg * dob * kd, y0 + reto * kd]]
                           : [[x0, y0 + sg * dob * kd], [x0, y0], [x0 + reto * kd, y0], [x0 + reto * kd, y0 + sg * dob * kd]];
      return `<polyline class="${cls}" points="${pts.map(q => q.map(v => v.toFixed(1)).join(',')).join(' ')}"/>`;
    };
    const ml = (x, y, t, an = 'middle') => `<text class="ml" x="${x}" y="${y}" text-anchor="${an}">${t}</text>`;
    const R0 = v => f(Math.round(v));
    const title = (x, y, q, col) => `<text class="ti" x="${x}" y="${y}"><tspan fill="var(--${col})" font-family="var(--mono,monospace)">${q.n}</tspan> ${q.el} ${lab(q.k)} · 2 barras</text>`;
    const vpair = (q, x0, y0, A1, B1, col, txt) => {
      const h = q.reto * kd, w = q.dob * kd;
      let g = piece(x0, y0, q.reto, q.dob, true, false, A1) + piece(x0 + 120, y0, q.reto, q.dob, true, true, B1);
      g += ml(x0 + w / 2, y0 - 7, R0(q.dob)) + ml(x0 + w / 2, y0 + h + 17, R0(q.dob)) + ml(x0 + 120 - w / 2, y0 - 7, R0(q.dob)) + ml(x0 + 120 - w / 2, y0 + h + 17, R0(q.dob));
      g += ml(x0 + 60, y0 + h / 2 + 4, txt);
      return g + title(x0 - 30, y0 - 28, q, col);
    };
    s += vpair(POS[0], 120, Z(p.Ht - c) - 10, 'A', 'B', 'aco', R0(POS[0].reto));
    s += vpair(POS[3], W - 250, Z(p.Ht - c) - 10, 'A2', 'B2', 'aco2', R0(POS[3].reto) + ' a ' + R0(POS[3].reto1));
    s += vpair(POS[2], W - 250, Math.max(Z(-c) + 30, Z(p.Ht - c) + POS[3].reto * kd + 80), 'A', 'B', 'aco', R0(POS[2].reto));
    { const q = POS[1], w = q.reto * kd, h = q.dob * kd, x0 = X(L / 2) - w / 2, y0 = Z(zBot) + 70;
      s += piece(x0, y0, q.reto, q.dob, false, false, 'A') + piece(x0, y0 + 70, q.reto, q.dob, false, true, 'B');
      s += ml(x0 + w / 2, y0 - 7, R0(q.reto)) + ml(x0 - 8, y0 + h / 2 + 4, R0(q.dob), 'end') + ml(x0 + w + 8, y0 + h / 2 + 4, R0(q.dob), 'start');
      s += ml(x0 + w / 2, y0 + 70 + 17, R0(q.reto)) + ml(x0 - 8, y0 + 70 - h / 2 + 4, R0(q.dob), 'end') + ml(x0 + w + 8, y0 + 70 - h / 2 + 4, R0(q.dob), 'start');
      s += title(Math.max(10, x0 - 250), y0 + 40, q, 'aco'); }
    return G.svgWrap(W, H, s);
  }

  /* ----- planta com a camada 1 da armadura horizontal (vai até a ponta) ----- */
  function planHz(p, a, W = 560, H = 400) {
    const c = a.cob, r = p.D / 2, et = p.et, Ls = hLayers(p, a);
    if (!Ls.length) return G.plan(p, W, H);
    const R = Ls[0];
    return G.plan(p, W, H, (X, Y) => {
      const P = pts => pts.map(([x, y]) => `${X(x).toFixed(1)},${Y(y).toFixed(1)}`).join(' ');
      const split = (pts, yF) => { const A1 = [], B1 = []; let side = A1; pts.forEach((q, i) => { if (i && Math.abs(q[1] - yF) < 1e-6 && Math.abs(pts[i - 1][1] - yF) < 1e-6 && pts[i - 1][0] * q[0] < 0) { const xs = Math.sign(pts[i - 1][0]) * (r + c); side.push([xs, yF]); side = B1; side.push([-xs, yF]); } side.push(q); }); return [A1, B1]; };
      const yO = c, yI = et - c, [O1, O2] = R.furo ? split(R.O, yO) : [R.O, []], [I1, I2] = R.furo ? split(R.I, yI) : [R.I, []];
      let g = [O1, O2].filter(x => x.length > 1).map(x => `<polyline points="${P(x)}" fill="none" stroke="var(--hz,#7a3fb0)" stroke-width="2.4" stroke-linejoin="round"/>`).join('');
      g += [I1, I2].filter(x => x.length > 1).map(x => `<polyline points="${P(x)}" fill="none" stroke="var(--hz-b,#b07fdc)" stroke-width="2.4" stroke-dasharray="7 3" stroke-linejoin="round"/>`).join('');
      g += `<polyline points="${P([R.O[0], R.I[0]])}" fill="none" stroke="var(--hz,#7a3fb0)" stroke-width="2.4"/><polyline points="${P([R.O[R.O.length - 1], R.I[R.I.length - 1]])}" fill="none" stroke="var(--hz,#7a3fb0)" stroke-width="2.4"/>`;
      if (R.furo) [-1, 1].forEach(sg => { g += `<polyline points="${P([[sg * (r + c), yO], [sg * (r + c), yI]])}" fill="none" stroke="var(--hz,#7a3fb0)" stroke-width="2.4"/>`; });
      const lb = 'font-weight="700" font-size="12" font-family="IBM Plex Mono, Consolas, monospace"';
      g += `<text x="${X(R.O[2][0]) + 8}" y="${Y(0) - 6}" ${lb} fill="var(--hz,#7a3fb0)" paint-order="stroke" stroke="var(--fundo,#fff)" stroke-width="4">N5 externa</text>`;
      g += `<text x="${X(p.b1 / 2 + 30)}" y="${Y(et + 30)}" ${lb} fill="var(--hz-b,#b07fdc)" paint-order="stroke" stroke="var(--fundo,#fff)" stroke-width="4">N5 interna</text>`;
      return g;
    });
  }

  return { DEF, CAA, BITOLAS, ELEM, check, bars, hLayers, cutBars, planHz, flex, vrd1, rhoMin, asBar };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = { AlasArm };
