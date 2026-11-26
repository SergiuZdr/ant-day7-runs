// Seed sweep: run the bot on every seed of a range (this job's share) and record what matters.
// env: START END JOBS JOB CONC MAXMIN MAXCOST BASE BOT KEEP RUN_TAG DIR (+ GH_TOKEN/GITHUB_REPOSITORY in the cloud)
// Seeds whose research path (Trap-Jaw + Sprout) costs more than MAXCOST sap are skipped without loading the game.
const {browser,page,sleep}=require('./h.js');const fs=require('fs');const {execFileSync}=require('child_process');
const {tree,cost}=require('./tree.js');
const E=process.env, START=+E.START, END=+E.END, JOBS=+(E.JOBS||1), JOB=+(E.JOB||1), CONC=+(E.CONC||4);
const MAXMIN=+(E.MAXMIN||330), MAXCOST=+(E.MAXCOST||99), KEEP=+(E.KEEP||168), BASE=JSON.parse(E.BASE||'{}');
const DIR=E.DIR||'out', TAG=E.RUN_TAG||'local', CLOUD=!!E.GITHUB_REPOSITORY;
const bot=fs.readFileSync(__dirname+'/'+(E.BOT||'c3bot')+'.js','utf8');
fs.mkdirSync(DIR,{recursive:true});const OUT=`${DIR}/sweep-job${JOB}.jsonl`;
const t0=Date.now();let part=0,lastPush=Date.now(),best=0;
const seeds=[];let skipped=0;
for(let s=START+JOB-1;s<END;s+=JOBS){const T=tree(s);const c=cost(T,['combat-trap-jaw','build-sprout']).cost;if(c<=MAXCOST)seeds.push([s,c,cost(T,['combat-trap-jaw']).cost]);else skipped++}
console.log(`job ${JOB}: ${seeds.length} seeds to run, ${skipped} skipped by research cost`);
const sum=a=>(a||[]).reduce((p,q)=>p+q,0);
function push(final){ if(!CLOUD) return; const f=`${DIR}/push.jsonl`;
  // upload only the lines since the last push, as a new part file
  const lines=fs.existsSync(OUT)?fs.readFileSync(OUT,'utf8').split('\n').filter(Boolean):[];
  const from=push.n||0; if(lines.length===from&&!final) return; fs.writeFileSync(f,lines.slice(from).join('\n')+'\n');
  try{execFileSync('./pushfile.sh',[f,`results/${TAG}/sweep-job${JOB}-part${String(part).padStart(3,'0')}.jsonl`,`${TAG} job${JOB} part${part}`],{stdio:'inherit'});push.n=lines.length;part++}catch(e){console.log('push failed')} }
function save(rec,rep){ const f=`${DIR}/s${rec.seed}-${rec.score}.json`;fs.writeFileSync(f,rep);
  if(CLOUD) try{execFileSync('./pushfile.sh',[f,`results/${TAG}/replay-${rec.score}-s${rec.seed}.json`,`${TAG} ${rec.score} s${rec.seed}`],{stdio:'inherit'})}catch(e){} }
(async()=>{const b=await browser();let i=0,done=0;
 async function one([seed,c2,c1]){let p;try{p=await page(b,seed);
   await p.evaluate(`(()=>{${bot}})()`);
   await p.evaluate(([c])=>{window.__C2.cfg=Object.assign(window.__C2.cfg,c);window.__runC2(63000)},[BASE]);
   for(;;){await sleep(3000);if(await p.evaluate(()=>window.__C2.done||!!window.__C2.err))break}
   const st=await p.evaluate(()=>window.__stC2());const L=st.ledger||{};
   const rec={seed,score:st.score,trapJaw:st.castes.trapJaw,costTjSprout:c2,costTj:c1,
     fungus:sum(L.fungus&&L.fungus.gained),leaves:sum(L.leaves&&L.leaves.gained),leavesDay4:sum(L.leaves&&L.leaves.gained.slice(0,4)),clay:sum(L.clay&&L.clay.gained),
     eggs:sum(L.eggs&&L.eggs.gained),tjAt:(st.at||{})['combat-trap-jaw']??null,sprouts:st.n.r17||0,leafStores:st.n.r4||0,majors:st.n.r49||0,pheromones:st.n.r6||0,
     ants:Object.values(st.castes).reduce((a,b)=>a+b,0),err:st.err||null};
   // unusual runs are kept too: they may show a new trick
   rec.odd=rec.leaves>3200||rec.fungus>1100||!!rec.err||null;
   fs.appendFileSync(OUT,JSON.stringify(rec)+'\n');done++;
   if(rec.score>=KEEP||rec.score>best&&rec.score>=164||rec.odd&&!rec.err){const rep=await p.evaluate(()=>{const x=window.ants.replay.export();return typeof x==='string'?x:JSON.stringify(x)});save(rec,rep)}
   best=Math.max(best,rec.score);
  }catch(e){fs.appendFileSync(OUT,JSON.stringify({seed,err:String(e).slice(0,160)})+'\n')}
  if(p) await p.ctx.close().catch(()=>{}) }
 await Promise.all(Array.from({length:CONC},async()=>{while(i<seeds.length&&(Date.now()-t0)/60000<MAXMIN){const s=seeds[i++];await one(s);
   if(Date.now()-lastPush>10*60000){lastPush=Date.now();push(false);console.log(new Date().toISOString(),'done',done,'of',seeds.length,'best',best)}}}));
 push(true);console.log('finished',done,'of',seeds.length,'best',best,'reached index',i);await b.close()})();
