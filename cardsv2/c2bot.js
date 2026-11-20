// c2bot: day-7 bot for the Cards v2 build (ants come from Dens).
// Core rule: a den gets +1 ant for every matching room in reach of ANY den in its joined group
// (farmer den <- fungus farm, leafcutter den <- leaf storage, digger den <- royal chamber).
// Joined farmer-den chain x many fungus farms (5 leaves each, no clay) => ants ~ dens * farms.
// Normal player commands only. Score = 1 + workers + warriors at tick 63000.
const R=window.ants.replay,V=160,Y=89;
const S=()=>window.__sim;
const B=window.__C2=window.__C2||{log:[],cmds:0,fails:0,err:null,fc:new Map(),n:{},best:0};
B.stop=false;
B.cfg=Object.assign({end:63000,
  dd:3,          // digger dens (free, +1 near royal chamber)
  ddAt:0,        // earliest tick for digger dens beyond the first
  ls:2,          // leaf storages early
  lcd:200,       // leafcutter dens
  fd:200,        // farmer dens max
  fdAt:0,        // first farmer den not before this tick
  farmMax:80,    // farms max
  maxPend:3,     // pending rooms at once (tunnels not counted)
  maxTun:1,      // clay tunnels at once
  clayRes:0,     // clay kept back
  lsMore:1,      // extra leaf storage when leaves near cap
  farmFirst:0,   // 1: farms before dens when both affordable
  denRow:0,      // preferred row offset of the den chain from the royal chamber
  farmLeafRes:0, // leaves kept back
  fW:1,lW:1,     // den gain weights
  keepClay:2,    // clay kept for the next den when an egg is near
  lsMax:200,
  ovf:1, ddMax:30, phero:2,
  pendN:{}, grpPen:40, grpFarm:2, phSpace:3, phNear:0.5, holdMax:3000, pits:0, resAt:0, cards:['build-clay-pit'], fungusRes:0, seedTun:1, pitHold:0,
  sd:1, sdAt:6000, sdHold:1, covW:0.15, // Strong Digging levels on digger dens; hold clay for it
},B.cfg||{});
const SZ={0:[4,2],8:[3,2],9:[4,3],10:[3,4],1:[2,2],3:[3,3],4:[4,2],7:[5,2],13:[3,3],14:[3,3],12:[2,3],5:[1,1],6:[2,3],15:[4,2],16:[4,3],17:[3,3],18:[2,4],42:[3,2],43:[3,2],44:[3,2],45:[3,2],46:[3,2],47:[3,2],48:[3,2],50:[3,2],49:[2,1]};
const log=(...a)=>{B.log.push([S().tick,...a]);if(B.log.length>600)B.log.splice(0,100)};
const cnt=k=>{B.n[k]=(B.n[k]||0)+1};
const G=()=>S().nest.grid;
const st=()=>S().stats();
const score=()=>{const x=st();return 1+x.workers+x.warriors};
const castes=()=>S().castes();
const rooms=t=>S().nest.works.filter(e=>e.kind===2&&e.room===t&&!e.fill);
const done=t=>rooms(t).filter(e=>e.done).length;
const pendingWorks=()=>S().nest.works.filter(e=>!e.done&&!e.fill);
const pendRooms=()=>pendingWorks().filter(w=>w.kind===2);
const pendRoom=r=>pendRooms().filter(w=>w.room===r).length>=((B.cfg.pendN||{})[r]||1);
const freeR=(x,y,w,h)=>{ if(x<0||y<0||x+w>V||y+h>Y) return false; const g=G(); for(let a=0;a<h;a++)for(let b=0;b<w;b++) if(g[(y+a)*V+x+b]!==-1) return false; return true };
const covered=(x,y,w,h)=>{ const P=S().pheromones; for(let a=0;a<h;a++)for(let b=0;b<w;b++) if(!P.contains(x+b,y+a)) return false; return true };
const diggable=(x,y,w,h)=>{ const s=S(),L=s.digLevel(); for(let a=0;a<h;a++)for(let b=0;b<w;b++) if(s.cellDirt(x+b,y+a)>L) return false; return true };
const cmd=c=>{ if(B.stop) throw Error('stopped'); const r=R.command(c); B.cmds++; if(!r){B.fails++; log('fail',JSON.stringify(c))} return r };
const ctr=e=>[e.cx/8,(e.cy-228)/8];
const RC=()=>ctr(S().royal);
// bonus reach in cells (inBonusReach with rangeCells 5): centre gaps < (w1+w2)/2+5 and (h1+h2)/2+5
const reach=(ra,ax,ay,rb,bx,by)=>{ const [wa,ha]=SZ[ra],[wb,hb]=SZ[rb]; return Math.abs(ax-bx)<(wa+wb)/2+5&&Math.abs(ay-by)<(ha+hb)/2+5 };
// does a room of type `room` at (x,y) touch a room of type `room` (side contact => joined)?
const touches=(room,x,y,w,h)=>{ const g=G(),s=S(); for(let i=y-1;i<=y+h;i++) for(let j=x-1;j<=x+w;j++){ if(!((j>=x&&j<x+w)||(i>=y&&i<y+h))) continue; if((j>=x&&j<x+w)&&(i>=y&&i<y+h)) continue; if(j<0||i<0||j>=V||i>=Y) continue; const v=g[i*V+j]; if(v>=0&&s.elems[v].room===room&&!s.elems[v].fill) return true } return false };
function place(room,scoreFn){ const [w,h]=SZ[room]; const c=[];
  for(let y=0;y+h<=Y;y++) for(let x=0;x+w<=V;x++){ if(!freeR(x,y,w,h)||!covered(x,y,w,h)||!diggable(x,y,w,h)) continue;
    const sc=scoreFn(x,y,w,h); if(sc!=null) c.push([sc,x,y]) }
  c.sort((a,b)=>a[0]-b[0]); let tries=0; if(!c.length){ B.nocand=B.nocand||{}; B.nocand[room]=S().tick }
  for(const [,x,y] of c){ const key=room+':'+x+':'+y, f=B.fc.get(key); if(f&&S().tick-f<3000) continue;
    const p=S().planRoom(room,x,y,false); if(!p.ok){ B.why=B.why||{}; const wk=room+':'+String(p.reason).slice(0,40); B.why[wk]=(B.why[wk]||0)+1; if(!/^Needs/.test(p.reason)) B.fc.set(key,S().tick); if(++tries>25) break; continue }
    if(cmd({type:'place-room',room,col:x,row:y})){ log('place',room,x,y); cnt('r'+room); return true }
    if(++tries>25) break }
  return false }
