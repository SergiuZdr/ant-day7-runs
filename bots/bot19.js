// bot19 = bot15 + early farmers when leaves pile up and no fungus is ripe (days 1-2 the queen sits idle without fungus).
// bot15 = bot14 + live seed tree: digs to buried seeds, buys cards (cfg.buy), builds unlocked Brown Clay Storage, buys upgrades (cfg.ups).
// Normal player commands only. Keeps the __B14/__run14/__st14 names so the sweep scripts work unchanged.
// Score = 1 + workers + warriors, sampled while day <= 7 (day 8 starts at tick 63000).
// Food: an egg costs 3 fungus fed to the queen; ants go hungry 1 day after eating and die 2 days later,
// so ants hatched late need no food before the deadline.
const R=window.ants.replay,V=160,Y=89;
const S=()=>window.__sim;
const B=window.__B14=window.__B14||{log:[],cmds:0,fails:0,err:null,fc:new Map(),n:{},best:0};
B.stop=false;
B.cfg=Object.assign({end:63000,farmPer:4,houseSlack:3,maxPend:2,dig0:1,digMax:4,maxTun:1,tunLen:6,lc0:2,farmersPer:1,lcEarly:0.6,dSwitch:4,hr:8,target:0,lcShare:0.25,lcEarly:0.7,farmPer:5,digMax:3,buy:['upgrades-food'],ups:['food'],upClay:0,upPri:0,seedDig:0,fLeaf:0,fMax:4,fDay:4,fRipe:2,farmLeaf:0,seedMax:9,storeAt:1},B.cfg||{}); // defaults = best sweep result on seed 1488 (117 ants by day 7)
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
function digSeeds(){ if(!B.cfg.seedDig||seedsGot()>=B.cfg.seedMax) return 0; const r=digTo(seedCells(),'stun'); return r>0?1:0 }
// seed tree: buy cards in cfg.buy order, revealing groups as needed; strict order
function tree(){ const u=S().unlocks; for(const id of B.cfg.buy){ if(u.unlocked.has(id)) continue;
    let r=u.refusal(id); if(r==='fogged'){ const p=u.revealPrice; if(p!=null&&u.seeds>=p&&cmd({type:'reveal-seed-group'})){ log('reveal',u.revealed); cnt('reveal'); r=u.refusal(id) } else return }
    if(r===null){ if(cmd({type:'buy-seed-card',id})){ log('buy',id); cnt('buy:'+id) } } return } }
function upgrades(){ const s=S(); for(const k of B.cfg.ups){ if(s.upgradeShortfall(k)) continue; if(st().clay-10<B.cfg.upClay) continue; if(cmd({type:'upgrade',kind:k})){ log('up',k,s.upgrades[k]); cnt('up:'+k); return } } }
const clayNear=(x0,y0,r)=>{ const s=S(),g=G(); let k=0; for(let y=Math.max(0,y0-r);y<Math.min(Y,y0+r);y++) for(let x=Math.max(0,x0-r);x<Math.min(V,x0+r);x++){ const i=y*V+x; if(s.terrain.clay[i]===1&&g[i]===-1) k++ } return k };
function hatch(kind){ if(S().hatchShortfall(kind)) return false; const ok=cmd({type:'hatch',kind}); if(ok) cnt('h_'+kind); return ok }

