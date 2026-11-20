// late.js: endgame search. Plays the start policy to tick T once, keeps the replay prefix and the bot's state,
// then every candidate (nets mutated only for days >= T/9000) starts from that point: import prefix, seek T,
// branch, restore bot state, run to 63000. Score = ants at tick 63000. Every new best is replayed from tick 0
// (full game) and only accepted if the full game gives the same or better score.
// After PATIENCE generations without gain, T moves one day earlier (TS list).
// env: START state.json, BOT, O, OBJ ignored (always end). node late.js <seed> <cfg> <outdir> <par> <pop> <sigma>
const { chromium } = require('playwright-core'); const fs = require('fs'), path = require('path');
const [seed, cfgP, out, par = '6', pop = '24', sig0 = '0.05'] = process.argv.slice(2);
const PAR = +par, POP = +pop, SIG = +sig0, H = 12, I = 23, O = +(process.env.O || 18), D = 7;
const NP = H * I + H + O * H + O, OUTF = H * I + H, PH = 8, PI = 18;
const TS = (process.env.TS || '54000,45000,36000,27000').split(',').map(Number), PAT = +(process.env.PATIENCE || 15);
const bot = fs.readFileSync(path.join(__dirname, process.env.BOT || 'nnbot5.js'), 'utf8');
const cfg = JSON.parse(fs.readFileSync(cfgP, 'utf8')); fs.mkdirSync(out, { recursive: true });
const unpack1 = th => ({ W1: th.slice(0, H * I), b1: th.slice(H * I, OUTF), W2: th.slice(OUTF, OUTF + O * H), b2: th.slice(OUTF + O * H, NP) });
const unpackP = t0 => { const t = t0.slice(NP); return { W1: t.slice(0, PH * PI), b1: t.slice(PH * PI, PH * PI + PH), W2: t.slice(PH * PI + PH, PH * PI + 2 * PH), b2: t.slice(PH * PI + 2 * PH) } };
const nets = pol => [pol.map(unpack1), pol.map(unpackP)];
let rs = +(process.env.RS || 777); const rnd = () => { rs = (rs * 1103515245 + 12345) & 0x7fffffff; return rs / 0x7fffffff };
const gauss = () => { let u = 0; while (!u) u = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd()) };
const log = o => { const l = JSON.stringify(Object.assign({ t: new Date().toTimeString().slice(0, 8) }, o)); fs.appendFileSync(path.join(out, 'log.jsonl'), l + '\n'); console.log(l) };
let browser;
async function newPage() { const p = await browser.newPage({ viewport: { width: 400, height: 300 }, bypassCSP: true });
  await p.addInitScript(() => { window.requestAnimationFrame = () => 0; const ok = Object.keys; Object.keys = function (o) { if (o && o.sim && 'instantBuilding' in o && 'sandbox' in o) window.__sim = o.sim; return ok.call(this, o) } });
  for (let a = 0; ; a++) { try { await p.goto('https://antarchitectgame.com/play/?seed=' + seed, { waitUntil: 'load', timeout: 120000 }); break } catch (e) { if (a >= 5) throw e; await new Promise(r => setTimeout(r, 15000)) } }
  for (let j = 0; j < 120 && !(await p.evaluate(() => !!(window.__sim && window.ants && window.ants.replay))); j++) await p.waitForTimeout(500);
  return p }
const waitBot = async p => { while (true) { await p.waitForTimeout(500); const r = await p.evaluate(() => ({ d: window.__B14.done, e: window.__B14.err })); if (r.d || r.e) return r.e } };
const endScore = p => p.evaluate(() => { const s = window.__sim, x = s.stats(); return s.tick >= 63000 ? 1 + x.workers + x.warriors : 0 });
// full game from tick 0; optionally stop at T and return prefix + bot snapshot
async function full(pol, T, wantReplay) { let p; try { p = await newPage();
  await p.evaluate(([src, cfg, nn, T]) => { window.__NN = nn[0]; window.__PN = nn[1]; window.__B14 = { log: [], cmds: 0, fails: 0, err: null, fc: new Map(), n: {}, best: 0, cfg }; new Function(src)(); window.__run14(T || undefined) }, [bot, cfg, nets(pol), T || 0]);
  let e = await waitBot(p); if (e) return { err: e }; const r = {};
  if (T) { Object.assign(r, await p.evaluate(() => { const B = window.__B14; const snap = JSON.stringify(B, (k, v) => v instanceof Map ? { __map: [...v] } : (typeof v === 'function' ? undefined : v));
      const x = window.ants.replay.export(); return { prefix: typeof x === 'string' ? x : JSON.stringify(x), snap, tick: window.__sim.tick } }));
    await p.evaluate(() => window.__run14()); e = await waitBot(p); if (e) return { err: e } }
  r.end = await endScore(p);
  if (wantReplay) r.replay = await p.evaluate(() => { const x = window.ants.replay.export(); return typeof x === 'string' ? x : JSON.stringify(x) });
  return r } catch (e) { return { err: String(e).slice(0, 300) } } finally { if (p) await p.close().catch(() => {}) } }
