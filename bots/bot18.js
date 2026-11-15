// bot18 = bot17 + seed-hunting Pheromones (cfg.pheroN rooms toward uncollected seeds), Brown Clay Pits (cfg.pits).
// bot17 = bot16 + Pheromones placed on sand (+1 range per sand tile), cheap-seed digging (seedNear), Fungus Grower.
// bot16 = bot15 + feeder path (seed tree -> feeder + tan clay storage, Strong Digging, tan clay tunnels, feeders).
// bot15 = bot14 + live seed tree: digs to buried seeds, buys cards (cfg.buy), builds unlocked Brown Clay Storage, buys upgrades (cfg.ups).
// Normal player commands only. Keeps the __B14/__run14/__st14 names so the sweep scripts work unchanged.
// Score = 1 + workers + warriors, sampled while day <= 7 (day 8 starts at tick 63000).
// Food: an egg costs 3 fungus fed to the queen; ants go hungry 1 day after eating and die 2 days later,
// so ants hatched late need no food before the deadline.
const R=window.ants.replay,V=160,Y=89;
const S=()=>window.__sim;
const B=window.__B14=window.__B14||{log:[],cmds:0,fails:0,err:null,fc:new Map(),n:{},best:0};
B.stop=false; B.plan=null; B.qs={};
B.cfg=Object.assign({end:63000,farmPer:4,houseSlack:3,maxPend:2,dig0:1,digMax:4,maxTun:1,tunLen:6,lc0:2,farmersPer:1,lcEarly:0.6,dSwitch:4,hr:8,target:0,lcShare:0.25,lcEarly:0.7,farmPer:5,digMax:3,buy:['upgrades-food'],ups:['food'],upClay:0,upPri:0,seedDig:0,feeders:0,fTargets:[],extraBuy:['upgrades-food'],tanStore:0,fstores:0,pheroAt:0,reserve30:1,pause:0,sandW:0,seedNear:0,gens:0,seedAt:0,ring:0,farmAdj:0,pheroN:0,pheroSeedAt:0,pits:0,hard:0,seedMax:9,storeAt:1},B.cfg||{}); // defaults = best sweep result on seed 1488 (117 ants by day 7)
const SZ={0:[4,2],8:[3,2],9:[4,3],10:[3,4],1:[2,2],3:[3,3],4:[4,2],7:[5,2],13:[3,3],14:[3,3],12:[2,3],5:[1,1],6:[2,3],15:[4,2],16:[4,3],17:[3,3],18:[2,4]};
const log=(...a)=>{B.log.push([S().tick,...a]);if(B.log.length>400)B.log.splice(0,100)};
const cnt=k=>{B.n[k]=(B.n[k]||0)+1};
const G=()=>S().nest.grid;
const st=()=>S().stats();
const score=()=>{const x=st();return 1+x.workers+x.warriors};
const castes=()=>S().castes();
const rooms=t=>S().nest.works.filter(e=>e.kind===2&&e.room===t);
const done=t=>rooms(t).filter(e=>e.done).length;
const pendingWorks=()=>S().nest.works.filter(e=>!e.done&&!e.fill);
const freeR=(x,y,w,h)=>{ if(x<0||y<0||x+w>V||y+h>Y) return false; const g=G(); for(let a=0;a<h;a++)for(let b=0;b<w;b++) if(g[(y+a)*V+x+b]!==-1) return false; return true };
const covered=(x,y,w,h)=>{ const P=S().pheromones; for(let a=0;a<h;a++)for(let b=0;b<w;b++) if(!P.contains(x+b,y+a)) return false; return true };
const diggable=(x,y,w,h)=>{ const s=S(),L=s.upgrades.tunnel; for(let a=0;a<h;a++)for(let b=0;b<w;b++) if(s.cellDirt(x+b,y+a)>L) return false; return true };
// planRoom touches pheromone/bonus caches; restore them so the sim state stays identical to a normal player's
const CK=()=>{const s=S(),P=s.pheromones;return {pc:P.cells.slice(),ps:P.seen.slice(),pr:P.revision,pk:P.key,sb:new Map(s.storeBonuses),dc:s.dugCells,dk:s.dugKey.slice()}};
const CR=k=>{const s=S(),P=s.pheromones;P.cells.set(k.pc);P.seen.set(k.ps);P.revision=k.pr;P.key=k.pk;s.storeBonuses.clear();for(const [a,b] of k.sb)s.storeBonuses.set(a,b);s.dugCells=k.dc;s.dugKey.length=0;for(const v of k.dk)s.dugKey.push(v)};
B.guard=null;
const guarded=f=>{ B.guard=CK(); try{ return f() } finally { CR(B.guard); B.guard=null } };
const cmd=c=>{ if(B.stop) throw Error('stopped'); if(B.guard) CR(B.guard); const r=R.command(c); if(B.guard) B.guard=CK(); B.cmds++; if(!r){B.fails++; log('fail',JSON.stringify(c))} return r };
const home=()=>{ const q=S().queenHome; return [q.cx/8,(q.cy-228)/8] };
function place(room,scoreFn){ const [w,h]=SZ[room]; const [hx,hy]=home(); const c=[];
  for(let y=0;y+h<=Y;y++) for(let x=0;x+w<=V;x++){ if(!freeR(x,y,w,h)||!covered(x,y,w,h)||!diggable(x,y,w,h)) continue;
    const sc=scoreFn?scoreFn(x,y,w,h):Math.hypot(x+w/2-hx,(y+h/2-hy)*1.6); if(sc!=null) c.push([sc,x,y]) }
  c.sort((a,b)=>a[0]-b[0]); let tries=0;
  for(const [,x,y] of c){ const key=room+':'+x+':'+y, f=B.fc.get(key); if(f&&S().tick-f<3000) continue;
    const p=S().planRoom(room,x,y,false); if(!p.ok){ if(!/^Needs/.test(p.reason)) B.fc.set(key,S().tick); if(++tries>30) break; continue }
    if(cmd({type:'place-room',room,col:x,row:y})){ log('place',room,x,y); cnt('r'+room); return true }
    if(++tries>30) break }
  return false }
