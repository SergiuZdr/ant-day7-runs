// es8: elite search for nnbot10 (knob net + placement net + build-decision net + hatch-decision net, one set per day).
// Score = ants at tick 63000 (what the day-7 board records). Each candidate mutates one segment of one or two days.
// START=<state or pol file with 683 values per day> adds zeroed decision nets, so generation 0 plays like the start.
// env: START, RS, PATIENCE, MAXMIN (stop after N minutes), CHROME_PATH (default: Mac Chrome if present).
// node es8.js <seed> <cfg.json> <outdir> [par] [pop] [sigma]
let pw; try { pw = require('playwright-core') } catch (e) { pw = require('playwright') }
const fs = require('fs'), path = require('path');
const [seed, cfgP, out, par = '6', pop = '24', sig0 = '0.05'] = process.argv.slice(2);
const PAR = +par, POP = +pop, SIG = +sig0, D = 7, T0 = Date.now();
const H = 12, I = 23, O = 18, NP = H * I + H + O * H + O;            // knob net
const PH = 8, PI = 18, NPP = PH * PI + PH + PH + 1;                  // placement net
const BH = 10, BO = 7, NB = BH * I + BH + BO * BH + BO;               // build-decision net
const HH = 8, HO = 5, NH = HH * I + HH + HO * HH + HO;                // hatch-decision net
const SEG = [[0, NP, H * I + H, 1], [NP, NPP, PH * PI + PH, 3], [NP + NPP, NB, BH * I + BH, 10], [NP + NPP + NB, NH, HH * I + HH, 10]]; // start, len, hidden-part length, sigma scale
const LEN = NP + NPP + NB + NH;
const bot = fs.readFileSync(path.join(__dirname, process.env.BOT || 'nnbot10.js'), 'utf8');
const cfg = JSON.parse(fs.readFileSync(cfgP, 'utf8')); fs.mkdirSync(out, { recursive: true });
const mlp = (t, h, i, o) => ({ W1: t.slice(0, h * i), b1: t.slice(h * i, h * i + h), W2: t.slice(h * i + h, h * i + h + o * h), b2: t.slice(h * i + h + o * h, h * i + h + o * h + o) });
const nets = pol => ({ nn: pol.map(t => mlp(t.slice(0, NP), H, I, O)), pn: pol.map(t => mlp(t.slice(NP, NP + NPP), PH, PI, 1)),
  bn: pol.map(t => mlp(t.slice(NP + NPP, NP + NPP + NB), BH, I, BO)), hn: pol.map(t => mlp(t.slice(NP + NPP + NB), HH, I, HO)) });
let rs = +(process.env.RS || 4242); const rnd = () => { rs = (rs * 1103515245 + 12345) & 0x7fffffff; return rs / 0x7fffffff };
const gauss = () => { let u = 0; while (!u) u = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd()) };
const MAC = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const CHROME = process.env.CHROME_PATH || (fs.existsSync(MAC) ? MAC : undefined);
let browser;
async function play(pol, wantReplay) { let p; try {
  p = await browser.newPage({ viewport: { width: 400, height: 300 }, bypassCSP: true });
  await p.addInitScript(() => { window.requestAnimationFrame = () => 0; const ok = Object.keys; Object.keys = function (o) { if (o && o.sim && 'instantBuilding' in o && 'sandbox' in o) window.__sim = o.sim; return ok.call(this, o) } });
  for (let a = 0; ; a++) { try { await p.goto('https://antarchitectgame.com/play/?seed=' + seed, { waitUntil: 'load', timeout: 120000 }); break } catch (e) { if (a >= 5) throw e; await new Promise(r => setTimeout(r, 15000)) } }
  for (let j = 0; j < 120 && !(await p.evaluate(() => !!(window.__sim && window.ants && window.ants.replay))); j++) await p.waitForTimeout(500);
  await p.evaluate(([src, cfg, n]) => { window.__NN = n.nn; window.__PN = n.pn; window.__BN = n.bn; window.__HN = n.hn; window.__B14 = { log: [], cmds: 0, fails: 0, err: null, fc: new Map(), n: {}, best: 0, cfg }; new Function(src)(); window.__run14() }, [bot, cfg, nets(pol)]);
  while (true) { await p.waitForTimeout(1000); const r = await p.evaluate(() => ({ d: window.__B14.done, e: window.__B14.err })); if (r.e) return { end: 0, err: r.e }; if (r.d) break }
  const r = await p.evaluate(() => { const s = window.__sim, x = s.stats(); return { end: s.tick >= 63000 ? 1 + x.workers + x.warriors : 0, n: window.__B14.n } });
  if (wantReplay) r.replay = await p.evaluate(() => { const x = window.ants.replay.export(); return typeof x === 'string' ? x : JSON.stringify(x) });
  return r } catch (e) { return { end: 0, err: String(e).slice(0, 300) } } finally { if (p) await p.close().catch(() => {}) } }
