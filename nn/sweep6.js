// node sweep6.js <state.json> <variants.jsonl> <out.jsonl> [par] : the trained 219 policy + cfg overrides
const { chromium } = require('playwright-core'); const fs = require('fs');
const [stP, varP, outP, par = '12'] = process.argv.slice(2);
const bot = fs.readFileSync('nnbot6.js', 'utf8'); const base = JSON.parse(fs.readFileSync('cfg200.json'));
const st = JSON.parse(fs.readFileSync(stP)); const H = 12, I = 23, O = 18, NP = H * I + H + O * H + O, OUTF = H * I + H, PH = 8, PI = 18;
const u = t => ({ W1: t.slice(0, H * I), b1: t.slice(H * I, OUTF), W2: t.slice(OUTF, OUTF + O * H), b2: t.slice(OUTF + O * H, NP) });
const up = t0 => { const t = t0.slice(NP); return { W1: t.slice(0, PH * PI), b1: t.slice(PH * PI, PH * PI + PH), W2: t.slice(PH * PI + PH, PH * PI + 2 * PH), b2: t.slice(PH * PI + 2 * PH) } };
const NN = st.pol.map(u), PN = st.pol.map(up);
const V = fs.readFileSync(varP, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
(async () => { const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true }); let k = 0;
  await Promise.all(Array.from({ length: +par }, async () => { while (k < V.length) { const i = k++, v = V[i]; const p = await b.newPage();
    try { await p.addInitScript(() => { window.requestAnimationFrame = () => 0; const ok = Object.keys; Object.keys = function (o) { if (o && o.sim && 'instantBuilding' in o && 'sandbox' in o) window.__sim = o.sim; return ok.call(this, o) } });
      await p.goto('https://antarchitectgame.com/play/?seed=55917', { waitUntil: 'load', timeout: 120000 });
      for (let j = 0; j < 120 && !(await p.evaluate(() => !!(window.__sim && window.ants && window.ants.replay))); j++) await p.waitForTimeout(500);
      await p.evaluate(([src, cfg, nn, pn]) => { window.__NN = nn; window.__PN = pn; window.__B14 = { log: [], cmds: 0, fails: 0, err: null, fc: new Map(), n: {}, best: 0, cfg }; new Function(src)(); window.__run14() }, [bot, { ...base, ...v }, NN, PN]);
      while (true) { await p.waitForTimeout(1000); if (await p.evaluate(() => window.__B14.done || !!window.__B14.err)) break }
      const r = await p.evaluate(() => { const B = window.__B14, s = window.__sim, L = s.stats().ledger; return { best: B.best, bestT: B.bestT, err: B.err, leaves: L.leaves.gained, ls: s.nest.works.filter(e => e.kind === 2 && e.room === 4).length, lc: s.castes().leafcutter } });
      if (r.best >= 220) r.replay = await p.evaluate(() => { const x = window.ants.replay.export(); return typeof x === 'string' ? x : JSON.stringify(x) });
      fs.appendFileSync(outP, JSON.stringify({ v, ...r }) + '\n'); console.log(i, r.best, JSON.stringify(v), r.ls, r.leaves && r.leaves.reduce((a, c) => a + c, 0));
    } catch (e) { console.log(i, 'ERR', String(e).slice(0, 150)) } finally { await p.close() } } }));
  await b.close() })();