const isDug=v=>v===-3||v>=0;
function digTo(targets,tag){ const s=S(), g=G(), P=s.pheromones, L=s.digLevel();
  const pendT=pendingWorks().filter(w=>w.kind===1).length; if(pendT>=B.cfg.maxTun) return 0;
  const ok=(x,y)=>x>=0&&y>=0&&x<V&&y<Y&&g[y*V+x]===-1&&P.contains(x,y)&&s.cellDirt(x,y)<=L;
  B.bad=B.bad||new Map(); const now=s.tick;
  targets=targets.filter(([x,y])=>ok(x,y)&&!((B.bad.get(tag+':'+x+','+y)||0)>now)); if(!targets.length) return -1;
  const dug=[]; for(let i=0;i<V*Y;i++) if(isDug(g[i])) dug.push([i%V,Math.floor(i/V)]);
  const pairs=[]; for(const [tx,ty] of targets) for(const [dx,dy] of dug) pairs.push([Math.abs(tx-dx)+Math.abs(ty-dy),tx,ty,dx,dy]);
  pairs.sort((a,b)=>a[0]-b[0]);
  const tryLine=(fx,fy,ex,ey)=>{ const sx=Math.sign(ex-fx),sy=Math.sign(ey-fy); let k=0,x=fx,y=fy;
    while(k<12){ const nx=x+sx,ny=y+sy; if(!ok(nx,ny)) break; x=nx;y=ny;k++; if(x===ex&&y===ey) break }
    for(let j=k;j>=1;j--){ const ex2=fx+sx*j, ey2=fy+sy*j; const p=S().planRoom(5,ex2,ey2,false,{col:fx,row:fy}); if(!p.ok) continue;
      if(cmd({type:'place-room',room:5,col:ex2,row:ey2,fromCol:fx,fromRow:fy})){ log(tag,fx,fy,ex2,ey2); cnt(tag); return true } }
    return false };
  const per=new Map(); let nt=0; const tried=[];
  for(const [,tx,ty,dx,dy] of pairs){ const k=tx+','+ty, c=per.get(k)||0; if(c>=3) continue; if(!c){ if(nt>=15) continue; nt++; tried.push(k) } per.set(k,c+1);
    if(dx!==tx && tryLine(dx,dy,tx,dy)) return 1;
    if(dy!==ty && tryLine(dx,dy,dx,ty)) return 1 }
  for(const k of tried) B.bad.set(tag+':'+k,now+4500);
  return 0 }
