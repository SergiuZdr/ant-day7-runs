// node verify.js replay.json : import in a clean live page, step through, report max ants (1+workers+warriors) while day<=7
const {chromium}=require('playwright-core');const fs=require('fs');
(async()=>{const txt=fs.readFileSync(process.argv[2],'utf8');const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const p=await b.newPage();await p.addInitScript(()=>{window.requestAnimationFrame=()=>0;const ok=Object.keys;Object.keys=function(o){if(o&&o.sim&&'instantBuilding' in o&&'sandbox' in o)window.__sim=o.sim;return ok.call(this,o)}});
const seed=JSON.parse(txt).replay.seed;await p.goto('https://antarchitectgame.com/play/?seed='+seed,{waitUntil:'load'});
for(let j=0;j<120&&!(await p.evaluate(()=>!!(window.__sim&&window.ants&&window.ants.replay)));j++)await p.waitForTimeout(500);
await p.evaluate(([a,b])=>{window.__FROM=a;window.__STEP=b},[process.env.FROM||52650,process.env.STEP||450]);const r=await p.evaluate(async t=>{const R=window.ants.replay;await R.import(t);let best=0,bt=0;const T0=Date.now();
 const S=()=>window.__sim;const sc=()=>{const x=S().stats();return [1+x.workers+x.warriors,x.day]};
 for(let t=+window.__FROM;t<=62850;t+=+window.__STEP){await R.seek(t);const [s,d]=sc();if(d<=7&&s>best){best=s;bt=S().tick}}
 return {best,bt,build:JSON.parse(t).replay.build,status:R.status(),sec:(Date.now()-T0)/1000}},txt);
console.log(JSON.stringify(r));await b.close()})();
