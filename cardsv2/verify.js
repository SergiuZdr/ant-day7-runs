// node verify.js replay.json seed [tick] : import into a clean Cards v2 page, seek, print ants
const {browser,page}=require('./h.js');const fs=require('fs');
(async()=>{const b=await browser();const p=await page(b,+process.argv[3]);const T=+(process.argv[4]||63000);
 const t=fs.readFileSync(process.argv[2],'utf8');
 const r=await p.evaluate(async([t,T])=>{const R=window.ants.replay;await R.import(t);await R.seek(T);const s=window.__sim,x=s.stats();return {ants:1+x.workers+x.warriors,tick:s.tick,status:JSON.stringify(R.status?.()).slice(0,300)}},[t,T]);
 console.log(JSON.stringify(r));await b.close()})();
