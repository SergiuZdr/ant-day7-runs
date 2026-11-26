// node sweep-summary.js [dir] : summary of all seed-sweep results.
// With no dir it fetches the c2-results branch into ../.sweep-results (git worktree-free: plain fetch + archive).
const fs=require('fs'),path=require('path'),{execSync}=require('child_process');
let dir=process.argv[2];
if(!dir){dir=path.join(__dirname,'..','.sweep-results');fs.rmSync(dir,{recursive:true,force:true});fs.mkdirSync(dir,{recursive:true});
  execSync('git fetch -q origin c2-results',{cwd:__dirname});
  execSync(`git archive origin/c2-results results/sweep | tar -x -C "${dir}"`,{cwd:__dirname,shell:'/bin/bash'})}
const files=[];(function walk(d){for(const f of fs.readdirSync(d)){const p=path.join(d,f);fs.statSync(p).isDirectory()?walk(p):/sweep-job.*\.jsonl$/.test(f)&&files.push(p)}})(dir);
const R=[],E=[];for(const f of files)for(const l of fs.readFileSync(f,'utf8').split('\n'))if(l.trim()){const r=JSON.parse(l);(r.score==null?E:R).push(r)}
const bySeed=new Map();for(const r of R)bySeed.set(r.seed,r);const A=[...bySeed.values()];
if(!A.length){console.log('no results yet');process.exit(0)}
const mean=a=>a.reduce((p,q)=>p+q,0)/a.length;
const corr=(a,b)=>{const ma=mean(a),mb=mean(b);let n=0,da=0,db=0;for(let i=0;i<a.length;i++){n+=(a[i]-ma)*(b[i]-mb);da+=(a[i]-ma)**2;db+=(b[i]-mb)**2}return da&&db?n/Math.sqrt(da*db):0};
const sc=A.map(r=>r.score).sort((a,b)=>a-b);
console.log(`seeds run: ${A.length}   failed loads: ${E.length}   seed range seen: ${Math.min(...A.map(r=>r.seed))}..${Math.max(...A.map(r=>r.seed))}`);
console.log(`power: median ${sc[sc.length>>1]}   best ${sc.at(-1)}`);
const h={};for(const s of sc)h[s]=(h[s]||0)+1;console.log('top of the distribution:',Object.entries(h).sort((a,b)=>b[0]-a[0]).slice(0,6).map(([k,v])=>`${k}:${v}`).join('  '));
console.log('\nbest seeds:');for(const r of A.sort((a,b)=>b.score-a.score||a.seed-b.seed).slice(0,15))console.log(`  ${r.seed}  power ${r.score}  trapJaws ${r.trapJaw}  fungus ${r.fungus}  leaves ${r.leaves}  TJ at ${r.tjAt}  sprouts ${r.sprouts}  sap cost ${r.costTjSprout}`);
const keys=['fungus','leaves','leavesDay4','tjAt','costTjSprout','costTj','sprouts','leafStores','majors','pheromones','clay','eggs','ants'];
const ok=A.filter(r=>r.score>=100);const y=ok.map(r=>r.score);
console.log('\nwhat goes with a high score (correlation with power):');
for(const k of keys){const v=ok.map(r=>r[k]??70000);console.log(`  ${k.padEnd(13)} ${corr(v,y)>=0?'+':''}${corr(v,y).toFixed(2)}`)}
const odd=A.filter(r=>r.odd);console.log(`\nunusual runs (leaves>3200, fungus>1100 or bot error): ${odd.length}`);for(const r of odd.slice(0,10))console.log('  ',JSON.stringify(r));
const low=A.filter(r=>r.score<100);console.log(`runs under 100 power (bot gaps): ${low.length}`,low.slice(0,10).map(r=>r.seed).join(' '));
