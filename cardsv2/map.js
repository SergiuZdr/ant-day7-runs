const {browser,page}=require('./h.js');
(async()=>{const b=await browser();const p=await page(b,+process.argv[2]||55917);
 const r=await p.evaluate(()=>{const s=window.__sim,P=s.pheromones,g=s.nest.grid,V=160,Y=89;const lines=[];
  // terrain clay per cell: count brown clay pixels
  const T=s.terrain; const keys=Object.keys(T);
  for(let y=0;y<45;y++){let l='';for(let x=40;x<120;x++){const v=g[y*V+x];let ch;
    if(v>=0)ch='#';else if(v===-3)ch='=';else{const d=s.cellDirt(x,y);ch='.tTr'[d]||'?';
      // clay?
      let c=0;for(let yy=228+y*8;yy<236+y*8;yy++)for(let xx=x*8;xx<x*8+8;xx++){const i=yy*1280+xx; if(T.clay&&T.clay[i])c++;}
      if(c>8)ch=d===0?'c':'C';
      if(!P.contains(x,y))ch=ch===' '?' ':(ch==='.'?' ':ch.toLowerCase()==='c'?'k':'_');}
    l+=ch}lines.push(String(y).padStart(2)+' '+l)}
  return {keys,lines,mats:[...new Set(Array.from(T.mat.slice(228*1280,400*1280)))].slice(0,20)}});
 console.log(r.keys.join(' '));console.log(r.mats);console.log('   '+[...Array(80)].map((_,i)=>((40+i)%10)).join(''));console.log(r.lines.join('\n'));
 await b.close()})();
