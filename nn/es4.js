// Elite search for the per-day neural policy (nnbot2): 7 nets, one per game day.
// Each candidate mutates the net of 1-2 days, so earlier days replay identically (deterministic sim).
// node es2.js <seed> <cfg.json> <outdir> [par=12] [pop=24] [sigma=0.05]
const { chromium } = require('playwright-core'); const fs = require('fs'), path = require('path');
const [seed, cfgP, out, par = '12', pop = '24', sig0 = '0.05'] = process.argv.slice(2);
const PAR = +par, POP = +pop, SIG = +sig0, H = 12, I = 23, O = +(process.env.O || 18), D = 7;
const NP = H * I + H + O * H + O, OUTF = H * I + H;
const bot = fs.readFileSync(path.join(__dirname, 'nnbot5.js'), 'utf8');
const PH = 8, PI = 18, NPP = PH * PI + PH + PH + 1;
const unpackP = th => ({ W1: th.slice(0, PH * PI), b1: th.slice(PH * PI, PH * PI + PH), W2: th.slice(PH * PI + PH, PH * PI + 2 * PH), b2: th.slice(PH * PI + 2 * PH) });
const cfg = JSON.parse(fs.readFileSync(cfgP, 'utf8'));
fs.mkdirSync(out, { recursive: true });
const unpack1 = th => ({ W1: th.slice(0, H * I), b1: th.slice(H * I, OUTF), W2: th.slice(OUTF, OUTF + O * H), b2: th.slice(OUTF + O * H) });
const unpack = pol => pol.map(t => unpack1(t.slice(0, NP)));
const unpackPN = pol => pol.map(t => unpackP(t.slice(NP)));
let rs = +(process.env.RS || 4242); const rnd = () => { rs = (rs * 1103515245 + 12345) & 0x7fffffff; return rs / 0x7fffffff };
const gauss = () => { let u = 0; while (!u) u = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd()) };
// old 10-output net -> 16-output net (new output rows are zero = no change)
const widen = n => { const Oo = n.b2.length; const W2 = [...n.W2, ...new Array((O - Oo) * H).fill(0)], b2 = [...n.b2, ...new Array(O - Oo).fill(0)]; return [...n.W1, ...n.b1, ...W2, ...b2] };