// tunnels toward the nearest buried brown clay (terrain.clay===1). Digging plain dirt gives no clay.
const isDug=v=>v===-3||v>=0;
function digTo(targets,tag){ const s=S(), g=G(), P=s.pheromones, L=s.upgrades.tunnel;
  const pendT=pendingWorks().filter(w=>w.kind===1).length; if(pendT>=B.cfg.maxTun) return 0;
  const ok=(x,y)=>x>=0&&y>=0&&x<V&&y<Y&&g[y*V+x]===-1&&P.contains(x,y)&&s.cellDirt(x,y)<=L;
  targets=targets.filter(([x,y])=>ok(x,y)); if(!targets.length) return -1;
  const dug=[]; for(let i=0;i<V*Y;i++) if(isDug(g[i])) dug.push([i%V,Math.floor(i/V)]);
  const pairs=[]; for(const [tx,ty] of targets) for(const [dx,dy] of dug) pairs.push([Math.abs(tx-dx)+Math.abs(ty-dy),tx,ty,dx,dy]);
  pairs.sort((a,b)=>a[0]-b[0]);
  const tryLine=(fx,fy,ex,ey)=>{ const sx=Math.sign(ex-fx),sy=Math.sign(ey-fy); let k=0,x=fx,y=fy;
    while(k<12){ const nx=x+sx,ny=y+sy; if(!ok(nx,ny)) break; x=nx;y=ny;k++; if(x===ex&&y===ey) break }
    for(let j=k;j>=1;j--){ const ex2=fx+sx*j, ey2=fy+sy*j; const p=S().planRoom(5,ex2,ey2,false,{col:fx,row:fy}); if(!p.ok) continue;
      if(cmd({type:'place-room',room:5,col:ex2,row:ey2,fromCol:fx,fromRow:fy})){ log(tag,fx,fy,ex2,ey2); cnt(tag); return true } }
    return false };
  let tries=0; for(const [,tx,ty,dx,dy] of pairs){ if(++tries>15) break;
    if(dx!==tx && tryLine(dx,dy,tx,dy)) return 1;
    if(dy!==ty && tryLine(dx,dy,dx,ty)) return 1 }
  return 0 }
function digClay(){ const s=S(), g=G(); if(st().clay>=s.clayCapacity()-2) return 0;
  const t=[]; for(let i=0;i<V*Y;i++){ if(s.terrain.clay[i]===1&&g[i]===-1) t.push([i%V,Math.floor(i/V)]) }
  const r=digTo(t,'tun'); if(r<0){ B.noClay=S().tick; return 0 } return r }
