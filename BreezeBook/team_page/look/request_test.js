const {chromium}=require('playwright');const fs=require('fs');const S=process.argv[2]||require('path').join(__dirname,'test-output');require('fs').mkdirSync(S+'/shots',{recursive:true}),F=S+'/fontsrc/node_modules/@fontsource/';
const css=`@font-face{font-family:'Bellefair';font-weight:400;src:url(http://fonts.local/bf.woff2) format('woff2')}`+[400,500,600,700].map(w=>`@font-face{font-family:'Montserrat';font-weight:${w};src:url(http://fonts.local/m${w}.woff2) format('woff2')}`).join('');
const files={'/bf.woff2':F+'bellefair/files/bellefair-latin-400-normal.woff2'};[400,500,600,700].forEach(w=>files['/m'+w+'.woff2']=F+`montserrat/files/montserrat-latin-${w}-normal.woff2`);
async function ctx(b,vp){const c=await b.newContext({viewport:vp,deviceScaleFactor:1});await c.route(/^https?:/,r=>{const u=new URL(r.request().url());if(u.host==='fonts.googleapis.com')return r.fulfill({contentType:'text/css',body:css});if(u.host==='fonts.local')return fs.existsSync(files[u.pathname]||'')?r.fulfill({contentType:'font/woff2',body:fs.readFileSync(files[u.pathname])}):r.abort();return r.abort()});return c}
(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader','--allow-file-access-from-files']});const errs=[],out={};
const run=async(vp,tag)=>{const c=await ctx(b,vp);const p=await c.newPage();p.on('pageerror',e=>errs.push(tag+': '+e.message));
await p.goto('file://'+require('path').resolve(__dirname,'../BreezeBook.html'),{waitUntil:'domcontentloaded',timeout:120000});await p.waitForTimeout(3000);
// chat
await p.click('#botBtn');await p.waitForTimeout(400);out[tag+'_chat_open']=await p.isVisible('#botPanel');out[tag+'_name']=await p.$eval('#botPanel header',e=>e.textContent.slice(0,60));
await p.screenshot({path:S+'/shots/r_'+tag+'_chat.png'});await p.click('.bb-chat-x');out[tag+'_chat_closed']=!(await p.isVisible('#botPanel'));
// grand tour + details
await p.click('.bb-hero-tour [data-grand]');await p.waitForTimeout(3500);
if(!(await p.isVisible('#bbPanel')))await p.click('#bbDetBtn');await p.waitForTimeout(300);
out[tag+'_specs']=await p.$eval('.bb-specs',e=>e.innerText.replace(/\n/g,' | '));await p.screenshot({path:S+'/shots/r_'+tag+'_det.png'});
await p.click('#bbReqBtn');await p.click('#bbReqForm button[type=submit]');out[tag+'_err']=await p.textContent('#rqErr');
await p.fill('#rqName','Ana Test');await p.fill('#rqEmail','ana@example.com');await p.fill('#rqEvent','Wedding reception');await p.fill('#rqGuests','300');await p.fill('#rqDate','2027-04-17');
await p.screenshot({path:S+'/shots/r_'+tag+'_form.png'});await p.click('#bbReqForm button[type=submit]');await p.waitForTimeout(800);
out[tag+'_receipt']=await p.$eval('#bbPanelBody',e=>e.innerText.slice(0,500));await p.screenshot({path:S+'/shots/r_'+tag+'_rcpt.png'});
out[tag+'_hscroll']=await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
await p.click('#bbImmClose');await p.waitForTimeout(500);
// scale venue
await p.evaluate(()=>BBView.open(BB_VENUES2?BB_VENUES2[0].id:document.querySelector('[data-open]')?.dataset.open)).catch(()=>{});
const id=await p.evaluate(()=>{const b=document.querySelector('button.bb-3d[data-open]');return b&&b.dataset.open});out[tag+'_firstcard']=id;
if(!id){await p.fill('#q, textarea',"Wedding for 150 guests in April").catch(()=>{});}
return [c,p]};
const [c1,p1]=await run({width:1440,height:900},'desk');
// scale venue via search on desktop
await p1.evaluate(()=>{const ids=["v01","v02"];});
const vid=await p1.evaluate(()=>{try{return (window.BV&&BV.VENUES||[])[0]?.id}catch(e){return null}});
out.vid=vid;if(vid){await p1.evaluate(id=>BBView.open(id),vid);await p1.waitForTimeout(2500);if(!(await p1.isVisible('#bbPanel')))await p1.click('#bbDetBtn');out.scale_specs=await p1.$eval('.bb-specs',e=>e.innerText.replace(/\n/g,' | '));out.scale_price=await p1.$eval('.bb-price',e=>e.innerText.replace(/\n/g,' | '));await p1.screenshot({path:S+'/shots/r_scale.png'})}
// photo matching of judge photos
const jp=fs.readdirSync(S+'/judge_photos');for(const f of jp){const d='data:image/jpeg;base64,'+fs.readFileSync(S+'/judge_photos/'+f).toString('base64');out['match_'+f]=await p1.evaluate(async d=>{const r=await BBPhotoMatch(d);return JSON.stringify(r).slice(0,160)},d).catch(e=>'ERR '+e.message)}
await run({width:390,height:844},'mob');
console.log(JSON.stringify(out,null,1));console.log('ERRS',errs);await b.close()})();