function digClay(){ const s=S(), g=G(), x=st(); if(x.clay>=x.clayCapacity-(B.hold?0:2)) return 0;
  const t=[]; for(let i=0;i<V*Y;i++){ if(s.terrain.clay[i]===1&&g[i]===-1) t.push([i%V,Math.floor(i/V)]) }
  const r=digTo(t,'tun'); if(r<0){ B.noClay=S().tick; return 0 } return r }

// --- placement scores
const dRoyal=(x,y,w,h)=>{ const [rx,ry]=RC(); return Math.hypot(x+w/2-rx,(y+h/2-ry)*1.3) };
const groupOf=room=>rooms(room).map(e=>[...ctr(e)]);
const inGroupReach=(den,room,x,y,w,h)=>{ const cx=x+w/2,cy=y+h/2; return rooms(den).some(e=>{ const [ex,ey]=ctr(e); return reach(den,ex,ey,room,cx,cy) }) };
// digger dens: touch the royal chamber's reach, chain together
const ddScore=(x,y,w,h)=>{ const [rx,ry]=RC(); const n=rooms(42).length; const inR=reach(42,x+w/2,y+h/2,0,rx,ry);
  if(n===0) return inR?dRoyal(x,y,w,h):null; return touches(42,x,y,w,h)?dRoyal(x,y,w,h):null };
const lsScore=(x,y,w,h)=>dRoyal(x,y,w,h)+(rooms(43).length&&inGroupReach(43,4,x,y,w,h)?-6:0);
const lcdScore=(x,y,w,h)=>{ const n=rooms(43).length; if(n&&!touches(43,x,y,w,h)) return null; const ls=rooms(4).filter(e=>{const [ex,ey]=ctr(e);return reach(43,x+w/2,y+h/2,4,ex,ey)}).length; return dRoyal(x,y,w,h)-ls*2-newCover(43,4,x,y,w,h)*B.cfg.covW*0.5 };
// farmer den chain: first near royal (offset), then touching the chain, prefer horizontal growth near royal row
// free diggable covered cells within reach of a den at (x,y) that no den of that type reaches yet (farm-sized targets)
function newCover(den,src,x,y,w,h){ const s=S(),g=G(),P=s.pheromones,L=s.digLevel(); const [sw,sh]=SZ[src]; const cx=x+w/2,cy=y+h/2;
  const ex=rooms(den).map(ctr); let k=0;
  const rx=Math.ceil((w+sw)/2+5), ry=Math.ceil((h+sh)/2+5);
  for(let yy=Math.max(0,Math.floor(cy-ry));yy<Math.min(Y,cy+ry);yy++) for(let xx=Math.max(0,Math.floor(cx-rx));xx<Math.min(V,cx+rx);xx++){
    if(g[yy*V+xx]!==-1||!P.contains(xx,yy)||s.cellDirt(xx,yy)>L) continue; if(xx>=x&&xx<x+w&&yy>=y&&yy<y+h) continue;
    const fx=xx+0.5, fy=yy+0.5; if(!reach(den,cx,cy,src,fx,fy)) continue;
    if(ex.some(([a,b])=>reach(den,a,b,src,fx,fy))) continue; k++ }
  return k }
