// research tree per seed (pure function of seed, copied from the beta3 bundle) + cheapest cost to own a set of cards
const fs=require('fs');
const src=fs.readFileSync(__dirname+'/cards.raw','utf8').replace(/`/g,"'");
const s=eval('(()=>{'+src.replace(/,\s*$/,'')+'; return s})()');
const H=(e,t,n=0)=>{let r=(Math.imul(e,374761393)+Math.imul(t,668265263)+Math.imul(n,982451653))|0;r=Math.imul(r^(r>>>13),1274126177);r^=r>>>16;return (r>>>0)/4294967296};
const N=Object.keys(s), GROUPS=[...new Set(N.map(k=>s[k].group))];
const byG=GROUPS.map(g=>N.filter(k=>s[k].group===g));
const REV=[1,2,3,4];
function tree(seed){const r=new Map();
  GROUPS.forEach((g,gi)=>{const i=byG[gi],a=[...i];for(let n=a.length-1;n>0;n--){const j=Math.floor(H(n,g,seed^99538926)*(n+1));[a[n],a[j]]=[a[j],a[n]]}i.forEach((e,t)=>r.set(e,a[t]))});
  const T={};for(const e of N){const {group,col,row,links}=s[e],c=r.get(e);T[c]={seeds:s[c].seeds,group,col,row,links:links.map(x=>x.startsWith('@')?x:r.get(x))}}return T}
function parents(T,t){const out=[...T[t].links];for(const n of N)if(T[n].links.includes(t))out.push(n);return out.filter(n=>n.startsWith('@')||T[n].row<=T[t].row)}
// cheapest total sap to own all targets: exact search over parent choices is small; use Dijkstra-like best path per target, union of paths
function cost(T,targets){const dist={},prev={};const P={};for(const n of N)P[n]=parents(T,n);
  let ch=true;for(const n of N)dist[n]=Infinity;
  while(ch){ch=false;for(const n of N){let best=Infinity,bp=null;for(const p of P[n]){const d=p.startsWith('@')?0:dist[p];if(d<best){best=d;bp=p}}const v=best+T[n].seeds;if(v<dist[n]){dist[n]=v;prev[n]=bp;ch=true}}}
  const own=new Set();let roots=new Set();for(const t of targets){let x=t;while(x&&!x.startsWith('@')&&!own.has(x)){own.add(x);x=prev[x]}if(x&&x.startsWith('@'))roots.add(x)}
  const g=Math.max(...[...own].map(n=>T[n].group));let c=0;for(const n of own)c+=T[n].seeds;c+=REV.slice(0,g).reduce((a,b)=>a+b,0);
  return {cost:c,own:[...own],roots:[...roots],group:g}}
module.exports={tree,cost,parents,N};
if(require.main===module){const sd=+process.argv[2]||1;const T=tree(sd);console.log(JSON.stringify(Object.fromEntries(Object.entries(T).map(([k,v])=>[k,[v.group,v.seeds,v.links.join('|')]]))));console.log(JSON.stringify(cost(T,['combat-trap-jaw'])),JSON.stringify(cost(T,['combat-trap-jaw','build-sprout'])))}