// seeds sit at pixel cells; digging the grid cell that holds one collects it
const seedCells=()=>S().seeds.map(x=>[Math.floor((x.cell%1280)/8),Math.floor((Math.floor(x.cell/1280)-228)/8)]);
const seedsGot=()=>S().unlocks.collected;
function digSeeds(){ if((!B.cfg.seedDig&&!B.cfg.seedNear)||seedsGot()>=B.cfg.seedMax||S().tick<B.cfg.seedAt) return 0; let c=seedCells();
  if(!B.cfg.seedDig){ const g=G(),dug=[]; for(let i=0;i<V*Y;i++) if(isDug(g[i])) dug.push([i%V,Math.floor(i/V)]); c=c.filter(([x,y])=>dug.some(([a,b])=>Math.abs(a-x)+Math.abs(b-y)<=B.cfg.seedNear)) }
  const r=digTo(c,'stun'); return r>0?1:0 }

// cheapest way through the seed tree to the target cards (Dijkstra on seeds; '@' links are always open)
function planCards(targets){ const u=S().unlocks,t=u.tree,ids=Object.keys(t);
  const nb=id=>[...t[id].links.filter(x=>!x.startsWith('@')),...ids.filter(n=>t[n].links.includes(id))];
  const dist={},prev={},done=new Set();
  for(const id of ids){ if(u.unlocked.has(id)) dist[id]=0; else if(t[id].links.some(x=>x.startsWith('@'))) dist[id]=t[id].seeds }
  while(true){ let best=null; for(const id of ids) if(!done.has(id)&&dist[id]!=null&&(best==null||dist[id]<dist[best])) best=id; if(best==null) break; done.add(best);
    for(const n of nb(best)){ const c=dist[best]+(u.unlocked.has(n)?0:t[n].seeds); if(dist[n]==null||c<dist[n]){dist[n]=c;prev[n]=best} } }
  const out=[]; for(const tg of targets){ const chain=[]; let x=tg; while(x!=null&&!out.includes(x)&&!chain.includes(x)){ chain.unshift(x); x=prev[x] } for(const c of chain) if(!out.includes(c)) out.push(c) }
  return out }
const seedCost=list=>{ const t=S().unlocks.tree; let c=0,g=0; for(const id of list){ c+=t[id].seeds; g=Math.max(g,t[id].group) } for(let i=0;i<g;i++) c+=[1,2,3,4][i]; return c };
const tan=()=>S().deepClay(0);
const has=id=>S().unlocks.unlocked.has(id);
function digTan(){ const s=S(),g=G(); if(s.upgrades.tunnel<1||!done(13)) return 0; if(tan()>=s.deepCapacity(0)-2) return 0;
  if(castes().feeder>=B.cfg.feeders) return 0;
  const t=[]; for(let i=0;i<V*Y;i++){ if(s.terrain.clay[i]===2&&g[i]===-1) t.push([i%V,Math.floor(i/V)]) }
  return digTo(t,'ttun')>0?1:0 }

// one pheromone room toward the tan clay + seeds that sit just outside the start range
function pheroTarget(){ if(B.pt!==undefined) return B.pt; const s=S(),P=s.pheromones,[hx,hy]=home(); const pts=[];
  for(let i=0;i<V*Y;i++){ const x=i%V,y=Math.floor(i/V); if(s.terrain.clay[i]===2&&!P.contains(x,y)&&Math.hypot(x-hx,y-hy)<=32) pts.push([x,y]) }
  for(const [x,y] of seedCells()) if(!P.contains(x,y)&&Math.hypot(x-hx,y-hy)<=32) pts.push([x,y]);
  if(!pts.length) return B.pt=null; const cx=pts.reduce((a,p)=>a+p[0],0)/pts.length, cy=pts.reduce((a,p)=>a+p[1],0)/pts.length; return B.pt=[cx,cy] }
function pheroToward(){ const t=pheroTarget(); if(!t) return false; if(rooms(6).length) return false; const x=st(); if(x.leaves<10||x.fungus<10) return false;
  return place(6,(x0,y0,w,h)=>Math.hypot(x0+1-t[0],y0+1-t[1])-(B.cfg.sandW?sandAt(x0,y0)*B.cfg.sandW:0)) }

