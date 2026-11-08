const {chromium}=require('playwright');const fs=require('fs');const S=process.argv[2]||require('path').join(__dirname,'test-output');require('fs').mkdirSync(S+'/shots',{recursive:true}),F=S+'/fontsrc/node_modules/@fontsource/';
const css=`@font-face{font-family:'Bellefair';font-weight:400;src:url(http://fonts.local/bf.woff2) format('woff2')}`+[400,500,600,700].map(w=>`@font-face{font-family:'Montserrat';font-weight:${w};src:url(http://fonts.local/m${w}.woff2) format('woff2')}`).join('');
const files={'/bf.woff2':F+'bellefair/files/bellefair-latin-400-normal.woff2'};[400,500,600,700].forEach(w=>files['/m'+w+'.woff2']=F+`montserrat/files/montserrat-latin-${w}-normal.woff2`);
async function ctx(b,vp){const c=await b.newContext({viewport:vp,deviceScaleFactor:1});await c.route(/^https?:/,r=>{const u=new URL(r.request().url());if(u.host==='fonts.googleapis.com')return r.fulfill({contentType:'text/css',body:css});if(u.host==='fonts.local')return fs.existsSync(files[u.pathname]||'')?r.fulfill({contentType:'font/woff2',body:fs.readFileSync(files[u.pathname])}):r.abort();return r.abort()});return c}
(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader','--allow-file-access-from-files']});const errs=[];
let c=await ctx(b,{width:1440,height:1000});let p=await c.newPage();p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+require('path').resolve(__dirname,'../BreezeBook.html'),{waitUntil:'domcontentloaded',timeout:120000});await p.waitForTimeout(3000);
await p.evaluate(()=>document.getElementById('visualize').scrollIntoView());await p.waitForTimeout(4500);await p.screenshot({path:S+'/shots/p1.png'});
console.log('inline started:',await p.evaluate(()=>!!document.querySelector('#bbGlBox canvas')),'| old plan hidden:',await p.evaluate(()=>document.getElementById('floorplan').closest('[hidden]')!==null),'| count:',await p.textContent('#bbGlCount'));
await p.click('[data-gl="reception"]');await p.waitForTimeout(3000);
const box=await (await p.$('#bbGlBox')).boundingBox();await p.mouse.move(box.x+box.width/2,box.y+box.height/2);await p.mouse.down();await p.mouse.move(box.x+box.width/2-40,box.y+box.height/2,{steps:3});await p.mouse.up();await p.waitForTimeout(400);
const pin=await p.$$eval('#bbGlSpots .bb-hs:not(.nav)',e=>{const x=e.find(b=>!b.hidden);return x&&x.getAttribute('data-ghs')});if(pin){const r=await (await p.$(`[data-ghs="${pin}"]`)).boundingBox();await p.mouse.click(r.x+r.width/2,r.y+r.height/2)}await p.waitForTimeout(400);
console.log('pin:',pin,'| card:',(await p.textContent('#bbGlCard')).slice(0,80),'| count:',await p.textContent('#bbGlCount'));await p.screenshot({path:S+'/shots/p2.png'});
await p.click('#bbGlFs');await p.waitForTimeout(3000);console.log('fullscreen open:',await p.evaluate(()=>!document.getElementById('bbImm').hidden),'| layout:',await p.$eval('#bbSeg [aria-pressed="true"]',e=>e.textContent));
await p.click('#bbImmClose');await p.waitForTimeout(500);console.log('inline resumed:',await p.evaluate(()=>true));
await p.click('#matchBtn');await p.waitForTimeout(2500);await p.click('#venueCards .venuefoot .btn');await p.waitForTimeout(1500);
console.log('details dialog open:',await p.evaluate(()=>document.getElementById('modal').classList.contains('show')),'| has 3D button:',!!await p.$('#dialogContent [data-open]'));
console.log('errors',errs);await b.close()})();
