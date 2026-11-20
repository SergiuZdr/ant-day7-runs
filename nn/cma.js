// cma.js: CMA-ES over the output biases of the 7 per-day knob nets (O each) plus the 7 placement-net output biases.
// These biases shift each knob directly, so the search space is small (7*O+7 dims) and CMA-ES can learn which
// directions help. Every candidate is a full game; score = ants at tick 63000. New bests save a replay.
// env: START state.json, BOT, O. node cma.js <seed> <cfg> <outdir> <par> <lambda> <sigma>
const { chromium } = require('playwright-core'); const fs = require('fs'), path = require('path');
const [seed, cfgP, out, par = '6', lam0 = '12', sig0 = '0.1'] = process.argv.slice(2);
const PAR = +par, LAM = +lam0, H = 12, I = 23, O = +(process.env.O || 18), D = 7;
const NP = H * I + H + O * H + O, OUTF = H * I + H, PH = 8, PI = 18, NPP = PH * PI + PH + PH + 1;
const bot = fs.readFileSync(path.join(__dirname, process.env.BOT || 'nnbot5.js'), 'utf8');
const cfg = JSON.parse(fs.readFileSync(cfgP, 'utf8')); fs.mkdirSync(out, { recursive: true });
const unpack1 = th => ({ W1: th.slice(0, H * I), b1: th.slice(H * I, OUTF), W2: th.slice(OUTF, OUTF + O * H), b2: th.slice(OUTF + O * H, NP) });
const unpackP = t0 => { const t = t0.slice(NP); return { W1: t.slice(0, PH * PI), b1: t.slice(PH * PI, PH * PI + PH), W2: t.slice(PH * PI + PH, PH * PI + 2 * PH), b2: t.slice(PH * PI + 2 * PH) } };
// index of every searched value inside pol[d]
const IDX = []; for (let d = +(process.env.DMIN || 0); d < D; d++) { for (let k = 0; k < O; k++) IDX.push([d, OUTF + O * H + k]); IDX.push([d, NP + NPP - 1]) }
const N = IDX.length;
let rs = +(process.env.RS || 991); const rnd = () => { rs = (rs * 1103515245 + 12345) & 0x7fffffff; return rs / 0x7fffffff };
const gauss = () => { let u = 0; while (!u) u = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd()) };
const log = o => { const l = JSON.stringify(Object.assign({ t: new Date().toTimeString().slice(0, 8) }, o)); fs.appendFileSync(path.join(out, 'log.jsonl'), l + '\n'); console.log(l) };
let browser;
async function play(pol, wantReplay) { const p = await browser.newPage({ viewport: { width: 400, height: 300 } }); try {
  await p.addInitScript(() => { window.requestAnimationFrame = () => 0; const ok = Object.keys; Object.keys = function (o) { if (o && o.sim && 'instantBuilding' in o && 'sandbox' in o) window.__sim = o.sim; return ok.call(this, o) } });
  await p.goto('https://antarchitectgame.com/play/?seed=' + seed, { waitUntil: 'load', timeout: 120000 });
  for (let j = 0; j < 120 && !(await p.evaluate(() => !!(window.__sim && window.ants && window.ants.replay))); j++) await p.waitForTimeout(500);
  await p.evaluate(([src, cfg, a, b]) => { window.__NN = a; window.__PN = b; window.__B14 = { log: [], cmds: 0, fails: 0, err: null, fc: new Map(), n: {}, best: 0, cfg }; new Function(src)(); window.__run14() }, [bot, cfg, pol.map(unpack1), pol.map(unpackP)]);
  while (true) { await p.waitForTimeout(1000); const r = await p.evaluate(() => ({ d: window.__B14.done, e: window.__B14.err })); if (r.e) return { end: 0, err: r.e }; if (r.d) break }
  const r = { end: await p.evaluate(() => { const s = window.__sim, x = s.stats(); return s.tick >= 63000 ? 1 + x.workers + x.warriors : 0 }) };
  if (wantReplay) r.replay = await p.evaluate(() => { const x = window.ants.replay.export(); return typeof x === 'string' ? x : JSON.stringify(x) });
  return r } catch (e) { return { end: 0, err: String(e).slice(0, 200) } } finally { await p.close() } }
async function pool(jobs) { const res = new Array(jobs.length); let k = 0;
  await Promise.all(Array.from({ length: PAR }, async () => { while (k < jobs.length) { const i = k++; res[i] = await play(jobs[i]) } })); return res }
// symmetric eigen-decomposition (Jacobi)
function eig(A) { const n = A.length, a = A.map(r => r.slice()), V = a.map((r, i) => r.map((_, j) => +(i === j)));
  for (let sw = 0; sw < 50; sw++) { let off = 0; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += a[i][j] * a[i][j]; if (off < 1e-20) break;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) { if (Math.abs(a[p][q]) < 1e-14) continue;
      const th = (a[q][q] - a[p][p]) / (2 * a[p][q]), t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1)), c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < n; k++) { const akp = a[k][p], akq = a[k][q]; a[k][p] = c * akp - s * akq; a[k][q] = s * akp + c * akq }
      for (let k = 0; k < n; k++) { const apk = a[p][k], aqk = a[q][k]; a[p][k] = c * apk - s * aqk; a[q][k] = s * apk + c * aqk }
      for (let k = 0; k < n; k++) { const vkp = V[k][p], vkq = V[k][q]; V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq } } }
  return { d: a.map((r, i) => Math.max(1e-20, r[i])), V } }