// bank fungus for the feeder path (pheromone room, Strong Digging) by pausing eggs for a moment
function fungusBank(){ if(!B.cfg.pause) return; const s=S(),x=st(); let need=0;
  if(S().tick>=B.cfg.pheroAt && !rooms(6).length && pheroTarget()) need=10;
  else if(s.unlocks.revealed>=2 && s.upgrades.tunnel<1) need=10;
  const want=need>0 && x.fungus<need; if(want!==!!s.eggsPaused){ if(cmd({type:'room-action',action:want?'pause-eggs':'resume-eggs',id:s.royal.id})){ log(want?'pause':'resume'); cnt(want?'pause':'resume') } } }

// Pheromones toward the nearest uncollected seed outside range (up to cfg.pheroN rooms in total)
function pheroSeeds(){ if(!B.cfg.pheroN || rooms(6).length>=B.cfg.pheroN || S().tick<B.cfg.pheroSeedAt) return false; if(seedsGot()>=B.cfg.seedMax) return false;
  const x=st(); if(x.leaves<10||x.fungus<10) return false; const P=S().pheromones,[hx,hy]=home();
  const out=seedCells().filter(([a,b])=>!P.contains(a,b)).map(([a,b])=>[Math.hypot(a-hx,b-hy),a,b]).sort((p,q)=>p[0]-q[0]);
  if(!out.length) return false; const [,tx,ty]=out[0];
  return place(6,(x0,y0,w,h)=>Math.hypot(x0+1-tx,y0+1-ty)) }
// seed tree: buy cards in cfg.buy order, revealing groups as needed; strict order
function tree(){ const u=S().unlocks; for(const id of B.cfg.buy){ if(u.unlocked.has(id)) continue;
    let r=u.refusal(id); if(r==='fogged'){ const p=u.revealPrice; if(p!=null&&u.seeds>=p&&cmd({type:'reveal-seed-group'})){ log('reveal',u.revealed); cnt('reveal'); r=u.refusal(id) } else return }
    if(r===null){ if(cmd({type:'buy-seed-card',id})){ log('buy',id); cnt('buy:'+id) } } return } }
function upgrades(){ const s=S(); for(const k of B.cfg.ups){ if(k==='tunnel'&&(s.upgrades.tunnel>=1||s.unlocks.revealed<2)) continue; if(s.upgradeShortfall(k)) continue; if(st().clay-10<B.cfg.upClay) continue; if(cmd({type:'upgrade',kind:k})){ log('up',k,s.upgrades[k]); cnt('up:'+k); return } } }
const clayNear=(x0,y0,r)=>{ const s=S(),g=G(); let k=0; for(let y=Math.max(0,y0-r);y<Math.min(Y,y0+r);y++) for(let x=Math.max(0,x0-r);x<Math.min(V,x0+r);x++){ const i=y*V+x; if(s.terrain.clay[i]===1&&g[i]===-1) k++ } return k };
function hatch(kind){ if(S().hatchShortfall(kind)) return false; const ok=cmd({type:'hatch',kind}); if(ok) cnt('h_'+kind); return ok }