async function pool(jobs) { const res = new Array(jobs.length); let k = 0;
  await Promise.all(Array.from({ length: PAR }, async () => { while (k < jobs.length) { const i = k++; res[i] = await play(jobs[i]) } })); return res }
const log = o => { const l = JSON.stringify(Object.assign({ t: new Date().toTimeString().slice(0, 8) }, o)); fs.appendFileSync(path.join(out, 'log.jsonl'), l + '\n'); console.log(l) };

(async () => {
  browser = await pw.chromium.launch({ executablePath: CHROME, headless: true });
  const stF = path.join(out, 'state.json');
  let st = fs.existsSync(stF) ? JSON.parse(fs.readFileSync(stF, 'utf8')) : null;
  if (!st) { const o = JSON.parse(fs.readFileSync(process.env.START, 'utf8')); let pol = o.pol;
    if (pol[0].length < LEN) pol = pol.map(t => [...t.slice(0, NP + NPP),
      ...Array.from({ length: NB }, (_, i) => i < BH * I ? gauss() * 0.3 : 0), ...Array.from({ length: NH }, (_, i) => i < HH * I ? gauss() * 0.3 : 0)]);
    const r = await play(pol); log({ init: r.end, err: r.err }); st = { gen: 0, pol, best: r.end, lastImp: 0 } }
  if (st.rs) rs = st.rs;
  while (true) {
    const t0 = Date.now(), cands = [], tags = [];
    for (let k = 0; k < POP; k++) { const d = Math.floor(rnd() * D), two = rnd() < 0.3 && d < D - 1, sg = SIG * [0.5, 1, 2][k % 3], outOnly = k % 2;
      const u = rnd(), si = u < 0.15 ? 0 : u < 0.3 ? 1 : u < 0.65 ? 2 : 3, [a, len, hid, sc] = SEG[si];
      const pol = st.pol.map(n => n.slice());
      for (const dd of two ? [d, d + 1] : [d]) for (let i = a; i < a + len; i++) { if (outOnly && i - a < hid) continue; if (rnd() > 0.3) continue; pol[dd][i] += sg * sc * gauss() }
      cands.push(pol); tags.push('KPBH'[si] + d + (two ? '+' : '')) }
    const res = await pool(cands); const f = res.map(r => r.end);
    if (res.filter(r => r.err).length > POP / 2) { log({ skip: true, errs: res.filter(r => r.err).length, err: String(res.find(r => r.err).err).slice(0, 150) }); await new Promise(r => setTimeout(r, 60000)); continue }
    const gi = f.indexOf(Math.max(...f)); st.gen++; let acc = '';
    if (f[gi] > st.best) { const v = await play(cands[gi], true);
      if (v.end > st.best) { st.best = v.end; st.pol = cands[gi]; st.lastImp = st.gen; acc = 'NEW ' + v.end;
        fs.writeFileSync(path.join(out, `s${seed}-nn10-b${v.end}.json`), v.replay); fs.writeFileSync(path.join(out, `pol-b${v.end}.json`), JSON.stringify({ pol: st.pol, best: st.best, n: v.n })) } }
    else if (f[gi] === st.best) st.pol = cands[gi];
    st.rs = rs; fs.writeFileSync(stF, JSON.stringify(st));
    const s2 = [...f].sort((a, b) => b - a);
    log({ gen: st.gen, max: s2[0], med: s2[POP >> 1], day: tags[gi], best: st.best, acc, n: res[gi].n && Object.fromEntries(Object.entries(res[gi].n).filter(([k]) => /^(bn|hn)_/.test(k))), errs: res.filter(r => r.err).length, sec: Math.round((Date.now() - t0) / 1000) });
    if (fs.existsSync(path.join(out, 'STOP'))) break;
    if (process.env.PATIENCE && st.gen - st.lastImp >= +process.env.PATIENCE) { log({ stop: 'patience', best: st.best }); break }
    if (process.env.MAXMIN && Date.now() - T0 > +process.env.MAXMIN * 60000) { log({ stop: 'time', best: st.best }); break }
  }
  await browser.close();
})();
