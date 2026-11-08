const {chromium}=require('playwright');const fs=require('fs');const S=process.argv[2]||require('path').join(__dirname,'test-output');require('fs').mkdirSync(S+'/shots',{recursive:true}),F=S+'/fontsrc/node_modules/@fontsource/';
const css=`@font-face{font-family:'Bellefair';font-weight:400;src:url(http://fonts.local/bf.woff2) format('woff2')}`+[400,500,600,700].map(w=>`@font-face{font-family:'Montserrat';font-weight:${w};src:url(http://fonts.local/m${w}.woff2) format('woff2')}`).join('');
const files={'/bf.woff2':F+'bellefair/files/bellefair-latin-400-normal.woff2'};[400,500,600,700].forEach(w=>files['/m'+w+'.woff2']=F+`montserrat/files/montserrat-latin-${w}-normal.woff2`);
async function ctx(b,vp){const c=await b.newContext({viewport:vp,deviceScaleFactor:1});await c.route(/^https?:/,r=>{const u=new URL(r.request().url());if(u.host==='fonts.googleapis.com')return r.fulfill({contentType:'text/css',body:css});if(u.host==='fonts.local')return fs.existsSync(files[u.pathname]||'')?r.fulfill({contentType:'font/woff2',body:fs.readFileSync(files[u.pathname])}):r.abort();return r.abort()});return c}
(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader','--allow-file-access-from-files']});const errs=[];
const c=await ctx(b,{width:1440,height:900});const p=await c.newPage();p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+require('path').resolve(__dirname,'../BreezeBook.html'),{waitUntil:'domcontentloaded',timeout:120000});await p.waitForTimeout(3000);
console.log('hero buttons:',await p.$$eval('.hero button, .hero a.btn, [class*=hero] button',e=>e.map(x=>x.textContent.trim()).filter(Boolean)));
await p.click('#botBtn');await p.waitForTimeout(300);
const ask=async q=>{const n=await p.$$eval('#botLog > *',e=>e.length);const t=Date.now();await p.fill('#botIn',q);await p.press('#botIn','Enter');await p.waitForFunction(n=>document.querySelectorAll('#botLog > *').length>n+1,n,{timeout:20000}).catch(()=>{});await p.waitForTimeout(150);const ms=Date.now()-t;const last=await p.$$eval('#botLog > *',e=>e.slice(-2).map(x=>x.innerText.replace(/\n+/g,' / ')).join(' || '));console.log(`[${ms} ms] ${q}\n   -> ${last.slice(0,420)}`)};
for(const q of ["hi","Wedding for 150 guests in April, about $20,000","outdoor","How do prices work?","birthday party","80","gala for 900 in March with a stage, $15k","what's the weather like?"])await ask(q);
await p.screenshot({path:S+'/shots/chat_fast.png'});
const chip=await p.$('#botLog .bchips button');console.log('chips:',await p.$$eval('#botLog .bchips button',e=>e.map(x=>x.textContent)));
const v=await p.$('#botLog [data-bview]');if(v){await v.click();await p.waitForTimeout(2000);console.log('3D opened:',await p.evaluate(()=>!document.getElementById('bbImm').hidden))}
console.log('ERRS',errs);await b.close()})();