const houseScore=(x0,y0,w,h)=>{ const [hx,hy]=home(); const hs=rooms(1); let k=0; for(const e of hs){ const ex=e.cx/8-1,ey=(e.cy-228)/8-1; if(Math.abs(ex-x0)<=B.cfg.hr&&Math.abs(ey-y0)<=B.cfg.hr) k++ } const d=Math.hypot(x0+1-hx,(y0+1-hy)*1.6); return hs.length? (k?-k*20+d*0.3:d+30) : d };
function build(){ const s=S(), x=st(), n=castes(), P=score();
  const pend=pendingWorks().filter(w=>w.kind===2).length;
  if(pend>=Math.max(1,Math.min(B.cfg.maxPend,Math.floor(n.digger/2)))) return;
  const leaves=x.leaves, clay=x.clay, cap=x.capacity, brood=x.brood;
  const pendRoom=r=>pendingWorks().some(w=>w.kind===2&&w.room===r);
  // 0. brown clay storage (+20 clay) once unlocked
  if(B.cfg.storeAt && S().unlocks.unlocked.has('build-dirt-store') && !rooms(7).length && clay>=10 && !pendRoom(7)) return place(7);
  // 1. first leaf storage
  if(!rooms(4).length && clay>=1) return place(4);
  // 2. houses before capacity runs out
  if(cap-(P-1)-brood<B.cfg.houseSlack && !pendRoom(1) && clay>=5 && leaves>=8) return place(1,houseScore);
  // 3. farms: one per farmPer leafcutters
  if(leaves>=5 && rooms(3).length<Math.max(1,Math.ceil(n.leafcutter/B.cfg.farmPer)) && !pendRoom(3)) return place(3);
  // pheromones when no buried clay is left in range
  if(B.noClay && S().tick-B.noClay<600 && leaves>=10 && x.fungus>=10 && !pendRoom(6)) return place(6,(x0,y0,w,h)=>{ const [hx,hy]=home(); const d=Math.hypot(x0+1-hx,(y0+1-hy)); return d<8?null:-clayNear(x0,y0,12)*10+d });
  // 3b. another farm when leaves pile up (more slots to convert)
  if(B.cfg.farmLeaf && x.day<=B.cfg.fDay && leaves>=B.cfg.farmLeaf && !pendRoom(3)) return place(3);
  // 4. more leaf storage when close to full
  if(clay>=1 && leaves>=x.leafCapacity-3 && !pendRoom(4)) return place(4);
}

function ants(){ const s=S(); let k=0;
  while(k++<6){ const x=st(), n=castes(), P=score(); if(x.brood<1||x.workers+x.warriors>=x.capacity) return; if(B.cfg.target && P>=B.cfg.target) return;
    const farms=done(3)+rooms(3).filter(e=>!e.done).length;
    const work=pendingWorks().length, dWant=Math.min(B.cfg.dig0+Math.floor(work/2),B.cfg.digMax);
    let kind=null;
    const ripe=(()=>{let r=0;for(const g of S().gardens)for(const sl of g.slots)if(sl.leaf&&sl.growth>=1)r++;return r})();
    if(n.digger<1) kind='digger';
    else if(B.cfg.fLeaf && x.day<=B.cfg.fDay && x.leaves>=B.cfg.fLeaf && ripe<B.cfg.fRipe && n.farmer<B.cfg.fMax && done(3)>0){ if(x.brood>=2&&x.clay>=2) kind='farmer'; else return }
    else if(n.farmer<done(3)*B.cfg.farmersPer){ if(x.brood>=2&&x.clay>=2) kind='farmer'; else return }
    else if(n.leafcutter<B.cfg.lc0 || n.leafcutter<(st().day<=B.cfg.dSwitch?B.cfg.lcEarly:B.cfg.lcShare)*(P-1)){ if(x.clay>=1) kind='leafcutter'; else if(n.digger<dWant) kind='digger'; else return }
    else if(n.digger<dWant) kind='digger';
    else kind='digger';
    if(!kind||!hatch(kind)) return }
}

function manage(){ tree(); if(!digSeeds()) digClay(); if(B.cfg.upPri){ upgrades(); build() } else { build(); upgrades() } ants() }

window.__run14=async(maxTicks)=>{ maxTicks=maxTicks??B.cfg.end; const myId=(B.runId=(B.runId||0)+1); B.done=false; try{
  while(!B.stop && B.runId===myId && S().tick<maxTicks){
    guarded(manage);
    await R.step(Math.min(150,maxTicks-S().tick));
    const sc=score(); if(st().day<=7 && sc>B.best){B.best=sc;B.bestT=S().tick}
    if(S().tick%9000<150) log('day',st().day,{score:sc,cap:st().capacity,brood:st().brood,leaves:st().leaves,clay:st().clay,fungus:st().fungus,castes:castes()});
    await new Promise(r=>setTimeout(r,0));
  } B.done=true }catch(e){ B.err=String(e)+' '+(e.stack||'').slice(0,400) } };
window.__st14=()=>{ const x=st(); return {tick:S().tick,day:x.day,score:score(),best:B.best,cap:x.capacity,brood:x.brood,leaves:x.leaves+'/'+x.leafCapacity,clay:x.clay+'/'+x.clayCapacity,fungus:x.fungus,castes:castes(),n:B.n,cmds:B.cmds,fails:B.fails,err:B.err,done:B.done} };
return 'bot14 loaded';
