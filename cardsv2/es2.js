// (1+lambda) elite ES for c2pnn (knob + what + where nets). Runs locally or in GitHub Actions.
// env: SEED, BASE (json cfg), START (json net file: {k,w,p} or a plain knob net), LAMBDA, CONC, DIR, GENS,
//      SIG, MAXMIN (stop after), RS (rng seed), ONBEST (shell cmd run on a new best; gets $BEST_FILE $NET_FILE $SCORE)
const {browser,page,sleep}=require('./h.js');const fs=require('fs');const cp=require('child_process');
const E=process.env, SEED=+(E.SEED||55917), BASE=JSON.parse(E.BASE||'{"dd":9,"maxPend":5,"maxTun":1,"lcd":6,"lsMax":8}');
const LAMBDA=+(E.LAMBDA||8), CONC=+(E.CONC||4), DIR=E.DIR||'pn1', GENS=+(E.GENS||1000), SIG=+(E.SIG||0.08), MAXMIN=+(E.MAXMIN||1e9);
const T0=Date.now(); fs.mkdirSync(DIR,{recursive:true});
// mulberry32 (the old LCG lost precision in doubles and cycled every few generations)
let rs=(+(E.RS||Date.now()%1e9))>>>0; const rnd=()=>{rs=(rs+0x6D2B79F5)>>>0;let t=rs;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296};
const rn=()=>{let u=0;while(!u)u=rnd();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*rnd())};
const bot=fs.readFileSync(__dirname+'/'+(E.BOT||'c2bot')+'.js','utf8'), nnsrc=fs.readFileSync(__dirname+'/c2pnn.js','utf8');
const fresh=(I,H,O,s)=>({W1:Array.from({length:H},()=>Array.from({length:I+1},()=>rn()*s)),W2:Array.from({length:O},()=>Array(H+1).fill(0))});
const SF=DIR+'/state.json'; const WO=+(E.WO||8), KO=+(E.KO||15);
const PM=Object.fromEntries((E.PMUL||'k:1,w:1,p:1').split(',').map(x=>x.split(':')).map(([a,b])=>[a,+b]));
let st=fs.existsSync(SF)?JSON.parse(fs.readFileSync(SF,'utf8')):{gen:0,best:null,bestScore:+(E.START_SCORE||-1),hist:[]};
if(!st.best){ let s=E.START?JSON.parse(fs.readFileSync(E.START,'utf8')):{}; if(s.W1) s={k:s};
  st.best={k:s.k||fresh(20,10,KO,0.5),w:s.w||fresh(20,8,WO,0.5),p:s.p||fresh(18,8,1,0.7)} }
// grow the what-net to WO outputs (new outputs start at zero = no change)
for(const r of [st.best.w.W2]) while(r.length<WO) r.push(Array(st.best.w.W1.length+1).fill(0));
while(st.best.k.W2.length<KO) st.best.k.W2.push(Array(st.best.k.W1.length+1).fill(0));
function mutate(n,sig){ const m=JSON.parse(JSON.stringify(n)); const parts=['k','w','p']; const r=rnd();
  const pick=r<0.25?parts:[parts[Math.floor(rnd()*3)]];   // one net at a time most of the time
  for(const q of pick){ const sg=sig*(PM[q]??1); for(const row of m[q].W1) for(let i=0;i<row.length;i++) if(rnd()<0.15) row[i]+=rn()*sg*0.5;
    for(const row of m[q].W2) for(let i=0;i<row.length;i++) if(rnd()<0.3) row[i]+=rn()*sg }
  return m }
async function evalNet(b,net){ const p=await page(b,SEED); try{
  await p.evaluate(`(()=>{${bot}})()`); await p.evaluate(([c,n])=>{window.__C2.cfg=Object.assign(window.__C2.cfg,c);window.__NET=n},[BASE,net]);
  await p.evaluate(nnsrc); await p.evaluate(()=>window.__runC2(63000));
  for(;;){await sleep(3000);if(await p.evaluate(()=>window.__C2.done||!!window.__C2.err))break}
  const r=await p.evaluate(()=>({s:window.__stC2().score,e:window.__C2.err}));
  if(r.e){ console.log('ERR',r.e); r.s=-1 }
  r.rep=await p.evaluate(()=>{const x=window.ants.replay.export();return typeof x==='string'?x:JSON.stringify(x)});
  return r }finally{await p.ctx.close()} }
function onBest(s,rep,net){ const bf=DIR+`/best-${s}.json`, nf=DIR+`/net-${s}.json`; fs.writeFileSync(bf,rep); fs.writeFileSync(nf,JSON.stringify(net));
  if(E.ONBEST) try{ cp.execSync(E.ONBEST,{env:{...E,BEST_FILE:bf,NET_FILE:nf,SCORE:String(s)},stdio:'inherit',timeout:120000}) }catch(e){ console.log('onbest failed',String(e).slice(0,200)) } }
(async()=>{ let b=await browser();
  if(st.bestScore<0){ const r=await evalNet(b,st.best); st.bestScore=r.s; onBest(r.s,r.rep,st.best); fs.writeFileSync(SF,JSON.stringify(st)); console.log('base',r.s) }
  for(;st.gen<GENS;st.gen++){ if((Date.now()-T0)/60000>MAXMIN) break; const t0=Date.now();
    const cands=Array.from({length:LAMBDA},(_,k)=>mutate(st.best,SIG*(k%2?1:0.5)));
    const res=new Array(LAMBDA); let i=0;
    await Promise.all(Array.from({length:CONC},async()=>{while(i<LAMBDA){const k=i++;try{res[k]=await evalNet(b,cands[k])}catch(e){res[k]={s:-1};console.log('evalerr',String(e).slice(0,150))}}}));
    const sc=res.map(r=>r.s); const bi=sc.indexOf(Math.max(...sc));
    if(sc[bi]>st.bestScore){ st.best=cands[bi]; st.bestScore=sc[bi]; onBest(sc[bi],res[bi].rep,cands[bi]) }
    st.hist.push([st.gen,st.bestScore,sc]); fs.writeFileSync(SF,JSON.stringify(st));
    const line=[new Date().toISOString().slice(11,19),'gen',st.gen,'best',st.bestScore,'scores',sc.join(' '),((Date.now()-t0)/60000).toFixed(1)+'min'].join(' ');
    console.log(line);
    if(E.ONGEN) try{ cp.execSync(E.ONGEN,{env:{...E,LINE:line},stdio:'inherit',timeout:120000}) }catch(e){ console.log('ongen failed',String(e).slice(0,200)) }
    if(st.gen%5===4){ await b.close(); b=await browser() } }
  await b.close() })();
