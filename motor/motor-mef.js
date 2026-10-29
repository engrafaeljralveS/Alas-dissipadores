/* =====================================================================
   Alas · Motor de elementos finitos de casca
   Extraído do app "Flutuação em Caixas" v3.10 (FEengine), sem nada
   específico da caixa: serve para qualquer estrutura de placas e cascas
   planas montada com elementos retangulares.

   Elemento: retangular de 4 nós, 6 graus de liberdade por nó
     (ux, uy, uz, θx, θy, θz globais)
     - membrana Q4 com modos incompatíveis (condensação estática)
     - placa de Mindlin MITC4 (sem travamento por cisalhamento)
     - rigidez fictícia de giro no plano (1e-3 · D)
   Solver: numeração Cuthill-McKee reversa + skyline LDLᵀ.
   Molas: lineares ou só de compressão (iteração liga/desliga).
   Esforços: valores nos pontos de Gauss e recuperação nodal SPR
     (Zienkiewicz-Zhu), por superfície.
   Unidades: as que você usar, de forma coerente (o app usa kN e m).

   Funções puras, sem DOM. MotorMEF é autocontida: MotorMEF.toString()
   pode ser levada para um Web Worker, como o app de flutuação faz.
   ===================================================================== */
function MotorMEF() {
  const G2 = [-1 / Math.sqrt(3), 1 / Math.sqrt(3)];
  const NODE = [[-1, -1], [1, -1], [1, 1], [-1, 1]];

  /* ----- eixos locais -----
     Cada elemento usa a matriz T da sua superfície (mesh.surf[e.s].T) ou
     a sua própria (e.T). As linhas de T são os eixos locais x', y', z'
     escritos em coordenadas globais; z' é a normal da casca. */
  const axesOf = (mesh, e) => e.T || mesh.surf[e.s].T;

  /* ----- matriz do elemento retangular (cache por dimensões) ----- */
  const cache = new Map();
  function elemMats(a, b, t, E, nu) {
    const key = [a.toFixed(6), b.toFixed(6), t.toFixed(5), E, nu].join('|');
    if (cache.has(key)) return cache.get(key);
    const ha = a / 2, hb = b / 2, dJ = ha * hb;
    const Am = E * t / (1 - nu * nu), Db = E * t * t * t / (12 * (1 - nu * nu)), Ds = 5 / 6 * E / (2 * (1 + nu)) * t;
    const C = [[1, nu, 0], [nu, 1, 0], [0, 0, (1 - nu) / 2]];
    const N = (i, x, y) => 0.25 * (1 + NODE[i][0] * x) * (1 + NODE[i][1] * y);
    const Nx = (i, x, y) => 0.25 * NODE[i][0] * (1 + NODE[i][1] * y) / ha;
    const Ny = (i, x, y) => 0.25 * NODE[i][1] * (1 + NODE[i][0] * x) / hb;
    const zeros = (r, c) => Array.from({ length: r }, () => new Float64Array(c));
    const K = zeros(24, 24);
    // ---- membrana: nós (u,v) -> 8 gl; modos incompatíveis 4 gl
    const Kcc = zeros(8, 8), Kci = zeros(8, 4), Kii = zeros(4, 4);
    const BmAt = (x, y) => {
      const Bc = zeros(3, 8), Bi = zeros(3, 4);
      for (let i = 0; i < 4; i++) { const dx = Nx(i, x, y), dy = Ny(i, x, y); Bc[0][2 * i] = dx; Bc[1][2 * i + 1] = dy; Bc[2][2 * i] = dy; Bc[2][2 * i + 1] = dx; }
      Bi[0][0] = -2 * x / ha; Bi[1][3] = -2 * y / hb; Bi[2][1] = -2 * y / hb; Bi[2][2] = -2 * x / ha;
      return { Bc, Bi };
    };
    const addBtDB = (Kout, B1, B2, D, f) => {
      const r1 = B1[0].length, r2 = B2[0].length;
      for (let p = 0; p < r1; p++) for (let q = 0; q < r2; q++) {
        let s = 0;
        for (let i = 0; i < 3; i++) { if (!B1[i][p]) continue; for (let j = 0; j < 3; j++) s += B1[i][p] * D[i][j] * B2[j][q]; }
        Kout[p][q] += s * f;
      }
    };
    const Dm = C.map(r => r.map(v => v * Am)), Dbm = C.map(r => r.map(v => v * Db));
    G2.forEach(x => G2.forEach(y => {
      const { Bc, Bi } = BmAt(x, y);
      addBtDB(Kcc, Bc, Bc, Dm, dJ); addBtDB(Kci, Bc, Bi, Dm, dJ); addBtDB(Kii, Bi, Bi, Dm, dJ);
    }));
    // condensação estática: K = Kcc − Kci Kii⁻¹ Kic ;  R = Kii⁻¹ Kic (para recuperar os modos internos)
    const inv = invert(Kii.map(r => Array.from(r)));
    const R = zeros(4, 8);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 8; j++) { let s = 0; for (let k = 0; k < 4; k++) s += inv[i][k] * Kci[j][k]; R[i][j] = s; }
    const mDof = i => [6 * i, 6 * i + 1];
    for (let p = 0; p < 8; p++) for (let q = 0; q < 8; q++) {
      let s = Kcc[p][q]; for (let k = 0; k < 4; k++) s -= Kci[p][k] * R[k][q];
      K[mDof(p >> 1)[p & 1]][mDof(q >> 1)[q & 1]] += s;
    }
    // ---- placa MITC4: gl locais (w, φx, φy); φx = θy', φy = −θx'
    // B de flexão: κx = Σ Nx φx ; κy = Σ Ny φy ; κxy = Σ (Ny φx + Nx φy)   (colunas: w, φx, φy por nó)
    const BbAt = (x, y) => { const B = zeros(3, 12); for (let i = 0; i < 4; i++) { const dx = Nx(i, x, y), dy = Ny(i, x, y); B[0][3 * i + 1] = dx; B[1][3 * i + 2] = dy; B[2][3 * i + 1] = dy; B[2][3 * i + 2] = dx; } return B; };
    // cisalhamento direto: γxz = ∂w/∂x + φx ; γyz = ∂w/∂y + φy, interpolado nos pontos A, B, C, D (MITC4)
    const gxzAt = (x, y) => { const r = new Float64Array(12); for (let i = 0; i < 4; i++) { r[3 * i] = Nx(i, x, y); r[3 * i + 1] = N(i, x, y); } return r; };
    const gyzAt = (x, y) => { const r = new Float64Array(12); for (let i = 0; i < 4; i++) { r[3 * i] = Ny(i, x, y); r[3 * i + 2] = N(i, x, y); } return r; };
    const gA = gxzAt(0, -1), gC = gxzAt(0, 1), gD = gyzAt(-1, 0), gB = gyzAt(1, 0);
    const BsAt = (x, y) => { const B = zeros(2, 12); for (let k = 0; k < 12; k++) { B[0][k] = 0.5 * (1 - y) * gA[k] + 0.5 * (1 + y) * gC[k]; B[1][k] = 0.5 * (1 - x) * gD[k] + 0.5 * (1 + x) * gB[k]; } return B; };
    const Kp = zeros(12, 12);
    G2.forEach(x => G2.forEach(y => {
      const Bb = BbAt(x, y), Bs = BsAt(x, y);
      addBtDB(Kp, Bb, Bb, Dbm, dJ);
      for (let p = 0; p < 12; p++) for (let q = 0; q < 12; q++) Kp[p][q] += Ds * (Bs[0][p] * Bs[0][q] + Bs[1][p] * Bs[1][q]) * dJ;
    }));
    // (w, φx, φy) -> (w, θx', θy'):  φx = θy', φy = −θx'
    const map = (k) => { const n = Math.floor(k / 3), c = k % 3; return c === 0 ? [6 * n + 2, 1] : c === 1 ? [6 * n + 4, 1] : [6 * n + 3, -1]; };
    for (let p = 0; p < 12; p++) for (let q = 0; q < 12; q++) { const [ip, sp] = map(p), [iq, sq] = map(q); K[ip][iq] += sp * sq * Kp[p][q]; }
    // giro no plano (fictício)
    const kd = 1e-3 * Db;
    for (let i = 0; i < 4; i++) K[6 * i + 5][6 * i + 5] += kd;
    // ---- resultantes nos 4 pontos de Gauss, como funções lineares dos 24 gl locais
    // ordem: [M1, M2, M12, Q1, Q2, N1, N2, N12]  (1 = x', 2 = y')
    const S = [];
    const gp = [[G2[0], G2[0]], [G2[1], G2[0]], [G2[1], G2[1]], [G2[0], G2[1]]];
    gp.forEach(([x, y]) => {
      const rows = Array.from({ length: 8 }, () => new Float64Array(24));
      const Bb = BbAt(x, y), Bs = BsAt(x, y);
      for (let k = 0; k < 12; k++) {
        const [ik, sk] = map(k);
        for (let r = 0; r < 3; r++) { let s = 0; for (let j = 0; j < 3; j++) s += Dbm[r][j] * Bb[j][k]; rows[r][ik] += sk * s; }
        rows[3][ik] += sk * Ds * Bs[0][k]; rows[4][ik] += sk * Ds * Bs[1][k];
      }
      const { Bc, Bi } = BmAt(x, y);
      // ε = Bc uc + Bi a ,  a = −R uc
      const Beff = zeros(3, 8);
      for (let r = 0; r < 3; r++) for (let q = 0; q < 8; q++) { let s = Bc[r][q]; for (let k = 0; k < 4; k++) s -= Bi[r][k] * R[k][q]; Beff[r][q] = s; }
      for (let r = 0; r < 3; r++) for (let q = 0; q < 8; q++) { let s = 0; for (let j = 0; j < 3; j++) s += Dm[r][j] * Beff[j][q]; rows[5 + r][mDof(q >> 1)[q & 1]] += s; }
      S.push(rows);
    });
    // extrapolação Gauss -> nós
    const s3 = Math.sqrt(3), X = NODE.map(([xi, yi]) => gp.map(([xg, yg]) => 0.25 * (1 + xi * s3 * Math.sign(xg)) * (1 + yi * s3 * Math.sign(yg))));
    const out = { K, S, X, ha, hb, dJ, N, Db };
    cache.set(key, out);
    return out;
  }

  function invert(A) {
    const n = A.length, M = A.map((r, i) => r.concat(Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))));
    for (let c = 0; c < n; c++) {
      let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      [M[c], M[p]] = [M[p], M[c]];
      const d = M[c][c]; for (let j = 0; j < 2 * n; j++) M[c][j] /= d;
      for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c]; if (f) for (let j = 0; j < 2 * n; j++) M[r][j] -= f * M[c][j]; }
    }
    return M.map(r => r.slice(n));
  }

  /* ----- malha ----- */
  // Divide o intervalo dos pontos-chave em trechos de passo ≤ h, passando por todos eles.
  // zones: [[a, b, hf]] = faixas com passo menor (refino junto às ligações)
  function axis(keys, h, zones = []) {
    keys = keys.slice();
    const lo = Math.min(...keys), hi = Math.max(...keys);
    zones.forEach(([a, b]) => { if (a > lo && a < hi) keys.push(a); if (b > lo && b < hi) keys.push(b); });
    const k = [...new Set(keys.map(v => +v.toFixed(6)))].sort((a, b) => a - b);
    const out = [k[0]];
    for (let i = 1; i < k.length; i++) {
      const L = k[i] - k[i - 1]; if (L < 1e-6) continue;
      const mid = (k[i] + k[i - 1]) / 2, z = zones.find(([a, b]) => mid > a && mid < b), hs = z ? Math.min(h, z[2]) : h;
      const n = Math.max(1, Math.round(L / hs)); for (let j = 1; j <= n; j++) out.push(k[i - 1] + L * j / n);
    }
    return out;
  }

  // Montador de malha: nós únicos por coordenada (as superfícies se ligam nos nós comuns)
  // surf: { nome: { T } } com os eixos locais de cada superfície
  function createMesh(surf) {
    const nodes = [], keyMap = new Map(), elems = [];
    const node = (x, y, z) => { const k = x.toFixed(5) + ',' + y.toFixed(5) + ',' + z.toFixed(5); let id = keyMap.get(k); if (id == null) { id = nodes.length; nodes.push([x, y, z]); keyMap.set(k, id); } return id; };
    // Superfície em grade: us, vs = divisões nas direções locais x', y'; P(u, v) -> [x, y, z] global.
    // Nós em ordem anti-horária em torno de z'. keep(uc, vc) descarta elementos (aberturas).
    // extra(nome, uc, vc) -> propriedades a mais do elemento (ex.: { Ef: 1e-4 } para zerar a rigidez).
    const addSurface = (name, us, vs, P, t, keep, extra) => {
      for (let i = 0; i < us.length - 1; i++) for (let j = 0; j < vs.length - 1; j++) {
        const uc = (us[i] + us[i + 1]) / 2, vc = (vs[j] + vs[j + 1]) / 2;
        if (keep && !keep(uc, vc)) continue;
        const n = [node(...P(us[i], vs[j])), node(...P(us[i + 1], vs[j])), node(...P(us[i + 1], vs[j + 1])), node(...P(us[i], vs[j + 1]))];
        const e = { s: name, n, a: us[i + 1] - us[i], b: vs[j + 1] - vs[j], t, c: P(uc, vc), Ef: 1 };
        if (extra) Object.assign(e, extra(name, uc, vc));
        elems.push(e);
      }
    };
    return { nodes, elems, surf, node, addSurface };
  }

  /* ----- numeração (Cuthill-McKee reverso) e solver skyline LDLᵀ ----- */
  function rcm(nn, elems) {
    const adj = Array.from({ length: nn }, () => new Set());
    elems.forEach(e => e.n.forEach(a => e.n.forEach(b => { if (a !== b) adj[a].add(b); })));
    const deg = adj.map(s => s.size), seen = new Uint8Array(nn), order = [];
    const bfs = start => { const lv = new Int32Array(nn).fill(-1); lv[start] = 0; const q = [start]; for (let i = 0; i < q.length; i++) adj[q[i]].forEach(v => { if (lv[v] < 0) { lv[v] = lv[q[i]] + 1; q.push(v); } }); return { q, lv }; };
    for (let s0 = 0; s0 < nn; s0++) {
      if (seen[s0]) continue;
      let start = s0;
      for (let it = 0; it < 3; it++) { const { q, lv } = bfs(start); const far = q[q.length - 1]; let best = far; q.forEach(v => { if (lv[v] === lv[far] && deg[v] < deg[best]) best = v; }); start = best; }
      const q = [start]; seen[start] = 1;
      for (let i = 0; i < q.length; i++) {
        const nb = [...adj[q[i]]].filter(v => !seen[v]).sort((a, b) => deg[a] - deg[b]);
        nb.forEach(v => { seen[v] = 1; q.push(v); });
      }
      order.push(...q);
    }
    return order.reverse();
  }

  // Fatora a matriz skyline em LDLᵀ no próprio vetor. false se não for positiva definida.
  function factor(a, maxa, n) {
    for (let N = 0; N < n; N++) {
      const kn = maxa[N], kl = kn + 1, ku = maxa[N + 1] - 1, kh = ku - kl;
      if (kh > 0) {
        let k = N - kh, ic = 0, klt = ku;
        for (let j = 1; j <= kh; j++) {
          ic++; klt--;
          const ki = maxa[k], nd = maxa[k + 1] - ki - 1;
          if (nd > 0) { const kk = Math.min(ic, nd); let c = 0; for (let l = 1; l <= kk; l++) c += a[ki + l] * a[klt + l]; a[klt] -= c; }
          k++;
        }
      }
      if (kh >= 0) {
        let k = N, b = 0;
        for (let kk = kl; kk <= ku; kk++) { k--; const ki = maxa[k], c = a[kk] / a[ki]; b += c * a[kk]; a[kk] = c; }
        a[kn] -= b;
      }
      if (!(a[kn] > 0)) return false;
    }
    return true;
  }
  // Resolve com a matriz já fatorada (sobrescreve v)
  function backsub(a, maxa, n, v) {
    for (let N = 0; N < n; N++) { const kl = maxa[N] + 1, ku = maxa[N + 1] - 1; if (ku >= kl) { let k = N, c = 0; for (let kk = kl; kk <= ku; kk++) { k--; c += a[kk] * v[k]; } v[N] -= c; } }
    for (let N = 0; N < n; N++) v[N] /= a[maxa[N]];
    for (let N = n - 1; N > 0; N--) { const kl = maxa[N] + 1, ku = maxa[N + 1] - 1; if (ku >= kl) { let k = N; for (let kk = kl; kk <= ku; kk++) { k--; v[k] -= a[kk] * v[N]; } } }
    return v;
  }

  /* ----- montagem ----- */
  // fixedDof(nó, gl) -> true para gl restrito (0..5 = ux, uy, uz, θx, θy, θz).
  // Devolve eq (gl -> equação, −1 se restrito), n equações e a matriz skyline a0.
  // E de cada elemento = mat.E × e.Ef (Ef = 1 por padrão).
  function prepare(mesh, mat, fixedDof) {
    const nn = mesh.nodes.length, order = rcm(nn, mesh.elems);
    const eq = new Int32Array(6 * nn).fill(-1);
    let n = 0;
    order.forEach(nd => { for (let d = 0; d < 6; d++) if (!fixedDof(nd, d)) eq[6 * nd + d] = n++; });
    const top = new Int32Array(n); for (let i = 0; i < n; i++) top[i] = i;
    mesh.elems.forEach(e => {
      const eqs = []; e.n.forEach(nd => { for (let d = 0; d < 6; d++) { const q = eq[6 * nd + d]; if (q >= 0) eqs.push(q); } });
      const mn = Math.min(...eqs); eqs.forEach(q => { if (mn < top[q]) top[q] = mn; });
    });
    const maxa = new Int32Array(n + 1); for (let j = 0; j < n; j++) maxa[j + 1] = maxa[j] + (j - top[j] + 1);
    const a0 = new Float64Array(maxa[n]);
    mesh.elems.forEach(e => {
      const M = elemMats(e.a, e.b, e.t, mat.E * (e.Ef || 1), mat.nu);
      const Kg = globalK(M.K, axesOf(mesh, e));
      const idx = []; e.n.forEach(nd => { for (let d = 0; d < 6; d++) idx.push(eq[6 * nd + d]); });
      for (let p = 0; p < 24; p++) { const i = idx[p]; if (i < 0) continue; for (let q = 0; q < 24; q++) { const j = idx[q]; if (j < 0 || i > j) continue; a0[maxa[j] + (j - i)] += Kg[p][q]; } }
    });
    return { eq, n, maxa, a0, nnz: maxa[n], nn };
  }
  function globalK(K, T) {
    // R (24×24) bloco-diagonal com T 3×3; Kg = Rᵀ K R
    const Kg = Array.from({ length: 24 }, () => new Float64Array(24));
    const tmp = Array.from({ length: 24 }, () => new Float64Array(24));
    for (let p = 0; p < 24; p++) for (let q = 0; q < 24; q++) {        // tmp = K R
      const bq = q - q % 3; let s = 0; for (let k = 0; k < 3; k++) s += K[p][bq + k] * T[k][q % 3]; tmp[p][q] = s;
    }
    for (let p = 0; p < 24; p++) for (let q = 0; q < 24; q++) {        // Kg = Rᵀ tmp
      const bp = p - p % 3; let s = 0; for (let k = 0; k < 3; k++) s += T[k][p % 3] * tmp[bp + k][q]; Kg[p][q] = s;
    }
    return Kg;
  }

  /* ----- cargas ----- */
  // Força por área: fn(x, y, z, elemento) -> [fx, fy, fz] global (ou null). Integração 2×2.
  function areaLoad(mesh, eq, n, fn) {
    const F = new Float64Array(n);
    mesh.elems.forEach(e => {
      const M = elemMats(e.a, e.b, e.t, 1, 0.2);
      const P = e.n.map(i => mesh.nodes[i]);
      G2.forEach(x => G2.forEach(y => {
        const Nv = [0, 1, 2, 3].map(i => M.N(i, x, y));
        const X = [0, 1, 2].map(c => Nv.reduce((s, v, i) => s + v * P[i][c], 0));
        const f = fn(X[0], X[1], X[2], e); if (!f) return;
        for (let i = 0; i < 4; i++) for (let c = 0; c < 3; c++) { const q = eq[6 * e.n[i] + c]; if (q >= 0) F[q] += Nv[i] * f[c] * M.dJ; }
      }));
    });
    return F;
  }
  // Força por comprimento "vec" [fx, fy, fz] ao longo dos nós em que pred(ponto) é verdadeiro,
  // ordenados pela coordenada "along" (0 = x, 1 = y, 2 = z); cada nó recebe metade dos trechos vizinhos.
  function lineLoad(mesh, eq, F, pred, along, vec) {
    const nn = mesh.nodes.length, ids = []; for (let i = 0; i < nn; i++) if (pred(mesh.nodes[i])) ids.push(i);
    ids.sort((a, b) => mesh.nodes[a][along] - mesh.nodes[b][along]);
    ids.forEach((id, k) => {
      const c = mesh.nodes[id][along], lo = k > 0 ? (c - mesh.nodes[ids[k - 1]][along]) / 2 : 0, hi = k < ids.length - 1 ? (mesh.nodes[ids[k + 1]][along] - c) / 2 : 0;
      for (let d = 0; d < 3; d++) { const q = eq[6 * id + d]; if (q >= 0 && vec[d]) F[q] += vec[d] * (lo + hi); }
    });
    return F;
  }
  // Força ou momento concentrado no gl "dof" (0..5) do nó
  function nodalLoad(eq, F, node, dof, value) { const q = eq[6 * node + dof]; if (q >= 0) F[q] += value; return F; }
  // Soma das cargas no gl "dof" (ex.: 2 = resultante vertical)
  function sumLoad(eq, nn, F, dof) { let s = 0; for (let i = 0; i < nn; i++) { const q = eq[6 * i + dof]; if (q >= 0) s += F[q]; } return s; }

  // Área de influência de cada nó (¼ da área de cada elemento) nos elementos em que filter(e) é verdadeiro
  function tributary(mesh, filter) {
    const trib = new Float64Array(mesh.nodes.length);
    mesh.elems.forEach(e => { if (!filter || filter(e)) e.n.forEach(i => { trib[i] += e.a * e.b / 4; }); });
    return trib;
  }

  /* ----- solução com molas -----
     springs: [{ node, dof, k, compOnly, comp }]
       k        rigidez da mola (força por deslocamento)
       compOnly só compressão: a mola é desligada se tracionar, e o cálculo se repete
       comp     sentido do deslocamento que comprime a mola (−1 padrão: mola de apoio sob a base, uz ≤ 0)
     F:      vetores de carga básicos
     combos: [{ f: [coeficientes de cada F], lin: true para manter todas as molas ligadas }]
     Devolve, por combinação: U, active (por mola), force (por mola, positiva comprimindo),
     lifted (molas desligadas), floated (nenhuma mola ativa ou sistema instável), it. */
  function solveSprings(sys, springs, F, combos, opt = {}) {
    const { eq, n, maxa, a0 } = sys, maxIt = opt.maxIt || 25, ns = springs.length;
    const eqOf = springs.map(s => eq[6 * s.node + s.dof]);
    const cmp = springs.map(s => s.comp == null ? -1 : s.comp);
    const solveWith = (active, rhsList) => {
      const a = new Float64Array(a0);
      for (let j = 0; j < ns; j++) if (active[j]) { const q = eqOf[j]; if (q >= 0) a[maxa[q]] += springs[j].k; }
      if (!factor(a, maxa, n)) return null;
      return rhsList.map(r => backsub(a, maxa, n, Float64Array.from(r)));
    };
    const uOf = (U, j) => { const q = eqOf[j]; return q >= 0 ? U[q] : 0; };
    const allOn = new Uint8Array(ns).fill(1);
    let nFact = 1;
    const base = solveWith(allOn, F);
    if (!base) return { error: 'A matriz de rigidez não é positiva definida. Confira a geometria, os apoios e as molas.' };
    const solveCombo = cb => {
      let U = new Float64Array(n); cb.f.forEach((c, k) => { if (c) for (let i = 0; i < n; i++) U[i] += c * base[k][i]; });
      let active = allOn, it = 0, lifted = 0;
      const anyNonlin = springs.some(s => s.compOnly);
      if (!cb.lin && anyNonlin) {
        for (; it < maxIt; it++) {
          const next = new Uint8Array(ns); let changed = false, any = false;
          for (let j = 0; j < ns; j++) { next[j] = !springs[j].compOnly || cmp[j] * uOf(U, j) >= 0 ? 1 : 0; if (next[j]) any = true; if (next[j] !== active[j]) changed = true; }
          if (!changed) break;
          if (!any) return { U, active: next, floated: true, it };
          const Fc = new Float64Array(n); cb.f.forEach((c, k) => { if (c) for (let i = 0; i < n; i++) Fc[i] += c * F[k][i]; });
          const r = solveWith(next, [Fc]); nFact++;
          if (!r) return { U, active: next, floated: true, it };
          U = r[0]; active = next;
        }
        for (let j = 0; j < ns; j++) if (!active[j]) lifted++;
      }
      return { U, active, it, lifted, floated: false };
    };
    const results = combos.map(cb => {
      const r = solveCombo(cb), force = new Float64Array(ns);
      for (let j = 0; j < ns; j++) if (r.active[j]) force[j] = Math.max(0, cmp[j] * springs[j].k * uOf(r.U, j));
      r.force = force;
      return r;
    });
    return { results, nFact };
  }

  /* ----- deslocamentos ----- */
  // Translações nodais [ux, uy, uz] por nó (Float64Array de 3·nn)
  function displacements(eq, nn, U) { const d = new Float64Array(nn * 3); for (let i = 0; i < nn; i++) for (let c = 0; c < 3; c++) { const q = eq[6 * i + c]; d[3 * i + c] = q >= 0 ? U[q] : 0; } return d; }

  /* ----- resultantes: pontos de Gauss e recuperação nodal (SPR, Zienkiewicz-Zhu) ----- */
  // Por elemento, nos 4 pontos de Gauss: [M1, M2, M12, Q1, Q2, N1, N2, N12] nos eixos locais
  function gaussValues(mesh, eq, U, mat) {
    return mesh.elems.map(e => {
      const M = elemMats(e.a, e.b, e.t, mat.E * (e.Ef || 1), mat.nu), T = axesOf(mesh, e), ul = new Float64Array(24);
      e.n.forEach((nd, k) => { for (let blk = 0; blk < 2; blk++) { const gv = [0, 1, 2].map(c => { const q = eq[6 * nd + 3 * blk + c]; return q >= 0 ? U[q] : 0; }); for (let r = 0; r < 3; r++) ul[6 * k + 3 * blk + r] = T[r][0] * gv[0] + T[r][1] * gv[1] + T[r][2] * gv[2]; } });
      return M.S.map(rows => rows.map(row => { let s = 0; for (let k = 0; k < 24; k++) s += row[k] * ul[k]; return s; }));
    });
  }
  // Para cada superfície: lista de nós e, para cada nó, pesos sobre os valores de Gauss (elemento, ponto).
  // A recuperação é feita por superfície (não mistura parede com laje). Calcule uma vez por malha.
  function recovery(mesh) {
    const surfNodes = {}, surfIdx = {}, W = {};
    const Tof = e => axesOf(mesh, e);
    const gpPos = mesh.elems.map(e => {
      const M = elemMats(e.a, e.b, e.t, 1, 0.2), T = Tof(e), P = e.n.map(i => mesh.nodes[i]);
      return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => {
        const x = sx / Math.sqrt(3), y = sy / Math.sqrt(3), Nv = [0, 1, 2, 3].map(i => M.N(i, x, y));
        const X = [0, 1, 2].map(c => Nv.reduce((s, v, i) => s + v * P[i][c], 0));
        return [T[0][0] * X[0] + T[0][1] * X[1] + T[0][2] * X[2], T[1][0] * X[0] + T[1][1] * X[1] + T[1][2] * X[2]];
      });
    });
    // superfícies na ordem em que aparecem na malha
    const names = []; mesh.elems.forEach(e => { if (!names.includes(e.s)) names.push(e.s); });
    names.forEach(s => {
      const nodeEl = new Map();
      let Ts = null;
      mesh.elems.forEach((e, ei) => { if (e.s !== s) return; if (!Ts) Ts = Tof(e); e.n.forEach((i, k) => { if (!nodeEl.has(i)) nodeEl.set(i, []); nodeEl.get(i).push([ei, k]); }); });
      const uv = i => { const T = Ts, X = mesh.nodes[i]; return [T[0][0] * X[0] + T[0][1] * X[1] + T[0][2] * X[2], T[1][0] * X[0] + T[1][1] * X[1] + T[1][2] * X[2]]; };
      const list = [...nodeEl.keys()]; surfNodes[s] = list; surfIdx[s] = new Map(list.map((i, j) => [i, j]));
      // polinômio do patch de cada nó interior (4 elementos): p = [1, u, v, uv] centrado no nó
      const patch = new Map();
      nodeEl.forEach((els, i) => {
        if (els.length !== 4) return;
        const [u0, v0] = uv(i), pts = [];
        els.forEach(([ei]) => gpPos[ei].forEach((q, g) => pts.push([ei, g, q[0] - u0, q[1] - v0])));
        const A = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
        pts.forEach(([, , du, dv]) => { const p = [1, du, dv, du * dv]; for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) A[r][c] += p[r] * p[c]; });
        patch.set(i, { u0, v0, Ai: invert(A), pts });
      });
      const evalPatch = (pt, u, v) => { const p = [1, u - pt.u0, v - pt.v0, (u - pt.u0) * (v - pt.v0)], c = [0, 1, 2, 3].map(r => pt.Ai[r].reduce((s2, x, k) => s2 + x * p[k], 0)); return pt.pts.map(([ei, g, du, dv]) => [ei, g, c[0] + c[1] * du + c[2] * dv + c[3] * du * dv]); };
      W[s] = list.map(i => {
        const [u, v] = uv(i);
        if (patch.has(i)) return evalPatch(patch.get(i), u, v);
        // nó de borda: média das extrapolações dos patches vizinhos
        const nb = new Set(); nodeEl.get(i).forEach(([ei]) => mesh.elems[ei].n.forEach(j => { if (patch.has(j)) nb.add(j); }));
        if (nb.size) { const acc = []; nb.forEach(j => evalPatch(patch.get(j), u, v).forEach(([ei, g, w]) => acc.push([ei, g, w / nb.size]))); return acc; }
        // sem patch interior: extrapolação dentro dos próprios elementos
        const els = nodeEl.get(i), acc = [];
        els.forEach(([ei, k]) => { const M = elemMats(mesh.elems[ei].a, mesh.elems[ei].b, mesh.elems[ei].t, 1, 0.2); for (let g = 0; g < 4; g++) acc.push([ei, g, M.X[k][g] / els.length]); });
        return acc;
      });
    });
    return { surfNodes, surfIdx, W };
  }
  // Resultantes nodais por superfície: out[s][8·j + r], j = índice do nó em surfNodes[s]
  function nodal(rec, gpv) {
    const out = {};
    Object.keys(rec.W).forEach(s => {
      const W = rec.W[s], a = new Float64Array(W.length * 8);
      W.forEach((ws, j) => ws.forEach(([ei, g, w]) => { const v = gpv[ei][g]; for (let r = 0; r < 8; r++) a[8 * j + r] += w * v[r]; }));
      out[s] = a;
    });
    return out;
  }

  return {
    // elemento e solver
    elemMats, invert, globalK, rcm, factor, backsub, prepare,
    // malha
    axis, createMesh, tributary,
    // cargas
    areaLoad, lineLoad, nodalLoad, sumLoad,
    // solução e resultados
    solveSprings, displacements, gaussValues, recovery, nodal,
    COMP: ['M1', 'M2', 'M12', 'Q1', 'Q2', 'N1', 'N2', 'N12']
  };
}

if (typeof module !== 'undefined' && module.exports) module.exports = { MotorMEF };
