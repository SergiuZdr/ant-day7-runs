// harness: open Cards v2 page with sim captured
const pw=require('playwright');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const URL=process.env.GAME_URL||'https://beta.antarchitectgame.com/';
const CH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
async function browser(){const o={headless:true};if(process.env.CHROME!=='bundled'&&require('fs').existsSync(CH))o.executablePath=CH;return pw.chromium.launch(o)}
async function page(b,seed){
 const ctx=await b.newContext({viewport:{width:1400,height:900}});const p=await ctx.newPage();
 await p.addInitScript(()=>{const raf=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>setTimeout(()=>raf(cb),2000);
  const ok=Object.keys;Object.keys=function(o){if(o&&o.sim&&'instantBuilding' in o&&'sandbox' in o)window.__sim=o.sim;return ok.call(this,o)}});
 for(let k=0;;k++){try{await p.goto(URL+'?simWorker=0&seed='+seed+'&r='+Date.now(),{waitUntil:'load',timeout:90000});break}catch(e){if(k>=4)throw e;await sleep(15000)}}
 for(let i=0;i<90;i++){const t=await p.evaluate(()=>window.__sim&&window.ants?window.__sim.tick:-1);if(t===0)break;await sleep(1000)}
 p.ctx=ctx;return p}
module.exports={browser,page,sleep};
