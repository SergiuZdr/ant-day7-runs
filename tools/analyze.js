// Replays a saved run and reports where the fungus goes, per half day.
// node tools/analyze.js <replay.json> [step=1500]
const fs=require('fs');let pw;try{pw=require('playwright')}catch{pw=require('playwright-core')}
const file=process.argv[2], STEP=+(process.argv[3]||1500);
(async()=>{const b=await pw.chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-background-timer-throttling','--disable-renderer-backgrounding']});
const ctx=await b.newContext();const p=await ctx.newPage();
await p.addInitScript(()=>{const raf=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>setTimeout(()=>raf(cb),2000);const ok=Object.keys;Object.keys=function(o){if(o&&o.sim&&'instantBuilding' in o&&'sandbox' in o)window.__sim=o.sim;return ok.call(this,o)}});
const txt=fs.readFileSync(file,'utf8');const seed=JSON.parse(txt).seed||(file.match(/s(\d+)-/)||[])[1];
await p.goto(`https://antarchitectgame.com/play/?seed=${seed}&r=${Date.now()}`,{waitUntil:'load',timeout:180000});
for(let i=0;i<90;i++){const t=await p.evaluate(()=>window.__sim&&window.ants?window.__sim.tick:-1);if(t===0)break;await new Promise(r=>setTimeout(r,2000))}
await p.evaluate(async txt=>{await window.ants.replay.import(txt);await new Promise(r=>setTimeout(r,1500))},txt);
const rows=await p.evaluate(async STEP=>{const R=window.ants.replay,S=()=>window.__sim;const seen=new Map();const out=[];let meals=0,born=0,died=0,qt={};
 for(let t=0;t<=63000;t+=150){await R.seek(t);const s=S();const ids=new Set();
  for(const a of s.ants){ids.add(a.id);const o=seen.get(a.id);if(o===undefined){if(a.kind!=='queen')born++}else if(a.ate>o)meals++;seen.set(a.id,a.ate)}
  for(const id of [...seen.keys()]) if(!ids.has(id)){died++;seen.delete(id)}
  const q=s.queen;if(q)qt[q.task]=(qt[q.task]||0)+1;
  if(t%STEP===0){const x=s.stats();const c=s.castes();const hungry=s.ants.filter(a=>a.kind!=='queen'&&s.tick-a.ate>=9000*s.upgradeSpeed('food')).length;
   out.push({t,day:x.day,score:1+x.workers+x.warriors,cap:x.capacity,brood:x.brood,fungus:x.fungus,leaves:x.leaves,clay:x.clay,tan:x.tanClay,born,meals,died,hungry,qt,f:c.feeder,lc:c.leafcutter,fa:c.farmer,dg:c.digger,ups:{...s.upgrades},seeds:s.unlocks.collected});meals=0;born=0;died=0;qt={}}}
 return out},STEP);
console.log(JSON.stringify(rows));await b.close()})();
