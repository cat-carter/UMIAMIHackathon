const {chromium}=require('playwright');const S=process.argv[2]||require('path').join(__dirname,'test-output');require('fs').mkdirSync(S+'/shots',{recursive:true});(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader','--allow-file-access-from-files']});
const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.addInitScript(()=>{const store={};const doc=path=>({get:async()=>({exists:!!store[path],data:()=>store[path]}),set:async d=>{store[path]=JSON.parse(JSON.stringify(d))}});
  window.__store=store;const sample=async()=>({text:"x"});sample.json=async prompt=>{const t=prompt.split("<message>\n")[1].split("\n</message>")[0];const r=BLIND.find(x=>BV.maskPII(x.text).masked===t);await new Promise(z=>setTimeout(z,5));return r?r.gold:{}};
  window.claude={use:async n=>n==="sample"?sample:n==="db"?{doc:p=>doc(p),collection:c=>({doc:d=>doc(c+"/"+d),onSnapshot:()=>()=>{}})}:n==="user"?{id:async()=>"u_test",canEdit:async()=>false}:null}});
await p.goto('file://'+require('path').resolve(__dirname,'../breezebook-team.html'));await p.waitForTimeout(2500);
await p.click('#botBtn');await p.fill('#botIn','/eval');await p.click('#botForm button');
for(let i=0;i<60;i++){await p.waitForTimeout(1000);const t=await p.$$eval('#botLog .bmsg',e=>e.map(x=>x.textContent));if(t.some(x=>x.includes('Full system'))){console.log(t.slice(-1)[0]);break}}
console.log('saved summary:',JSON.stringify(await p.evaluate(()=>window.__store["data/users/u_test/eval_blind"]?.summary)));console.log('errors',errs);await b.close()})();
