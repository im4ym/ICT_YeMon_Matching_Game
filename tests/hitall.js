// Tap-target test: every number and card on all 9 pages can be tapped (nothing invisible on top of it).
const { chromium } = require('playwright');
const path=require('path'),fs=require('fs');
const repo=path.resolve(process.argv[2]); const out=path.resolve(__dirname,'results',process.argv[3]||'hit'); fs.mkdirSync(out,{recursive:true});
(async()=>{const b=await chromium.launch();const rows=[];
for(const d of ['fruit-orchard','under-the-sea','toy-box'])for(const lv of [1,2,3]){
 const p=await b.newPage({viewport:{width:1214,height:620}});
 await p.goto(`file://${repo}/${d}/level${lv}.html`);await p.click('#playBtn');await p.waitForTimeout(400);
 const r=await p.evaluate(()=>{let n=0;const bad=[];document.querySelectorAll('#basketCol .basket, #numCol .num').forEach(el=>{const r=el.getBoundingClientRect();
  for(const fx of [0.1,0.5,0.9]){n++;const h=document.elementFromPoint(r.left+r.width*fx,r.top+r.height/2);if(!el.contains(h))bad.push(h.id||h.className);}});return {n,bad};});
 rows.push([d,`Level ${lv}`,`${r.n-r.bad.length} of ${r.n} tap points reach the card`+(r.bad.length?' (blocked by '+[...new Set(r.bad)].join(', ')+')':''),r.bad.length?'Fail':'Pass']);
 await p.close();}
await b.close();rows.forEach(r=>console.log(r.join(' | ')));const f=rows.filter(r=>r[3]!=='Pass').length;console.log(f?f+' FAILED':'ALL '+rows.length+' PASS');
fs.writeFileSync(out+'/results.json',JSON.stringify(rows,null,1));})();
