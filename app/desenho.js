/* =====================================================================
   Alas · Desenho paramétrico da planta e do corte (SVG)
   Medidas em cm. Planta: x horizontal (eixo do tubo em x = 0), y para
   baixo a partir da face de montante da testa. Corte A: s ao longo do
   eixo (s = 0 na face de montante da testa), z para cima (z = 0 no topo
   da laje de fundo).
   ===================================================================== */
const AlasGeo = (function () {
  const DEF = {
    D: 50,      // diâmetro externo do tubo
    et: 15,     // espessura da testa
    Ht: 95,     // altura da testa acima da laje
    ea: 15,     // espessura das alas (perpendicular à face)
    b1: 90,     // abertura interna entre alas junto à testa
    b2: 202,    // abertura interna entre alas na ponta
    La: 113,    // comprimento das alas em planta (da face de jusante da testa à ponta)
    Hp: 20,     // altura das alas na ponta, acima da laje
    el: 15,     // espessura da laje de fundo
    eg: 25,     // espessura total da laje sob a testa (engrossamento)
    bg: 25,     // largura do engrossamento
    hd: 25,     // profundidade do dente na ponta, abaixo da laje
    bd: 15      // largura do dente
  };
  const LM = 5;  // lastro de concreto magro: sempre 5 cm

  function derive(p) {
    const ang = Math.atan(((p.b2 - p.b1) / 2) / p.La);         // abertura de cada ala em relação ao eixo
    const ex = p.ea / Math.cos(ang);                            // espessura da ala medida na horizontal
    const Lt = p.b1 + 2 * ex;                                   // comprimento da testa
    const Ls = p.La / Math.cos(ang);                            // comprimento inclinado da ala
    const Btot = p.b2 + 2 * ex;                                 // largura total na ponta
    return { ang, angDeg: ang * 180 / Math.PI, ex, Lt, Ls, Btot, Ltot: p.et + p.La, cob: p.Ht - p.D };
  }

  /* ----- utilidades de SVG ----- */
  const f0 = v => (Math.round(v * 10) / 10).toString().replace('.', ',');
  function svgWrap(W, H, body) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" height="100%" font-family="'IBM Plex Sans', 'Segoe UI', Arial, sans-serif">${body}</svg>`;
  }
  // cota entre dois pontos (já em px); off = deslocamento perpendicular; txt = valor
  function dim(x1, y1, x2, y2, off, txt, o = {}) {
    const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    const ax = x1 + nx * off, ay = y1 + ny * off, bx = x2 + nx * off, by = y2 + ny * off;
    const ext = (x, y, xa, ya) => `<line x1="${x + nx * Math.sign(off) * 3}" y1="${y + ny * Math.sign(off) * 3}" x2="${xa + nx * Math.sign(off) * 5}" y2="${ya + ny * Math.sign(off) * 5}" class="ext"/>`;
    const tk = (x, y) => `<line x1="${x - 4 * (dx + dy) / L}" y1="${y - 4 * (dy - dx) / L}" x2="${x + 4 * (dx + dy) / L}" y2="${y + 4 * (dy - dx) / L}" class="tick"/>`;
    let a = Math.atan2(dy, dx) * 180 / Math.PI; if (a > 90 || a <= -90) a += 180;
    const mx = (ax + bx) / 2 + nx * (o.tin ? 12 : -6) * Math.sign(off || 1), my = (ay + by) / 2 + ny * (o.tin ? 12 : -6) * Math.sign(off || 1);
    return `<g class="dim">${o.noExt ? '' : ext(x1, y1, ax, ay) + ext(x2, y2, bx, by)}<line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}"/>${tk(ax, ay)}${tk(bx, by)}<text x="${mx}" y="${my}" transform="rotate(${a} ${mx} ${my})" text-anchor="middle" dominant-baseline="${o.tin ? 'hanging' : 'auto'}">${txt}</text></g>`;
  }
  const STYLE = `<style>
    .c{fill:var(--concreto,#bfe9cc);stroke:var(--linha,#1d2430);stroke-width:1.6;stroke-linejoin:round}
    .cv{fill:var(--vista,#f3f6f4);stroke:var(--linha,#1d2430);stroke-width:1.2;stroke-linejoin:round}
    .ln{fill:none;stroke:var(--linha,#1d2430);stroke-width:1}
    .th{fill:none;stroke:var(--linha,#1d2430);stroke-width:.6;opacity:.75}
    .tubo{fill:var(--tubo,#e7ebf0);stroke:var(--linha,#1d2430);stroke-width:1.2}
    .eixo{stroke:var(--eixo,#8a94a3);stroke-width:.9;stroke-dasharray:14 4 3 4;fill:none}
    .mag{fill:url(#magro);stroke:var(--linha,#1d2430);stroke-width:.8}
    .dim line{stroke:var(--cota,#334155);stroke-width:.8}
    .dim line.ext{stroke-width:.6}
    .dim line.tick{stroke-width:1.2}
    .dim text{font-size:12.5px;fill:var(--cota,#334155);font-variant-numeric:tabular-nums;paint-order:stroke;stroke:var(--fundo,#fff);stroke-width:4px;stroke-linejoin:round}
    .lbl{font-size:12px;fill:var(--cota,#334155)}
    .lbl text{paint-order:stroke;stroke:var(--fundo,#fff);stroke-width:4px}
  </style>
  <defs><pattern id="magro" width="7" height="7" patternUnits="userSpaceOnUse"><rect width="7" height="7" fill="#f4f1ea"/><circle cx="2" cy="2" r=".8" fill="#8b8579"/><circle cx="5.5" cy="5" r=".6" fill="#8b8579"/></pattern></defs>`;

  /* ----- planta ----- */
  function plan(p, W = 760, H = 470, overlay) {
    const d = derive(p), padL = 70, padR = 110, padT = 110, padB = 70;
    const pipeL = 45;                                            // trecho do tubo desenhado a montante
    const wcm = d.Btot, hcm = d.Ltot + pipeL;
    const k = Math.min((W - padL - padR) / wcm, (H - padT - padB) / hcm);
    const ox = padL + (W - padL - padR - wcm * k) / 2 + wcm * k / 2, oy = padT + pipeL * k + (H - padT - padB - hcm * k) / 2;
    const X = x => ox + x * k, Y = y => oy + y * k;
    const P = pts => pts.map(([x, y]) => `${X(x).toFixed(1)},${Y(y).toFixed(1)}`).join(' ');
    const yT = p.et, yE = p.et + p.La, hb1 = p.b1 / 2, hb2 = p.b2 / 2, ex = d.ex;
    let s = STYLE;
    // laje de fundo (vista de cima, entre as alas)
    s += `<polygon class="cv" points="${P([[-hb1, yT], [hb1, yT], [hb2, yE], [-hb2, yE]])}"/>`;
    // linha do dente na ponta (aresta interna do dente, sob a laje)
    const xdi = hb1 + (p.La - p.bd) / p.La * (hb2 - hb1);
    s += `<line class="ln" x1="${X(-xdi)}" y1="${Y(yE - p.bd)}" x2="${X(xdi)}" y2="${Y(yE - p.bd)}" stroke-dasharray="6 4"/>`;
    // alas
    [-1, 1].forEach(sg => {
      const pts = [[sg * hb1, yT], [sg * (hb1 + ex), yT], [sg * (hb2 + ex), yE], [sg * hb2, yE]];
      s += `<polygon class="c" points="${P(pts)}"/>`;
      // degraus do topo inclinado (linhas perpendiculares à ala)
      const n = 6;
      for (let i = 1; i < n; i++) { const t = i / n, yi = yT + t * p.La, xi = hb1 + t * (hb2 - hb1); s += `<line class="th" x1="${X(sg * xi)}" y1="${Y(yi)}" x2="${X(sg * (xi + ex))}" y2="${Y(yi)}"/>`; }
    });
    // testa
    s += `<rect class="c" x="${X(-d.Lt / 2)}" y="${Y(0)}" width="${d.Lt * k}" height="${p.et * k}"/>`;
    // tubo a montante com quebra ondulada
    const r = p.D / 2, yb = -pipeL;
    const wave = `M${X(-r)},${Y(yb + 4)} C${X(-r * 0.5)},${Y(yb - 6)} ${X(-r * 0.1)},${Y(yb + 10)} ${X(0)},${Y(yb + 3)} C${X(r * 0.1)},${Y(yb - 6)} ${X(r * 0.5)},${Y(yb + 10)} ${X(r)},${Y(yb + 2)}`;
    s += `<path class="tubo" d="${wave} L${X(r)},${Y(0)} L${X(-r)},${Y(0)} Z"/>`;
    for (let i = 1; i < 10; i++) { const x = -r + i * p.D / 10; s += `<line class="th" x1="${X(x)}" y1="${Y(yb + 8)}" x2="${X(x)}" y2="${Y(0)}"/>`; }
    // eixo
    s += `<line class="eixo" x1="${X(0)}" y1="${Y(yb - 25)}" x2="${X(0)}" y2="${Y(yE + 25)}"/>`;
    // cotas superiores
    const yc = Y(yb) - 22, cx = [-d.Btot / 2, -d.Lt / 2, -r, r, d.Lt / 2, d.Btot / 2];
    for (let i = 0; i < cx.length - 1; i++) s += dim(X(cx[i]), yc, X(cx[i + 1]), yc, 0, f0(cx[i + 1] - cx[i]), { noExt: true });
    cx.forEach(x => { s += `<line class="th" x1="${X(x)}" y1="${yc - 6}" x2="${X(x)}" y2="${x === -r || x === r ? Y(yb) : x === -d.Lt / 2 || x === d.Lt / 2 ? Y(0) : Y(yE)}" stroke-dasharray="${Math.abs(x) === d.Btot / 2 ? '0' : '0'}"/>`; });
    // abertura junto à testa
    s += dim(X(-hb1), Y(yT + 12), X(hb1), Y(yT + 12), 0, f0(p.b1), { noExt: true, tin: true });
    // cotas inferiores
    const yb2 = Y(yE) + 26;
    s += dim(X(-d.Btot / 2), yb2, X(-hb2), yb2, 0, f0(ex), { noExt: true, tin: true }) + dim(X(-hb2), yb2, X(hb2), yb2, 0, f0(p.b2), { noExt: true, tin: true }) + dim(X(hb2), yb2, X(d.Btot / 2), yb2, 0, f0(ex), { noExt: true, tin: true });
    // cotas à direita
    const xr = X(d.Btot / 2) + 34, xr2 = xr + 34;
    s += dim(xr, Y(0), xr, Y(yT), 0, f0(p.et), { noExt: true }) + dim(xr, Y(yT), xr, Y(yE - p.bd), 0, f0(p.La - p.bd), { noExt: true }) + dim(xr, Y(yE - p.bd), xr, Y(yE), 0, f0(p.bd), { noExt: true });
    s += dim(xr2, Y(0), xr2, Y(yE), 0, f0(d.Ltot), { noExt: true });
    [0, yT, yE - p.bd, yE].forEach(y => { s += `<line class="th" x1="${X(d.Lt / 2 + (y > 0 ? (y - yT) / p.La * (hb2 - hb1) : 0)) + 6}" y1="${Y(y)}" x2="${xr2 + 6}" y2="${Y(y)}"/>`; });
    // espessura da ala (cota perpendicular)
    const tm = 0.62, xa = hb1 + tm * (hb2 - hb1), ya = yT + tm * p.La, nx = Math.cos(d.ang), ny = -Math.sin(d.ang);
    s += dim(X(-xa), Y(ya), X(-xa - p.ea * nx), Y(ya - p.ea * ny), 0, f0(p.ea), { noExt: true });
    // marcação do corte A
    s += `<g class="lbl"><text x="${X(0) - 26}" y="${Y(yb - 30)}" font-weight="600">A</text><text x="${X(0) - 26}" y="${Y(yE) + 58}" font-weight="600">A</text></g>`;
    if (overlay) s += overlay(X, Y, k);
    return svgWrap(W, H, s);
  }

  /* ----- corte A (pelo eixo do tubo) ----- */
  function cut(p, W = 760, H = 400, overlay) {
    const d = derive(p), padL = 110, padR = 120, padT = 30, padB = 100;
    const pipeL = 60, s0 = -pipeL, s1 = d.Ltot, zTop = p.Ht, zBot = -(p.el + p.hd) - LM;
    const wcm = s1 - s0, hcm = zTop - zBot;
    const k = Math.min((W - padL - padR) / wcm, (H - padT - padB) / hcm);
    const ox = padL + (W - padL - padR - wcm * k) / 2 - s0 * k, oy = padT + (H - padT - padB - hcm * k) / 2 + zTop * k;
    const X = x => ox + x * k, Z = z => oy - z * k;
    const P = pts => pts.map(([x, z]) => `${X(x).toFixed(1)},${Z(z).toFixed(1)}`).join(' ');
    const et = p.et, L = d.Ltot, el = p.el, eg = p.eg, bg = p.bg, ch = Math.max(0, eg - el);
    let s = STYLE;
    // lastro de concreto magro
    s += `<polygon class="mag" points="${P([[0, -eg], [bg, -eg], [bg + ch, -el], [L - p.bd, -el], [L - p.bd, -el - LM], [bg + ch, -el - LM], [bg, -eg - LM], [0, -eg - LM]])}"/>`;
    s += `<rect class="mag" x="${X(L - p.bd)}" y="${Z(-el - p.hd)}" width="${p.bd * k}" height="${LM * k}"/>`;
    // vista da ala (face interna além do plano de corte)
    s += `<polygon class="cv" points="${P([[et, 0], [et, p.Ht], [L, p.Hp], [L, 0]])}"/>`;
    const nv = 8; for (let i = 1; i < nv; i++) { const x = et + i * (L - et) / nv, zt = p.Ht + (p.Hp - p.Ht) * (x - et) / (L - et); s += `<line class="th" x1="${X(x)}" y1="${Z(0)}" x2="${X(x)}" y2="${Z(zt)}"/>`; }
    // laje de fundo com engrossamento sob a testa e dente na ponta (seção cortada)
    s += `<polygon class="c" points="${P([[0, 0], [L, 0], [L, -el - p.hd], [L - p.bd, -el - p.hd], [L - p.bd, -el], [bg + ch, -el], [bg, -eg], [0, -eg]])}"/>`;
    // testa cortada acima do tubo
    s += `<rect class="c" x="${X(0)}" y="${Z(p.Ht)}" width="${et * k}" height="${(p.Ht - p.D) * k}"/>`;
    // tubo
    const wave = `M${X(s0 + 4)},${Z(p.D)} C${X(s0 - 6)},${Z(p.D * 0.8)} ${X(s0 + 10)},${Z(p.D * 0.6)} ${X(s0 + 3)},${Z(p.D / 2)} C${X(s0 - 6)},${Z(p.D * 0.4)} ${X(s0 + 10)},${Z(p.D * 0.2)} ${X(s0 + 2)},${Z(0)}`;
    s += `<path class="tubo" d="${wave} L${X(et)},${Z(0)} L${X(et)},${Z(p.D)} Z"/>`;
    for (let i = 1; i < 8; i++) { const z = i * p.D / 8; s += `<line class="th" x1="${X(s0 + 8)}" y1="${Z(z)}" x2="${X(et)}" y2="${Z(z)}"/>`; }
    s += `<line class="eixo" x1="${X(s0 - 15)}" y1="${Z(p.D / 2)}" x2="${X(et + 30)}" y2="${Z(p.D / 2)}"/>`;
    // cotas à esquerda
    const xl = X(s0) - 30, xl2 = xl - 32;
    s += dim(xl, Z(p.Ht), xl, Z(p.D), 0, f0(p.Ht - p.D), { noExt: true }) + dim(xl, Z(p.D), xl, Z(0), 0, f0(p.D), { noExt: true }) + dim(xl, Z(0), xl, Z(-eg), 0, f0(eg), { noExt: true });
    s += dim(xl2, Z(p.Ht), xl2, Z(0), 0, f0(p.Ht), { noExt: true }) + dim(xl2, Z(0), xl2, Z(-el - p.hd), 0, f0(el + p.hd), { noExt: true });
    [[p.Ht, 0], [p.D, s0], [0, 0], [-eg, 0], [-el - p.hd, L - p.bd]].forEach(([z, x0]) => { s += `<line class="th" x1="${xl2 - 6}" y1="${Z(z)}" x2="${X(x0) - 4}" y2="${Z(z)}"/>`; });
    // cotas à direita
    const xr = X(L) + 30;
    s += dim(xr, Z(p.Ht), xr, Z(p.Hp), 0, f0(p.Ht - p.Hp), { noExt: true }) + dim(xr, Z(p.Hp), xr, Z(0), 0, f0(p.Hp), { noExt: true }) + dim(xr, Z(0), xr, Z(-el), 0, f0(el), { noExt: true }) + dim(xr, Z(-el), xr, Z(-el - p.hd), 0, f0(p.hd), { noExt: true });
    [p.Ht, p.Hp, 0, -el, -el - p.hd].forEach(z => { s += `<line class="th" x1="${z === p.Ht ? X(et) + 4 : X(L) + 4}" y1="${Z(z)}" x2="${xr + 6}" y2="${Z(z)}"/>`; });
    // cotas inferiores
    const yb = Z(-el - p.hd - LM) + 26;
    s += dim(X(0), yb, X(bg), yb, 0, f0(bg), { noExt: true, tin: true }) + dim(X(L - p.bd), yb, X(L), yb, 0, f0(p.bd), { noExt: true, tin: true }) + dim(X(0), yb + 28, X(L), yb + 28, 0, f0(L), { noExt: true, tin: true });
    [0, bg, L - p.bd, L].forEach(x => { s += `<line class="th" x1="${X(x)}" y1="${Z(x >= L - p.bd ? -el - p.hd - LM : -eg - LM) + 4}" y2="${yb + 34}" x2="${X(x)}"/>`; });
    // rótulo do lastro
    const lx = X(L * 0.5), ly = Z(-el - LM / 2), tx = X(s0) + 10, ty = Z(-el - p.hd - LM) + 12;
    s += `<g class="lbl"><polyline class="th" points="${lx},${ly} ${lx - 18},${ty - 4} ${tx + 210},${ty - 4}"/><text x="${tx + 205}" y="${ty}" text-anchor="end">lastro de concreto magro (${f0(LM)} cm)</text></g>`;
    if (overlay) s += overlay(X, Z, k);
    return svgWrap(W, H, s);
  }

  return { DEF, LM, derive, plan, cut, f0, dim, svgWrap, STYLE };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = { AlasGeo };
