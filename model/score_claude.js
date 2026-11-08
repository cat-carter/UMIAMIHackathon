// node model/score_claude.js -> rescore Claude's saved blind-test answers with the repo engine; writes model/claude_eval.json
const fs=require("fs");require("../web/engine.js");const BV=globalThis.BV;
const raw=JSON.parse(fs.readFileSync("model/claude_blind_raw.json"));const res=(raw.data||raw).results;
const venues=JSON.parse(fs.readFileSync("data/venues.json"));const M=BV.prepModel(JSON.parse(fs.readFileSync("model/model_web.json")));
const rows=fs.readFileSync("data/requests.jsonl","utf8").trim().split("\n").map(JSON.parse).filter(r=>r.split==="test_blind");
const F=["event_type","guests","budget","date","setting","layout","styles","must_have"];
const ok=(f,p,g)=>f==="styles"?(g.length?p.some(x=>g.includes(x)):!p.length):f==="must_have"?(p.length===g.length&&p.every(x=>g.includes(x))):(p??null)===(g??null);
function sc(fields,r){const fok=Object.fromEntries(F.map(f=>[f,ok(f,fields[f],r.gold[f])]));const recs=BV.missing(fields).length?[]:BV.match(venues,fields).map(v=>v.id);const hit=recs.some(id=>r.gold_venues.includes(id));const viol=recs.some(id=>BV.check(venues.find(v=>v.id===id),r.gold).length);return {fok,s:BV.REQUIRED.every(f=>fok[f])&&hit&&!viol,hit,viol}}
const out={n:rows.length,thresholds:{}};let cS=0,cH=0,cV=0;const fa=Object.fromEntries(F.map(f=>[f,0]));const per=[];const ms=[];
for(const r of rows){const m=BV.extractModel(M,r.text),x=res[r.id];ms.push(x.ms);const cl={...m.fields,...Object.fromEntries(Object.entries(x.c||{}).filter(([k,v])=>v!=null&&!(k==="setting"&&v==="any"&&m.fields.setting!=="any")))};
  const a=sc(cl,r),b=sc(m.fields,r);cS+=a.s;cH+=a.hit;cV+=a.viol;F.forEach(f=>fa[f]+=a.fok[f]);per.push({id:r.id,conf:m.confidence,claude:a,model:b,text:r.text.split(" Thanks,")[0],cl,gold:r.gold})}
const pc=v=>Math.round(1000*v/rows.length)/10;
for(const t of [0.7,0.8,0.9,0.95,1.01]){let s=0,h=0,loc=0;for(const p of per){const use=p.conf>=t?p.model:p.claude;s+=use.s;h+=use.hit;loc+=p.conf>=t}out.thresholds[t>1?"always Claude":String(t)]={system_success:pc(s),system_top3:pc(h),handled_by_model:pc(loc)}}
ms.sort((a,b)=>a-b);
Object.assign(out,{claude_success:pc(cS)+"%",claude_top3:pc(cH)+"%",claude_violation_cases:cV,claude_field_acc:Object.fromEntries(F.map(f=>[f,pc(fa[f])+"%"])),
  system_success:out.thresholds["0.8"].system_success+"%",system_top3:out.thresholds["0.8"].system_top3+"%",model_success:pc(per.filter(p=>p.model.s).length)+"%",
  claude_calls:rows.length,failed_calls:Object.values(res).filter(x=>x.err).length,median_ms:ms[ms.length>>1],p95_ms:ms[Math.floor(ms.length*.95)],run_at:(raw.data||raw).summary?.run_at,
  claude_misses:per.filter(p=>!p.claude.s).map(p=>({id:p.id,text:p.text,wrong:F.filter(f=>!p.claude.fok[f]).map(f=>`${f}: got ${JSON.stringify(p.cl[f])}, truth ${JSON.stringify(p.gold[f])}`),top3_hit:p.claude.hit}))});
fs.writeFileSync("model/claude_eval.json",JSON.stringify(out,null,1));console.log(JSON.stringify({...out,claude_misses:undefined},null,1));out.claude_misses.forEach(m=>console.log(m.id,m.wrong.join("; "),"| top3",m.top3_hit,"|",m.text.slice(0,90)));
