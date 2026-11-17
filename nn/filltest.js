// Play the 219 policy to tick AT, then fill one finished room (or none) and step on without the bot; compare resources.
const { chromium } = require('playwright-core'); const fs = require('fs');
const bot = fs.readFileSync('nnbot6.js', 'utf8'); const base = JSON.parse(fs.readFileSync('cfg200.json'));
const st = JSON.parse(fs.readFileSync('p3/state.json')); const H = 12, I = 23, O = 18, NP = H * I + H + O * H + O, OUTF = H * I + H, PH = 8, PI = 18;
const u = t => ({ W1: t.slice(0, H * I), b1: t.slice(H * I, OUTF), W2: t.slice(OUTF, OUTF + O * H), b2: t.slice(OUTF + O * H, NP) });
const up = t0 => { const t = t0.slice(NP); return { W1: t.slice(0, PH * PI), b1: t.slice(PH * PI, PH * PI + PH), W2: t.slice(PH * PI + PH, PH * PI + 2 * PH), b2: t.slice(PH * PI + 2 * PH) } };
const AT = 45000;
(async () => { const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  await Promise.all([null, 1, 4, 3].map(async room => { const p = await b.newPage();
    await p.addInitScript(() => { window.requestAnimationFrame = () => 0; const ok = Object.keys; Object.keys = function (o) { if (o && o.sim && 'instantBuilding' in o && 'sandbox' in o) window.__sim = o.sim; return ok.call(this, o) } });
    await p.goto('https://antarchitectgame.com/play/?seed=55917', { waitUntil: 'load', timeout: 120000 });
    for (let j = 0; j < 120 && !(await p.evaluate(() => !!(window.__sim && window.ants && window.ants.replay))); j++) await p.waitForTimeout(500);
    await p.evaluate(([src, cfg, nn, pn, at]) => { window.__NN = nn; window.__PN = pn; window.__B14 = { log: [], cmds: 0, fails: 0, err: null, fc: new Map(), n: {}, best: 0, cfg }; new Function(src)(); window.__run14(at) }, [bot, base, st.pol.map(u), st.pol.map(up), AT]);
    while (!(await p.evaluate(() => window.__B14.done || !!window.__B14.err))) await p.waitForTimeout(500);
    const out = await p.evaluate(async room => { const s = window.__sim, R = window.ants.replay;
      const snap = () => { const x = s.stats(); const L = x.ledger; const sum = a => a.reduce((p, c) => p + c, 0);
        return { t: s.tick, clay: x.clay, leaves: x.leaves, fungus: x.fungus, cap: x.capacity, lcap: x.leafCapacity, ants: 1 + x.workers + x.warriors, owed: { ...s.owed }, loose: [s.looseClay, s.looseLeaves],
          gain: { clay: sum(L.clay.gained), leaves: sum(L.leaves.gained), fungus: sum(L.fungus.gained) }, spent: { clay: sum(L.clay.spent), leaves: sum(L.leaves.spent) } } };
      const res = { room, before: snap() };
      if (room != null) { const w = s.nest.works.filter(e => e.kind === 2 && e.room === room && e.done).pop();
        res.target = w && { id: w.id, stored: room === 4 ? s.storedLeaves(w) : null };
        res.ok = w ? R.command({ type: 'room-action', action: 'fill', id: w.id }) : 'no room';
        res.after0 = snap(); res.fillState = w && w.fill ? { ...w.fill } : null }
      for (let k = 0; k < 20; k++) { await R.step(150); }
      res.after3000 = snap(); res.fillDone = room != null ? !s.nest.works.some(e => e.id === res.target?.id && e.fill) : null; return res }, room);
    console.log(JSON.stringify(out)); await p.close() }));
  await b.close() })();
