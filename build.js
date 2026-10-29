// Monta o Alas num único arquivo HTML, sem dependências.
// Uso: node build.js [versão]      ex.: node build.js 1.7
//   Gera index.html e, se a versão for informada, versoes/alas-v<versão>.html
const fs = require('fs'), path = require('path');
const dir = __dirname, rd = f => fs.readFileSync(path.join(dir, f), 'utf8');
let html = rd('app/app-template.html');
[['DESENHO', 'app/desenho'], ['ESFORCOS', 'app/esforcos'], ['ARMADURAS', 'app/armaduras'], ['MOTOR', 'motor/motor-mef'], ['PAREDES', 'app/paredes-mef'], ['MEMORIAL', 'app/memorial']]
  .forEach(([k, f]) => { html = html.replace(`/*__${k}__*/`, () => rd(`${f}.js`)); });
const ver = process.argv[2];
if (ver) html = html.replace(/v\d+\.\d+ · medidas em cm/, `v${ver} · medidas em cm`);
fs.writeFileSync(path.join(dir, 'index.html'), html);
if (ver) fs.writeFileSync(path.join(dir, 'versoes', `alas-v${ver}.html`), html);
console.log('index.html' + (ver ? ` e versoes/alas-v${ver}.html` : '') + ` (${(html.length / 1024).toFixed(0)} kB)`);
