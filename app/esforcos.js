/* =====================================================================
   Alas · Esforços: empuxo do solo e paredes engastadas na laje de fundo
   Rankine, solo não coesivo, terreno horizontal em cada faixa, sem atrito
   solo-parede. Valores característicos (sem majorar). Unidades kN e m;
   a geometria chega em cm (AlasGeo).

   - Testa: empuxo ativo em toda a altura, do fundo da laje sob a testa
     (e_g) até o topo (H_t).
   - Dente na ponta: empuxo passivo na altura da laje mais o dente
     (e_l + h_d). O passivo deve equilibrar o ativo: E_p / E_a ≥ 1 por metro
     (com as resultantes totais, testa × L_t e ponta × B_tot, só informativo).
   - Paredes (testa e alas) engastadas na laje de fundo, em faixas
     verticais de 1 m: o solo de cada faixa tem a altura da parede
     acima da laje, que nas alas cai do topo da testa (H_t) até a ponta
     (H_p). M = K_a γ h³ / 6 e V = K_a γ h² / 2 na base.
   ===================================================================== */
const AlasEsf = (function () {
  const G = AlasGeo, f = G.f0;
  const fx = (v, n = 2) => (Math.abs(v) < 0.5 * 10 ** -n ? 0 : v).toFixed(n).replace('.', ',');
  const SDEF = { gs: 18, phi: 30, sadm: 100 };   // γ do solo (kN/m³), φ (graus), tensão admissível (kPa)
  const GC = 25;                                  // peso específico do concreto armado (kN/m³)

  // Peso próprio e tensão média no solo (medidas em cm -> m)
  function weight(p) {
    const d = G.derive(p), m = v => v / 100;
    const Lt = m(d.Lt), Bt = m(d.Btot), et = m(p.et), La = m(p.La), Ls = m(d.Ls), el = m(p.el), eg = m(p.eg), bg = m(p.bg), hd = m(p.hd), bd = m(p.bd), ea = m(p.ea), Ht = m(p.Ht), Hp = m(p.Hp), D = m(p.D);
    const ch = Math.max(0, eg - el);
    const A = Lt * et + (Lt + Bt) / 2 * La;                            // área de apoio em planta (contorno externo)
    const parts = [
      ['Laje de fundo', A * el, `${fx(A, 2)} m² × ${G.f0(p.el)} cm`],
      ['Engrossamento sob a testa', ch * (bg + ch / 2) * Lt, `faixa de ${G.f0(p.bg)} cm + chanfro, ao longo da testa`],
      ['Dente na ponta', hd * bd * Bt, `${G.f0(p.hd)} × ${G.f0(p.bd)} cm, ao longo da ponta`],
      ['Testa', Lt * et * Ht - Math.PI * D * D / 4 * et, `descontado o furo do tubo`],
      ['Alas (duas)', 2 * ea * Ls * (Ht + Hp) / 2, `altura média ${G.f0((p.Ht + p.Hp) / 2)} cm`]
    ].map(([nm, V, obs]) => ({ nm, V, W: GC * V, obs }));
    const V = parts.reduce((a, x) => a + x.V, 0), W = GC * V;
    return { A, parts, V, W, sigma: W / A };
  }

  function calc(p, s) {
    const d = G.derive(p), r = Math.PI / 180;
    const Ka = Math.tan((45 - s.phi / 2) * r) ** 2, Kp = Math.tan((45 + s.phi / 2) * r) ** 2;
    const m = v => v / 100;
    // empuxo ativo na testa (do fundo da laje até o topo)
    const Ha = m(p.Ht + p.eg), pa = Ka * s.gs * Ha, Ea = pa * Ha / 2, EaT = Ea * m(d.Lt);
    // empuxo passivo no dente (laje + dente)
    const Hpp = m(p.el + p.hd), pp = Kp * s.gs * Hpp, Ep = pp * Hpp / 2, EpT = Ep * m(d.Btot);
    const FS = Ep / Ea, FST = EpT / EaT;                     // por metro e com as larguras da testa e da ponta
    // paredes engastadas na laje (faixa de 1 m)
    const strip = h => ({ h, p: Ka * s.gs * h, M: Ka * s.gs * h ** 3 / 6, V: Ka * s.gs * h ** 2 / 2 });
    const testa = strip(m(p.Ht));
    const alaH = t => m(p.Ht + (p.Hp - p.Ht) * t);       // t = 0 junto à testa, 1 na ponta
    const ala0 = strip(alaH(0)), ala1 = strip(alaH(1));
    const wt = weight(p), soilOk = wt.sigma <= s.sadm;
    return { wt, soilOk, sadm: s.sadm, d, Ka, Kp, Ha, pa, Ea, EaT, Hpp, pp, Ep, EpT, FS, FST, ok: FS >= 1 - 1e-9, testa, ala0, ala1, alaH, strip, yEa: Ha / 3, yEp: Hpp / 3 };
  }

  const STY = G.STYLE + `<style>
    .pa{fill:var(--ativo-soft,#fde7d6);stroke:var(--ativo,#c2531b);stroke-width:1.2}
    .pp{fill:var(--passivo-soft,#dbe9fb);stroke:var(--passivo,#2563b0);stroke-width:1.2}
    .aa{stroke:var(--ativo,#c2531b);stroke-width:1}
    .ap{stroke:var(--passivo,#2563b0);stroke-width:1}
    .ta{font-size:12px;fill:var(--ativo,#c2531b);font-weight:600;paint-order:stroke;stroke:var(--fundo,#fff);stroke-width:4px}
    .tp{font-size:12px;fill:var(--passivo,#2563b0);font-weight:600;paint-order:stroke;stroke:var(--fundo,#fff);stroke-width:4px}
    .gr{stroke:var(--solo,#8b6a3e);stroke-width:1.4}
    .grh{stroke:var(--solo,#8b6a3e);stroke-width:.9}
    .eng{stroke:var(--linha,#1d2430);stroke-width:.8}
    .mm{fill:var(--ativo-soft,#fde7d6);stroke:var(--ativo,#c2531b);stroke-width:1.4}
    .vv{fill:var(--passivo-soft,#dbe9fb);stroke:var(--passivo,#2563b0);stroke-width:1.4}
    .ax{stroke:var(--cota,#334155);stroke-width:.8}
    .grid{stroke:var(--line,#d9dee5);stroke-width:.6}
    .tt{font-size:12px;fill:var(--cota,#334155);paint-order:stroke;stroke:var(--fundo,#fff);stroke-width:4px}
    .th2{font-size:12px;fill:var(--ink,#1d2430);font-weight:600}
  </style>
  <defs>
    <marker id="arA" viewBox="0 0 8 8" refX="7.5" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="var(--ativo,#c2531b)"/></marker>
    <marker id="arP" viewBox="0 0 8 8" refX="7.5" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="var(--passivo,#2563b0)"/></marker>
  </defs>`;

  // terreno: linha com hachuras curtas
  const ground = (x1, x2, y, dir = 1) => { let g = `<line class="gr" x1="${x1}" y1="${y}" x2="${x2}" y2="${y}"/>`; for (let x = Math.min(x1, x2) + 4; x < Math.max(x1, x2); x += 9) g += `<line class="grh" x1="${x}" y1="${y}" x2="${x - 6}" y2="${y + 6 * dir}"/>`; return g; };

  /* ----- corte A com os empuxos ----- */
  function cutLoads(p, R, W = 760, H = 430) {
    const d = R.d, L = d.Ltot, et = p.et, el = p.el, eg = p.eg, bg = p.bg, ch = Math.max(0, eg - el);
    const zTop = p.Ht, zBot = -(el + p.hd);
    const kp = 120 / Math.max(R.pa, R.pp);                       // px por kPa nos diagramas
    const padL = 175 + R.pa * kp, padR = 175 + R.pp * kp, padT = 34, padB = 46;
    const k = Math.min((W - padL - padR) / L, (H - padT - padB) / (zTop - zBot));
    const ox = padL + (W - padL - padR - L * k) / 2, oy = padT + (H - padT - padB - (zTop - zBot) * k) / 2 + zTop * k;
    const X = x => ox + x * k, Z = z => oy - z * k;
    const P = pts => pts.map(([x, z]) => `${X(x).toFixed(1)},${Z(z).toFixed(1)}`).join(' ');
    let s = STY;
    // vista da ala e concreto (sem o tubo: faixa da testa ao lado do tubo)
    s += `<polygon class="cv" points="${P([[et, 0], [et, p.Ht], [L, p.Hp], [L, 0]])}"/>`;
    s += `<polygon class="c" points="${P([[0, p.Ht], [et, p.Ht], [et, 0], [L, 0], [L, -el - p.hd], [L - p.bd, -el - p.hd], [L - p.bd, -el], [bg + ch, -el], [bg, -eg], [0, -eg]])}"/>`;
    // terreno: a montante no topo da testa; a jusante no topo da laje
    s += ground(X(0) - R.pa * kp - 150, X(0), Z(p.Ht));
    s += ground(X(L), X(L) + R.pp * kp + 150, Z(0));
    // diagrama ativo na face de montante (de z = H_t até o fundo da laje, −e_g)
    const xa = X(0), za0 = Z(p.Ht), za1 = Z(-eg), wa = R.pa * kp;
    s += `<polygon class="pa" points="${xa},${za0} ${xa - wa},${za1} ${xa},${za1}"/>`;
    for (let i = 1; i <= 6; i++) { const t = i / 6, y = za0 + t * (za1 - za0), w = wa * t; if (w > 8) s += `<line class="aa" x1="${xa - w + 2}" y1="${y}" x2="${xa - 2}" y2="${y}" marker-end="url(#arA)"/>`; }
    s += `<text class="ta" x="${xa - wa - 6}" y="${za1 + 4}" text-anchor="end">${fx(R.pa)} kPa</text>`;
    // resultante ativa
    const yEa = Z(-eg + R.yEa * 100);
    s += `<line class="aa" x1="${xa - wa - 110}" y1="${yEa}" x2="${xa - 3}" y2="${yEa}" stroke-width="2.2" marker-end="url(#arA)"/>`;
    s += `<text class="ta" x="${xa - wa - 12}" y="${yEa - 7}" text-anchor="end">E<tspan font-size="9" dy="3">a</tspan><tspan dy="-3"> = ${fx(R.Ea)} kN/m</tspan></text>`;
    // diagrama passivo na face da ponta (do topo da laje ao pé do dente)
    const xp = X(L), zp0 = Z(0), zp1 = Z(zBot), wp = R.pp * kp;
    s += `<polygon class="pp" points="${xp},${zp0} ${xp + wp},${zp1} ${xp},${zp1}"/>`;
    for (let i = 1; i <= 4; i++) { const t = i / 4, y = zp0 + t * (zp1 - zp0), w = wp * t; if (w > 8) s += `<line class="ap" x1="${xp + w - 2}" y1="${y}" x2="${xp + 2}" y2="${y}" marker-end="url(#arP)"/>`; }
    s += `<text class="tp" x="${xp + wp + 6}" y="${zp1 + 4}">${fx(R.pp)} kPa</text>`;
    const yEp = Z(zBot + R.yEp * 100);
    s += `<line class="ap" x1="${xp + wp + 110}" y1="${yEp}" x2="${xp + 3}" y2="${yEp}" stroke-width="2.2" marker-end="url(#arP)"/>`;
    s += `<text class="tp" x="${xp + wp + 12}" y="${yEp - 7}">E<tspan font-size="9" dy="3">p</tspan><tspan dy="-3"> = ${fx(R.Ep)} kN/m</tspan></text>`;
    // alturas de solo
    s += G.dim(X(0) - wa - 135, Z(p.Ht), X(0) - wa - 135, Z(-eg), 0, f(p.Ht + eg), { noExt: true });
    s += G.dim(X(L) + wp + 135, Z(0), X(L) + wp + 135, Z(zBot), 0, f(el + p.hd), { noExt: true });
    s += `<text class="tt" x="${X(0) - wa / 2 - 10}" y="${Z(p.Ht) - 10}" text-anchor="middle">solo ativo</text>`;
    s += `<text class="tt" x="${X(L) + wp / 2 + 10}" y="${Z(0) - 10}" text-anchor="middle">solo passivo</text>`;
    return G.svgWrap(W, H, s);
  }

  /* ----- ala desenvolvida: altura de solo, M e V na base ----- */
  function wingChart(p, R, W = 760, H = 470) {
    const d = R.d, Ls = d.Ls, padL = 80, padR = 40;
    const kx = (W - padL - padR) / Ls, X = x => padL + x * kx;
    const n = 40, ts = Array.from({ length: n + 1 }, (_, i) => i / n);
    const S = ts.map(t => R.strip(R.alaH(t)));
    let s = STY;
    // painel 1: elevação da ala com a altura de solo
    const h1 = 140, y1 = 30, kz = Math.min((h1 - 20) / p.Ht, kx);
    const Zb = y1 + h1 - 8, Zw = z => Zb - z * kz;
    s += `<text class="th2" x="${padL}" y="${y1 - 10}">Elevação da ala (face em contato com o solo)</text>`;
    s += `<polygon class="cv" points="${X(0)},${Zb} ${X(0)},${Zw(p.Ht)} ${X(Ls)},${Zw(p.Hp)} ${X(Ls)},${Zb}"/>`;
    for (let i = 1; i < 8; i++) { const x = Ls * i / 8, z = p.Ht + (p.Hp - p.Ht) * i / 8; s += `<line class="th" x1="${X(x)}" y1="${Zb}" x2="${X(x)}" y2="${Zw(z)}"/>`; }
    // engaste na laje
    s += `<line class="ln" x1="${X(0) - 6}" y1="${Zb}" x2="${X(Ls) + 6}" y2="${Zb}" stroke-width="1.6"/>`;
    for (let x = X(0); x < X(Ls); x += 9) s += `<line class="eng" x1="${x}" y1="${Zb}" x2="${x - 6}" y2="${Zb + 7}"/>`;
    s += `<text class="tt" x="${X(Ls / 2)}" y="${Zb + 22}" text-anchor="middle">engastada na laje de fundo</text>`;
    s += `<text class="tt" x="${X(0) + 6}" y="${Zw(p.Ht) - 6}">junto à testa</text>`;
    s += G.dim(X(0) - 40, Zw(p.Ht), X(0) - 40, Zb, 0, f(p.Ht), { noExt: true });
    s += G.dim(X(Ls) + 22, Zw(p.Hp), X(Ls) + 22, Zb, 0, f(p.Hp), { noExt: true });
    s += G.dim(X(0), Zb + 36, X(Ls), Zb + 36, 0, f(Ls) + ' (comprimento inclinado)', { noExt: true, tin: true });
    // painéis 2 e 3: M e V na base, ao longo da ala
    const plot = (top, hgt, key, cls, unit, title) => {
      const vmax = S[0][key] || 1, ky = (hgt - 26) / vmax, base = top + 18, Y = v => base + v * ky;
      let g = `<text class="th2" x="${padL}" y="${top}">${title}</text>`;
      g += `<line class="ax" x1="${X(0)}" y1="${base}" x2="${X(Ls)}" y2="${base}"/>`;
      [0.25, 0.5, 0.75, 1].forEach(t => { g += `<line class="grid" x1="${X(Ls * t)}" y1="${base}" x2="${X(Ls * t)}" y2="${base + hgt - 26}"/>`; });
      g += `<polygon class="${cls}" points="${X(0)},${base} ${ts.map((t, i) => `${X(Ls * t).toFixed(1)},${Y(S[i][key]).toFixed(1)}`).join(' ')} ${X(Ls)},${base}"/>`;
      g += `<text class="tt" x="${X(0) + 8}" y="${Y(S[0][key]) - 4}">${fx(S[0][key])} ${unit}</text>`;
      g += `<text class="tt" x="${X(Ls) - 4}" y="${Y(S[n][key]) + 16}" text-anchor="end">${fx(S[n][key], 3)} ${unit}</text>`;
      g += `<text class="tt" x="${X(0) - 8}" y="${base + 4}" text-anchor="end">0</text>`;
      return g;
    };
    s += plot(y1 + h1 + 70, 110, 'M', 'mm', 'kN·m/m', 'Momento fletor na base da ala, M (por metro de ala)');
    s += plot(y1 + h1 + 215, 100, 'V', 'vv', 'kN/m', 'Esforço cortante na base da ala, V (por metro de ala)');
    // eixo s
    const yb = y1 + h1 + 215 + 100;
    s += `<text class="tt" x="${X(0)}" y="${yb + 14}" text-anchor="start">junto à testa</text><text class="tt" x="${X(Ls)}" y="${yb + 14}" text-anchor="end">ponta</text>`;
    return G.svgWrap(W, Math.max(H, yb + 24), s);
  }

  return { SDEF, GC, calc, weight, cutLoads, wingChart, fx };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = { AlasEsf };
