// Runs in the page at tick 0: map + seed-tree facts for the day-7 sprint.
const s=window.__sim,P=s.pheromones,q=s.queenHome,hx=q.cx/8,hy=(q.cy-228)/8;
const cells=[];for(let i=0;i<160*89;i++){const v=s.terrain.clay[i];if(!v)continue;const x=i%160,y=Math.floor(i/160);cells.push([v,Math.hypot(x-hx,y-hy),P.contains(x,y)?1:0])}
const near=(v,d)=>cells.filter(r=>r[0]===v&&r[1]<=d).length;
const sd=s.seeds.map(x=>{const cx=Math.floor((x.cell%1280)/8),cy=Math.floor((Math.floor(x.cell/1280)-228)/8);return Math.hypot(cx-hx,cy-hy)});
const u=s.unlocks,t=u.tree,ids=Object.keys(t);const nb=id=>[...t[id].links.filter(x=>!x.startsWith('@')),...ids.filter(n=>t[n].links.includes(id))];
const dist={},prev={},dn=new Set();for(const id of ids){if(t[id].links.some(x=>x.startsWith('@')))dist[id]=t[id].seeds}
while(true){let b=null;for(const id of ids)if(!dn.has(id)&&dist[id]!=null&&(b==null||dist[id]<dist[b]))b=id;if(b==null)break;dn.add(b);for(const n of nb(b)){const c=dist[b]+t[n].seeds;if(dist[n]==null||c<dist[n]){dist[n]=c;prev[n]=b}}}
const cost=(...ts)=>{const set=new Set();let g=0;for(const id of ts){let x=id;while(x){set.add(x);g=Math.max(g,t[x].group);x=prev[x]}}let c=0;for(const x of set)c+=t[x].seeds;return c+[0,1,3,6,10][g]};
return {seeds16:sd.filter(d=>d<=16).length,seeds25:sd.filter(d=>d<=25).length,seeds35:sd.filter(d=>d<=35).length,
 tan25:near(2,25),tan35:near(2,35),brown16:near(1,16),brown25:near(1,25),
 cFeeder:cost('ants-feeder','build-tan-clay-store'),cPit:cost('build-clay-pit'),cFeederPit:cost('ants-feeder','build-tan-clay-store','build-clay-pit'),
 cFood:cost('upgrades-food'),cQueen:cost('build-queen'),cQueenFood:cost('build-queen','upgrades-food'),cScent:cost('upgrades-scent'),cJelly:cost('upgrades-jelly')};
