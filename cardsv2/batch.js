// node batch.js cfgs.json out.jsonl [conc] : each line of cfgs = {seed,cfg,end?,save?}
const {browser,page,sleep}=require('./h.js');const fs=require('fs');
const jobs=JSON.parse(fs.readFileSync(process.argv[2],'utf8')), out=process.argv[3], CONC=+(process.argv[4]||6);
const bot=fs.readFileSync(__dirname+'/'+(process.env.BOT||'c2bot')+'.js','utf8');
(async()=>{const b=await browser();let i=0;
 async function one(j){const t0=Date.now();const p=await page(b,j.seed||55917);
  try{await p.evaluate(`(()=>{${bot}})()`);
  await p.evaluate(([c,e])=>{window.__C2.cfg=Object.assign(window.__C2.cfg,c);window.__runC2(e)},[j.cfg||{},j.end||63000]);
  for(;;){await sleep(3000);if(await p.evaluate(()=>window.__C2.done||!!window.__C2.err))break}
  const st=await p.evaluate(()=>window.__stC2());const ts=st.ts;delete st.ts;
  const rec={seed:j.seed||55917,cfg:j.cfg,score:st.score,tag:j.tag,sec:(Date.now()-t0)/1000|0,n:st.n,castes:st.castes,err:st.err,clay:st.clay,leaves:st.leaves,brood:st.brood,waste:st.waste,noClay:st.noClay};
  if(j.save||(process.env.KEEP&&st.score>=+process.env.KEEP)){const rep=await p.evaluate(()=>{const x=window.ants.replay.export();return typeof x==='string'?x:JSON.stringify(x)});const f=`saves/s${rec.seed}-${rec.score}-${Date.now()}.json`;fs.mkdirSync('saves',{recursive:true});fs.writeFileSync(f,rep);rec.file=f}
  fs.appendFileSync(out,JSON.stringify(rec)+'\n');console.log(rec.score,rec.tag||'',JSON.stringify(j.cfg))}catch(e){console.log('ERR',String(e).slice(0,200))}
  await p.ctx.close()}
 await Promise.all(Array.from({length:CONC},async()=>{while(i<jobs.length){const j=jobs[i++];await one(j)}}));
 await b.close()})();
