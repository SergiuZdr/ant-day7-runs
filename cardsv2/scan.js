// node scan.js START END WORKERS CHUNK : day-7 map facts for each seed on the live build (in-page sim constructor, no game run)
const {chromium}=require('playwright');const fs=require('fs');
const [START,END,W,CH]=process.argv.slice(2).map(Number);const RECYCLE=+(process.env.RECYCLE||40);
const DONE='done.txt';const done=new Set(fs.existsSync(DONE)?fs.readFileSync(DONE,'utf8').split('\n').filter(Boolean):[]);
const chunks=[];for(let a=START;a<END;a+=CH){if(!done.has(String(a)))chunks.push(a)}
const FN=`(a,b)=>{const C=window.__C;const out=[];
for(let sd=a;sd<b;sd++){const s=new C(sd);const P=s.pheromones,q=s.queenHome,hx=q.cx/8,hy=(q.cy-228)/8;
 let brownIn=0,brown25=0,tanCl=0,dark=0,tanD=0;const cl=s.terrain.clay;
 for(let i=0;i<cl.length;i++){const x=i%160,y=(i/160)|0;const inn=P.contains(x,y);const v=cl[i];
  if(v===1){if(inn)brownIn++;if(Math.hypot(x-hx,y-hy)<=25)brown25++} if(v===2&&inn)tanCl++;
  if(inn&&s.nest.grid[i]===-1){const d=s.cellDirt(x,y);if(d===0)dark++;else if(d===1)tanD++}}
 let seedsIn=0;for(const x of s.seeds){const cx=Math.floor((x.cell%1280)/8),cy=Math.floor((Math.floor(x.cell/1280)-228)/8);if(P.contains(cx,cy))seedsIn++}
 out.push([sd,brownIn,brown25,tanCl,dark,tanD,seedsIn,Math.round(hx),Math.round(hy)].join(','))}
return out.join('\\n')}`;
(async()=>{const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--disable-gpu','--disable-background-timer-throttling','--disable-renderer-backgrounding']});
let next=0;
async function worker(w){while(next<chunks.length){await worker1(w)}}
async function worker1(w){let n=0;const p=await b.newPage({viewport:{width:400,height:300}});
 await p.addInitScript(()=>{const ok=Object.keys;Object.keys=function(o){if(o&&o.sim&&'instantBuilding' in o&&'sandbox' in o&&!window.__C){window.__C=o.sim.constructor;window.requestAnimationFrame=()=>0}return ok.call(this,o)};});
 await p.goto('https://ants2-cards-v2.pages.dev/?seed=1',{waitUntil:'load'});
 for(let i=0;i<60&&!(await p.evaluate(()=>!!window.__C));i++) await p.waitForTimeout(500);
 while(next<chunks.length&&n++<RECYCLE){const a=chunks[next++];const t=Date.now();const r=await p.evaluate(`(${FN})(${a},${Math.min(a+CH,END)})`);
  fs.appendFileSync(`out-${process.env.TAG||''}${w}.csv`,r+'\n');fs.appendFileSync(DONE,a+'\n');
  if(w===0&&next%20===1)console.log(new Date().toISOString(),'chunk',a,'ms/seed',((Date.now()-t)/CH).toFixed(1),next,'/',chunks.length)}
 await p.close()}
await Promise.all(Array.from({length:W},(_,w)=>worker(w)));await b.close();console.log('ALL DONE')})();
