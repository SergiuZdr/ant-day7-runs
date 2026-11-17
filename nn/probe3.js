const { chromium } = require('playwright-core'); const fs = require('fs');
const bot = fs.readFileSync('nnbot3.js', 'utf8'); const cfg = JSON.parse(fs.readFileSync('cfg200.json'));
const st = JSON.parse(fs.readFileSync('p1/state.json')); const H=12,I=23,O=16,NP=H*I+H+O*H+O,OUTF=H*I+H;
const u = th => ({ W1: th.slice(0, H*I), b1: th.slice(H*I, OUTF), W2: th.slice(OUTF, OUTF+O*H), b2: th.slice(OUTF+O*H, NP) });
(async () => { const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const p = await b.newPage(); await p.addInitScript(() => { window.requestAnimationFrame = () => 0; const ok = Object.keys; Object.keys = function (o) { if (o && o.sim && 'instantBuilding' in o && 'sandbox' in o) window.__sim = o.sim; return ok.call(this, o) } });
  await p.goto('https://antarchitectgame.com/play/?seed=55917', { waitUntil: 'load' });
  for (let j = 0; j < 120 && !(await p.evaluate(() => !!(window.__sim && window.ants && window.ants.replay))); j++) await p.waitForTimeout(500);
  await p.evaluate(([src, cfg, nn]) => { window.__NN = nn; window.__B14 = { log: [], cmds: 0, fails: 0, err: null, fc: new Map(), n: {}, best: 0, cfg }; new Function(src)();
    window.__T=[]; const S=()=>window.__sim; const R=window.ants.replay; const st0=R.step.bind(R);
    const s0=window.__sim; window.__G={}; const og=s0.onGain; s0.onGain=function(e){ const k=e.resource; window.__G[k]=(window.__G[k]||0)+(e.amount||1); return og&&og.apply(this,arguments) }; window.__run14() }, [bot, cfg, st.pol.map(u)]);
  
  await p.evaluate(()=>{ const s=window.__sim; window.__P={first:new Array(s.plants.length).fill(-1),regTicks:new Array(s.plants.length).fill(0),day:[]};
    const P=window.__P; P.px=s.plants.map(pl=>pl&&(pl.x??pl.cx??pl.col??null)); P.keys=Object.keys(s.plants[0]||{}); P.ent=s.nest.entrance||null;
    const R=window.ants.replay, st0=R.step.bind(R);
    const sample=()=>{ const n=s.plants.length; let reg=0,full=0,bur=0,empty=0; const day=Math.floor(s.tick/9000), dl=(s.tick%9000)<6000;
      for(let t=0;t<n;t++){ let miss=0,pres=0,b=0; for(let r=0;r<21;r++){ const i=t*21+r; const e=s.elems[s.nest.leafPaths[i]]; const buried=e&&e.ys[e.n-1]>=220-s.moundH[Math.round(e.xs[e.n-1])];
          if(s.plantStock[i]) pres++; else if(buried) b++; else miss++ }
        if(miss&&P.first[t]<0) P.first[t]=s.tick; if(miss){reg++; if(dl) P.regTicks[t]+=150} if(pres===21) full++; if(!pres) empty++; bur+=b }
      (P.day[day]=P.day[day]||{n:0,reg:0,full:0,bur:0,empty:0,lc:0}); const D=P.day[day]; D.n++; if(dl){D.reg+=reg} D.full+=full; D.bur=bur; D.empty+=empty; D.lc+=s.castes().leafcutter };
    R.step=async function(k){ const r=await st0(k); sample(); return r } });
  while (true) { await p.waitForTimeout(1000); if (await p.evaluate(() => window.__B14.done||!!window.__B14.err)) break }
  const P=await p.evaluate(()=>window.__P); console.log('PLANTS',JSON.stringify(P));
console.log(JSON.stringify(await p.evaluate(()=>({G:window.__G,hatched:window.__sim.stats().hatched,ledger:window.__sim.stats().ledger,best:window.__B14.best,qs:window.__B14.qs,n:window.__B14.n,stats:Object.keys(window.__sim.stats())}))));
  await b.close() })();
