const {chromium}=require('playwright');const fs=require('fs');const S=process.argv[2]||require('path').join(__dirname,'test-output');require('fs').mkdirSync(S+'/shots',{recursive:true}),F=S+'/fontsrc/node_modules/@fontsource/';
const css=`@font-face{font-family:'Bellefair';font-weight:400;src:url(http://fonts.local/bf.woff2) format('woff2')}`+[400,500,600,700].map(w=>`@font-face{font-family:'Montserrat';font-weight:${w};src:url(http://fonts.local/m${w}.woff2) format('woff2')}`).join('');
const files={'/bf.woff2':F+'bellefair/files/bellefair-latin-400-normal.woff2'};[400,500,600,700].forEach(w=>files['/m'+w+'.woff2']=F+`montserrat/files/montserrat-latin-${w}-normal.woff2`);
async function ctx(b,vp){const c=await b.newContext({viewport:vp,deviceScaleFactor:1});await c.route(/^https?:/,r=>{const u=new URL(r.request().url());if(u.host==='fonts.googleapis.com')return r.fulfill({contentType:'text/css',body:css});if(u.host==='fonts.local')return fs.existsSync(files[u.pathname]||'')?r.fulfill({contentType:'font/woff2',body:fs.readFileSync(files[u.pathname])}):r.abort();return r.abort()});return c}
(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader','--allow-file-access-from-files']});const errs=[],out={};
const c=await ctx(b,{width:1440,height:900});const p=await c.newPage();p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+require('path').resolve(__dirname,'../BreezeBook.html'),{waitUntil:'domcontentloaded',timeout:120000});await p.waitForTimeout(3000);
await p.evaluate(()=>BBView.open('V01','banquet'));await p.waitForTimeout(2500);
out.panel=await p.isVisible('#bbPanel');out.specs=await p.$eval('.bb-specs',e=>e.innerText.replace(/\n/g,' | '));out.price=await p.$eval('.bb-price',e=>e.innerText.replace(/\n/g,' | '));out.equip=await p.$$eval('.bb-tbl',t=>t[1].innerText.replace(/\n/g,' | '));
await p.screenshot({path:S+'/shots/r_scale.png'});
// layout switch keeps panel in step
const lay=await p.$('[data-lay="theater"]');if(lay){await lay.click();await p.waitForTimeout(800);out.on=await p.$eval('.bb-tbl tr.on',e=>e.innerText)}
await p.evaluate(()=>{window.BBNotify=async x=>{window.__sent=x;return {ok:true}}});
await p.click('#bbReqBtn');await p.fill('#rqName','Ana Test');await p.fill('#rqEmail','ana@example.com');await p.fill('#rqGuests','5000');await p.fill('#rqDate','2027-04-17');
await p.click('#bbReqForm button[type=submit]');out.capErr=await p.textContent('#rqErr');
await p.fill('#rqGuests','120');await p.fill('#rqPhone','305-555-0100');await p.click('#bbReqForm button[type=submit]');await p.waitForTimeout(500);
out.head=await p.textContent('#bbPanelBody h2');out.lead=await p.textContent('#bbPanelBody .bb-lead');out.sent=await p.evaluate(()=>window.__sent);
await p.screenshot({path:S+'/shots/r_sent.png'});
console.log(JSON.stringify(out,null,1));console.log('ERRS',errs);await b.close()})();
