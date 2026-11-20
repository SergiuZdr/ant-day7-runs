// (1+lambda) elite ES for the c2nn net. env: SEED, BASE (json cfg), LAMBDA(6), CONC(6), DIR(nn1), GENS(100), SIG(0.3)
const {browser,page,sleep}=require('./h.js');const fs=require('fs');
const SEED=+(process.env.SEED||55917), BASE=JSON.parse(process.env.BASE||'{}'), LAMBDA=+(process.env.LAMBDA||6), CONC=+(process.env.CONC||6);
const DIR=process.env.DIR||'nn1', GENS=+(process.env.GENS||100), SIG=+(process.env.SIG||0.3);
fs.mkdirSync(DIR,{recursive:true});
const bot=fs.readFileSync(__dirname+'/c2bot.js','utf8'), nnsrc=fs.readFileSync(__dirname+'/c2nn.js','utf8');
const I=20,H=10,O=12; const rn=()=>{let u=0,v=0;while(!u)u=Math.random();v=Math.random();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)};
const SF=DIR+'/state.json';
let st=fs.existsSync(SF)?JSON.parse(fs.readFileSync(SF,'utf8')):{gen:0,best:null,bestScore:-1,hist:[]};
if(!st.best) st.best={W1:Array.from({length:H},()=>Array.from({length:I+1},()=>rn()*0.5)),W2:Array.from({length:O},()=>Array(H+1).fill(0))};
function mutate(n,sig){ const m=JSON.parse(JSON.stringify(n)); const p=0.3;
  for(const r of m.W1) for(let i=0;i<r.length;i++) if(Math.random()<p*0.5) r[i]+=rn()*sig*0.5;
  for(const r of m.W2) for(let i=0;i<r.length;i++) if(Math.random()<p) r[i]+=rn()*sig;
  return m }
async function evalNet(b,net,save){ const p=await page(b,SEED); try{
  await p.evaluate(`(()=>{${bot}})()`); await p.evaluate(([c,n])=>{window.__C2.cfg=Object.assign(window.__C2.cfg,c);window.__NET=n},[BASE,net]);
  await p.evaluate(nnsrc); await p.evaluate(()=>window.__runC2(63000));
  for(;;){await sleep(3000);if(await p.evaluate(()=>window.__C2.done||!!window.__C2.err))break}
  const r=await p.evaluate(()=>({s:window.__stC2().score,e:window.__C2.err}));
  if(r.e) console.log('ERR',r.e);
  r.rep=await p.evaluate(()=>{const x=window.ants.replay.export();return typeof x==='string'?x:JSON.stringify(x)});
  return r }finally{await p.ctx.close()} }
(async()=>{ let b=await browser();
  if(st.bestScore<0){ const r=await evalNet(b,st.best); st.bestScore=r.s; fs.writeFileSync(DIR+`/best-${r.s}.json`,r.rep); fs.writeFileSync(SF,JSON.stringify(st)); console.log('base',r.s) }
  for(;st.gen<GENS;st.gen++){ const t0=Date.now(); const cands=Array.from({length:LAMBDA},(_,k)=>mutate(st.best,SIG*(k%2?1:0.5)));
    const res=new Array(LAMBDA); let i=0;
    await Promise.all(Array.from({length:CONC},async()=>{while(i<LAMBDA){const k=i++;try{res[k]=await evalNet(b,cands[k])}catch(e){res[k]={s:-1};console.log('evalerr',String(e).slice(0,150))}}}));
    const sc=res.map(r=>r.s); let bi=sc.indexOf(Math.max(...sc));
    if(sc[bi]>st.bestScore){ st.best=cands[bi]; st.bestScore=sc[bi]; fs.writeFileSync(DIR+`/best-${sc[bi]}.json`,res[bi].rep); fs.writeFileSync(DIR+`/net-${sc[bi]}.json`,JSON.stringify(cands[bi])) }
    st.hist.push([st.gen,st.bestScore,sc]); fs.writeFileSync(SF,JSON.stringify(st));
    console.log(new Date().toISOString().slice(11,19),'gen',st.gen,'best',st.bestScore,'scores',sc.join(' '),((Date.now()-t0)/60000).toFixed(1)+'min');
    if(st.gen%5===4){ await b.close(); b=await browser() } }
  await b.close() })();
