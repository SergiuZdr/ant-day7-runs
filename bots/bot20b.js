// bot20 = bot18 + ideas from the #1 player's 172 save (seeds/v119/TOP1-172-ANALYSIS.md), all off by default:
//  lcLateAt/lcLate/lcLateEnd  leafcutter share lcLate between those ticks (keeps fungus up on day 7)
//  fLateAt/fLate/farmPerLate  from tick fLateAt: fLate farmers per farm, one farm per farmPerLate leafcutters (late fungus)
//  f1At/f1Leaf  no first farmer before this tick / leaf count (from bot19: 170 on 3377334)
//  grid:1      houses on a 2x2 lattice packed beside the royal chamber (more +1 neighbour bonuses)
//  sprouts:N   up to N Sprout Leaf Rooms beside Leaf Storage (needs 'build-sprout' in fTargets/extraBuy); sproutFrom = houses first; sproutRes = clay kept back
//  pheroCover:W place seed pheromone rooms to cover the most new seeds (pheroR radius, pheroTanW weight per tan cell)
//  coverAfter:'tan'|'plan' use pheroCover only after the Tan Clay Storage card is owned / the planned cards' seeds are collected
//  busyAt:T busyTun:N busyIdle:K after tick T, with K+ idle diggers, keep up to N tunnels going
//  buyFirst:[ids] buy the cheapest path to these cards (planCards) before the planned path (e.g. ['build-egg','build-sprout'] for early sprouts)
//  noDigAt:T  stop new clay/tan/seed tunnels after tick T (less soil on the surface mound over the plants)
//  soilStores:N build N Dirt Storage rooms once 'build-soil-store' is owned (put it in extraBuy)
//  foodFeed:N after N feeders, keep tan clay for Rich Food level 2 (10 tan) before more feeders
//  jelly:1     buy the Royal Jelly upgrade (30 fungus, no clay) as soon as the card is owned; jellyPause:1 pauses eggs to bank the fungus; jellyBy = last tick to try
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
B.cfg=Object.assign({end:63000,farmPer:4,houseSlack:3,maxPend:2,dig0:1,digMax:4,maxTun:1,tunLen:6,lc0:2,farmersPer:1,lcEarly:0.6,dSwitch:4,hr:8,target:0,lcShare:0.25,lcEarly:0.7,farmPer:5,digMax:3,buy:['upgrades-food'],ups:['food'],upClay:0,upPri:0,seedDig:0,feeders:0,fTargets:[],extraBuy:['upgrades-food'],tanStore:0,fstores:0,pheroAt:0,reserve30:1,pause:0,sandW:0,seedNear:0,gens:0,seedAt:0,ring:0,farmAdj:0,pheroN:0,pheroSeedAt:0,pits:0,hard:0,seedMax:9,storeAt:1,grid:0,starve:0,starveFrom:36000,starveMargin:2700,starveN:2,fLateAt:0,fLate:2,farmPerLate:0,house1First:0,ls1Tun:0,lcFall:0,lcLateAt:0,lcLate:0.35,lcLateEnd:58000,farmEast:0,houseWest:0,seedCover:0,digFix:0,farmFall:0,stuckT:0,f1At:0,f1Leaf:0,seedPar:0,seedDiggers:4,sprouts:0,sproutFrom:2,sproutRes:5,sproutLs:2,jelly:0,jellyPause:1,jellyBy:54000,pheroCover:0,pheroR:15,pheroTanW:0,busyAt:0,busyTun:4,busyIdle:10,noDigAt:0,soilStores:0,buyFirst:null},B.cfg||{}); // defaults = best sweep result on seed 1488 (117 ants by day 7)
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
function place(room,scoreFn){ const [w,h]=SZ[room]; const [hx,hy]=home(); const c=[]; const SC=B.cfg.seedCover?seedCells():[];
  for(let y=0;y+h<=Y;y++) for(let x=0;x+w<=V;x++){ if(!freeR(x,y,w,h)||!covered(x,y,w,h)||!diggable(x,y,w,h)) continue;
    let sc=scoreFn?scoreFn(x,y,w,h):Math.hypot(x+w/2-hx,(y+h/2-hy)*1.6); if(sc!=null&&B.cfg.seedCover&&SC.some(([a,b])=>a>=x&&a<x+w&&b>=y&&b<y+h)) sc-=B.cfg.seedCover; if(sc!=null) c.push([sc,x,y]) }
  c.sort((a,b)=>a[0]-b[0]); let tries=0;
  for(const [,x,y] of c){ const key=room+':'+x+':'+y, f=B.fc.get(key); if(f&&S().tick-f<3000) continue;
    const p=S().planRoom(room,x,y,false); if(!p.ok){ B.why=B.why||{}; const wk=room+':'+String(p.reason).slice(0,50); B.why[wk]=(B.why[wk]||0)+1; if(!/^Needs/.test(p.reason)) B.fc.set(key,S().tick); if(++tries>30) break; continue }
    if(cmd({type:'place-room',room,col:x,row:y})){ log('place',room,x,y); cnt('r'+room); return true }
    if(++tries>30) break }
  return false }
