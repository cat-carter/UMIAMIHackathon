const {chromium}=require('playwright');const fs=require('fs');const S=process.argv[2]||require('path').join(__dirname,'test-output');require('fs').mkdirSync(S+'/shots',{recursive:true}),F=S+'/fontsrc/node_modules/@fontsource/';
const css=`@font-face{font-family:'Bellefair';font-weight:400;src:url(http://fonts.local/bf.woff2) format('woff2')}`+[400,500,600,700].map(w=>`@font-face{font-family:'Montserrat';font-weight:${w};src:url(http://fonts.local/m${w}.woff2) format('woff2')}`).join('');
const files={'/bf.woff2':F+'bellefair/files/bellefair-latin-400-normal.woff2'};[400,500,600,700].forEach(w=>files['/m'+w+'.woff2']=F+`montserrat/files/montserrat-latin-${w}-normal.woff2`);
async function ctx(b,vp){const c=await b.newContext({viewport:vp,deviceScaleFactor:1});await c.route(/^https?:/,r=>{const u=new URL(r.request().url());if(u.host==='fonts.googleapis.com')return r.fulfill({contentType:'text/css',body:css});if(u.host==='fonts.local')return fs.existsSync(files[u.pathname]||'')?r.fulfill({contentType:'font/woff2',body:fs.readFileSync(files[u.pathname])}):r.abort();return r.abort()});return c}
(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader','--allow-file-access-from-files']});const errs=[];
let c=await ctx(b,{width:1440,height:900});let p=await c.newPage();p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+require('path').resolve(__dirname,'../BreezeBook.html'),{waitUntil:'domcontentloaded',timeout:120000});await p.waitForTimeout(3500);await p.screenshot({path:S+'/shots/g0.png'});
await p.evaluate(()=>BBView.openGrand());await p.waitForTimeout(4000);await p.screenshot({path:S+'/shots/g1.png'});
const vis=await p.$$eval('#bbSpots .bb-hs',e=>e.filter(x=>!x.hidden).map(x=>x.getAttribute('aria-label')));console.log('visible pins:',vis);
console.log('layouts:',await p.$$eval('#bbSeg button',e=>e.map(x=>x.textContent)),'| viewpoints:',await p.$$eval('#bbVps button',e=>e.map(x=>x.textContent)),'| count:',await p.textContent('#bbCount'));
await p.mouse.move(700,450);await p.mouse.down();await p.mouse.move(640,450,{steps:4});await p.mouse.up();await p.waitForTimeout(500);const id=await p.$$eval('#bbSpots .bb-hs:not(.nav)',e=>{const x=e.find(b=>!b.hidden);if(x)x.click();return x&&x.getAttribute('aria-label')});await p.waitForTimeout(400);console.log('opened pin:',id,'| card:',(await p.textContent('#bbCard')).slice(0,110))
await p.screenshot({path:S+'/shots/g2.png'});
await p.click('#bbSeg [data-lay="reception"]');await p.waitForTimeout(3000);await p.screenshot({path:S+'/shots/g3.png'});console.log('count:',await p.textContent('#bbCount'));
await p.click('#bbVps [data-vp="stage"]');await p.waitForTimeout(3000);await p.screenshot({path:S+'/shots/g4.png'});
await p.click('#bbImmClose');await p.waitForTimeout(300);
await p.click('#matchBtn');await p.waitForTimeout(2500);await p.evaluate(()=>document.querySelector('.bb-row').scrollIntoView());await p.waitForTimeout(300);await p.screenshot({path:S+'/shots/g5.png'});
await p.click('#venueCards .bb-3d');await p.waitForTimeout(2500);await p.screenshot({path:S+'/shots/g6.png'});
console.log('scale layouts:',await p.$$eval('#bbSeg button',e=>e.map(x=>x.textContent)),'| plan hidden:',await p.evaluate(()=>document.getElementById('bbPlan').hidden));
await p.click('#bbImmClose');console.log('bot home:',await p.evaluate(()=>document.getElementById('botBtn').parentElement===document.body));
c=await ctx(b,{width:390,height:844});p=await c.newPage();p.on('pageerror',e=>errs.push('m:'+e.message));
await p.goto('file://'+require('path').resolve(__dirname,'../BreezeBook.html'),{waitUntil:'domcontentloaded',timeout:120000});await p.waitForTimeout(4000);
await p.evaluate(()=>BBView.openGrand());await p.waitForTimeout(4000);await p.screenshot({path:S+'/shots/gm.png'});
console.log('mobile h-scroll:',await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth));console.log('errors',errs);await b.close()})();