const sandAt=(x0,y0)=>{ const [w,h]=SZ[6]; return S().pheromoneSandTiles({cx:(x0+w/2)*8,cy:228+(y0+h/2)*8}).filter(Boolean).length };
const dHome=(x0,y0,w,h)=>{ const [hx,hy]=home(); return Math.hypot(x0+w/2-hx,y0+h/2-hy) };
const royalD=(x0,y0,w,h)=>{ const R=S().royal.gridCells; let m=1e9; for(const c of R){ const cx=c%V,cy=Math.floor(c/V); const dx=Math.max(x0-cx,0,cx-(x0+w-1)), dy=Math.max(y0-cy,0,cy-(y0+h-1)); m=Math.min(m,dx+dy) } return m };
const outRing=(x0,y0,w,h)=>!B.cfg.ring||dHome(x0,y0,w,h)>=B.cfg.ring;
const houseScore=(x0,y0,w,h)=>{ if(!outRing(x0,y0,w,h)) return null; const [hx,hy]=home(); const hs=rooms(1); let k=0; for(const e of hs){ const ex=e.cx/8-1,ey=(e.cy-228)/8-1; if(Math.abs(ex-x0)<=B.cfg.hr&&Math.abs(ey-y0)<=B.cfg.hr) k++ } const d=Math.hypot(x0+1-hx,(y0+1-hy)*1.6); return hs.length? (k?-k*20+d*0.3:d+30) : d };
function build(){ const s=S(), x=st(), n=castes(), P=score();
  const pend=pendingWorks().filter(w=>w.kind===2).length;
  if(pend>=Math.max(1,Math.min(B.cfg.maxPend,Math.floor(n.digger/2)))) return;
  const leaves=x.leaves, clay=x.clay, cap=x.capacity, brood=x.brood;
  const pendRoom=r=>pendingWorks().some(w=>w.kind===2&&w.room===r);
  if(B.cfg.hard){ const wantT=B.cfg.tanStore&&has('build-tan-clay-store')&&!rooms(13).length, wantP=B.cfg.pits&&has('build-clay-pit')&&rooms(15).length<B.cfg.pits;
    if((wantT||wantP) && cap-(P-1)-brood>=1){ if(x.leafCapacity<31 && clay>=1 && !pendRoom(4)) return place(4); if(wantT && leaves>=30 && !pendRoom(13)) return place(13); if(!wantT && wantP && leaves>=30 && x.fungus>=20 && !pendRoom(15)) return place(15); return } }
  // 0e. Brown Clay Pit: water seeps in by itself, 1 brown clay per ~30 s each
  if(B.cfg.pits && has('build-clay-pit') && rooms(15).length<B.cfg.pits){ if(x.leafCapacity<31 && clay>=1 && !pendRoom(4)) return place(4); if(leaves>=30 && x.fungus>=20 && !pendRoom(15)) return place(15); if(B.cfg.reserve30 && cap-(P-1)-brood>=1 && x.leafCapacity>=31) return }
  // 0f. seed-hunting pheromones
  if(pheroSeeds()) return;
  // 0d. Fungus Grower (60 leaves, 10 clay) once unlocked: grow leaf storage to hold 60 first
  if(B.cfg.gens && has('build-generator') && rooms(10).length<B.cfg.gens){ if(x.leafCapacity<61 && clay>=1 && !pendRoom(4)) return place(4); if(leaves>=60 && clay>=10 && !pendRoom(10)) return place(10); if(B.cfg.reserve30 && cap-(P-1)-brood>=1 && x.leafCapacity>=61) return }
  // 0c. fungus storage right next to the queen: farmers stock it, the queen's trips get short
  if(B.cfg.fstores && has('build-fungus-store') && rooms(12).length<B.cfg.fstores && clay>=5 && leaves>=20 && !pendRoom(12)) return place(12);
  // 0b. early pheromone room toward the feeder resources
  if(B.cfg.pheroAt && S().tick>=B.cfg.pheroAt && !rooms(6).length && pheroTarget()){ if(pheroToward()) return }
  // 0a. tan clay storage once unlocked (30 leaves): make sure leaf storage can hold 30
  if(B.cfg.tanStore && has('build-tan-clay-store') && !rooms(13).length){ if(x.leafCapacity<31 && clay>=1 && !pendRoom(4)) return place(4); if(leaves>=30 && !pendRoom(13)) return place(13); if(B.cfg.reserve30 && cap-(P-1)-brood>=1) return }
  // 0. brown clay storage (+20 clay) once unlocked
  if(B.cfg.storeAt && S().unlocks.unlocked.has('build-dirt-store') && !rooms(7).length && clay>=10 && !pendRoom(7)) return place(7);
  // 1. first leaf storage
  if(!rooms(4).length && clay>=1) return place(4);
  // 2. houses before capacity runs out
  if(cap-(P-1)-brood<B.cfg.houseSlack && !pendRoom(1) && clay>=5 && leaves>=8) return place(1,houseScore);
  // 3. farms: one per farmPer leafcutters
  if(leaves>=5 && rooms(3).length<Math.max(1,Math.ceil(n.leafcutter/B.cfg.farmPer)) && !pendRoom(3)) return place(3,B.cfg.farmAdj?(x0,y0,w,h)=>royalD(x0,y0,w,h)*10+dHome(x0,y0,w,h):B.cfg.ring?(x0,y0,w,h)=>dHome(x0,y0,w,h):undefined);
  // pheromones when no buried clay is left in range
  if(B.noClay && S().tick-B.noClay<600 && leaves>=10 && x.fungus>=10 && !pendRoom(6)) return place(6,(x0,y0,w,h)=>{ const [hx,hy]=home(); const d=Math.hypot(x0+1-hx,(y0+1-hy)); return d<8?null:-clayNear(x0,y0,12)*10+d-(B.cfg.sandW?sandAt(x0,y0)*B.cfg.sandW:0) });
  // 4. more leaf storage when close to full
  if(clay>=1 && leaves>=x.leafCapacity-3 && !pendRoom(4)) return place(4,B.cfg.ring?(x0,y0,w,h)=>outRing(x0,y0,w,h)?dHome(x0,y0,w,h):null:undefined);
}