// tunnels toward the nearest buried brown clay (terrain.clay===1). Digging plain dirt gives no clay.
const isDug=v=>v===-3||v>=0;
function digTo(targets,tag){ const s=S(), g=G(), P=s.pheromones, L=s.upgrades.tunnel;
  const pendT=pendingWorks().filter(w=>w.kind===1).length; if(pendT>=B.cfg.maxTun) return 0;
  const ok=(x,y)=>x>=0&&y>=0&&x<V&&y<Y&&g[y*V+x]===-1&&P.contains(x,y)&&s.cellDirt(x,y)<=L;
  B.bad=B.bad||new Map(); const now=s.tick;
  targets=targets.filter(([x,y])=>ok(x,y)&&!(B.cfg.digFix&&(B.bad.get(tag+':'+x+','+y)||0)>now)); if(!targets.length) return -1;
  const dug=[]; for(let i=0;i<V*Y;i++) if(isDug(g[i])) dug.push([i%V,Math.floor(i/V)]);
  const pairs=[]; for(const [tx,ty] of targets) for(const [dx,dy] of dug) pairs.push([Math.abs(tx-dx)+Math.abs(ty-dy),tx,ty,dx,dy]);
  pairs.sort((a,b)=>a[0]-b[0]);
  const tryLine=(fx,fy,ex,ey)=>{ const sx=Math.sign(ex-fx),sy=Math.sign(ey-fy); let k=0,x=fx,y=fy;
    while(k<12){ const nx=x+sx,ny=y+sy; if(!ok(nx,ny)) break; x=nx;y=ny;k++; if(x===ex&&y===ey) break }
    for(let j=k;j>=1;j--){ const ex2=fx+sx*j, ey2=fy+sy*j; const p=S().planRoom(5,ex2,ey2,false,{col:fx,row:fy}); if(!p.ok) continue;
      if(cmd({type:'place-room',room:5,col:ex2,row:ey2,fromCol:fx,fromRow:fy})){ log(tag,fx,fy,ex2,ey2); cnt(tag); return true } }
    return false };
  if(B.cfg.digFix){ // up to 15 distinct targets, 3 start points each; targets that fail are skipped for a while
    const per=new Map(); let nt=0; const tried=[];
    for(const [,tx,ty,dx,dy] of pairs){ const k=tx+','+ty, c=per.get(k)||0; if(c>=3) continue; if(!c){ if(nt>=15) continue; nt++; tried.push(k) } per.set(k,c+1);
      if(dx!==tx && tryLine(dx,dy,tx,dy)) return 1;
      if(dy!==ty && tryLine(dx,dy,dx,ty)) return 1 }
    for(const k of tried) B.bad.set(tag+':'+k,now+4500);
    return 0 }
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

// seeds in parallel with clay: up to cfg.seedPar pending seed tunnels, only while clay is not short
function seedPar(){ if(seedsGot()>=B.cfg.seedMax||S().tick<B.cfg.seedAt) return 0; const pendS=pendingWorks().filter(w=>w.kind===1&&w.__s).length;
  const n=castes().digger; if(n<B.cfg.seedDiggers) return 0;
  const save=B.cfg.maxTun; B.cfg.maxTun=save+B.cfg.seedPar; const r=digTo(seedCells(),'stun'); B.cfg.maxTun=save; return r>0?1:0 }
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
  const coverOn=()=>!B.cfg.coverAfter||(B.cfg.coverAfter==='tan'?has('build-tan-clay-store'):seedsGot()>=(B.plan?seedCost(B.plan):99));
  if(B.cfg.pheroCover&&coverOn()){ const R=B.cfg.pheroR||15, W=B.cfg.pheroCover, T=B.cfg.pheroTanW||0, tanC=[];
    if(T){ const s=S(); for(let i=0;i<V*Y;i++){ const a=i%V,b=Math.floor(i/V); if(s.terrain.clay[i]===2&&!P.contains(a,b)) tanC.push([a,b]) } }
    return place(6,(x0,y0,w,h)=>{ const cx=x0+1,cy=y0+1; let v=0; for(const [,a,b] of out){ const d=Math.hypot(a-cx,b-cy); if(d<=R) v+=1-d/(2*R) }
      if(T) for(const [a,b] of tanC){ if(Math.hypot(a-cx,b-cy)<=R) v+=T }
      return -W*v+Math.hypot(cx-tx,cy-ty)*0.2 }) }
  return place(6,(x0,y0,w,h)=>Math.hypot(x0+1-tx,y0+1-ty)) }
