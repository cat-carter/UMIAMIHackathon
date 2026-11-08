// node model/evaluate_full.js  -> calibration, routing, error types, speed for the live web model
const fs=require("fs");require("../web/engine.js");const BV=globalThis.BV;
const rows=fs.readFileSync("data/requests.jsonl","utf8").trim().split("\n").map(JSON.parse);
const M=BV.prepModel(JSON.parse(fs.readFileSync("model/model_web.json")));
const tests=["test_in","test_out","test_fresh","test_blind"];const all=[];
for(const sp of tests)for(const r of rows.filter(x=>x.split===sp)){const t0=process.hrtime.bigint();const {fields:f,confidence:c}=BV.extractModel(M,r.text);const ms=Number(process.hrtime.bigint()-t0)/1e6;const g=r.gold;
  const core=f.event_type===g.event_type&&(f.layout??null)===(g.layout??null)&&f.setting===g.setting;all.push({sp,c,core,ms,f,g})}
// calibration
console.log("CONFIDENCE vs ACTUAL (event+layout+setting all right)");
for(const [lo,hi] of [[0,.5],[.5,.7],[.7,.8],[.8,.9],[.9,1.01]]){const b=all.filter(x=>x.c>=lo&&x.c<hi);if(b.length)console.log(`  ${lo.toFixed(1)}-${Math.min(hi,1).toFixed(1)}: n=${String(b.length).padStart(3)}  right ${(100*b.filter(x=>x.core).length/b.length).toFixed(1)}%`)}
// routing per set
console.log("ROUTING at 0.8");for(const sp of tests){const s=all.filter(x=>x.sp===sp),loc=s.filter(x=>x.c>=.8);console.log(`  ${sp.padEnd(11)} local ${(100*loc.length/s.length).toFixed(1)}%  right-when-local ${loc.length?(100*loc.filter(x=>x.core).length/loc.length).toFixed(1):"-"}%  -> Claude ${(100-100*loc.length/s.length).toFixed(1)}%`)}
// error types on new wording
const nw=all.filter(x=>x.sp==="test_fresh"||x.sp==="test_blind");const conf={};
for(const x of nw){if(x.f.event_type!==x.g.event_type){const k=`event ${x.g.event_type}->${x.f.event_type}`;conf[k]=(conf[k]||0)+1}if(x.f.setting!==x.g.setting){const k=`setting ${x.g.setting}->${x.f.setting}`;conf[k]=(conf[k]||0)+1}}
console.log("TOP MISTAKES on new wording (300 requests)");Object.entries(conf).sort((a,b)=>b[1]-a[1]).slice(0,8).forEach(([k,v])=>console.log("  ",v,k));
let missA=0,extraA=0,missS=0,extraS=0;for(const x of nw){missA+=x.g.must_have.filter(a=>!x.f.must_have.includes(a)).length;extraA+=x.f.must_have.filter(a=>!x.g.must_have.includes(a)).length;missS+=x.g.styles.filter(a=>!x.f.styles.includes(a)).length;extraS+=x.f.styles.filter(a=>!x.g.styles.includes(a)).length}
const totA=nw.reduce((s,x)=>s+x.g.must_have.length,0),totS=nw.reduce((s,x)=>s+x.g.styles.length,0);
console.log(`  must-haves missed ${missA}/${totA} (${(100*missA/totA).toFixed(0)}%), invented ${extraA}; styles missed ${missS}/${totS} (${(100*missS/totS).toFixed(0)}%), invented ${extraS}`);
const ms=all.map(x=>x.ms).sort((a,b)=>a-b);console.log(`SPEED median ${ms[ms.length>>1].toFixed(2)} ms, p95 ${ms[Math.floor(ms.length*.95)].toFixed(2)} ms per request; model file ${(fs.statSync("model/model_web.json").size/1024).toFixed(0)} KB`);
// save for the spreadsheet and gate documents
const cal=[[0,.5],[.5,.7],[.7,.8],[.8,.9],[.9,1.01]].map(([lo,hi])=>{const b=all.filter(x=>x.c>=lo&&x.c<hi);return {band:`${Math.round(lo*100)}-${Math.min(100,Math.round(hi*100))}%`,n:b.length,right_pct:b.length?Math.round(1000*b.filter(x=>x.core).length/b.length)/10:null}});
const routing=tests.map(sp=>{const s=all.filter(x=>x.sp===sp),loc=s.filter(x=>x.c>=.8);return {split:sp,local_pct:Math.round(1000*loc.length/s.length)/10,right_when_local_pct:loc.length?Math.round(1000*loc.filter(x=>x.core).length/loc.length)/10:null,to_claude_pct:Math.round(1000*(1-loc.length/s.length))/10}});
const short=t=>t.split(" Thanks,")[0];const bl=all.filter(x=>x.sp==="test_blind");const rowsB=rows.filter(r=>r.split==="test_blind");
const ex=bl.map((x,i)=>({text:short(rowsB[i].text),conf:Math.round(x.c*100),got:`${x.f.event_type} / ${x.f.layout||"no layout"} / ${x.f.setting}`,truth:`${x.g.event_type} / ${x.g.layout||"no layout"} / ${x.g.setting}`,right:x.core}));
const examples=[...ex.filter(e=>e.right&&e.conf>=80).slice(0,4),...ex.filter(e=>!e.right).slice(0,6)];
fs.writeFileSync("model/eval_full.json",JSON.stringify({calibration:cal,routing,mistakes:Object.entries(conf).sort((a,b)=>b[1]-a[1]).slice(0,8),must_have:{missed:missA,total:totA,invented:extraA},styles:{missed:missS,total:totS,invented:extraS},speed_ms:{median:+ms[ms.length>>1].toFixed(2),p95:+ms[Math.floor(ms.length*.95)].toFixed(2)},examples},null,1));
