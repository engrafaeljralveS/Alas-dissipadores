/* =====================================================================
   Alas · Memorial de cálculo
   Monta o memorial em HTML a partir do estado do app (geometria, solo,
   esforços, tensão no solo, dimensionamento e armaduras adotadas).
   O mesmo HTML serve para a aba Memorial, para copiar para o Word e
   para o arquivo .doc.
   ===================================================================== */
const AlasMem = (function () {
  const G = AlasGeo, E = AlasEsf, AR = AlasArm, f = G.f0, fx = E.fx;
  const x2 = v => fx(v, 2), R0 = v => f(Math.round(v));
  const esc = t => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const tbl = (head, rows, cls = '') => `<table class="mt ${cls}"><thead><tr>${head.map((h, i) => `<th${i ? '' : ' class="l"'}>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map((c, i) => `<td${i ? '' : ' class="l"'}>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const tblL = (head, rows) => `<table class="mt"><thead><tr>${head.map(h => `<th class="l">${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td class="l">${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const st = ok => `<b class="${ok ? 'mok' : 'mno'}">${ok ? 'atende' : 'não atende'}</b>`;
  const eq = t => `<p class="eq">${t}</p>`;

  function build(ctx) {
    const { p, soil, R, a, A, info, FE } = ctx, D = A.hzD, d = R.d, wt = R.wt, B = AR.bars(p, a), caa = AR.CAA[a.caa];
    const rw = k => A.rows.find(x => x.k === k);
    const today = new Date().toLocaleDateString('pt-BR');
    let h = '';
    h += `<div class="mh"><div class="mh-t">Memorial de cálculo</div><div class="mh-s">Alas de bueiro em concreto armado</div>
      <table class="mi"><tr><td>Obra</td><td>${esc(info.obra) || '—'}</td></tr><tr><td>Local</td><td>${esc(info.local) || '—'}</td></tr><tr><td>Responsável técnico</td><td>${esc(info.resp) || '—'}</td></tr><tr><td>Data</td><td>${today}</td></tr></table></div>`;

    // 1
    h += `<h2>1. Objeto e premissas</h2>
      <p>Este memorial apresenta a verificação da testa, das alas, da laje de fundo e do dente de um bueiro com tubo de diâmetro externo ${f(p.D)} cm, em concreto armado.</p>
      <ul>
        <li>Empuxo do solo pela teoria de Rankine, solo não coesivo, sem atrito solo-parede e sem sobrecarga no aterro.</li>
        <li>Empuxo ativo na testa em toda a altura, do fundo da laje sob a testa até o topo; empuxo passivo no dente, na altura da laje mais o dente.</li>
        <li>Testa e alas engastadas na laje de fundo, calculadas em faixas verticais de 1 m com a altura de solo de cada faixa; o aterro acompanha o topo inclinado das alas.</li>
        <li>Tensão no solo pelo peso próprio da estrutura dividido pela área de apoio, com concreto armado a ${E.GC} kN/m³.</li>
        <li>Dimensionamento pela ABNT NBR 6118, em faixas de 1 m, com γ<sub>f</sub> = 1,4, γ<sub>c</sub> = 1,4 e γ<sub>s</sub> = 1,15. Na testa e nas alas, a armadura vertical é dimensionada com o modelo de faixas engastadas na laje; a armadura horizontal, com os momentos horizontais de um modelo de casca por elementos finitos (item 4.6).</li>
      </ul>`;

    // 2
    h += `<h2>2. Geometria</h2><p>Planta e corte A pelo eixo do tubo, com as medidas em centímetros. Lastro de concreto magro de ${f(G.LM)} cm sob a laje de fundo.</p>
      <div class="mfig" data-w="760" data-h="470">${G.plan(p, 760, 470)}</div><p class="mcap">Figura 1 · Planta (medidas em cm)</p>
      <div class="mfig" data-w="760" data-h="430">${G.cut(p, 760, 430)}</div><p class="mcap">Figura 2 · Corte A (medidas em cm)</p>`;

    // 3
    h += `<h2>3. Solo</h2>` + tbl(['Parâmetro', 'Valor'], [
      ['Peso específico, γ', f(soil.gs) + ' kN/m³'], ['Ângulo de atrito, φ', f(soil.phi) + '°'], ['Tensão admissível, σ<sub>adm</sub>', f(soil.sadm) + ' kPa'],
      ['Coeficiente de empuxo ativo, K<sub>a</sub> = tg²(45° − φ/2)', fx(R.Ka, 4)], ['Coeficiente de empuxo passivo, K<sub>p</sub> = tg²(45° + φ/2)', fx(R.Kp, 4)]
    ]);

    // 4
    const Ha = R.Ha, Hp = R.Hpp;
    h += `<h2>4. Esforços</h2>
      <h3>4.1 Empuxo ativo na testa</h3><p>Altura de solo do fundo da laje sob a testa até o topo: H = H<sub>t</sub> + e<sub>g</sub> = ${f(p.Ht)} + ${f(p.eg)} = ${f(p.Ht + p.eg)} cm.</p>
      ${eq(`p<sub>a</sub> = K<sub>a</sub> · γ · H = ${fx(R.Ka, 4)} × ${f(soil.gs)} × ${fx(Ha, 2)} = <b>${x2(R.pa)} kPa</b>`)}
      ${eq(`E<sub>a</sub> = p<sub>a</sub> · H / 2 = ${x2(R.pa)} × ${fx(Ha, 2)} / 2 = <b>${x2(R.Ea)} kN/m</b>, aplicado a H/3 = ${fx(Ha / 3 * 100, 1)} cm do fundo`)}
      <p>Na largura da testa (${f(d.Lt)} cm), a resultante é ${x2(R.EaT)} kN.</p>
      <h3>4.2 Empuxo passivo no dente</h3><p>Altura de solo da laje mais o dente: H = e<sub>l</sub> + h<sub>d</sub> = ${f(p.el)} + ${f(p.hd)} = ${f(p.el + p.hd)} cm.</p>
      ${eq(`p<sub>p</sub> = K<sub>p</sub> · γ · H = ${fx(R.Kp, 4)} × ${f(soil.gs)} × ${fx(Hp, 2)} = <b>${x2(R.pp)} kPa</b>`)}
      ${eq(`E<sub>p</sub> = p<sub>p</sub> · H / 2 = ${x2(R.pp)} × ${fx(Hp, 2)} / 2 = <b>${x2(R.Ep)} kN/m</b>`)}
      <p>Na largura da ponta (${f(d.Btot)} cm), a resultante é ${x2(R.EpT)} kN.</p>
      <h3>4.3 Equilíbrio dos empuxos</h3>
      ${eq(`E<sub>p</sub> / E<sub>a</sub> = ${x2(R.Ep)} / ${x2(R.Ea)} = <b>${x2(R.FS)}</b> ${R.ok ? '≥' : '<'} 1,00 → ${st(R.ok)}`)}
      <p>${R.ok ? 'O empuxo passivo no dente equilibra o empuxo ativo na testa.' : 'O empuxo passivo no dente não equilibra o ativo: é preciso aprofundar o dente.'}</p>
      <h3>4.4 Paredes engastadas na laje de fundo</h3>
      <p>Faixa vertical de 1 m com a altura de solo da própria parede acima da laje. Na base: M = K<sub>a</sub> · γ · h³ / 6 e V = K<sub>a</sub> · γ · h² / 2 (valores característicos).</p>` +
      tbl(['Parede', 'h (cm)', 'Pressão na base (kPa)', 'M<sub>k</sub> (kN·m/m)', 'V<sub>k</sub> (kN/m)'], [['Testa', R.testa], ['Ala, junto à testa', R.ala0], ['Ala, na ponta', R.ala1]].map(([n, x]) => [n, f(Math.round(x.h * 1000) / 10), x2(x.p), x2(x.M), x2(x.V)]));
    h += `<h3>4.5 Tensão no solo</h3>` + tblL(['Parte', 'Base do volume', 'Volume (m³)', 'Peso (kN)'], wt.parts.map(x => [x.nm, x.obs, fx(x.V, 3), x2(x.W)]).concat([['<b>Total</b>', '', `<b>${fx(wt.V, 3)}</b>`, `<b>${x2(wt.W)}</b>`]])) +
      `<p>Área de apoio (contorno externo da laje em planta): A = ${x2(wt.A)} m².</p>
      ${eq(`σ = P / A = ${x2(wt.W)} / ${x2(wt.A)} = <b>${x2(wt.sigma)} kPa</b> (${fx(wt.sigma / 98.0665, 2)} kgf/cm²) ${R.soilOk ? '≤' : '>'} σ<sub>adm</sub> = ${f(soil.sadm)} kPa → ${st(R.soilOk)}`)}`;

    // 4.6 casca
    h += `<h3>4.6 Momentos horizontais nas paredes</h3>`;
    if (!FE || FE.error) h += `<p>${FE && FE.error ? 'Não foi possível calcular o modelo de casca: ' + esc(FE.error) : 'Cálculo do modelo de casca em andamento.'}</p>`;
    else {
      h += `<p>Testa e alas modeladas como cascas pelo plano médio (elementos de 4 nós, placa de Mindlin MITC4 com membrana), ligadas no encontro, em metade da estrutura pela simetria no eixo do tubo. Base engastada na laje de fundo, furo do tubo aberto na testa e topo da ala em degraus. Carga característica: empuxo ativo K<sub>a</sub> · γ · (topo − z) na face do solo. Malha de ${fx(FE.hm * 100, 1)} cm, ${FE.stats.nElem} elementos. Momentos horizontais M<sub>x</sub> com Wood-Armer.</p>`;
      h += `<div class="mfig" data-w="760" data-h="320">${AlasMEF.mapSvg(p, FE, 760, 320)}</div><p class="mcap">Figura 3 · Momento horizontal M<sub>x</sub> na testa e na ala desenvolvida (valores característicos)</p>`;
      const rows = [];
      [['testa', 'Testa'], ['ala', 'Ala']].forEach(([s2, nm]) => [0, 1].forEach(fc => {
        const q = FE.pts[s2].reduce((b, x) => (x.wa[fc] > (b ? b.wa[fc] : -1) ? x : b), null);
        rows.push([nm, fc ? 'oposta ao solo' : 'do solo', fx(q.wa[fc], 3), x2(q.N1), fx(q.u * 100, 1), fx(q.z * 100, 1)]);
      }));
      h += tbl(['Parede', 'Face tracionada', 'M<sub>x</sub> máx. (kN·m/m)', 'N<sub>x</sub> no ponto (kN/m)', 'Posição horizontal (cm)', 'z (cm)'], rows);
    }

    // 5
    const fcd = a.fck / 1.4, fyd = 500 / 1.15;
    h += `<h2>5. Dimensionamento das armaduras</h2><h3>5.1 Materiais e ambiente</h3>` + tbl(['Item', 'Valor'], [
      ['Concreto', `C${a.fck}: f<sub>ck</sub> = ${a.fck} MPa, f<sub>cd</sub> = ${x2(fcd)} MPa`], ['Aço', `CA-50: f<sub>yd</sub> = ${x2(fyd)} MPa`],
      ['Classe de agressividade ambiental', caa.nome], ['Cobrimento nominal adotado', f(a.cob) + ' cm'],
      ['Cobrimento mínimo (contato com o solo, Tabela 7.2)', f(caa.cob) + ' cm'], ['f<sub>ck</sub> mínimo para a classe (Tabela 7.1)', 'C' + caa.fck]
    ]);
    h += `<h3>5.2 Flexão e armadura mínima</h3><p>Faixa de b = 100 cm, altura h igual à espessura do elemento, d = h − c − ø/2. M<sub>d</sub> = 1,4 · M<sub>k</sub>. Armadura mínima por face A<sub>s,mín</sub> = ρ<sub>mín</sub> · b · h, com ρ<sub>mín</sub> = ${fx(A.rhoMin, 3)} % (Tabela 17.3). A laje de fundo recebe no engaste o maior momento das paredes.</p>` +
      tbl(['Elemento', 'Armadura', 'h (cm)', 'd (cm)', 'M<sub>k</sub> (kN·m/m)', 'M<sub>d</sub> (kN·m/m)', 'x/d', 'A<sub>s,nec</sub> (cm²/m)', 'A<sub>s,mín</sub> (cm²/m)', 'A<sub>s,ef</sub> (cm²/m)', 'Situação'],
        A.rows.map(r => [r.nome, `ø${f(r.phi)} c/${f(r.s)}${r.k === 'lf' ? '' : ' (vertical)'}`, f(r.h), x2(r.d), x2(r.Mk), x2(r.Md), isFinite(r.xd) ? fx(r.xd, 3) : '—', isFinite(r.As) ? x2(r.As) : '—', x2(r.Asmin), `<b>${x2(r.Asef)}</b>`, st(r.it.flex && r.it.min)]), 'sm');
    h += `<h3>5.3 Cortante</h3><p>Verificação sem armadura transversal: V<sub>Sd</sub> = 1,4 · V<sub>k</sub> ≤ V<sub>Rd1</sub> (item 19.4.1). Na laje de fundo, o cortante não foi calculado nesta versão.</p>` +
      tbl(['Elemento', 'd (cm)', 'ρ<sub>1</sub> (%)', 'V<sub>k</sub> (kN/m)', 'V<sub>Sd</sub> (kN/m)', 'V<sub>Rd1</sub> (kN/m)', 'Situação'],
        A.rows.filter(r => r.Vd != null).map(r => [r.nome, x2(r.d), fx(Math.min(2, r.Asef / r.d), 3), x2(r.Vk), x2(r.Vd), x2(r.VR), st(r.it.cort)]), 'sm');
    h += `<h3>5.4 Armadura horizontal das paredes</h3><p>Armadura N5, a ${f(a.cob)} cm das faces, correndo pelas duas alas e pela testa nas duas faces; nas pontas das alas, as barras externa e interna fecham com dobra de ${R0(p.ea - 2 * a.cob)} cm. Dimensionamento à flexo-tração com M<sub>d</sub> = 1,4 · M<sub>x</sub> e N<sub>d</sub> = 1,4 · N<sub>x</sub> do item 4.6, em cada face, fora do nó do encontro; d = h − c − ø/2. A armadura mínima é a da parede mais espessa.</p>`;
    const HL = AR.hLayers(p, a);
    if (!D) h += `<p>Verificação em andamento (cálculo do modelo de casca).</p>`;
    else {
      const g = D.gov;
      h += tbl(['Item', 'Valor'], [
        ['Armadura adotada (N5)', `ø${f(a.ph_phi)} c/${f(a.ph_s)}, ${HL.length} camadas (z = ${HL.map(x => f(x.z)).join(', ')} cm)`],
        ['Ponto que governa', g.s ? `${g.s === 'testa' ? 'testa' : 'ala'}, face ${g.f ? 'oposta ao solo' : 'do solo'}, z = ${fx(g.z * 100, 1)} cm: M<sub>x</sub> = ${fx(g.Mk, 3)} kN·m/m, N<sub>x</sub> = ${x2(g.Nk)} kN/m` : '—'],
        ['A<sub>s,nec</sub> (flexo-tração)', fx(D.req, 3) + ' cm²/m'], ['A<sub>s,mín</sub> por face', x2(D.AsminMax) + ' cm²/m'], ['A<sub>s,ef</sub> por face', x2(D.Asef) + ' cm²/m'],
        ['Espaçamento ≤ s<sub>máx</sub>', `${f(a.ph_s)} ≤ ${f(D.sMax)} cm`], ['Bitola ≤ h/8', `${f(a.ph_phi)} ≤ ${fx(D.phiMax, 1)} mm`],
        ['Situação', st(D.ok)]
      ]);
    }

    // 7
    const checks = [
      ['Equilíbrio dos empuxos, E<sub>p</sub> / E<sub>a</sub> ≥ 1', `${x2(R.FS)}`, R.ok],
      ['Tensão no solo, σ ≤ σ<sub>adm</sub>', `${x2(wt.sigma)} ≤ ${f(soil.sadm)} kPa`, R.soilOk]
    ].concat(A.rows.map(r => [`${r.nome}${r.k === 'lf' ? '' : ' (vertical)'}: flexão, armadura mínima, cortante e detalhamento`, `ø${f(r.phi)} c/${f(r.s)}`, r.ok]));
    h += `<h2>6. Resumo das verificações</h2>` + tbl(['Verificação', 'Valor', 'Situação'], checks.map(([n, v, ok]) => [n, v, st(ok)]).concat([['Paredes, armadura horizontal (N5): flexo-tração, armadura mínima e detalhamento', `ø${f(a.ph_phi)} c/${f(a.ph_s)}`, D ? st(D.ok) : 'em cálculo']]));
    if (A.warn.length) h += `<p class="mw">${A.warn.join('<br>')}</p>`;
    h += `<p class="mf">Cálculo preliminar: valide coeficientes e hipóteses antes de uso em projeto executivo. Gerado pelo Alas v1.8 em ${today}.</p>`;
    return h;
  }

  // CSS do documento (para a aba e para o Word)
  const CSS = `
    .mdoc{font-family:Calibri,'IBM Plex Sans',Arial,sans-serif;font-size:11pt;line-height:1.4;color:#1b1f24}
    .mdoc h2{font-size:13pt;margin:18pt 0 6pt;color:#1f4e46;border-bottom:1px solid #c9d6d2;padding-bottom:2pt}
    .mdoc h3{font-size:11pt;margin:10pt 0 4pt;color:#1b1f24}
    .mdoc p{margin:4pt 0}
    .mdoc ul{margin:4pt 0 4pt 18pt;padding:0}
    .mdoc .eq{margin:4pt 0 4pt 14pt;font-family:Cambria,'IBM Plex Serif',Georgia,serif}
    .mdoc table.mt{border-collapse:collapse;margin:4pt 0 8pt;width:100%}
    .mdoc table.mt th,.mdoc table.mt td{border:1px solid #b9c3c0;padding:3pt 6pt;text-align:right;font-size:10pt;vertical-align:top}
    .mdoc table.mt th{background:#e6efec;font-weight:bold}
    .mdoc table.mt .l{text-align:left}
    .mdoc table.sm th,.mdoc table.sm td{font-size:9pt;padding:2pt 4pt}
    .mdoc .mok{color:#1f7a4d}.mdoc .mno{color:#b42318}
    .mdoc .mh{border-bottom:2px solid #1f4e46;padding-bottom:8pt;margin-bottom:6pt}
    .mdoc .mh-t{font-size:18pt;font-weight:bold;color:#1f4e46}
    .mdoc .mh-s{font-size:12pt;margin-bottom:6pt}
    .mdoc td,.mdoc th,.mdoc li{color:#1b1f24}
    .mdoc table.mi td{padding:1pt 10pt 1pt 0;font-size:10pt}
    .mdoc table.mi td:first-child{color:#5b6676}
    .mdoc td .mok,.mdoc .mok{color:#1f7a4d}.mdoc td .mno,.mdoc .mno{color:#b42318}
    .mdoc .mw{color:#9a5b00}
    .mdoc .mf{margin-top:14pt;font-size:9pt;color:#5b6676}
    .mdoc .mfig{margin:8pt 0 2pt;text-align:center}
    .mdoc .mfig svg{width:100%;height:auto;max-width:640px}
    .mdoc .mcap{text-align:center;font-size:9.5pt;color:#5b6676;margin:0 0 10pt}`;

  // arquivo .doc (HTML que o Word abre)
  function wordFile(inner) {
    return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>Memorial de cálculo - Alas</title>
      <!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
      <style>@page{size:21cm 29.7cm;margin:2cm 2cm 2cm 2.5cm}${CSS}</style></head><body><div class="mdoc">${inner}</div></body></html>`;
  }

  /* ----- figuras: SVG -> PNG (para o Word) ----- */
  function svgToPng(svgEl, W, H, scale = 2) {
    return new Promise((res, rej) => {
      const src = new XMLSerializer().serializeToString(svgEl).replace('width="100%" height="100%"', `width="${W}" height="${H}"`);
      const img = new Image();
      img.onload = () => {
        const cv = document.createElement('canvas'); cv.width = W * scale; cv.height = H * scale;
        const cx = cv.getContext('2d'); cx.fillStyle = '#ffffff'; cx.fillRect(0, 0, cv.width, cv.height); cx.drawImage(img, 0, 0, cv.width, cv.height);
        const url = cv.toDataURL('image/png'), bin = atob(url.split(',')[1]), u8 = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        res({ url, bytes: u8, w: W, h: H });
      };
      img.onerror = () => rej(new Error('falha ao gerar a imagem'));
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(src);
    });
  }
  async function figures(root) {
    const figs = [...root.querySelectorAll('.mfig')];
    return Promise.all(figs.map(fg => svgToPng(fg.querySelector('svg'), +fg.dataset.w, +fg.dataset.h)));
  }
  // HTML para colar no Word: figuras como PNG
  async function clipHtml(root) {
    const pngs = await figures(root), clone = root.cloneNode(true);
    [...clone.querySelectorAll('.mfig')].forEach((fg, i) => { fg.innerHTML = `<img src="${pngs[i].url}" width="600" alt="Figura ${i + 1}">`; });
    return wordFile(clone.innerHTML);
  }

  /* ----- .docx a partir do memorial na tela (sem bibliotecas) ----- */
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = u8 => { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  function zip(files) {                                   // ZIP sem compressão (store)
    const enc = new TextEncoder(), parts = [], cen = []; let off = 0;
    files.forEach(([name, text]) => {
      const nb = enc.encode(name), data = typeof text === 'string' ? enc.encode(text) : text, crc = crc32(data);
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(8, 0, true); h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, nb.length, true);
      parts.push(new Uint8Array(h.buffer), nb, data);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, nb.length, true); c.setUint32(42, off, true);
      cen.push(new Uint8Array(c.buffer), nb);
      off += 30 + nb.length + data.length;
    });
    const csize = cen.reduce((a, x) => a + x.length, 0), e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, csize, true); e.setUint32(16, off, true);
    return new Blob(parts.concat(cen, [new Uint8Array(e.buffer)]), { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  }
  const xe = t => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // runs a partir dos nós inline (negrito, sub/sobrescrito, cor de situação)
  function runs(node, fmt = {}) {
    let out = '';
    node.childNodes.forEach(n => {
      if (n.nodeType === 3) {
        const t = n.textContent.replace(/\s+/g, ' '); if (!t) return;
        let pr = '';
        if (fmt.b) pr += '<w:b/>'; if (fmt.color) pr += `<w:color w:val="${fmt.color}"/>`; if (fmt.sz) pr += `<w:sz w:val="${fmt.sz}"/>`; if (fmt.va) pr += `<w:vertAlign w:val="${fmt.va}"/>`; if (fmt.font) pr += `<w:rFonts w:ascii="${fmt.font}" w:hAnsi="${fmt.font}"/>`;
        out += `<w:r>${pr ? `<w:rPr>${pr}</w:rPr>` : ''}<w:t xml:space="preserve">${xe(t)}</w:t></w:r>`;
      } else if (n.nodeType === 1) {
        const tg = n.tagName.toLowerCase(), f2 = Object.assign({}, fmt);
        if (tg === 'b' || tg === 'strong') f2.b = true;
        if (tg === 'sub') f2.va = 'subscript'; if (tg === 'sup') f2.va = 'superscript';
        if (n.classList.contains('mok')) { f2.color = '1F7A4D'; f2.b = true; } if (n.classList.contains('mno')) { f2.color = 'B42318'; f2.b = true; }
        if (tg === 'br') { out += '<w:r><w:br/></w:r>'; return; }
        out += runs(n, f2);
      }
    });
    return out;
  }
  const para = (inner, o = {}) => `<w:p><w:pPr>${o.style ? `<w:pStyle w:val="${o.style}"/>` : ''}${o.ind ? `<w:ind w:left="${o.ind}"/>` : ''}${o.jc ? `<w:jc w:val="${o.jc}"/>` : ''}${o.sp ? `<w:spacing w:before="${o.sp[0]}" w:after="${o.sp[1]}"/>` : ''}</w:pPr>${inner}</w:p>`;
  function table(t) {
    const small = t.classList.contains('sm'), info = t.classList.contains('mi'), sz = small ? 16 : 19;
    const rows = [...t.querySelectorAll('tr')];
    const ncol = Math.max(...rows.map(r => r.children.length));
    const bd = info ? 'none' : 'single';
    let x = `<w:tbl><w:tblPr><w:tblW w:w="${info ? 0 : 5000}" w:type="${info ? 'auto' : 'pct'}"/><w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(b => `<w:${b} w:val="${bd}" w:sz="4" w:color="B9C3C0"/>`).join('')}</w:tblBorders><w:tblCellMar><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${'<w:gridCol/>'.repeat(ncol)}</w:tblGrid>`;
    rows.forEach(r => {
      const head = r.parentElement.tagName.toLowerCase() === 'thead';
      x += `<w:tr>${head ? '<w:trPr><w:tblHeader/></w:trPr>' : ''}`;
      [...r.children].forEach(c => {
        const left = info || c.classList.contains('l');
        x += `<w:tc><w:tcPr>${head ? '<w:shd w:val="clear" w:color="auto" w:fill="E6EFEC"/>' : ''}</w:tcPr>${para(runs(c, { b: head, sz, color: info && c === r.children[0] ? '5B6676' : null }), { jc: left ? 'left' : 'right', sp: [20, 20] })}</w:tc>`;
      });
      x += '</w:tr>';
    });
    return x + '</w:tbl>' + para('', { sp: [0, 60] });
  }
  function body(root, imgs) {
    let x = '', fi = 0;
    const walk = el => [...el.children].forEach(n => {
      const tg = n.tagName.toLowerCase();
      if (n.classList.contains('mfig')) { const im = imgs[fi++]; if (im) { const cx = 5760000, cy = Math.round(cx * im.h / im.w), id = fi; x += `<w:p><w:pPr><w:keepNext/><w:jc w:val="center"/><w:spacing w:before="120" w:after="40"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${id}" name="Figura ${id}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${id}" name="figura${id}.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdImg${id}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`; } }
      else if (n.classList.contains('mcap')) x += para(runs(n, { sz: 19, color: '5B6676' }), { jc: 'center', sp: [0, 200] });
      else if (n.classList.contains('mh-t')) x += para(runs(n, { b: true, sz: 36, color: '1F4E46' }), { sp: [0, 40] });
      else if (n.classList.contains('mh-s')) x += para(runs(n, { sz: 24 }), { sp: [0, 120] });
      else if (n.classList.contains('mh')) walk(n);
      else if (tg === 'h2') x += para(runs(n), { style: 'Ttulo1' });
      else if (tg === 'h3') x += para(runs(n), { style: 'Ttulo2' });
      else if (tg === 'table') x += table(n);
      else if (tg === 'ul') n.querySelectorAll('li').forEach(li => { x += para('<w:r><w:t xml:space="preserve">•  </w:t></w:r>' + runs(li), { ind: 360 }); });
      else if (n.classList.contains('eq')) x += para(runs(n, { font: 'Cambria' }), { ind: 360 });
      else if (n.classList.contains('mf')) x += para(runs(n, { sz: 18, color: '5B6676' }), { sp: [240, 0] });
      else if (n.classList.contains('mw')) x += para(runs(n, { color: '9A5B00' }));
      else if (tg === 'p') x += para(runs(n));
      else walk(n);
    });
    walk(root);
    return x;
  }
  async function docx(root) {
    const imgs = await figures(root);
    const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"';
    const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${W}><w:body>${body(root, imgs)}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1417" w:header="709" w:footer="709" w:gutter="0"/></w:sectPr></w:body></w:document>`;
    const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles ${W}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:lang w:val="pt-BR"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="80" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
      <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
      <w:style w:type="paragraph" w:styleId="Ttulo1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="320" w:after="120"/><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="2" w:color="C9D6D2"/></w:pBdr><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:color w:val="1F4E46"/><w:sz w:val="26"/></w:rPr></w:style>
      <w:style w:type="paragraph" w:styleId="Ttulo2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="200" w:after="80"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="22"/></w:rPr></w:style></w:styles>`;
    return zip([
      ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>'],
      ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'],
      ['word/_rels/document.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' + imgs.map((im, i) => `<Relationship Id="rIdImg${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/figura${i + 1}.png"/>`).join('') + '</Relationships>'],
      ['word/document.xml', doc],
      ['word/styles.xml', styles]
    ].concat(imgs.map((im, i) => [`word/media/figura${i + 1}.png`, im.bytes])));
  }

  return { build, CSS, wordFile, docx, clipHtml };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = { AlasMem };
