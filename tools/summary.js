// Merge results.jsonl files under a folder and print a markdown summary (best first).
const fs=require('fs'),path=require('path');
const root=process.argv[2]||'out';const rows=[];
(function walk(d){for(const f of fs.readdirSync(d)){const p=path.join(d,f);if(fs.statSync(p).isDirectory())walk(p);else if(f==='results.jsonl')for(const l of fs.readFileSync(p,'utf8').split('\n'))if(l.trim())rows.push(JSON.parse(l))}})(root);
rows.sort((a,b)=>b.best-a.best);
const by={};for(const r of rows){(by[r.seed]??=[]).push(r.best)}
let md=`## Day-7 runs: ${rows.length}\n\n| Seed | Runs | Best | Median |\n|---|---|---|---|\n`;
for(const [s,v] of Object.entries(by)){v.sort((a,b)=>a-b);md+=`| ${s} | ${v.length} | ${v[v.length-1]} | ${v[Math.floor(v.length/2)]} |\n`}
md+=`\n### Top 10\n\n| Best | Seed | Bot | Saved | Config |\n|---|---|---|---|---|\n`;
for(const r of rows.slice(0,10))md+=`| ${r.best} | ${r.seed} | ${r.bot} | ${r.saved||''} | \`${JSON.stringify(r.cfg)}\` |\n`;
const errs=rows.filter(r=>r.error).length;if(errs)md+=`\n${errs} runs failed.\n`;
console.log(md);