(async () => {
  browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const stF = path.join(out, 'state.json');
  let st = fs.existsSync(stF) ? JSON.parse(fs.readFileSync(stF, 'utf8')) : null;
  const mu = LAM >> 1; let w = Array.from({ length: mu }, (_, i) => Math.log(mu + 0.5) - Math.log(i + 1)); const ws = w.reduce((a, b) => a + b); w = w.map(x => x / ws);
  const mueff = 1 / w.reduce((a, b) => a + b * b, 0);
  const cc = (4 + mueff / N) / (N + 4 + 2 * mueff / N), cs = (mueff + 2) / (N + mueff + 5), c1 = 2 / ((N + 1.3) ** 2 + mueff);
  const cmu = Math.min(1 - c1, 2 * (mueff - 2 + 1 / mueff) / ((N + 2) ** 2 + mueff)), damps = 1 + 2 * Math.max(0, Math.sqrt((mueff - 1) / (N + 1)) - 1) + cs;
  const chiN = Math.sqrt(N) * (1 - 1 / (4 * N) + 1 / (21 * N * N));
  if (!st) { const o = JSON.parse(fs.readFileSync(process.env.START, 'utf8'));
    st = { gen: 0, base: o.pol, best: o.best || 0, bestPol: o.pol, m: IDX.map(([d, i]) => o.pol[d][i]), sigma: +sig0,
      C: Array.from({ length: N }, (_, i) => Array.from({ length: N }, (_, j) => +(i === j))), pc: new Array(N).fill(0), ps: new Array(N).fill(0) } }
  if (st.rs) rs = st.rs;
  const make = x => { const pol = st.base.map(t => t.slice()); IDX.forEach(([d, i], k) => pol[d][i] = x[k]); return pol };
  while (true) {
    const t0 = Date.now(); const { d, V } = eig(st.C), sd = d.map(Math.sqrt);
    const Z = [], Y = [], X = [];
    for (let k = 0; k < LAM; k++) { const z = Array.from({ length: N }, gauss), y = new Array(N).fill(0);
      for (let i = 0; i < N; i++) { let s = 0; for (let j = 0; j < N; j++) s += V[i][j] * sd[j] * z[j]; y[i] = s }
      Z.push(z); Y.push(y); X.push(st.m.map((m, i) => m + st.sigma * y[i])) }
    const res = await pool(X.map(make)); const f = res.map(r => r.end);
    if (res.some(r => r.err)) { log({ skip: true, errs: res.filter(r => r.err).length, err: String(res.find(r => r.err).err).slice(0, 120) }); await new Promise(r => setTimeout(r, 60000)); continue }
    const ord = f.map((v, i) => i).sort((a, b) => f[b] - f[a]); st.gen++;
    let acc = '';
    if (f[ord[0]] > st.best) { const v = await play(make(X[ord[0]]), true);
      if (v.end > st.best) { st.best = v.end; st.bestPol = make(X[ord[0]]); acc = 'NEW ' + v.end;
        fs.writeFileSync(path.join(out, `s${seed}-cma-b${v.end}.json`), v.replay); fs.writeFileSync(path.join(out, `pol-b${v.end}.json`), JSON.stringify({ pol: st.bestPol, best: st.best })) } }
    // CMA update
    const yw = new Array(N).fill(0); for (let k = 0; k < mu; k++) for (let i = 0; i < N; i++) yw[i] += w[k] * Y[ord[k]][i];
    st.m = st.m.map((m, i) => m + st.sigma * yw[i]);
    // C^-1/2 yw = V diag(1/sd) V^T yw
    const t1 = new Array(N).fill(0); for (let j = 0; j < N; j++) { let s = 0; for (let i = 0; i < N; i++) s += V[i][j] * yw[i]; t1[j] = s / sd[j] }
    const iy = new Array(N).fill(0); for (let i = 0; i < N; i++) { let s = 0; for (let j = 0; j < N; j++) s += V[i][j] * t1[j]; iy[i] = s }
    st.ps = st.ps.map((p, i) => (1 - cs) * p + Math.sqrt(cs * (2 - cs) * mueff) * iy[i]);
    const psn = Math.sqrt(st.ps.reduce((a, b) => a + b * b, 0)), hs = psn / Math.sqrt(1 - (1 - cs) ** (2 * st.gen)) / chiN < 1.4 + 2 / (N + 1) ? 1 : 0;
    st.pc = st.pc.map((p, i) => (1 - cc) * p + hs * Math.sqrt(cc * (2 - cc) * mueff) * yw[i]);
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { let r = 0; for (let k = 0; k < mu; k++) r += w[k] * Y[ord[k]][i] * Y[ord[k]][j];
      st.C[i][j] = (1 - c1 - cmu) * st.C[i][j] + c1 * (st.pc[i] * st.pc[j] + (1 - hs) * cc * (2 - cc) * st.C[i][j]) + cmu * r }
    st.sigma *= Math.exp((cs / damps) * (psn / chiN - 1)); st.sigma = Math.min(0.5, Math.max(0.002, st.sigma));
    st.rs = rs; fs.writeFileSync(stF, JSON.stringify(st));
    const s2 = [...f].sort((a, b) => b - a);
    log({ gen: st.gen, max: s2[0], med: s2[LAM >> 1], min: s2[LAM - 1], best: st.best, sigma: +st.sigma.toFixed(4), acc, errs: res.filter(r => r.err).length, sec: Math.round((Date.now() - t0) / 1000) });
    if (fs.existsSync(path.join(out, 'STOP'))) break;
  }
  await browser.close();
})();
