// BreezeBook engine: shared by the website and the Node evaluation (one source of truth).
(function (root) {
const STYLES = ["modern","elegant","rustic","tropical","industrial","romantic","corporate","artsy","beach","classic"];
const AMEN = ["projector","screens","stage","dance_floor","microphone","buffet","parking","accessible","natural_light","ocean_view"];
const EVENT_TYPES = ["wedding","birthday","conference","meeting","gala","networking","workshop","party"];
const LAYOUTS = ["theater","classroom","banquet","buffet","reception","ushape","boardroom"];
const DEFAULT_LAYOUT = {wedding:"banquet",gala:"banquet",birthday:"reception",party:"reception",networking:"reception",conference:"theater",workshop:"classroom",meeting:"boardroom"};
const REQUIRED = ["event_type","guests","budget"];

// ---------- privacy + safety
const EMAIL=/[\w.+-]+@[\w-]+\.[\w.-]+/g, PHONE=/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g, CARD=/\b\d(?:[ -]?\d){12,15}\b/g;
const NAME=/((?:[Tt]hanks|[Rr]egards|[Cc]heers|[Gg]racias|[Ss]aludos),?|[Mm]y name is|I am|I'm)(\s+)([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/g;
function maskPII(t){const c={emails:t.match(EMAIL)||[],phones:[],names:[]};let m=t.replace(EMAIL,"[EMAIL]").replace(CARD,"[CARD]");c.phones=m.match(PHONE)||[];m=m.replace(PHONE,"[PHONE]");m=m.replace(NAME,(a,tr,sp,n)=>{c.names.push(n);return tr+sp+"[NAME]"});return {masked:m,contact:c}}
const INJ=[/(ignore|disregard|forget|override) (all |any |the |your )?(previous |prior |above |earlier |system )?(instructions|rules|prompt)/i,/new instructions/i,/developer mode|jailbreak/i,/(reveal|show|print|repeat) (me )?(your|the) (system )?(prompt|instructions|rules)/i,/(100 ?%|full) (discount|off)/i,/pretend (to be|you are)/i,/you are now/i,/system prompt/i,/(set|make|quote) (the )?(price|cost) (to|at)? ?\$?0\b/i,/\$0\b/,/confirm (the |my )?booking/i,/act as (the )?(admin|hotel)/i,/ignora (las )?instrucciones/i];
const screen=t=>INJ.filter(r=>r.test(t)).map(r=>r.source);
// drop sentences that look like instructions to the system before any text is sent to Claude
const stripInjection=t=>String(t).split(/(?<=[.!?\n])\s+/).filter(x=>!INJ.some(r=>r.test(x))).join(" ");

// ---------- deterministic number / date parser
const UNITS={zero:0,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,eighteen:18,nineteen:19};
const TENS={twenty:20,thirty:30,forty:40,fifty:50,sixty:60,seventy:70,eighty:80,ninety:90};
function wordsToNum(s){ // "a hundred and twenty", "twenty-five", "two hundred fifty"
  const w=s.toLowerCase().replace(/-/g," ").replace(/\band\b/g," ").split(/\s+/).filter(Boolean);let total=0,cur=0,seen=false;
  for(const x of w){ if(x==="a"&&!seen){cur=1;continue} if(x in UNITS){cur+=UNITS[x];seen=true} else if(x in TENS){cur+=TENS[x];seen=true} else if(x==="hundred"){cur=(cur||1)*100;seen=true} else if(x==="thousand"){total+=(cur||1)*1000;cur=0;seen=true} else return null }
  return seen?total+cur:null;
}
const NUMWORD="(?:a |one |two |three )?(?:hundred(?: and)?(?: )?)?(?:(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:[- ](?:one|two|three|four|five|six|seven|eight|nine))?|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|one|two|three|four|five|six|seven|eight|nine)?";
const PEOPLE="(?:people|peple|guests|attendees|pax|personas|folks|of us|invitados|ppl)";
function parseGuests(t){
  const s=t.toLowerCase();let m;
  if((m=s.match(new RegExp("(?:headcount of|party of|group of|para)\\s+(\\d{1,4})"))))return +m[1];
  if((m=s.match(new RegExp("(\\d{1,4})(?:-ish)?\\s*"+PEOPLE))))return +m[1];
  if((m=s.match(new RegExp("\\b((?:a |one |two |three )?hundred(?: and)?(?: (?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:[- ](?:one|two|three|four|five|six|seven|eight|nine))?| (?:ten|eleven|twelve|fifteen))?|(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:[- ](?:one|two|three|four|five|six|seven|eight|nine))?|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen)\\s+"+PEOPLE)))){const n=wordsToNum(m[1]);if(n)return n}
  if((m=s.match(/\bfor\s+(?:about\s+|around\s+|roughly\s+)?(\d{2,4})\b(?![\d,.]*\s*(?:k\b|dollars|usd|grand|sq|ft|hours?))/)))return +m[1];
  return null;
}
function parseBudget(t){
  const s=t.toLowerCase().replace(/\[phone\]/g,"");let m;
  const num=(x,k)=>{const v=parseFloat(x.replace(/,/g,""));return Math.round(k?v*1000:v)};
  if((m=s.match(/\$\s?([\d,]+(?:\.\d+)?)\s*(k)\b/)))return num(m[1],1);
  if((m=s.match(/\$\s?([\d,]{3,})(?!\d)/)))return num(m[1],0);
  if((m=s.match(/(?:budget|budgt|presupuesto)[^\d$]{0,20}\$?([\d,]+(?:\.\d+)?)\s*(k|grand)?\b/)))return num(m[1],!!m[2]);
  if((m=s.match(/([\d,]+(?:\.\d+)?)\s*(k|grand)\b/)))return num(m[1],1);
  if((m=s.match(/(?:up to|spend|cap of|max|under|around)\s+\$?([\d,]{3,})/)))return num(m[1],0);
  if((m=s.match(/([\d,]{3,})\s*(?:dollars|usd)/)))return num(m[1],0);
  return null;
}
const MON={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
function yearFor(m){return m>=11?2026:2027} // upcoming season: Nov-Dec 2026, Jan-Oct 2027
const iso=(y,m,d)=>`${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
function parseDate(t){
  const s=t.toLowerCase();let m;
  if((m=s.match(/\b(\d{1,2})\/(\d{1,2})\/(20\d\d)\b/)))return iso(+m[3],+m[1],+m[2]);
  if((m=s.match(/\b(20\d\d)-(\d\d)-(\d\d)\b/)))return m[0];
  const mon="(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?";
  if((m=s.match(new RegExp("\\b"+mon+"\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b"))))return iso(yearFor(MON[m[1]]),MON[m[1]],+m[2]);
  if((m=s.match(new RegExp("\\b(?:the\\s+)?(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?"+mon))))return iso(yearFor(MON[m[2]]),MON[m[2]],+m[1]);
  return null;
}

// ---------- trained model inference (TF-IDF + logistic regression, mirrors scikit-learn)
function wordTokens(s,ng){const t=s.match(/[a-z0-9_ñáéíóú]{2,}/g)||[];const out=[...t];if(ng[1]>=2)for(let i=0;i+1<t.length;i++)out.push(t[i]+" "+t[i+1]);return out}
function charWb(s,ng){const out=[];for(const w0 of s.replace(/\s+/g," ").split(" ").filter(Boolean)){const w=" "+w0+" ",L=w.length;for(let n=ng[0];n<=ng[1];n++){let o=0;out.push(w.slice(o,o+n));while(o+n<L){o++;out.push(w.slice(o,o+n))}if(o===0)break}}return out}
function prepModel(M){for(const f of M.features){f.index=new Map(f.vocab.map((t,i)=>[t,i]))}let off=0;for(const f of M.features){f.offset=off;off+=f.vocab.length}
  for(const h of Object.values(M.heads)){h.w=h.coef.map(r=>Object.entries(r).map(([i,v])=>[+i,v]))}M.ready=true;return M}
const normText=t=>maskPII(t).masked.toLowerCase().replace(/\d/g,"0");
function vectorize(M,text){const s=normText(text),x=new Map();
  for(const f of M.features){const toks=f.analyzer==="word"?wordTokens(s,f.ngram):charWb(s,f.ngram);const tf=new Map();for(const tk of toks){const i=f.index.get(tk);if(i!==undefined)tf.set(i,(tf.get(i)||0)+1)}
    let norm=0;const part=[];for(const [i,c] of tf){const v=(1+Math.log(c))*f.idf[i];part.push([i,v]);norm+=v*v}norm=Math.sqrt(norm)||1;for(const [i,v] of part)x.set(f.offset+i,v/norm)}
  return x}
function predictHeads(M,text){if(!M.ready)prepModel(M);const x=vectorize(M,text),out={},conf={};
  for(const [name,h] of Object.entries(M.heads)){const scores=h.w.map((r,k)=>r.reduce((a,[i,v])=>a+(x.get(i)||0)*v,h.intercept[k]));
    if(h.binary){const p=1/(1+Math.exp(-scores[0]));out[name]=p>=0.5?h.classes[1]:h.classes[0];conf[name]=Math.max(p,1-p)}
    else{const mx=Math.max(...scores),ex=scores.map(s=>Math.exp(s-mx)),Z=ex.reduce((a,b)=>a+b,0);let bi=0;scores.forEach((s,i)=>{if(s>scores[bi])bi=i});out[name]=h.classes[bi];conf[name]=ex[bi]/Z}}
  return {out,conf}}

const empty=()=>({event_type:null,guests:null,budget:null,date:null,setting:"any",styles:[],must_have:[],layout:null});
function extractModel(M,text){const masked=maskPII(text).masked,{out,conf}=predictHeads(M,text),f=empty();
  f.event_type=out.event_type||null;f.layout=out.layout&&out.layout!=="none"?out.layout:null;f.setting=out.setting||"any";
  f.styles=STYLES.filter(s=>String(out["style:"+s])==="1");f.must_have=AMEN.filter(a=>String(out["amen:"+a])==="1");
  f.guests=parseGuests(masked);f.budget=parseBudget(masked);f.date=parseDate(masked);
  const c=[conf.event_type,conf.layout,conf.setting].filter(Boolean);return {fields:f,confidence:Math.min(...c)}}

// keyword baseline: what a traditional search form understands
const RULE_EVENT=[["wedding","wedding"],["birthday","birthday"],["conference","conference"],["summit","conference"],["meeting","meeting"],["gala","gala"],["networking","networking"],["mixer","networking"],["workshop","workshop"],["training","workshop"],["party","party"]];
const RULE_AMEN=[["projector","projector"],["screen","screens"],["stage","stage"],["dance floor","dance_floor"],["microphone","microphone"],["buffet","buffet"],["parking","parking"],["wheelchair","accessible"],["natural light","natural_light"],["ocean view","ocean_view"]];
const RULE_LAY=[["theater","theater"],["classroom","classroom"],["round tables","banquet"],["banquet","banquet"],["buffet","buffet"],["cocktail","reception"],["reception","reception"],["u-shape","ushape"],["boardroom","boardroom"]];
function extractRules(text){const masked=maskPII(text).masked,t=masked.toLowerCase(),f=empty();
  for(const [k,v] of RULE_EVENT)if(t.includes(k)){f.event_type=v;break}
  let m=t.match(/(\d{1,4})\s*(?:people|guests|attendees)/);if(m)f.guests=+m[1];
  m=t.match(/\$\s?([\d,]+)\s*(k)?\b/);if(m){const v=+m[1].replace(/,/g,"");f.budget=m[2]?v*1000:v}
  m=t.match(/(\d{1,2})\/(\d{1,2})\/(20\d\d)/);if(m)f.date=iso(+m[3],+m[1],+m[2]);
  if(/outdoor/.test(t))f.setting="outdoor";else if(/indoor/.test(t))f.setting="indoor";
  f.styles=STYLES.filter(s=>new RegExp("\\b"+s+"\\b").test(t));f.must_have=[...new Set(RULE_AMEN.filter(([k])=>t.includes(k)).map(x=>x[1]))];
  for(const [k,v] of RULE_LAY)if(t.includes(k)){f.layout=v;break}
  return {fields:f,confidence:1}}

// ---------- pricing, fit, matching
function priceFor(v,guests,date){const p=v.pricing;let mult=1,season=1,day=1;
  if(date){const d=new Date(date+"T12:00:00");season=p.season_mult[d.getMonth()+1];day=(d.getDay()===5||d.getDay()===6||d.getDay()===0)?p.weekend_mult:p.weekday_mult;mult=season*day}
  const rental=Math.round(p.rental_usd*mult),fnb=p.fnb_per_guest_usd*(guests||0);return {rental,fnb,total:rental+fnb,season,day}}
const layoutOf=n=>n.layout||DEFAULT_LAYOUT[n.event_type||"party"]||"reception";
function addonsNeeded(v,n){return (n.must_have||[]).filter(a=>!v.amenities.includes(a)&&v.addons&&a in v.addons)}
function addonCost(v,n){return addonsNeeded(v,n).reduce((s,a)=>s+v.addons[a],0)}
function totalFor(v,n){return priceFor(v,n.guests,n.date).total+addonCost(v,n)}
function check(v,n){const P=[],L=layoutOf(n),g=n.guests;
  if(g&&v.capacity[L]<g)P.push(`seats ${v.capacity[L]} ${L}-style`);
  if(g&&n.budget&&totalFor(v,n)>n.budget)P.push("over budget");
  if(n.date&&(v.calendar[n.date]||0)>=2)P.push("booked that date");
  if(n.setting&&n.setting!=="any"&&v.setting!==n.setting)P.push(`${v.setting} only`);
  const hard=(n.must_have||[]).filter(a=>!v.amenities.includes(a)&&!(v.addons&&a in v.addons));if(hard.length)P.push("no "+hard.map(a=>a.replace(/_/g," ")).join(", "));return P}
function fitSignal(v,n){ // green / amber / red with reasons
  const P=check(v,n);if(!n.guests)return {level:"none",reasons:[]};const add=addonsNeeded(v,n);
  const addTxt=add.length?["hotel adds "+add.map(a=>a.replace(/_/g," ")).join(", ")+" (+"+money(addonCost(v,n))+")"]:[];
  if(!P.length){const tot=totalFor(v,n),close=n.budget&&tot>0.9*n.budget;return {level:close||add.length?"amber":"green",reasons:[...addTxt,...(close?["within 10% of budget"]:[])]}}
  const soft=P.length===1&&P[0]==="over budget"&&totalFor(v,n)<=1.15*n.budget;return {level:soft?"amber":"red",reasons:P}}
function score(v,n){let s=0;const st=new Set(n.styles||[]);if(st.size)s+=3*v.styles.filter(x=>st.has(x)).length/st.size;
  if(n.guests){const fill=n.guests/v.capacity[layoutOf(n)];s+=1.5*(1-Math.abs(.72-fill))}
  if(n.budget&&n.guests)s+=Math.min(1,(n.budget-totalFor(v,n))/n.budget*3);s-=0.3*addonsNeeded(v,n).length;
  if(n.date){const b=v.calendar[n.date]||0;s+=b===0?.4:0} // prefer idle dates: fills unused space
  return s}
function match(venues,n,k=3){return venues.filter(v=>!check(v,n).length).sort((a,b)=>score(b,n)-score(a,n)).slice(0,k)}
const missing=f=>REQUIRED.filter(k=>f[k]==null);

// ---------- look-alike search from inspiration tags
function similarity(v,tags){let s=0;if(tags.setting&&tags.setting===v.setting)s+=2;s+=2*(tags.styles||[]).filter(x=>v.styles.includes(x)).length;s+=(tags.amenities||[]).filter(x=>v.amenities.includes(x)).length;return s}

// ---------- negotiation agent (acts only inside hotel rules; every result needs hotel approval)
function negotiate(v,VALUE,ctx,offer){ // ctx {guests,date,round}
  const pr=priceFor(v,ctx.guests,ctx.date),list=pr.total,R=v.rules,month=ctx.date?+ctx.date.slice(5,7):null;
  const off=month&&v.pricing.season_mult[month]<0.9;const booked=ctx.date?(v.calendar[ctx.date]||0):0;
  const floorPct=R.floor_pct-(off?R.offseason_extra_pct:0)-(booked===0?0.02:0),floor=Math.round(list*floorPct);
  const adds=R.value_adds.map(k=>VALUE.find(x=>x.key===k)).filter(Boolean).sort((a,b)=>b.planner_value/b.hotel_cost-a.planner_value/a.hotel_cost);
  const perGuest=a=>/drink|valet/i.test(a.label);const val=a=>perGuest(a)?a.planner_value*ctx.guests:a.planner_value,cost=a=>perGuest(a)?a.hotel_cost*ctx.guests:a.hotel_cost;
  const why=[off?"off-season date":null,booked===0?"space is otherwise empty that day":null].filter(Boolean);
  if(offer>=list)return {action:"accept",price:offer,adds:[],list,floor,why,text:`Good news: ${money(offer)} works. I'll send it to the events team to confirm the date.`};
  if(offer>=floor){const gap=list-offer;const pick=[];let v2=0;for(const a of adds){if(v2>=gap*0.5)break;pick.push(a);v2+=val(a)}
    const price=Math.round((offer+list)/2/50)*50;
    if(ctx.round>=v.rules.max_rounds||list-offer<list*0.03)return {action:"accept",price:offer,adds:[],list,floor,why,text:`We can do ${money(offer)}. I'll pass it to the events team for approval.`};
    return {action:"counter",price,adds:pick.slice(0,2),list,floor,why,text:`I can't go to ${money(offer)} on this date, but I can do ${money(price)} and include ${pick.slice(0,2).map(a=>a.label.toLowerCase()).join(" and ")||"priority setup"}.`}}
  const pick=adds.slice(0,2);return {action:"counter",price:floor,adds:pick,list,floor,why,text:`${money(offer)} is below what the hotel can accept. The best I can offer is ${money(floor)}${pick.length?`, and I'll add ${pick.map(a=>a.label.toLowerCase()).join(" and ")}`:""}${why.length?` (${why.join(", ")})`:""}.`}}
const money=n=>"$"+Math.round(n).toLocaleString("en-US");

root.BV={stripInjection,addonsNeeded,addonCost,totalFor,STYLES,AMEN,EVENT_TYPES,LAYOUTS,DEFAULT_LAYOUT,REQUIRED,maskPII,screen,parseGuests,parseBudget,parseDate,wordsToNum,prepModel,predictHeads,extractModel,extractRules,priceFor,check,fitSignal,score,match,missing,similarity,negotiate,layoutOf,money,empty};
})(typeof window!=="undefined"?window:globalThis);
