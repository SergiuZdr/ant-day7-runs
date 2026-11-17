// Evolution-strategies trainer for the nnbot neural controller.
// node es.js <seed> <cfg.json> <outdir> [par=8] [pop=24] [sigma=0.15] [lr=0.05] [H=12]
// Fitness = most ants by day 7 (deterministic sim, so one game per candidate).
const { chromium } = require('playwright-core'); const fs = require('fs'), path = require('path');
const [seed, cfgP, out, par = '8', pop = '24', sigma0 = '0.15', lr0 = '0.05', H0 = '12'] = process.argv.slice(2);
const PAR = +par, POP = +pop, SIG = +sigma0, LR = +lr0, H = +H0, I = 23, O = 10;
const NP = H * I + H + O * H + O;
const SW = process.env.SWITCH ? (([at, f]) => { const n = JSON.parse(require('fs').readFileSync(f, 'utf8')); return { at: +at, net: { W1: n.W1, b1: n.b1, W2: n.W2, b2: n.b2 } } })(process.env.SWITCH.split('@')) : null;
// BRANCH=replay.json@tick@preBest : fine-tune later days only
const BR = process.env.BRANCH ? (([f, at, pre]) => ({ txt: require('fs').readFileSync(f, 'utf8'), at: +at, pre: +(pre || 0) }))(process.env.BRANCH.split('@')) : null;
const bot = fs.readFileSync(path.join(__dirname, 'nnbot.js'), 'utf8');
const cfg = JSON.parse(fs.readFileSync(cfgP, 'utf8'));
fs.mkdirSync(out, { recursive: true });
const unpack = th => ({ W1: th.slice(0, H * I), b1: th.slice(H * I, H * I + H), W2: th.slice(H * I + H, H * I + H + O * H), b2: th.slice(H * I + H + O * H) });
let rs = 12345; const rnd = () => { rs = (rs * 1103515245 + 12345) & 0x7fffffff; return rs / 0x7fffffff };
const gauss = () => { let u = 0; while (!u) u = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd()) };

let browser;
async function play(theta, wantReplay) {
  const p = await browser.newPage({ viewport: { width: 400, height: 300 } });
  try {
    await p.addInitScript(() => { window.requestAnimationFrame = () => 0; const ok = Object.keys; Object.keys = function (o) { if (o && o.sim && 'instantBuilding' in o && 'sandbox' in o) window.__sim = o.sim; return ok.call(this, o) } });
    await p.goto('https://antarchitectgame.com/play/?seed=' + seed, { waitUntil: 'load', timeout: 120000 });
    for (let j = 0; j < 120 && !(await p.evaluate(() => !!(window.__sim && window.ants && window.ants.replay))); j++) await p.waitForTimeout(500);
    if (BR) { // continue from a saved replay at tick AT (earlier days fixed, the net only acts from AT on)
      await p.evaluate(async ({ txt, AT }) => { const R = window.ants.replay; await R.import(txt); await new Promise(r => setTimeout(r, 500)); await R.seek(AT); await new Promise(r => setTimeout(r, 500)); await R.branch(); await new Promise(r => setTimeout(r, 500)) }, { txt: BR.txt, AT: BR.at });
      for (let j = 0; j < 60; j++) { const t = await p.evaluate(() => window.__sim ? window.__sim.tick : -1); if (Math.abs(t - BR.at) <= 200) break; await p.waitForTimeout(500) } }
    if (SW) { // SWITCH=at@parentNet.json : play the parent net to tick AT (same bot memory), then the candidate
      await p.evaluate(([src, cfg, nn, at]) => { window.__NN = nn; window.__B14 = { log: [], cmds: 0, fails: 0, err: null, fc: new Map(), n: {}, best: 0, cfg }; new Function(src)(); window.__run14(at) }, [bot, cfg, SW.net, SW.at]);
      while (true) { await p.waitForTimeout(1000); const r = await p.evaluate(() => ({ d: window.__B14.done, e: window.__B14.err })); if (r.d || r.e) break }
      await p.evaluate(nn => { window.__NN = nn; window.__run14() }, theta ? unpack(theta) : SW.net);
    } else
    await p.evaluate(([src, cfg, nn, pre]) => { window.__NN = nn; window.__B14 = { log: [], cmds: 0, fails: 0, err: null, fc: new Map(), n: {}, best: pre, cfg }; new Function(src)(); window.__run14() }, [bot, cfg, theta ? unpack(theta) : null, BR ? BR.pre : 0]);
    while (true) { await p.waitForTimeout(1000); const r = await p.evaluate(() => ({ d: window.__B14.done, e: window.__B14.err })); if (r.d || r.e) break }
    const res = await p.evaluate(() => { const B = window.__B14; return { best: B.best, bestT: B.bestT, err: B.err, n: B.n } });
    if (wantReplay) res.replay = await p.evaluate(() => { const x = window.ants.replay.export(); return typeof x === 'string' ? x : JSON.stringify(x) });
    return res;
  } catch (e) { return { best: 0, err: String(e).slice(0, 200) } } finally { await p.close() }
}
async function pool(jobs) { const res = new Array(jobs.length); let k = 0;
  await Promise.all(Array.from({ length: PAR }, async () => { while (k < jobs.length) { const i = k++; res[i] = await play(jobs[i]) } })); return res }

