const {browser,page,sleep}=require('./h.js');const fs=require('fs');
(async()=>{const seed=+process.argv[2]||55917, cfg=JSON.parse(process.argv[3]||'{}'), end=+(process.argv[4]||30000);
 const b=await browser();const p=await page(b,seed);
 await p.evaluate(`(()=>{${fs.readFileSync(__dirname+'/c2bot.js','utf8')}})()`);
 await p.evaluate(([c,e])=>{window.__C2.cfg=Object.assign(window.__C2.cfg,c);window.__runC2(e)},[cfg,end]);
 for(;;){await sleep(2000);if(await p.evaluate(()=>window.__C2.done||!!window.__C2.err))break}
 const r=await p.evaluate(()=>{const s=window.__sim,g=s.nest.grid,P=s.pheromones,L=s.digLevel();const lines=[];
  const ch={3:'F',4:'L',42:'D',43:'C',44:'M',0:'Q',5:'='};
  for(let y=0;y<40;y++){let l='';for(let x=40;x<125;x++){const v=g[y*160+x];let c;
   if(v>=0){const e=s.elems[v];c=e.kind===1?'=':(ch[e.room]||'?');if(e.kind===2&&!e.done)c=c.toLowerCase()}else if(v===-3)c='=';else{const d=s.cellDirt(x,y);c=d>L?'t':'.';if(s.terrain.clay[y*160+x]===1)c='1'} if(!P.contains(x,y))c=' ';l+=c}lines.push(String(y).padStart(2)+' '+l)}
  return {lines,why:window.__C2.why,dl:L,st:window.__stC2()}});
 console.log(r.lines.join('\n'));console.log(JSON.stringify(r.why),r.dl);const st=r.st;delete st.ts;console.log(JSON.stringify(st));
 await b.close()})();
