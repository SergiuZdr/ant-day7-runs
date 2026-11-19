// node scan.js START END WORKERS CHUNK : day-7 map facts for each seed on the live build (in-page sim constructor, no game run)
const {chromium}=require('playwright-core');const fs=require('fs');
const [START,END,W,CH]=process.argv.slice(2).map(Number);const RECYCLE=+(process.env.RECYCLE||40);
const DONE='done.txt';const done=new Set(fs.existsSync(DONE)?fs.readFileSync(DONE,'utf8').split('\n').filter(Boolean):[]);
const chunks=[];for(let a=START;a<END;a+=CH){if(!done.has(String(a)))chunks.push(a)}
const FN=`(a,b)=>{const C=window.__C;const out=[];
for(let sd=a;sd<b;sd++){const s=new C(sd);const P=s.pheromones,q=s.queenHome,hx=q.cx/8,hy=(q.cy-228)/8;
 let tanIn=0,brownIn=0,tan25=0,tan35=0,brown16=0,brown25=0;const cl=s.terrain.clay;
 for(let i=0;i<cl.length;i++){const v=cl[i];if(!v)continue;const x=i%160,y=(i/160)|0,d=Math.hypot(x-hx,y-hy),inn=P.contains(x,y);
  if(v===2){if(inn)tanIn++;if(d<=25)tan25++;if(d<=35)tan35++}else if(v===1){if(inn)brownIn++;if(d<=16)brown16++;if(d<=25)brown25++}}
 let seedsIn=0,seeds25=0;for(const x of s.seeds){const cx=Math.floor((x.cell%1280)/8),cy=Math.floor((Math.floor(x.cell/1280)-228)/8);if(P.contains(cx,cy))seedsIn++;if(Math.hypot(cx-hx,cy-hy)<=25)seeds25++}
 const u=s.unlocks,t=u.tree,ids=Object.keys(t);const nb=id=>[...t[id].links.filter(x=>!x.startsWith('@')),...ids.filter(n=>t[n].links.includes(id))];
 const dist={},prev={},dn=new Set();for(const id of ids){if(t[id].links.some(x=>x.startsWith('@')))dist[id]=t[id].seeds}
 while(true){let bb=null;for(const id of ids)if(!dn.has(id)&&dist[id]!=null&&(bb==null||dist[id]<dist[bb]))bb=id;if(bb==null)break;dn.add(bb);for(const n of nb(bb)){const c=dist[bb]+t[n].seeds;if(dist[n]==null||c<dist[n]){dist[n]=c;prev[n]=bb}}}
 const cost=(...ts)=>{const set=new Set();let g=0;for(const id of ts){let x=id;while(x){set.add(x);g=Math.max(g,t[x].group);x=prev[x]}}let c=0;for(const x of set)c+=t[x].seeds;return c+[0,1,3,6,10][g]};
 out.push([sd,tanIn,brownIn,tan25,tan35,brown16,brown25,seedsIn,seeds25,cost('ants-feeder','build-tan-clay-store'),cost('ants-feeder','build-tan-clay-store','upgrades-food')].join(','))}
return out.join('\\n')}`;
(async()=>{const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--disable-gpu','--disable-background-timer-throttling','--disable-renderer-backgrounding']});
let next=0;
async function worker(w){while(next<chunks.length){await worker1(w)}}
async function worker1(w){let n=0;const p=await b.newPage({viewport:{width:400,height:300}});
 await p.addInitScript(()=>{const ok=Object.keys;Object.keys=function(o){if(o&&o.sim&&'instantBuilding' in o&&'sandbox' in o&&!window.__C){window.__C=o.sim.constructor;window.requestAnimationFrame=()=>0}return ok.call(this,o)};});
 await p.goto('https://antarchitectgame.com/play/?seed=1',{waitUntil:'load'});
 for(let i=0;i<60&&!(await p.evaluate(()=>!!window.__C));i++) await p.waitForTimeout(500);
 while(next<chunks.length&&n++<RECYCLE){const a=chunks[next++];const t=Date.now();const r=await p.evaluate(`(${FN})(${a},${Math.min(a+CH,END)})`);
  fs.appendFileSync(`out-${process.env.TAG||''}${w}.csv`,r+'\n');fs.appendFileSync(DONE,a+'\n');
  if(w===0&&next%20===1)console.log(new Date().toISOString(),'chunk',a,'ms/seed',((Date.now()-t)/CH).toFixed(1),next,'/',chunks.length)}
 await p.close()}
await Promise.all(Array.from({length:W},(_,w)=>worker(w)));await b.close();console.log('ALL DONE')})();