const fdScore=(x,y,w,h)=>{ const n=rooms(44).length; const d=dRoyal(x,y,w,h);
  if(n===0) return d<4?null:d-newCover(44,3,x,y,w,h)*B.cfg.covW;
  const farms=rooms(3).filter(e=>{const [a,b]=ctr(e);return reach(44,x+w/2,y+h/2,3,a,b)}).length;
  if(!touches(44,x,y,w,h)) return B.cfg.grpPen<0?null:d-newCover(44,3,x,y,w,h)*B.cfg.covW-farms*B.cfg.grpFarm+B.cfg.grpPen; return d-newCover(44,3,x,y,w,h)*B.cfg.covW };
const farmScore=(x,y,w,h)=>{ if(rooms(44).length&&!inGroupReach(44,3,x,y,w,h)) return null; return dRoyal(x,y,w,h) };

// caps: never let eggs or clay sit full (each wasted egg is a lost den)
function overflow(x){ const c=B.cfg; if(!c.ovf) return false; const s=S();
  if(x.brood>=s.eggCapacity()){ if(x.clay>=2&&rooms(44).length<c.fd&&place(44,fdScore)) return true; if(x.clay>=1&&rooms(4).length&&place(43,lcdScore)) return true; if(rooms(42).length<c.ddMax&&place(42,ddScore)) return true }
  if(x.clay>=x.clayCapacity-1&&!B.hold){ if(rooms(43).length&&place(4,lsScore)) return true }
  return false }
// pheromone room toward buried brown clay outside range, when none is left in range
function pheroClay(x){ const c=B.cfg,s=S(); if(!c.phero||rooms(6).length>=c.phero||!B.noClay||s.tick-B.noClay>600) return false;
  if(x.leaves<10||x.fungus<10||pendRoom(6)) return false; const P=s.pheromones,[hx,hy]=RC(),g=G();
  const pts=[]; for(let i=0;i<V*Y;i++){ if(s.terrain.clay[i]===1&&g[i]===-1){ const a=i%V,b=(i/V)|0; if(!P.contains(a,b)) pts.push([a,b]) } }
  if(!pts.length) return false;
  return place(6,(x0,y0,w,h)=>{ const cx=x0+1,cy=y0+1.5; let k=0; for(const [a,b] of pts) if(Math.hypot(a-cx,b-cy)<=16) k++; return k?-k+Math.hypot(cx-hx,cy-hy)*0.2:null }) }
// ---- research: queen levels (fungus), seeds, cards, clay pits
const seedCells=()=>S().seeds.map(x=>[Math.floor((x.cell%1280)/8),Math.floor((Math.floor(x.cell/1280)-228)/8)]);
function planCards(targets){ const u=S().unlocks,t=u.tree,ids=Object.keys(t);
  const nb=id=>[...t[id].links.filter(x=>!x.startsWith('@')),...ids.filter(n=>t[n].links.includes(id))];
  const dist={},prev={},dn=new Set();
  for(const id of ids){ if(u.unlocked.has(id)) dist[id]=0; else if(t[id].links.some(x=>x.startsWith('@'))) dist[id]=t[id].seeds }
  while(true){ let b=null; for(const id of ids) if(!dn.has(id)&&dist[id]!=null&&(b==null||dist[id]<dist[b])) b=id; if(b==null) break; dn.add(b);
    for(const n of nb(b)){ const c=dist[b]+(u.unlocked.has(n)?0:t[n].seeds); if(dist[n]==null||c<dist[n]){dist[n]=c;prev[n]=b} } }
  const out=[]; for(const tg of targets){ const ch=[]; let x=tg; while(x!=null&&!out.includes(x)&&!ch.includes(x)){ ch.unshift(x); x=prev[x] } for(const c of ch) if(!out.includes(c)) out.push(c) }
  return out }
