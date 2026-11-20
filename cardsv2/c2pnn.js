// c2pnn: three small nets on top of c2bot.
//   k: knob net (same as c2nn): every 150 ticks sets the bot's knobs around the base cfg.
//   w: "what" net: one output per build action (digger den, first leaf storage, farmer den,
//      leafcutter den, farm, leaf storage). Output shifts the action's priority; below -0.6 the
//      action is skipped this step (save the eggs/clay/leaves).
//   p: "where" net: scores each free spot for a room; added to the hand score (lower = better).
// All-zero output weights = the plain bot. window.__NET = {k:{W1,W2}, w:{W1,W2}, p:{W1,W2}}.
(()=>{const B=window.__C2, S=()=>window.__sim;
const net=window.__NET; if(!net) return;
const base=Object.assign({},B.cfg);
const rooms=t=>S().nest.works.filter(e=>e.kind===2&&e.room===t&&!e.fill);
const pend=()=>S().nest.works.filter(e=>!e.done&&!e.fill);
const lg=x=>Math.log1p(x)/4;
const V=160;
function feats(){ const s=S(),x=s.stats(),c=s.castes(),t=s.tick/63000; const pw=pend();
  return [t,Math.sin(2*Math.PI*s.tick/9000),Math.cos(2*Math.PI*s.tick/9000),x.brood/5,x.clay/10,x.leaves/Math.max(10,x.leafCapacity),Math.min(1,x.fungus/100),
    lg(rooms(42).length),lg(rooms(44).length),lg(rooms(3).length),lg(rooms(43).length),lg(rooms(4).length),
    pw.filter(w=>w.kind===2).length/5,pw.filter(w=>w.kind===1).length/2,lg(c.digger),lg(c.leafcutter),lg(c.farmer),B.noClay&&s.tick-B.noClay<1500?1:0,s.digLevel(),lg(x.leaves)] }
const mk=n=>{ if(!n) return null; const H=n.W1.length,I=n.W1[0].length-1;
  return v=>{ const h=n.W1.map(r=>{let a=r[I];for(let i=0;i<I;i++)a+=r[i]*v[i];return Math.tanh(a)}); return n.W2.map(r=>{let a=r[H];for(let i=0;i<H;i++)a+=r[i]*h[i];return Math.tanh(a)}) } };
const K=mk(net.k||(net.W1?net:null)), W=mk(net.w), P=mk(net.p);
const cl=(v,a,b)=>Math.max(a,Math.min(b,v));
let F=null;
let Wo=null;
B.pre=()=>{ F=feats(); if(W){ Wo=W(F); B.resOn=Wo.length>7&&Wo[7]>0 } if(!K) return; const o=K(F), c=B.cfg;
  c.fW=base.fW*Math.exp(o[0]); c.lW=base.lW*Math.exp(o[1]);
  c.keepClay=cl(Math.round(base.keepClay+2*o[2]),0,6);
  c.maxPend=cl(Math.round(base.maxPend+3*o[3]),1,10);
  c.maxTun=cl(Math.round(base.maxTun+1.5*o[4]),1,3);
  c.dd=o[5]>0.5?base.dd+3:o[5]<-0.5?Math.min(base.dd,rooms(42).length):base.dd;
  c.covW=base.covW*Math.exp(o[6]);
  c.farmFirst=o[7]>0.3?1:o[7]<-0.3?0:base.farmFirst;
  c.lsMax=o[8]<-0.5?rooms(4).length:base.lsMax;
  c.fd=o[9]<-0.5?rooms(44).length:base.fd;
  c.lcd=o[10]<-0.5?rooms(43).length:base.lcd;
  c.farmMax=o[11]<-0.5?rooms(3).length:base.farmMax; };
if(W) B.wadj=()=>Wo||W(F||feats());
if(P){ const SZ={42:[3,2],43:[3,2],44:[3,2],3:[3,3],4:[4,2],6:[2,3],15:[4,2]};
  const RT=[42,43,44,3,4];
  const ctr=e=>[e.cx/8,(e.cy-228)/8];
  const reach=(ra,ax,ay,rb,bx,by)=>{ const [wa,ha]=SZ[ra]||[3,2],[wb,hb]=SZ[rb]||[3,2]; return Math.abs(ax-bx)<(wa+wb)/2+5&&Math.abs(ay-by)<(ha+hb)/2+5 };
  let cache=null;
  const ctx=()=>{ const s=S(),k=s.tick+':'+s.nest.works.length; if(cache&&cache.k===k) return cache;
    const r=s.royal; const g=s.nest.grid;
    cache={k,rc:[r.cx/8,(r.cy-228)/8],fd:rooms(44).map(ctr),fm:rooms(3).map(ctr),lc:rooms(43).map(ctr),ls:rooms(4).map(ctr),dd:rooms(42).map(ctr),g,
      gl:F?[F[0],F[3],F[4],F[5]]:[0,0,0,0]}; return cache };
  const cnt=(L,ra,cx,cy,rb)=>{ let n=0; for(const [a,b] of L) if(reach(ra,cx,cy,rb,a,b)) n++; return n };
  B.padj=(room,x,y,w,h,sc)=>{ const ri=RT.indexOf(room); if(ri<0) return sc; const C=ctx(); const cx=x+w/2,cy=y+h/2;
    // free cells in a ring around the spot (room to grow)
    let fr=0; for(let yy=y-2;yy<y+h+2;yy++) for(let xx=x-2;xx<x+w+2;xx++){ if(yy<0||xx<0||yy>=89||xx>=V) continue; if(C.g[yy*V+xx]===-1) fr++ }
    const v=[ri===0?1:0,ri===1?1:0,ri===2?1:0,ri===3?1:0,ri===4?1:0,
      (cx-C.rc[0])/40,(cy-C.rc[1])/30,Math.hypot(cx-C.rc[0],cy-C.rc[1])/40,
      lg(cnt(C.fd,44,cx,cy,room)),lg(cnt(C.fm,3,cx,cy,room)),lg(cnt(C.lc,43,cx,cy,room)),lg(cnt(C.ls,4,cx,cy,room)),
      fr/((w+4)*(h+4)),y/89,...C.gl];
    return sc+8*P(v)[0] } }
window.__NETO=12; })();