// keep idle diggers busy late: extra tunnels to any reachable undug cell
function busyDig(){ if(!B.cfg.busyAt||S().tick<B.cfg.busyAt) return 0; const s=S(),g=G(),P=s.pheromones; let idle=0; for(const a of s.ants) if(a.kind==='digger'&&a.task===0) idle++;
  if(idle<B.cfg.busyIdle) return 0; const save=B.cfg.maxTun; B.cfg.maxTun=B.cfg.busyTun;
  const t=[]; for(let i=0;i<V*Y;i+=3){ const x=i%V,y=Math.floor(i/V); if(g[i]===-1&&P.contains(x,y)) t.push([x,y]) }
  const r=digTo(t,'btun'); B.cfg.maxTun=save; return r>0?1:0 }
// seed tree: buy cards in cfg.buy order, revealing groups as needed; strict order
function tree(){ const u=S().unlocks; for(const id of B.cfg.buy){ if(u.unlocked.has(id)) continue;
    let r=u.refusal(id); if(r==='fogged'){ const p=u.revealPrice; if(p!=null&&u.seeds>=p&&cmd({type:'reveal-seed-group'})){ log('reveal',u.revealed); cnt('reveal'); r=u.refusal(id) } else return }
    if(r===null){ if(cmd({type:'buy-seed-card',id})){ log('buy',id); cnt('buy:'+id) } } return } }
function upgrades(){ const s=S(); for(const k of B.cfg.ups){ if(k==='tunnel'&&(s.upgrades.tunnel>=1||s.unlocks.revealed<2)) continue; if(s.upgradeShortfall(k)) continue; if(k!=='jelly'&&st().clay-10<B.cfg.upClay) continue; if(cmd({type:'upgrade',kind:k})){ log('up',k,s.upgrades[k]); cnt('up:'+k); return } } }
function jelly(){ const s=S(); if(!B.cfg.jelly) return; const can=s.upgrades.jelly<1&&has('upgrades-jelly')&&s.tick<=B.cfg.jellyBy;
  if(can&&!s.upgradeShortfall('jelly')){ if(cmd({type:'upgrade',kind:'jelly'})){ log('up','jelly'); cnt('up:jelly') } }
  const want=B.cfg.jellyPause&&s.upgrades.jelly<1&&has('upgrades-jelly')&&s.tick<=B.cfg.jellyBy;
  if(want&&!s.eggsPaused){ if(cmd({type:'room-action',action:'pause-eggs',id:s.royal.id})){ B.jp=1; cnt('jpause') } }
  else if(!want&&B.jp&&s.eggsPaused){ if(cmd({type:'room-action',action:'resume-eggs',id:s.royal.id})) B.jp=0 } }
const clayNear=(x0,y0,r)=>{ const s=S(),g=G(); let k=0; for(let y=Math.max(0,y0-r);y<Math.min(Y,y0+r);y++) for(let x=Math.max(0,x0-r);x<Math.min(V,x0+r);x++){ const i=y*V+x; if(s.terrain.clay[i]===1&&g[i]===-1) k++ } return k };
function hatch(kind){ if(S().hatchShortfall(kind)) return false; const ok=cmd({type:'hatch',kind}); if(ok) cnt('h_'+kind); return ok }