(async () => {
  browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const stF = path.join(out, 'state.json');
  let st = fs.existsSync(stF) ? JSON.parse(fs.readFileSync(stF, 'utf8')) : null;
  if (!st) { // zero net = base bot; tiny random W1 so hidden units differ
    const th = new Array(NP).fill(0); for (let i = 0; i < H * I; i++) th[i] = gauss() * 0.3;
    st = { gen: 0, theta: th, m: new Array(NP).fill(0), v: new Array(NP).fill(0), best: 0, bestTheta: th, rs };
    const r = await play(th); st.best = r.best; console.log('base', r.best, r.err || '');
  }
  rs = st.rs;
  while (true) {
    const t0 = Date.now(); const eps = [];
    for (let i = 0; i < POP / 2; i++) eps.push(Array.from({ length: NP }, gauss));
    const cands = []; const OUTF = H * I + H;
    if (process.env.ELITE) { for (let k = 0; k < POP; k++) { const e = Array.from({ length: NP }, gauss), sp = k % 2, sg = SIG * [0.5, 1, 2][k % 3];
        cands.push(st.bestTheta.map((t, i) => (sp && i < OUTF) || rnd() > 0.3 ? t : t + sg * e[i])) } }
    else for (const e of eps) { cands.push(st.theta.map((t, i) => t + SIG * e[i])); cands.push(st.theta.map((t, i) => t - SIG * e[i])) }
    const res = await pool(cands); const f = res.map(r => r.best);
    // centered ranks, antithetic gradient, Adam
    const idx = f.map((v, i) => i).sort((a, b) => f[a] - f[b]); const rk = new Array(f.length); idx.forEach((j, r) => rk[j] = r / (f.length - 1) - 0.5);
    const g = new Array(NP).fill(0); if (!process.env.ELITE) eps.forEach((e, k) => { const w = rk[2 * k] - rk[2 * k + 1]; for (let i = 0; i < NP; i++) g[i] += w * e[i] / (POP * SIG) });
    st.gen++; const b1 = 0.9, b2 = 0.999;
    for (let i = 0; i < NP; i++) { st.m[i] = b1 * st.m[i] + (1 - b1) * g[i]; st.v[i] = b2 * st.v[i] + (1 - b2) * g[i] * g[i];
      const mh = st.m[i] / (1 - b1 ** st.gen), vh = st.v[i] / (1 - b2 ** st.gen); st.theta[i] += LR * mh / (Math.sqrt(vh) + 1e-8) - 0.001 * st.theta[i] }
    const gi = f.indexOf(Math.max(...f));
    if (process.env.ELITE && f[gi] === st.best) st.bestTheta = cands[gi];
    if (f[gi] > st.best) { st.best = f[gi]; st.bestTheta = cands[gi];
      const r = await play(cands[gi], true); // replay the best net to save the recording
      if (r.replay) fs.writeFileSync(path.join(out, `s${seed}-nn-b${r.best}.json`), r.replay);
      fs.writeFileSync(path.join(out, `net-b${r.best}.json`), JSON.stringify({ H, I, O, cfg, ...unpack(cands[gi]) })) }
    st.rs = rs; fs.writeFileSync(stF, JSON.stringify(st));
    const sorted = [...f].sort((a, b) => b - a), mean = f.reduce((a, b) => a + b, 0) / f.length;
    const line = { gen: st.gen, max: sorted[0], mean: +mean.toFixed(1), med: sorted[f.length >> 1], best: st.best, errs: res.filter(r => r.err).length, sec: Math.round((Date.now() - t0) / 1000) };
    fs.appendFileSync(path.join(out, 'log.jsonl'), JSON.stringify(line) + '\n'); console.log(JSON.stringify(line));
    if (fs.existsSync(path.join(out, 'STOP'))) break;
  }
  await browser.close();
})();