function research(){ const c=B.cfg,s=S(),u=s.unlocks; if(!c.pits||s.tick<c.resAt) return false;
  if(!B.plan){ B.plan=planCards(c.cards); const t=u.tree; B.needSeeds=B.plan.reduce((a,id)=>a+t[id].seeds,0); B.needGroup=Math.max(0,...B.plan.map(id=>t[id].group)); log('plan',B.plan.join(','),B.needSeeds,B.needGroup) }
  // queen level up to the needed group
  if(u.revealed<B.needGroup){ const pr=[10,20,30,40][s.queenLevel()-1]; if(st().fungus>=pr+c.fungusRes){ if(cmd({type:'upgrade-room',kind:'queen',id:s.royal.id})){ log('queen',s.queenLevel()); cnt('queen'); return true } } }
  // buy cards in order
  for(const id of B.plan){ if(u.unlocked.has(id)) continue; if(u.refusal(id)===null&&cmd({type:'buy-seed-card',id})){ log('buy',id); cnt('buy'); return true } break }
  return false }
function digSeeds(){ const c=B.cfg,s=S(),u=s.unlocks; if(!c.pits||!B.plan||s.tick<c.resAt) return 0; const left=B.plan.filter(id=>!u.unlocked.has(id)).reduce((a,id)=>a+u.tree[id].seeds,0);
  if(u.seeds>=left) return 0; const save=c.maxTun; c.maxTun=save+c.seedTun; const r=digTo(seedCells(),'stun'); c.maxTun=save; return r>0?1:0 }
function pits(x){ const c=B.cfg; if(!c.pits||!S().unlocks.unlocked.has('build-clay-pit')||rooms(15).length>=c.pits||pendRoom(15)) return false;
  if(x.leaves>=30&&x.fungus>=20) return place(15,(x0,y0,w,h)=>dRoyal(x0,y0,w,h));
  if(x.leafCapacity<31&&x.clay>=2&&!pendRoom(4)) return place(4,lsScore);
  return c.pitHold?true:false }
// pheromone room at the range edge when dens or farms find no spot (space is the limit)
function pheroSpace(x){ const c=B.cfg,s=S(),t=s.tick; if(!c.phSpace||rooms(6).length>=c.phSpace||pendRoom(6)) return false; const nc=B.nocand||{};
  if(!((nc[44]&&t-nc[44]<600)||(nc[3]&&t-nc[3]<600))) return false; if(x.leaves<10||x.fungus<10) return false;
  const [rx,ry]=RC(); const fd=rooms(44).map(ctr);
  return place(6,(x0,y0,w,h)=>{ const cx=x0+1,cy=y0+1.5; const d=Math.hypot(cx-rx,cy-ry); let m=99; for(const [a,b] of fd) m=Math.min(m,Math.hypot(a-cx,b-cy)); return -d+m*c.phNear }) }