const sandAt=(x0,y0)=>{ const [w,h]=SZ[6]; return S().pheromoneSandTiles({cx:(x0+w/2)*8,cy:228+(y0+h/2)*8}).filter(Boolean).length };
const dHome=(x0,y0,w,h)=>{ const [hx,hy]=home(); return Math.hypot(x0+w/2-hx,y0+h/2-hy) };
const royalD=(x0,y0,w,h)=>{ const R=S().royal.gridCells; let m=1e9; for(const c of R){ const cx=c%V,cy=Math.floor(c/V); const dx=Math.max(x0-cx,0,cx-(x0+w-1)), dy=Math.max(y0-cy,0,cy-(y0+h-1)); m=Math.min(m,dx+dy) } return m };
const outRing=(x0,y0,w,h)=>!B.cfg.ring||dHome(x0,y0,w,h)>=B.cfg.ring;
const houseScore=(x0,y0,w,h)=>{ if(!outRing(x0,y0,w,h)) return null; if(B.cfg.houseWest&&x0+w>RX()-1) return null; const [hx,hy]=home(); const hs=rooms(1); let k=0; for(const e of hs){ const ex=e.cx/8-1,ey=(e.cy-228)/8-1; if(Math.abs(ex-x0)<=B.cfg.hr&&Math.abs(ey-y0)<=B.cfg.hr) k++ } const d=Math.hypot(x0+1-hx,(y0+1-hy)*1.6); return hs.length? (k?-k*20+d*0.3:d+30) : d };
// farmEast: farms east of the queen, as close to her chamber as possible; houseWest: houses only west of her
const RX=()=>S().royal.cx/8, RY=()=>(S().royal.cy-228)/8;
const farmEastScore=(x0,y0,w,h)=>{ if(x0<RX()+B.cfg.farmEast-1) return null; return royalD(x0,y0,w,h)*3+Math.abs(y0+h/2-RY()) };
const lsTunScore=(x0,y0,w,h)=>{ const g=G(); let k=0; for(let y=y0-2;y<=y0+3;y++) for(let x=x0-2;x<=x0+5;x++){ if(x<0||y<0||x>=V||y>=Y) continue; if(x>=x0&&x<x0+w&&y>=y0&&y<y0+h) continue; const v=g[y*V+x]; if(v===-3||(v>=0&&S().elems[v]&&S().elems[v].kind===1)) k++ } return -k*3+dHome(x0,y0,w,h)*0.5 };
const houseGrid=(x0,y0,w,h)=>{ const r=S().royal; const rx=Math.round(r.cx/8-2), ry=Math.round((r.cy-228)/8-1); if((((x0-rx)%2)+2)%2||(((y0-ry)%2)+2)%2) return null;
  const hs=rooms(1); let k=0; for(const e of hs){ const ex=e.cx/8-1,ey=(e.cy-228)/8-1; if(Math.max(Math.abs(ex-x0),Math.abs(ey-y0))<=6) k++ }
  const d=royalD(x0,y0,w,h); return d>6?null:-k*10+d*2 };