// candidate from the saved point T
async function fromT(p, pre, pol) { try {
  const e = await p.evaluate(async ([src, prefix, snap, T, nn]) => { const R = window.ants.replay; await R.import(prefix); await R.seek(T); await R.branch();
      if (window.__sim.tick !== T) return 'tick ' + window.__sim.tick;
      window.__B14 = JSON.parse(snap, (k, v) => v && v.__map ? new Map(v.__map) : v); window.__B14.done = false; window.__B14.err = null;
      window.__NN = nn[0]; window.__PN = nn[1]; const plan = window.__B14.plan, cfgNow = window.__B14.cfg; new Function(src)(); window.__B14.plan = plan; window.__B14.cfg = cfgNow;
      window.__run14(); return null }, [bot, pre.prefix, pre.snap, pre.T, nets(pol)]);
  if (e) return { end: 0, err: e }; const e2 = await waitBot(p); if (e2) return { end: 0, err: e2 }; return { end: await endScore(p) } }
  catch (e) { return { end: 0, err: String(e).slice(0, 300) } } }

(async () => {
  browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const stF = path.join(out, 'state.json');
  let st = fs.existsSync(stF) ? JSON.parse(fs.readFileSync(stF, 'utf8')) : null;
  if (!st) { const o = JSON.parse(fs.readFileSync(process.env.START, 'utf8')); st = { gen: 0, pol: o.pol, best: o.best || 0, ti: 0, lastImp: 0 } }
  if (st.rs) rs = st.rs;
  const pages = []; for (let i = 0; i < PAR; i++) pages.push(await newPage());
  while (st.ti < TS.length) {
    const T = TS[st.ti], d0 = Math.floor(T / 9000);
    const f0 = await full(st.pol, T); if (f0.err) { log({ prepErr: f0.err }); break }
    const pre = { T, prefix: f0.prefix, snap: f0.snap };
    const chk = await fromT(pages[0], pre, st.pol); // the unchanged policy must reproduce the full-game score
    log({ prep: T, fullEnd: f0.end, fromT: chk.end, err: chk.err, best: st.best });
    if (chk.end !== f0.end) log({ warn: 'restart from T differs from full game; full-game check decides' });
    if (f0.end > st.best) st.best = f0.end;
    let since = 0;
    while (since < PAT) {
      const t0 = Date.now(), cands = [], tags = [];
      for (let k = 0; k < POP; k++) { const d = d0 + Math.floor(rnd() * (D - d0)), two = rnd() < 0.3 && d < D - 1, sg = SIG * [0.5, 1, 2][k % 3], outOnly = k % 2;
        const pol = st.pol.map(n => n.slice()), pl = rnd() < 0.6;
        for (const dd of two ? [d, d + 1] : [d]) pol[dd] = pol[dd].map((t, i) => { if (pl ? i < NP : i >= NP) return t; const j = pl ? i - NP : i;
          if (outOnly && (pl ? j < PH * PI + PH : j < OUTF)) return t; return rnd() > 0.3 ? t : t + sg * (pl ? 3 : 1) * gauss() });
        cands.push(pol); tags.push((pl ? 'P' : 'K') + d + (two ? '+' : '')) }
      const res = new Array(POP); let k = 0;
      await Promise.all(pages.map(async p => { while (k < POP) { const i = k++; res[i] = await fromT(p, pre, cands[i]) } }));
      const f = res.map(r => r.end), gi = f.indexOf(Math.max(...f)); st.gen++; since++;
      let acc = '';
      if (f[gi] > st.best) { const v = await full(cands[gi], 0, true);
        if (!v.err && v.end > st.best) { st.best = v.end; st.pol = cands[gi]; since = 0; st.lastImp = st.gen; acc = 'NEW ' + v.end;
          fs.writeFileSync(path.join(out, `s${seed}-late-b${v.end}.json`), v.replay); fs.writeFileSync(path.join(out, `pol-b${v.end}.json`), JSON.stringify({ pol: st.pol, best: st.best }));
          // the saved point is still valid only if days before d0 are unchanged, which holds
        } else acc = 'full ' + (v.end || v.err) }
      else if (f[gi] === st.best && f[gi] > 0) st.pol = cands[gi]; // neutral move, same as es7
      st.rs = rs; fs.writeFileSync(stF, JSON.stringify(st));
      const s2 = [...f].sort((a, b) => b - a);
      log({ gen: st.gen, T, max: s2[0], med: s2[POP >> 1], day: tags[gi], best: st.best, acc, errs: res.filter(r => r.err).length, sec: Math.round((Date.now() - t0) / 1000) });
      if (fs.existsSync(path.join(out, 'STOP'))) { await browser.close(); return }
    }
    st.ti++; fs.writeFileSync(stF, JSON.stringify(st));
  }
  log({ done: true, best: st.best }); await browser.close();
})();
