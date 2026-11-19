// node verifyend.js replay.json : import in a clean live page, seek to tick 63000 (end of day 7, what the board records), print ants
const { chromium } = require('playwright-core'); const fs = require('fs');
(async () => { const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true }); const p = await b.newPage();
  await p.addInitScript(() => { window.requestAnimationFrame = () => 0; const ok = Object.keys; Object.keys = function (o) { if (o && o.sim && 'instantBuilding' in o && 'sandbox' in o) window.__sim = o.sim; return ok.call(this, o) } });
  const t = fs.readFileSync(process.argv[2], 'utf8'); const seed = JSON.parse(t).replay?.seed ?? process.argv[3];
  await p.goto('https://antarchitectgame.com/play/?seed=' + (process.argv[3] || 1), { waitUntil: 'load', timeout: 120000 });
  for (let j = 0; j < 120 && !(await p.evaluate(() => !!(window.ants && window.ants.replay))); j++) await p.waitForTimeout(500);
  const r = await p.evaluate(async t => { const R = window.ants.replay; await R.import(t); await R.seek(63000); const x = window.__sim.stats(); return { end: 1 + x.workers + x.warriors, tick: window.__sim.tick } }, t);
  console.log(JSON.stringify(r)); await b.close() })();