let browser;
async function play(pol, wantReplay) {
  const p = await browser.newPage({ viewport: { width: 400, height: 300 } });
  try {
    await p.addInitScript(() => { window.requestAnimationFrame = () => 0; const ok = Object.keys; Object.keys = function (o) { if (o && o.sim && 'instantBuilding' in o && 'sandbox' in o) window.__sim = o.sim; return ok.call(this, o) } });
    await p.goto('https://antarchitectgame.com/play/?seed=' + seed, { waitUntil: 'load', timeout: 120000 });
    for (let j = 0; j < 120 && !(await p.evaluate(() => !!(window.__sim && window.ants && window.ants.replay))); j++) await p.waitForTimeout(500);
    await p.evaluate(([src, cfg, nn]) => { window.__NN = nn[0]; window.__PN = nn[1]; window.__B14 = { log: [], cmds: 0, fails: 0, err: null, fc: new Map(), n: {}, best: 0, cfg }; new Function(src)(); window.__run14() }, [bot, cfg, [unpack(pol), unpackPN(pol)]]);
    while (true) { await p.waitForTimeout(1000); const r = await p.evaluate(() => ({ d: window.__B14.done, e: window.__B14.err })); if (r.d || r.e) break }
    const res = await p.evaluate(() => { const B = window.__B14; return { best: B.best, bestT: B.bestT, err: B.err } });
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
  if (!st && process.env.WIDEN) { const o = JSON.parse(fs.readFileSync(process.env.WIDEN, 'utf8')); const Oo = +process.env.OOLD;
    const pol = o.pol.map(t => { const W2o = t.slice(OUTF, OUTF + Oo * H), b2o = t.slice(OUTF + Oo * H, OUTF + Oo * H + Oo), rest = t.slice(OUTF + Oo * H + Oo);
      return [...t.slice(0, OUTF), ...W2o, ...new Array((O - Oo) * H).fill(0), ...b2o, ...new Array(O - Oo).fill(0), ...rest] });
    const r = await play(pol); console.log('init', r.best, r.bestT, r.err || ''); st = { gen: 0, pol, best: r.best, rs } }
  if (!st && process.env.FROM) { const o = JSON.parse(fs.readFileSync(process.env.FROM, 'utf8'));
    const pol = o.pol.map(t => [...t, ...Array.from({ length: NPP }, (_, i) => i < PH * PI ? gauss() * 0.3 : 0)]);
    const r = await play(pol); console.log('init', r.best, r.bestT, r.err || ''); st = { gen: 0, pol, best: r.best, rs, dayWins: new Array(D).fill(0) } }
  if (!st) { // INIT=early.json,late.json,switchDay : days < switchDay use early, others late
    const [a, b, sd] = process.env.INIT.split(','); const A = widen(JSON.parse(fs.readFileSync(a))), Bn = widen(JSON.parse(fs.readFileSync(b)));
    const pol = Array.from({ length: D }, (_, d) => (d < +sd ? A : Bn).slice());
    const r = await play(pol); console.log('init', r.best, r.bestT, r.err || '');
    st = { gen: 0, pol, best: r.best, rs, dayWins: new Array(D).fill(0) };
  }
  rs = st.rs;
  while (true) {
    const t0 = Date.now(); const cands = [], days = [];
    for (let k = 0; k < POP; k++) {
      const d = Math.floor(rnd() * D), two = rnd() < 0.3 && d < D - 1, sg = SIG * [0.5, 1, 2][k % 3], outOnly = k % 2;
      const pol = st.pol.map(n => n.slice());
      const pl = rnd() < +(process.env.PLACE || 0.6); // mutate the placement net (else the knob net)
      for (const dd of two ? [d, d + 1] : [d]) pol[dd] = pol[dd].map((t, i) => {
        if (pl ? i < NP : i >= NP) return t; const j = pl ? i - NP : i;
        if (outOnly && (pl ? j < PH * PI + PH : j < OUTF)) return t; return rnd() > 0.3 ? t : t + sg * (pl ? 3 : 1) * gauss() });
      cands.push(pol); days.push((pl ? 'P' : 'K') + d + (two ? '+' : ''));
    }
    const res = await pool(cands); const f = res.map(r => r.best);
    for (const r of res) if (r.err) fs.appendFileSync(path.join(out, 'errs.log'), st.gen + ' ' + String(r.err).slice(0, 600) + '\n');
    const gi = f.indexOf(Math.max(...f)); st.gen++;
    if (f[gi] >= st.best) { const better = f[gi] > st.best; st.pol = cands[gi]; st.best = f[gi]; 
      if (better) { const r = await play(cands[gi], true);
        if (r.replay) fs.writeFileSync(path.join(out, `s${seed}-nn5-b${r.best}.json`), r.replay);
        fs.writeFileSync(path.join(out, `pol-b${f[gi]}.json`), JSON.stringify({ H, I, O, cfg, nets: unpack(cands[gi]), pnets: unpackPN(cands[gi]) })) } }
    st.rs = rs; fs.writeFileSync(stF, JSON.stringify(st));
    const sorted = [...f].sort((a, b) => b - a), mean = f.reduce((a, b) => a + b, 0) / f.length;
    const line = { gen: st.gen, max: sorted[0], day: days[gi], mean: +mean.toFixed(1), med: sorted[f.length >> 1], best: st.best, errs: res.filter(r => r.err).length, sec: Math.round((Date.now() - t0) / 1000) };
    fs.appendFileSync(path.join(out, 'log.jsonl'), JSON.stringify(line) + '\n'); console.log(JSON.stringify(line));
    if (st.best >= +(process.env.TARGET || 250) || fs.existsSync(path.join(out, 'STOP'))) break;
  }
  await browser.close();
})();