function ants(){ const s=S(); let k=0;
  while(k++<6){ const x=st(), n=castes(), P=score(); if(x.brood<1||x.workers+x.warriors>=x.capacity) return; if(B.cfg.target && P>=B.cfg.target) return;
    const farms=done(3)+rooms(3).filter(e=>!e.done).length;
    const work=pendingWorks().length, dWant=Math.min(B.cfg.dig0+Math.floor(work/2),B.cfg.digMax);
    let kind=null;
    if(n.digger<1) kind='digger';
    else if(has('ants-feeder') && n.feeder<B.cfg.feeders && tan()>=5 && x.brood>=2) kind='feeder';
    else if(n.farmer<done(3)*B.cfg.farmersPer){ if(x.brood>=2&&x.clay>=2) kind='farmer'; else return }
    else if(n.leafcutter<B.cfg.lc0 || n.leafcutter<(st().day<=B.cfg.dSwitch?B.cfg.lcEarly:B.cfg.lcShare)*(P-1)){ if(x.clay>=1) kind='leafcutter'; else if(n.digger<dWant) kind='digger'; else return }
    else if(n.digger<dWant) kind='digger';
    else kind='digger';
    if(!kind||!hatch(kind)) return }
}

function manage(){ if(!B.plan){ B.plan=planCards(B.cfg.fTargets); B.cfg.buy=[...B.plan,...B.cfg.extraBuy.filter(x=>!B.plan.includes(x))]; B.cfg.seedMax=seedCost(B.cfg.buy); if(!B.cfg.ups.includes('tunnel')) B.cfg.ups=['tunnel',...B.cfg.ups]; log('plan',B.cfg.buy.join(','),B.cfg.seedMax) }
  tree(); fungusBank(); if(!digTan()&&!digSeeds()) digClay(); if(B.cfg.upPri){ upgrades(); build() } else { build(); upgrades() } ants() }

window.__run14=async(maxTicks)=>{ maxTicks=maxTicks??B.cfg.end; const myId=(B.runId=(B.runId||0)+1); B.done=false; try{
  while(!B.stop && B.runId===myId && S().tick<maxTicks){
    guarded(manage);
    await R.step(Math.min(150,maxTicks-S().tick));
    const sc=score(); if(st().day<=7 && sc>B.best){B.best=sc;B.bestT=S().tick}
    { const q=S().queen; if(q&&st().day>=4&&st().day<=7){ B.qs=B.qs||{}; B.qs[q.task]=(B.qs[q.task]||0)+1 } }
    if(S().tick%9000<150) log('day',st().day,{score:sc,cap:st().capacity,brood:st().brood,leaves:st().leaves,clay:st().clay,fungus:st().fungus,castes:castes()});
    await new Promise(r=>setTimeout(r,0));
  } B.done=true }catch(e){ B.err=String(e)+' '+(e.stack||'').slice(0,400) } };
window.__st14=()=>{ const x=st(); return {qs:B.qs,tan:tan(),unl:[...S().unlocks.unlocked],seeds:S().unlocks.collected,tick:S().tick,day:x.day,score:score(),best:B.best,cap:x.capacity,brood:x.brood,leaves:x.leaves+'/'+x.leafCapacity,clay:x.clay+'/'+x.clayCapacity,fungus:x.fungus,castes:castes(),n:B.n,cmds:B.cmds,fails:B.fails,err:B.err,done:B.done} };
return 'bot14 loaded';