const nearRooms=(r,x0,y0,w,h,R)=>rooms(r).filter(e=>{ const ex=e.cx/8,ey=(e.cy-228)/8; return Math.abs(ex-(x0+w/2))<=R+w/2+2&&Math.abs(ey-(y0+h/2))<=R+h/2+1 }).length;
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
  // 0g. Dirt Storage rooms (10 brown clay): diggers drop soil there instead of on the surface mound
  if(B.cfg.soilStores && has('build-soil-store') && rooms(16).length<B.cfg.soilStores && clay>=10 && !pendRoom(16)) return place(16);
  // 0b. early pheromone room toward the feeder resources
  if(B.cfg.pheroAt && S().tick>=B.cfg.pheroAt && !rooms(6).length && pheroTarget()){ if(pheroToward()) return }
  // 0a. tan clay storage once unlocked (30 leaves): make sure leaf storage can hold 30
  if(B.cfg.tanStore && has('build-tan-clay-store') && !rooms(13).length){ if(x.leafCapacity<31 && clay>=1 && !pendRoom(4)) return place(4); if(leaves>=30 && !pendRoom(13)) return place(13); if(B.cfg.reserve30 && cap-(P-1)-brood>=1) return }
  // 0. brown clay storage (+20 clay) once unlocked
  if(B.cfg.storeAt && S().unlocks.unlocked.has('build-dirt-store') && !rooms(7).length && clay>=10 && !pendRoom(7)) return place(7);
  // 1. first leaf storage
  if(!rooms(4).length && clay>=1) return place(4,B.cfg.ls1Tun?lsTunScore:undefined);
  // day 1: no farm (and no 2nd leaf storage unless needed to hold 8 leaves) before the first house
  if(B.cfg.house1First && !rooms(1).length){ if(clay>=5 && leaves>=8) return (B.cfg.grid&&place(1,houseGrid))||place(1,houseScore); if(x.leafCapacity<8 && clay>=1 && rooms(4).length<2 && !pendRoom(4)) return place(4,B.cfg.ls1Tun?lsTunScore:undefined); return }
  // 2. houses before capacity runs out
  if(cap-(P-1)-brood<B.cfg.houseSlack && !pendRoom(1) && clay>=5 && leaves>=8) return (B.cfg.grid&&place(1,houseGrid))||place(1,houseScore);
  // 3. farms: one per farmPer leafcutters
  if(leaves>=5 && rooms(3).length<Math.max(1,Math.ceil(n.leafcutter/(B.cfg.fLateAt&&S().tick>=B.cfg.fLateAt&&B.cfg.farmPerLate?B.cfg.farmPerLate:B.cfg.farmPer))) && !pendRoom(3)) return place(3,B.cfg.farmEast?farmEastScore:B.cfg.farmAdj?(x0,y0,w,h)=>royalD(x0,y0,w,h)*10+dHome(x0,y0,w,h):B.cfg.ring?(x0,y0,w,h)=>dHome(x0,y0,w,h):undefined);
  // 3b. Sprout Leaf Rooms (5 clay + 5 leaves) next to Leaf Storage, and Leaf Storage next to sprouts
  if(B.cfg.sprouts && has('build-sprout') && done(1)>=B.cfg.sproutFrom){
    if(rooms(17).length<B.cfg.sprouts && !pendRoom(17) && clay>=5+B.cfg.sproutRes && leaves>=5 && cap-(P-1)-brood>=B.cfg.houseSlack)
      return place(17,(x0,y0,w,h)=>{ const d=dHome(x0,y0,w,h); return d<5?null:-nearRooms(4,x0,y0,w,h,5)*6-nearRooms(17,x0,y0,w,h,4)*2+d*0.5 });
    if(rooms(17).length>=2 && clay>=1 && rooms(4).length<B.cfg.sproutLs+Math.floor(rooms(17).length/2) && !pendRoom(4))
      return place(4,(x0,y0,w,h)=>-nearRooms(17,x0,y0,w,h,5)*6+dHome(x0,y0,w,h)*0.5) }
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
    else if(has('ants-feeder') && n.feeder<B.cfg.feeders && tan()>=5 && x.brood>=2 && !(B.cfg.foodFeed!=null && n.feeder>=B.cfg.foodFeed && S().upgrades.food<2 && has('upgrades-food'))) kind='feeder';
    else if(n.farmer<done(3)*(B.cfg.fLateAt&&S().tick>=B.cfg.fLateAt?B.cfg.fLate:B.cfg.farmersPer) && !(n.farmer===0 && (S().tick<B.cfg.f1At || x.leaves<B.cfg.f1Leaf)) && (!B.cfg.farmFall || x.clay>=2)){ if(x.brood>=2&&x.clay>=2) kind='farmer'; else return }
    else if(n.leafcutter<B.cfg.lc0 || n.leafcutter<(st().day<=B.cfg.dSwitch?B.cfg.lcEarly:(B.cfg.lcLateAt&&S().tick>=B.cfg.lcLateAt&&S().tick<B.cfg.lcLateEnd?B.cfg.lcLate:B.cfg.lcShare))*(P-1)){ if(x.clay>=1) kind='leafcutter'; else if(n.digger<dWant||B.cfg.lcFall) kind='digger'; else return }
    else if(n.digger<dWant) kind='digger';
    else kind='digger';
    if(!kind||!hatch(kind)) return }
}

// cancel works that made no digging progress for cfg.stuckT ticks (unreachable or unpaid), so they stop blocking new digging
function unstick(){ if(!B.cfg.stuckT) return; const s=S(); B.wp=B.wp||new Map();
  for(const w of pendingWorks()){ const k=w.id, p=(w.ptr||0)+(w.dug||0); const o=B.wp.get(k);
    if(!o||o.p!==p){ B.wp.set(k,{p,t:s.tick}); continue }
    if(s.tick-o.t>=B.cfg.stuckT){ const c=w.cells&&w.cells.length?w.cells[Math.min(w.cells.length-1,w.ptr||0)]:null;
      const col=c!=null?Math.floor((c%1280)/8):Math.floor(w.cx/8), row=c!=null?Math.floor((Math.floor(c/1280)-228)/8):Math.floor((w.cy-228)/8);
      if(cmd({type:'cancel-room',col,row})){ log('cancel',w.kind,w.room,col,row); cnt('cancel') } B.wp.set(k,{p,t:s.tick}) } } }
