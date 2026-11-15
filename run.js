// Runs the day-7 bot headless against the live game, one fresh browser context per run.
// Env: SEED (1488), BOT (bot15), N (runs, 4), MODE (local|fixed), BASE (json cfg), KEEP (save replays >= this), OUT (out), CHROME_PATH (optional)
const fs = require('fs'), path = require('path');
let pw; try { pw = require('playwright') } catch { pw = require('playwright-core') }

const SEED = +(process.env.SEED || 1488);
const BOT = process.env.BOT || 'bot15';
const N = +(process.env.N || 4);
const MODE = process.env.MODE || 'local';
const KEEP = +(process.env.KEEP || 131);
const OUT = process.env.OUT || 'out';
const URL = process.env.GAME_URL || 'https://antarchitectgame.com/play/';
const BASE = Object.assign({ lcEarly: 0.7, lcShare: 0.25, dSwitch: 4, houseSlack: 3, farmPer: 5, maxPend: 2, hr: 8, tunLen: 6, digMax: 3, lc0: 2, farmersPer: 1 },
  JSON.parse(process.env.BASE || '{}'));
// small changes around the best config (1-3 keys per run)
const OPTS = { lcEarly: [0.6, 0.65, 0.7, 0.75, 0.8], lcShare: [0.15, 0.2, 0.25, 0.3], dSwitch: [3, 4, 5], houseSlack: [2, 3, 4], farmPer: [4, 5, 6],
  maxPend: [2, 3], hr: [7, 8, 9, 10], tunLen: [5, 6, 7], digMax: [2, 3, 4], lc0: [2, 3] };
const pick = a => a[Math.floor(Math.random() * a.length)];
function nextCfg(i) {
  const c = { ...BASE };
  if (MODE === 'fixed' || i === 0 && MODE !== 'random') return c;
  const keys = Object.keys(OPTS).sort(() => Math.random() - 0.5).slice(0, 1 + Math.floor(Math.random() * 3));
  for (const k of keys) c[k] = pick(OPTS[k]);
  return c;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
const botSrc = fs.readFileSync(path.join(__dirname, 'bots', BOT + '.js'), 'utf8');

async function oneRun(browser, cfg, idx) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const p = await ctx.newPage();
  // throttle rendering (the sim runs from the bot's own steps) and capture the sim object
  await p.addInitScript(() => {
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = cb => setTimeout(() => raf(cb), 2000);
    const ok = Object.keys;
    Object.keys = function (o) { if (o && o.sim && 'instantBuilding' in o && 'sandbox' in o) window.__sim = o.sim; return ok.call(this, o) };
  });
  const t0 = Date.now();
  await p.goto(`${URL}?seed=${SEED}&r=${Date.now()}`, { waitUntil: 'load', timeout: 180000 });
  for (let i = 0; i < 90; i++) { const t = await p.evaluate(() => window.__sim && window.ants ? window.__sim.tick : -1); if (t === 0) break; await sleep(2000) }
  await p.evaluate(`(()=>{${botSrc}})()`);
  await p.evaluate(c => { window.__B14.cfg = Object.assign(window.__B14.cfg, c); window.__run14() }, cfg);
  let st;
  for (let i = 0; i < 1200; i++) {
    await sleep(3000);
    const d = await p.evaluate(() => window.__B14.done || !!window.__B14.err);
    if (d) break;
  }
  st = await p.evaluate(() => window.__st14());
  const best = await p.evaluate(() => window.__B14.best);
  const rec = { seed: SEED, bot: BOT, best, cfg, minutes: +((Date.now() - t0) / 60000).toFixed(1), castes: st.castes, n: st.n, err: st.err };
  if (best >= KEEP) {
    const replay = await p.evaluate(() => { const x = window.ants.replay.export(); return typeof x === 'string' ? x : JSON.stringify(x) });
    const log = await p.evaluate(() => JSON.stringify(window.__B14.log));
    const name = `s${SEED}-b${best}-${Date.now()}-${idx}`;
    fs.writeFileSync(path.join(OUT, 'replays', name + '.json'), replay);
    fs.writeFileSync(path.join(OUT, 'replays', name + '.log.json'), log);
    fs.writeFileSync(path.join(OUT, 'replays', name + '.cfg.json'), JSON.stringify(cfg));
    rec.saved = name;
  }
  await ctx.close();
  return rec;
}

(async () => {
  fs.mkdirSync(path.join(OUT, 'replays'), { recursive: true });
  const browser = await pw.chromium.launch({
    headless: true, executablePath: process.env.CHROME_PATH || undefined,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-background-timer-throttling', '--disable-renderer-backgrounding']
  });
  for (let i = 0; i < N; i++) {
    const cfg = nextCfg(i);
    let rec;
    try { rec = await oneRun(browser, cfg, i) } catch (e) { rec = { seed: SEED, bot: BOT, best: 0, cfg, error: String(e).slice(0, 300) } }
    fs.appendFileSync(path.join(OUT, 'results.jsonl'), JSON.stringify(rec) + '\n');
    console.log(`run ${i + 1}/${N}: best=${rec.best} ${JSON.stringify(cfg)}${rec.saved ? ' SAVED ' + rec.saved : ''}${rec.error ? ' ERROR ' + rec.error : ''}`);
  }
  await browser.close();
})();
