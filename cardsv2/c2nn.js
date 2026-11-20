// c2nn: neural net on top of c2bot. Every 150 ticks a small tanh net reads the colony state and
// sets the bot's knobs around the base cfg. All-zero output weights = the plain bot.
// window.__NET = {W1:[H][I+1], W2:[O][H+1]} set before load.
(()=>{const B=window.__C2, S=()=>window.__sim;
const net=window.__NET; if(!net) return;
const base=Object.assign({},B.cfg);
const rooms=t=>S().nest.works.filter(e=>e.kind===2&&e.room===t&&!e.fill);
const pend=()=>S().nest.works.filter(e=>!e.done&&!e.fill);
const lg=x=>Math.log1p(x)/4;
function feats(){ const s=S(),x=s.stats(),c=s.castes(),t=s.tick/63000; const pw=pend();
  return [t,Math.sin(2*Math.PI*s.tick/9000),Math.cos(2*Math.PI*s.tick/9000),x.brood/5,x.clay/10,x.leaves/Math.max(10,x.leafCapacity),Math.min(1,x.fungus/100),
    lg(rooms(42).length),lg(rooms(44).length),lg(rooms(3).length),lg(rooms(43).length),lg(rooms(4).length),
    pw.filter(w=>w.kind===2).length/5,pw.filter(w=>w.kind===1).length/2,lg(c.digger),lg(c.leafcutter),lg(c.farmer),B.noClay&&s.tick-B.noClay<1500?1:0,s.digLevel(),lg(x.leaves)] }
const I=20,H=net.W1.length,O=net.W2.length;
function fwd(v){ const h=net.W1.map(r=>{let a=r[I];for(let i=0;i<I;i++)a+=r[i]*v[i];return Math.tanh(a)}); return net.W2.map(r=>{let a=r[H];for(let i=0;i<H;i++)a+=r[i]*h[i];return Math.tanh(a)}) }
const cl=(v,a,b)=>Math.max(a,Math.min(b,v));
B.pre=()=>{ const o=fwd(feats()), c=B.cfg;
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
window.__NETO=12; })();