function build(){ const s=S(), x=st(), n=castes(), t=s.tick, c=B.cfg;
  const eggs=x.brood, clay=x.clay-c.clayRes, leaves=x.leaves;
  const pend=pendRooms().length;
  if(pheroClay(x)) return;
  if(pits(x)) return;
  if(pheroSpace(x)) return;
  if(c.ovf>=2&&overflow(x)) return;
  if(pend>=c.maxPend){ if(!overflow(x)) return; return }
  const nd=rooms(42).length, nls=rooms(4).length, nlc=rooms(43).length, nf=rooms(3).length, nfd=rooms(44).length;
  // digger dens (eggs only)
  if(nd<c.dd && eggs>=2 && (nd===0||t>=c.ddAt) && !pendRoom(42)) { if(place(42,ddScore)) return }
  if(nls<1 && clay>=2) { if(place(4,lsScore)) return }
  // dens: pick the type with the larger marginal gain
  if(eggs>=2 && t>=c.fdAt){
    const gF=(2+nf)*c.fW, gL=(2+nls)*c.lW;
    const canF=clay>=2&&nfd<c.fd, canL=clay>=1&&nls>=1&&nlc<c.lcd;
    const order=gF>=gL?[[canF,44,fdScore],[canL,43,lcdScore]]:[[canL,43,lcdScore],[canF,44,fdScore]];
    for(const [ok,r,f] of order) if(ok && !pendRoom(r) && place(r,f)) return;
  }
  // farms: leaves only
  if(nf<c.farmMax && leaves-c.farmLeafRes>=5 && !pendRoom(3)) { if(place(3,farmScore)) return }
  // leaf storage: +1 leafcutter per leafcutter den in reach; keep clay for the next den
  const keep=eggs>=1?c.keepClay:0;
  if(nlc>=1 && clay-keep>=2 && nls<c.lsMax && !pendRoom(4)) { if(place(4,lsScore)) return }
  if(nls<c.ls && clay>=2 && !pendRoom(4)) { if(place(4,lsScore)) return }
}
function strongDig(){ const s=S(),c=B.cfg,x=st(); if(!c.sd||s.digLevel()>=c.sd||s.tick<c.sdAt) return false;
  if(x.clay<10||x.fungus<10) return x.fungus>=5?'wait':false;
  const d=rooms(42).filter(e=>e.done&&!(e.upgrades||[]).includes('tunnel'))[0]; if(!d) return false;
  if(cmd({type:'upgrade-room',kind:'tunnel',id:d.id})){ log('sd',s.digLevel()); cnt('sd'); return true } return false }
function manage(){ if(B.pre) B.pre(); research(); digSeeds(); const w=strongDig(); if(w==='wait'){ B.hs=B.hs??S().tick } else B.hs=null; B.hold=w==='wait'&&B.cfg.sdHold&&S().tick-B.hs<B.cfg.holdMax; if(!B.hold) build(); digClay() }

window.__runC2=async(maxTicks)=>{ maxTicks=maxTicks??B.cfg.end; const myId=(B.runId=(B.runId||0)+1); B.done=false; try{
  while(!B.stop && B.runId===myId && S().tick<maxTicks){
    manage();
    await R.step(Math.min(150,maxTicks-S().tick));
    { const x=st(); B.w=B.w||{egg:0,clay:0}; if(x.brood>=S().eggCapacity()) B.w.egg++; if(x.clay>=x.clayCapacity) B.w.clay++ }
    if(S().tick%1500<150){ const x=st(); B.ts=B.ts||[]; B.ts.push([S().tick,score(),x.brood,x.clay,x.leaves,x.leafCapacity,x.fungus,rooms(42).length,rooms(44).length,rooms(3).length,pendRooms().length]) }
    const sc=score(); if(S().tick<=63000 && sc>B.best){B.best=sc;B.bestT=S().tick}
    if(S().tick%9000<150) log('day',st().day,{score:sc,castes:castes()});
    await new Promise(r=>setTimeout(r,0));
  } B.done=true }catch(e){ B.err=String(e)+' '+(e.stack||'').slice(0,400) } };
window.__stC2=()=>{ const x=st(); return {waste:B.w,why:B.why,noClay:B.noClay,tick:S().tick,day:x.day,score:score(),best:B.best,end:score(),brood:x.brood,leaves:x.leaves+'/'+x.leafCapacity,clay:x.clay+'/'+x.clayCapacity,fungus:x.fungus,castes:castes(),n:B.n,cmds:B.cmds,fails:B.fails,err:B.err,done:B.done,ts:B.ts} };
return 'c2bot loaded';