// starvation guard: when ants are close to starving, pause eggs so the fungus feeds them (1 meal saves an ant; an egg costs 3)
function starveGuard(){ if(!B.cfg.starve) return; const s=S(); if(s.tick<B.cfg.starveFrom) return;
  const lim=9000*s.upgradeSpeed('food')+18000; let crit=0; for(const a of s.ants){ if(a.kind!=='queen'&&s.tick-a.ate>=lim-B.cfg.starveMargin) crit++ }
  B.crit=crit; const want=crit>=B.cfg.starveN;
  if(want&&!s.eggsPaused){ if(cmd({type:'room-action',action:'pause-eggs',id:s.royal.id})){ B.sp=1; cnt('spause') } }
  else if(!want&&B.sp&&s.eggsPaused){ if(cmd({type:'room-action',action:'resume-eggs',id:s.royal.id})) B.sp=0 } }
function manage(){ unstick(); starveGuard(); if(!B.plan){ B.plan=planCards(B.cfg.fTargets); B.cfg.buy=[...B.plan,...B.cfg.extraBuy.filter(x=>!B.plan.includes(x))]; if(B.cfg.buyFirst){ const f=planCards(B.cfg.buyFirst); B.cfg.buy=[...f,...B.cfg.buy.filter(x=>!f.includes(x))]; B.cfg.seedMax=seedCost(B.cfg.buy) } if(0) B.cfg.buy=[...B.cfg.buyFirst,...B.cfg.buy.filter(x=>!B.cfg.buyFirst.includes(x))]; B.cfg.seedMax=seedCost(B.cfg.buy); if(!B.cfg.ups.includes('tunnel')) B.cfg.ups=['tunnel',...B.cfg.ups]; log('plan',B.cfg.buy.join(','),B.cfg.seedMax) }
  tree(); jelly(); fungusBank(); busyDig(); if(!(B.cfg.noDigAt&&S().tick>=B.cfg.noDigAt)){ if(B.cfg.seedPar){ if(!digTan()) digClay(); seedPar() } else if(!digTan()&&!digSeeds()) digClay(); } if(B.cfg.upPri){ upgrades(); build() } else { build(); upgrades() } ants() }

window.__run14=async(maxTicks)=>{ maxTicks=maxTicks??B.cfg.end; const myId=(B.runId=(B.runId||0)+1); B.done=false; try{
  while(!B.stop && B.runId===myId && S().tick<maxTicks){
    guarded(manage);
    await R.step(Math.min(150,maxTicks-S().tick));
    const sc=score(); if(st().day<=7 && sc>B.best){B.best=sc;B.bestT=S().tick}
    { const q=S().queen; if(q&&st().day>=4&&st().day<=7){ B.qs=B.qs||{}; B.qs[q.task]=(B.qs[q.task]||0)+1 } }
    if(S().tick%9000<150) log('day',st().day,{score:sc,cap:st().capacity,brood:st().brood,leaves:st().leaves,clay:st().clay,fungus:st().fungus,castes:castes()});
    await new Promise(r=>setTimeout(r,0));
  } B.done=true }catch(e){ B.err=String(e)+' '+(e.stack||'').slice(0,400) } };
window.__st14=()=>{ const x=st(); return {why:B.why,noClay:B.noClay,pend:pendingWorks().map(w=>[w.id,w.kind,w.room,w.ptr,w.cells.length,Math.round(w.cx/8),Math.round((w.cy-228)/8),w.reach,w.n]),owed:S().owed,up:S().upgrades,rooms:{h:rooms(1).length,sp:rooms(17).length,ls:rooms(4).length,f:rooms(3).length,ph:rooms(6).length,cs:rooms(7).length},qs:B.qs,tan:tan(),unl:[...S().unlocks.unlocked],seeds:S().unlocks.collected,tick:S().tick,day:x.day,score:score(),best:B.best,cap:x.capacity,brood:x.brood,leaves:x.leaves+'/'+x.leafCapacity,clay:x.clay+'/'+x.clayCapacity,fungus:x.fungus,castes:castes(),n:B.n,cmds:B.cmds,fails:B.fails,err:B.err,done:B.done} };
return 'bot20 loaded';
