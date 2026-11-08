// node model/evaluate.js  -> model/eval_report.json   (uses the exact engine the website runs)
const fs=require("fs"),path=require("path");
require(path.join(__dirname,"../web/engine.js"));const BV=globalThis.BV;
const ROOT=path.join(__dirname,"..");
const venues=JSON.parse(fs.readFileSync(ROOT+"/data/venues.json"));
const rows=fs.readFileSync(ROOT+"/data/requests.jsonl","utf8").trim().split("\n").map(JSON.parse);
const FIELDS=["event_type","guests","budget","date","setting","layout","styles","must_have"];
function ok(f,p,g){if(f==="styles")return g.length?p.some(x=>g.includes(x)):!p.length;if(f==="must_have")return p.length===g.length&&p.every(x=>g.includes(x));return (p??null)===(g??null)}
function evalSet(name,extract,split){
  const rs=rows.filter(r=>r.split===split);let succ=0,hit=0,viol=0,exact=0;const acc=Object.fromEntries(FIELDS.map(f=>[f,0]));const fails=[];
  for(const r of rs){const {fields}=extract(r.text),g=r.gold;
    const fok=Object.fromEntries(FIELDS.map(f=>[f,ok(f,fields[f],g[f])]));FIELDS.forEach(f=>acc[f]+=fok[f]);
    const recs=BV.missing(fields).length?[]:BV.match(venues,fields).map(v=>v.id);const h=recs.some(id=>r.gold_venues.includes(id));
    const vv=recs.filter(id=>BV.check(venues.find(v=>v.id===id),g).length);
    const s=BV.REQUIRED.every(f=>fok[f])&&h&&!vv.length;succ+=s;hit+=h;viol+=vv.length>0;exact+=FIELDS.every(f=>fok[f]);
    if(!s&&fails.length<12)fails.push({id:r.id,text:r.text,wrong:FIELDS.filter(f=>!fok[f]).map(f=>({field:f,pred:fields[f],gold:g[f]})),top3_hit:h,violations:vv})}
  const n=rs.length,pc=x=>Math.round(1000*x/n)/10;
  return {model:name,split,n,success_pct:pc(succ),top3_hit_pct:pc(hit),violation_cases:viol,all_fields_exact_pct:pc(exact),field_acc_pct:Object.fromEntries(FIELDS.map(f=>[f,pc(acc[f])])),fails}}
const models={rules:t=>BV.extractRules(t)};
for(const k of ["A","B","C","web","D"])if(fs.existsSync(ROOT+`/model/model_${k}.json`)){const M=BV.prepModel(JSON.parse(fs.readFileSync(ROOT+`/model/model_${k}.json`)));models["model_"+k]=t=>BV.extractModel(M,t)}
const report=[];
for(const split of ["test_in","test_out","test_fresh","test_blind"])for(const [name,fn] of Object.entries(models))report.push(evalSet(name,fn,split));
fs.writeFileSync(ROOT+"/model/eval_report.json",JSON.stringify(report,null,1));
console.log("model      split     n   success top3  viol  exact | event guests budget date setting layout styles must");
for(const r of report)console.log(r.model.padEnd(10),r.split.padEnd(8),String(r.n).padEnd(4),String(r.success_pct).padStart(6),String(r.top3_hit_pct).padStart(5),String(r.violation_cases).padStart(5),String(r.all_fields_exact_pct).padStart(6),"|",FIELDS.map(f=>String(r.field_acc_pct[f]).padStart(5)).join(" "));
