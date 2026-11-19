// "Cancel hack" probe: play the 219 policy to tick AT, then (bot off) place N unfinished rooms of one type,
// let ants deliver leaves into them, cancel them all at AT+HOLD, and watch leaves/fungus/capacity afterwards.
const { chromium } = require('playwright-core'); const fs = require('fs');
const bot = fs.readFileSync('nnbot6.js', 'utf8'); const base = JSON.parse(fs.readFileSync('cfg200.json'));
const st = JSON.parse(fs.readFileSync('p3/state.json')); const H = 12, I = 23, O = 18, NP = H * I + H + O * H + O, OUTF = H * I + H, PH = 8, PI = 18;
const u = t => ({ W1: t.slice(0, H * I), b1: t.slice(H * I, OUTF), W2: t.slice(OUTF, OUTF + O * H), b2: t.slice(OUTF + O * H, NP) });
const up = t0 => { const t = t0.slice(NP); return { W1: t.slice(0, PH * PI), b1: t.slice(PH * PI, PH * PI + PH), W2: t.slice(PH * PI + PH, PH * PI + 2 * PH), b2: t.slice(PH * PI + 2 * PH) } };
const AT = +(process.env.AT || 36000), HOLD = +(process.env.HOLD || 4500), AFTER = +(process.env.AFTER || 1500);
const VARS = JSON.parse(process.env.VARS || '[[null,0],[13,1],[13,3],[6,3],[3,3],[1,3]]');
(async () => { const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  await Promise.all(VARS.map(async ([room, N]) => { const p = await b.newPage();
    await p.addInitScript(() => { window.requestAnimationFrame = () => 0; const ok = Object.keys; Object.keys = function (o) { if (o && o.sim && 'instantBuilding' in o && 'sandbox' in o) window.__sim = o.sim; return ok.call(this, o) } });
    await p.goto('https://antarchitectgame.com/play/?seed=55917', { waitUntil: 'load', timeout: 120000 });
    for (let j = 0; j < 120 && !(await p.evaluate(() => !!(window.__sim && window.ants && window.ants.replay))); j++) await p.waitForTimeout(500);
    await p.evaluate(([src, cfg, nn, pn, at]) => { window.__NN = nn; window.__PN = pn; window.__B14 = { log: [], cmds: 0, fails: 0, err: null, fc: new Map(), n: {}, best: 0, cfg }; new Function(src)(); window.__run14(at) }, [bot, base, st.pol.map(u), st.pol.map(up), AT]);
    while (!(await p.evaluate(() => window.__B14.done || !!window.__B14.err))) await p.waitForTimeout(500);
    const out = await p.evaluate(async ([room, N, HOLD, AFTER]) => { const s = window.__sim, R = window.ants.replay;
      const sum = a => a.reduce((p, c) => p + c, 0);
      const snap = () => { const x = s.stats(), L = x.ledger;
        return { t: s.tick, leaves: x.leaves, lcap: x.leafCapacity, fungus: x.fungus, clay: x.clay, loose: s.looseLeaves, owed: s.owed.leaves,
          gainL: sum(L.leaves.gained), gainF: sum(L.fungus.gained), spentL: sum(L.leaves.spent),
          hack: ids.map(id => { const w = s.elems[id]; return w ? (w.done ? 'DONE' : (w.materials ? w.materials.leaves + '/' + (w.materials.fungus || 0) : '?')) : 'gone' }).join(' ') } };
      const ids = [], at = []; const res = { room, N };
      // find valid spots with planRoom, nearest to the queen first
      const W = s.nest.grid.length; const q = s.queenHome, hx = q.cx / 8, hy = (q.cy - 228) / 8;
      const spots = [];
      if (room != null) { for (let y = 0; y < 200; y++) for (let x = 0; x < 200; x++) { spots.push([Math.hypot(x - hx, (y - hy) * 1.6), x, y]) } spots.sort((a, b) => a[0] - b[0]);
        for (const [, x, y] of spots) { if (ids.length >= N) break; let pl; try { pl = s.planRoom(room, x, y, false) } catch (e) { continue } if (!pl || !pl.ok) continue;
          const before = new Set(s.nest.works.map(w => w.id));
          if (R.command({ type: 'place-room', room, col: x, row: y })) { const w = s.nest.works.find(w => !before.has(w.id) && w.kind === 2); if (w) { ids.push(w.id); at.push([x, y]) } } } }
      res.placed = ids.length; res.why = (()=>{ const m={}; for (const [, x, y] of spots.slice(0,400)) { try { const pl=s.planRoom(room,x,y,false); if(!pl.ok){const k=String(pl.reason).slice(0,40); m[k]=(m[k]||0)+1} } catch(e){} } return m })(); res.cost = room!=null ? s.constructor.name : null; res.log = [snap()];
      for (let k = 0; k < HOLD / 150; k++) { await R.step(150); if (k % 6 === 5) res.log.push(snap()); }
      res.log.push(Object.assign(snap(), { tag: 'pre' }));
      // cancel each hack room that is still unfinished
      res.cancel = ids.map((id, i) => { const w = s.elems[id]; if (!w || w.done) return 'skip'; return R.command({ type: 'cancel-room', col: at[i][0], row: at[i][1] }) });
      res.log.push(Object.assign(snap(), { tag: 'cancelled' }));
      for (let k = 0; k < AFTER / 150; k++) { await R.step(150); if (k % 2 === 1) res.log.push(snap()); }
      return res }, [room, N, HOLD, AFTER]);
    console.log(JSON.stringify(out)); await p.close() }));
  await b.close() })();
