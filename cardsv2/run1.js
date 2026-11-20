// node run1.js seed '{cfg}' [end] [savefile]
const {browser,page,sleep}=require('./h.js');const fs=require('fs');
(async()=>{const seed=+process.argv[2]||55917, cfg=JSON.parse(process.argv[3]||'{}'), end=+(process.argv[4]||63000);
 const b=await browser();const p=await page(b,seed);const t0=Date.now();
 await p.evaluate(`(()=>{${fs.readFileSync(__dirname+'/'+(process.env.BOT||'c2bot')+'.js','utf8')}})()`);
 await p.evaluate(([c,e])=>{window.__C2.cfg=Object.assign(window.__C2.cfg,c);window.__runC2(e)},[cfg,end]);
 let last=0;for(;;){await sleep(3000);const r=await p.evaluate(()=>({d:window.__C2.done,e:window.__C2.err,t:window.__sim.tick,s:window.__sim.stats().workers}));
  if(process.env.V&&r.t-last>=9000){last=r.t;console.error('t',r.t,'ants',r.s+1,((Date.now()-t0)/1000|0)+'s')}
  if(r.d||r.e)break}
 const st=await p.evaluate(()=>window.__stC2());
 st.sec=((Date.now()-t0)/1000|0); const ts=st.ts;delete st.ts;
 console.log(JSON.stringify(st));
 if(process.env.TS) for(const r of ts) console.log(r.join('\t'));
 if(process.env.LOG) console.log(JSON.stringify(await p.evaluate(()=>window.__C2.log.slice(-200))));
 if(process.argv[5]){const rep=await p.evaluate(()=>{const x=window.ants.replay.export();return typeof x==='string'?x:JSON.stringify(x)});fs.writeFileSync(process.argv[5],rep)}
 await b.close()})();
