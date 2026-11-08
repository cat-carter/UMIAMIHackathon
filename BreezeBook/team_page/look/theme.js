// ===== Breeze Book look layer =====
// Adds brand artwork, illustrative photos and a full-screen venue view (3D to scale + photo tour).
// It calls the page's existing public functions (renderCards, viewVenue, changeLayout, BVScene) and does not change
// matching, the model, Claude, the team inbox or any safety checks.
(function(){
const I=BB_IMG,$=id=>document.getElementById(id),E=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

// brand artwork
document.querySelectorAll('img[data-bb="mark"]').forEach(i=>{i.src=I.mark});
try{const l=document.createElement("link");l.rel="icon";l.href=I.icon;document.head.appendChild(l)}catch(e){}
const bot=$("botBtn");if(bot){bot.innerHTML=`<img src="${I.mascot}" alt=""><span>Ask Breeza</span>`}
const bh=document.querySelector("#botPanel header");if(bh){const t=document.createElement("div");while(bh.firstChild)t.appendChild(bh.firstChild);bh.innerHTML=`<img class="bb-face" src="${I.mascot}" alt="">`;bh.appendChild(t)}

// illustrative photos, matched to the kind of space
const PHOTO={ballroom:"brisa-ballroom","grand ballroom":"grand-ballroom","event hall":"meridian-hall","exhibition hall":"meridian-hall","convention hall":"meridian-hall",loft:"warehouse",boardroom:"biblioteca","meeting room":"atlantico-salon",garden:"courtyard-palmas",courtyard:"courtyard-palmas",rooftop:"skyline-terrace",terrace:"skyline-terrace","beach deck":"mangrove-pavilion","pool deck":"mangrove-pavilion","great lawn":"oceanfront-lawn"};
const photoFor=v=>I.photos[PHOTO[v.space_type]]||I.photos["brisa-ballroom"];
const idOf=el=>{const b=el.querySelector('button[onclick^="viewVenue"]');const m=b&&b.getAttribute("onclick").match(/'([^']+)'/);return m&&m[1]};
function decorate(){document.querySelectorAll("#venueCards article.venue").forEach(a=>{if(a.dataset.bb)return;const id=idOf(a),v=id&&VENUES2.find(x=>x.id===id);if(!v)return;a.dataset.bb=id;
  const ph=a.querySelector(".photo");if(!ph)return;const old=ph.querySelector("img"),render=old?old.src:"";
  if(old){old.src=photoFor(v);old.alt=`Illustrative photo of a similar ${v.space_type}`}
  else ph.insertAdjacentHTML("afterbegin",`<img src="${photoFor(v)}" alt="Illustrative photo of a similar ${E(v.space_type)}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:1">`);
  const bl=ph.querySelector(".bottomlabel");if(bl)bl.textContent="Illustrative photo of a similar space";
  ph.insertAdjacentHTML("beforeend",`<button type="button" class="bb-3d" data-open="${id}">View in 3D</button>`);
  ph.dataset.open=id})}
const _rc=window.renderCards;window.renderCards=function(){const r=_rc.apply(this,arguments);decorate();return r};
document.addEventListener("click",e=>{const t=e.target.closest("[data-open]");if(t&&!e.target.closest("#leadBox")){e.preventDefault();open(t.dataset.open)}});

// the venue dialog and the space-intelligence section get a way into the full-screen view
const _vv=window.viewVenue;window.viewVenue=function(id){const r=_vv.apply(this,arguments);const d=$("dialogContent");if(d&&!d.querySelector(".bb-open"))d.insertAdjacentHTML("afterbegin",`<div class="bb-open" style="margin:0 0 12px"><button class="btn" type="button" data-open="${E(id)}">View in 3D</button></div>`);return r};

document.addEventListener("click",e=>{if(e.target.id==="bbOpenSel"){const v=state.selected2;if(v)open(v.id,state.layout)}if(e.target.closest("[data-grand]")){e.preventDefault();openGrand()}});


// ---------- full-screen view (layout and tour engine from the team's repo: BB3D.Viewer, hotspots, floor plan)
const GRAND=(window.BB_DATA&&BB_DATA.VENUES||[]).find(x=>x.id==="grand-ballroom"),GL=(window.BB_DATA&&BB_DATA.LAYOUTS)||{};
const OURLAYS=[["banquet","Banquet","rounds of 10"],["buffet","Buffet","buffet + rounds"],["reception","Cocktail","standing reception"],["theater","Theater","rows of chairs"],["classroom","Classroom","tables facing front"],["ushape","U-Shape","open conference U"],["boardroom","Boardroom","one long table"]];
const eqOf=v=>({stage:v.amenities.includes("stage"),screens:v.amenities.includes("screens")||v.amenities.includes("projector"),dance_floor:v.amenities.includes("dance_floor")});
const num=n=>Number(n).toLocaleString("en-US");
document.body.insertAdjacentHTML("beforeend",`<div id="bbImm" class="bb-imm" role="dialog" aria-modal="true" aria-labelledby="bbImmTitle" hidden>
 <div class="bb-stage" id="bbTourBox" tabindex="0" aria-label="360 degree tour. Drag or use the arrow keys to look around."><span class="vhint">Drag to look around</span></div>
 <div class="bb-stage" id="bbScaleBox"><canvas id="bbCanvas" aria-label="3D view of the room, drawn to scale"></canvas></div>
 <div class="bb-spots" id="bbSpots"></div>
 <div class="bb-top"><div class="bb-title bb-glass"><div class="k" id="bbImmKick"></div><h2 id="bbImmTitle"></h2><div class="spec" id="bbSpec"></div></div>
  <div class="bb-actions"><button type="button" class="bb-gbtn bb-glass" id="bbFs">Full screen</button><button type="button" class="bb-gbtn bb-glass" id="bbImmClose">Close</button></div></div>
 <div class="bb-tools bb-glass" id="bbTools"><button type="button" id="bbZin" aria-label="Zoom in">+</button><button type="button" id="bbZout" aria-label="Zoom out">−</button><button type="button" id="bbReset">Reset</button></div>
 <div class="bb-plan bb-glass" id="bbPlan"><div class="lbl">Floor plan</div><canvas id="bbPlanCanvas" width="200" height="132"></canvas><div class="bb-vps" id="bbVps"></div></div>
 <div class="bb-card bb-glass" id="bbCard" hidden></div>
 <p class="bb-note bb-glass" id="bbNote"></p>
 <div class="bb-bottom"><div class="bb-seg bb-glass" id="bbSeg" role="group" aria-label="Room setup"></div><span class="bb-count bb-glass" id="bbCount"></span></div></div>`);
const S={kind:null,v:null,layout:"banquet",tour:null,scale:null,home:null};
const need=()=>state.read?.need;
function guests(cap){const g=need()?.guests;return Math.max(1,Math.min(g||Math.round(cap*.6),cap))}
function seg(list,cur){$("bbSeg").innerHTML=list.map(([k,label])=>`<button type="button" data-lay="${k}" aria-pressed="${k===cur}">${E(label)}</button>`).join("")}
function count(cap,note){const g=guests(cap),asked=need()?.guests;$("bbCount").textContent=`Set for ${num(g)} guests · ${note}${asked&&asked>cap?` · max ${num(cap)}`:""}`}
function lockOpen(){const imm=$("bbImm");if(imm.hidden){imm.hidden=false;document.documentElement.classList.add("bb-lock");
  const bp=$("botPanel"),bb=$("botBtn");if(bp&&bb){S.home=bb.parentNode;imm.appendChild(bb);imm.appendChild(bp)}
  const m=$("modal");if(m&&m.classList.contains("show")&&typeof closeModal==="function")closeModal()}
  $("bbCard").hidden=true}
function goFull(){const imm=$("bbImm");try{if(!document.fullscreenElement&&imm.requestFullscreen&&matchMedia("(pointer: fine)").matches)imm.requestFullscreen().catch(()=>{})}catch(e){}}
function stopTour(){if(S.tour){S.tour.destroy();S.tour=null}$("bbSpots").innerHTML=""}
function stopScale(){if(S.scale){try{S.scale.dispose()}catch(e){}S.scale=null}}

// The Grand Ballroom: the team repo's photographic 360° tour with info pins
function openGrand(layout){if(!GRAND||!window.BB3D){showToast&&showToast("The 360° tour needs WebGL, which this browser does not offer.");return}
  lockOpen();goFull();stopScale();S.kind="grand";S.v=GRAND;S.layout=layout&&GRAND.cap[layout]?layout:(S.layout&&GRAND.cap[S.layout]?S.layout:"banquet");
  $("bbImm").classList.add("tour");$("bbTourBox").hidden=false;$("bbScaleBox").hidden=true;$("bbPlan").hidden=false;$("bbTools").hidden=false;
  $("bbImmKick").textContent=`${GRAND.space} | ${GRAND.hotel}`;$("bbImmTitle").textContent=GRAND.space;
  $("bbSpec").textContent=`${num(GRAND.dims.l*GRAND.dims.w)} sq ft · ${GRAND.dims.l} × ${GRAND.dims.w} ft · ${GRAND.dims.h} ft ceiling`;
  $("bbNote").textContent="Demo partner tour from our hotel preview, shown with illustrative photos. Tap i for room facts and ● to walk there.";
  seg(Object.keys(GL).filter(k=>GRAND.cap[k]).map(k=>[k,GL[k].label]),S.layout);
  if(!BB3D.webglOK()){$("bbNote").textContent="The 360° tour needs WebGL, which this browser does not offer.";return}
  if(!S.tour)S.tour=new BB3D.Viewer($("bbTourBox"));
  S.tour.show(GRAND,S.layout,guests(GRAND.cap[S.layout]),true);bindTour(S.tour);count(GRAND.cap[S.layout],GL[S.layout].note);
  setTimeout(()=>$("bbTourBox").focus({preventScroll:true}),50)}
function bindTour(vw){$("bbVps").innerHTML=(vw.viewpoints||[]).map(p=>`<button type="button" data-vp="${p.id}" aria-pressed="${p.id===vw.vpId}">${E(p.label)}</button>`).join("");
  $("bbSpots").innerHTML=(vw.hotspots||[]).map(s=>`<button type="button" class="bb-hs${s.kind==="nav"?" nav":""}" data-hs="${s.id}" aria-label="${E(s.title)}">${s.kind==="nav"?"●":"i"}</button>`).join("");
  vw.onframe=()=>{if($("bbImm").hidden||S.kind!=="grand")return;
    $("bbVps").querySelectorAll("button").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.vp===vw.vpId)));
    (vw.hotspots||[]).forEach(s=>{const b=$("bbSpots").querySelector(`[data-hs="${s.id}"]`);if(!b)return;const p=vw.project(s.x,s.y,s.z);b.style.left=p.x+"px";b.style.top=p.y+"px";b.hidden=!p.visible});
    drawPlan(vw)}}
function openSpot(s,btn){const c=$("bbCard");c.hidden=false;c.innerHTML=`<h3>${E(s.title)}</h3><p>${E(s.body)}</p>${s.go?`<button type="button" class="go" data-go="${s.go}">Go there</button>`:""}`;
  const r=btn.getBoundingClientRect(),box=$("bbImm").getBoundingClientRect();let left=r.left-box.left+22,top=r.top-box.top-8;
  if(left+290>box.width)left=r.left-box.left-300;if(top+150>box.height)top=Math.max(12,box.height-170);c.style.left=Math.max(12,left)+"px";c.style.top=Math.max(12,top)+"px"}
function drawPlan(vw){const c=$("bbPlanCanvas");if(!c||!vw||!vw.plan)return;const ctx=c.getContext("2d"),p=vw.plan,pad=10,totalL=p.l+(p.foyer||0),totalW=p.w;
  const s=Math.min((c.width-pad*2)/totalL,(c.height-pad*2)/totalW),ox=(c.width-totalL*s)/2,oy=(c.height-totalW*s)/2,X=x=>ox+(x+p.l/2+(p.foyer||0))*s,Z=z=>oy+(z+p.w/2)*s;
  ctx.clearRect(0,0,c.width,c.height);ctx.fillStyle="rgba(247,243,236,.12)";ctx.fillRect(X(-p.l/2),Z(-p.w/2),p.l*s,p.w*s);
  if(p.foyer){ctx.fillStyle="rgba(247,243,236,.06)";ctx.fillRect(X(-p.l/2-p.foyer),Z(-p.w/2),p.foyer*s,p.w*s)}
  ctx.strokeStyle="rgba(255,255,255,.45)";ctx.lineWidth=1;ctx.strokeRect(X(-p.l/2-(p.foyer||0)),Z(-p.w/2),totalL*s,totalW*s);
  const pos=vw.camera.position;ctx.fillStyle="#E8D9B8";ctx.beginPath();ctx.arc(X(pos.x),Z(pos.z),4,0,7);ctx.fill();ctx.strokeStyle="#E8D9B8";ctx.beginPath();ctx.moveTo(X(pos.x),Z(pos.z));
  const hd=vw.yaw+((vw.built&&vw.built.planYawOffset)||0);ctx.lineTo(X(pos.x+Math.sin(hd)*8),Z(pos.z-Math.cos(hd)*8));ctx.stroke()}

// Our measured spaces: 3D drawn to scale from the measurements
function open(id,layout){const v=VENUES2.find(x=>x.id===id);if(!v)return;lockOpen();goFull();stopTour();S.kind="scale";S.v=v;
  const n=need();S.layout=layout||(n&&BV.layoutOf(n))||state.layout||"banquet";if(!v.capacity[S.layout])S.layout="banquet";
  $("bbImm").classList.remove("tour");$("bbTourBox").hidden=true;$("bbScaleBox").hidden=false;$("bbPlan").hidden=true;$("bbTools").hidden=true;
  $("bbImmKick").textContent=`${v.hotel} · ${v.neighborhood}, Miami`;$("bbImmTitle").textContent=v.space;
  $("bbSpec").textContent=`${num(v.measured.usable_sqft)} usable sq ft · ${v.measured.length_ft} × ${v.measured.width_ft} ft · ${v.measured.ceiling_ft?v.measured.ceiling_ft+" ft ceiling":"open air"}`;
  $("bbNote").textContent="Drawn to scale from the measured room. Drag to turn, scroll or pinch to zoom.";
  seg(OURLAYS.filter(([k])=>v.capacity[k]).map(([k,l])=>[k,l]),S.layout);scaleShow()}
function scaleShow(){const v=S.v,cap=v.capacity[S.layout];count(cap,OURLAYS.find(x=>x[0]===S.layout)[2]);
  if(!window.THREE||!window.BVScene){$("bbNote").textContent="3D needs WebGL, which this browser does not offer.";return}
  const o={layout:S.layout,eq:eqOf(v),guests:guests(cap)};requestAnimationFrame(()=>{try{if(S.scale&&S.scale._id===v.id)S.scale.update(o);else{stopScale();S.scale=BVScene.viewer($("bbCanvas"),v,o);S.scale._id=v.id}}catch(e){$("bbNote").textContent="The 3D view could not start in this browser."}})}

function close(){const imm=$("bbImm");if(imm.hidden)return;imm.hidden=true;document.documentElement.classList.remove("bb-lock");stopTour();stopScale();S.kind=null;
  const bp=$("botPanel"),bb=$("botBtn");if(S.home&&bp&&bb){S.home.appendChild(bb);S.home.appendChild(bp)}
  try{if(document.fullscreenElement)document.exitFullscreen()}catch(e){}}
$("bbImmClose").onclick=close;
$("bbFs").onclick=()=>{try{document.fullscreenElement?document.exitFullscreen():$("bbImm").requestFullscreen().catch(()=>{})}catch(e){}};
document.addEventListener("fullscreenchange",()=>{$("bbFs").textContent=document.fullscreenElement?"Exit full screen":"Full screen"});
$("bbZin").onclick=()=>{if(S.tour){S.tour.stopAuto();S.tour.zoom(-8)}};$("bbZout").onclick=()=>{if(S.tour){S.tour.stopAuto();S.tour.zoom(8)}};$("bbReset").onclick=()=>{if(S.tour)S.tour.resetView()};
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!$("bbImm").hidden&&$("botPanel")?.hidden!==false){if(!$("bbCard").hidden)$("bbCard").hidden=true;else close()}});
$("bbImm").addEventListener("pointerdown",e=>{if(!e.target.closest(".bb-card")&&!e.target.closest(".bb-hs"))$("bbCard").hidden=true});
$("bbImm").addEventListener("click",e=>{const l=e.target.closest("[data-lay]");if(l){S.layout=l.dataset.lay;$("bbSeg").querySelectorAll("button").forEach(b=>b.setAttribute("aria-pressed",String(b===l)));
    if(S.kind==="grand"){S.tour.show(GRAND,S.layout,guests(GRAND.cap[S.layout]),true);bindTour(S.tour);count(GRAND.cap[S.layout],GL[S.layout].note)}else scaleShow();return}
  const vp=e.target.closest("[data-vp]");if(vp&&S.tour){S.tour.goTo(vp.dataset.vp);return}
  const hs=e.target.closest("[data-hs]");if(hs&&S.tour){e.stopPropagation();const s=S.tour.hotspots.find(x=>x.id===hs.dataset.hs);if(s)openSpot(s,hs);return}
  const go=e.target.closest("[data-go]");if(go&&S.tour){S.tour.goTo(go.dataset.go);$("bbCard").hidden=true}});

// Grand Ballroom as a normal-size card, next to the photo search panel; a way in from the hero
const SAMPLES=typeof BB_SAMPLES!=="undefined"?BB_SAMPLES:{};const PHOTOSEARCH_SAMPLES=Object.entries(SAMPLES);
if(GRAND){const vc=$("venueCards");if(vc)vc.insertAdjacentHTML("beforebegin",`<div class="bb-row">
  <article class="venue bb-grandcard" data-grand="1"><div class="photo"><img src="${SAMPLES.s1?SAMPLES.s1.src:I.photos["grand-ballroom"]}" alt="The Grand Ballroom set for a banquet" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:1"><span class="photolabel">360° tour</span><span class="bottomlabel">Demo partner listing · not in the 54 matched spaces</span></div>
   <div class="venuebody"><h3>${E(GRAND.space)}</h3><div class="sub">${E(GRAND.hotel.replace(/ & Conference Center$/,""))} · ${E(GRAND.area)} · indoor</div>
   <div class="facts"><span class="fact">${GRAND.dims.l} × ${GRAND.dims.w} ft</span><span class="fact">${num(GRAND.cap.banquet)} banquet</span><span class="fact">${num(GRAND.cap.reception)} cocktail</span></div>
   <p class="reasons">Pillar-free, ${GRAND.dims.h} ft ceiling, 24 ft LED wall and a glass wall over the bay.</p>
   <div class="venuefoot"><b>$${num(GRAND.price.rental)}<small>Rental per event, food & drink extra</small></b><button class="btn" type="button" data-grand="1">Walk in 360°</button></div></div></article>
  <section class="bb-ps panel" aria-labelledby="bbPsH"><div class="eyebrow">Search by photo</div><h3 id="bbPsH">Have a picture of the look you want?</h3>
   <p>Pick a sample or upload your own. We compare its colors, light and layout with photos of our spaces and show the closest match.</p>
   <div class="bb-ps-thumbs">${PHOTOSEARCH_SAMPLES.map(([k,s])=>`<button type="button" class="bb-ps-thumb" data-sample="${k}"><img src="${s.src}" alt="${E(s.title)}"><span>${E(s.from.split(" (")[0])}</span></button>`).join("")}</div>
   <div class="bb-open"><label class="btn soft" for="bbPsFile">Upload a photo</label><input id="bbPsFile" type="file" accept="image/png,image/jpeg,image/webp" hidden></div></section></div>`);
}

// ---------- photo search: nearest reference photo by color, light and layout (no AI needed; works offline)
const PS_CLASSES={grand:{label:"The Grand Ballroom",grand:true},ballroom:{label:"Ballrooms",types:["ballroom","grand ballroom"]},hall:{label:"Event and convention halls",types:["event hall","convention hall","exhibition hall"]},
  loft:{label:"Lofts",types:["loft"]},boardroom:{label:"Boardrooms and meeting rooms",types:["boardroom","meeting room"]},garden:{label:"Gardens and courtyards",types:["garden","courtyard"]},
  rooftop:{label:"Rooftops and terraces",types:["rooftop","terrace"]},waterfront:{label:"Beach and pool decks",types:["beach deck","pool deck"]},lawn:{label:"Lawns",types:["great lawn"]}};
const PS_REFS=[["grand",I.photos["grand-ballroom"],"Grand Ballroom photo"],...Object.keys(I.tour).map(k=>["grand",I.tour[k],"Grand Ballroom tour: "+k]),
  ["ballroom",I.photos["brisa-ballroom"],"Ballroom photo"],["ballroom",I.photos["atlantico-salon"],"Salon photo"],["hall",I.photos["meridian-hall"],"Event hall photo"],
  ["loft",I.photos["warehouse"],"Loft photo"],["boardroom",I.photos["biblioteca"],"Boardroom photo"],["garden",I.photos["courtyard-palmas"],"Courtyard photo"],
  ["rooftop",I.photos["skyline-terrace"],"Rooftop photo"],["waterfront",I.photos["mangrove-pavilion"],"Waterfront deck photo"],["lawn",I.photos["oceanfront-lawn"],"Lawn photo"]];
if(SAMPLES.s1){PS_REFS.push(["grand",SAMPLES.s1.src,"Team photo 1 (taught as the Grand Ballroom)"],["hall",SAMPLES.s2.src,"Team photo 2 (taught as an event hall)"])}
function loadImg(src){return new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=rej;im.src=src})}
function features(im){const W=64,H=36,c=document.createElement("canvas");c.width=W;c.height=H;const x=c.getContext("2d",{willReadFrequently:true});x.drawImage(im,0,0,W,H);const d=x.getImageData(0,0,W,H).data;
  const hue=new Float32Array(12),sat=new Float32Array(4),val=new Float32Array(6),grid=new Float32Array(24),band=new Float32Array(9),gc=new Float32Array(12),bc=new Float32Array(3);
  for(let y=0;y<H;y++)for(let i=0;i<W;i++){const k=(y*W+i)*4,r=d[k]/255,g=d[k+1]/255,b=d[k+2]/255,mx=Math.max(r,g,b),mn=Math.min(r,g,b),v=mx,s=mx?(mx-mn)/mx:0;let h=0;
    if(mx!==mn){h=mx===r?(g-b)/(mx-mn):mx===g?2+(b-r)/(mx-mn):4+(r-g)/(mx-mn);h=(h*60+360)%360}
    if(s>.12&&v>.12)hue[Math.floor(h/30)%12]+=s*v;sat[Math.min(3,Math.floor(s*4))]++;val[Math.min(5,Math.floor(v*6))]++;
    const gi=Math.min(3,Math.floor(i/(W/4)))+4*Math.min(2,Math.floor(y/(H/3)));grid[gi]+=v;grid[12+gi]+=s;gc[gi]++;const bi=Math.min(2,Math.floor(y/(H/3)));band[bi*3]+=r;band[bi*3+1]+=g;band[bi*3+2]+=b;bc[bi]++}
  for(let i=0;i<12;i++){grid[i]/=gc[i];grid[12+i]/=gc[i]}for(let i=0;i<9;i++)band[i]/=bc[Math.floor(i/3)];
  const norm=(a,w)=>{let n=0;for(const v of a)n+=v*v;n=Math.sqrt(n)||1;return Array.from(a,v=>v/n*w)};
  return [...norm(hue,1),...norm(sat,.7),...norm(val,1),...norm(grid,1.3),...norm(band,1.2)]}
const cos=(a,b)=>{let s=0,na=0,nb=0;for(let i=0;i<a.length;i++){s+=a[i]*b[i];na+=a[i]*a[i];nb+=b[i]*b[i]}return s/Math.sqrt(na*nb)};
let refP=null;function refs(){return refP??=Promise.all(PS_REFS.map(async([cls,src,name])=>({cls,src,name,f:features(await loadImg(src))})))}
async function matchPhoto(src){const R=await refs(),f=features(await loadImg(src));const sims=R.map(r=>({...r,sim:cos(f,r.f)})).sort((a,b)=>b.sim-a.sim);
  const by={};for(const s of sims)if(!(s.cls in by))by[s.cls]=s;return {best:sims[0],ranked:Object.values(by).sort((a,b)=>b.sim-a.sim),all:sims}}
window.BBPhotoMatch=matchPhoto;

document.body.insertAdjacentHTML("beforeend",`<div class="bb-pop" id="bbPop" role="dialog" aria-modal="true" aria-labelledby="bbPopH" hidden><div class="bb-pop-card">
  <div class="bb-pop-head"><div><div class="eyebrow">Search by photo</div><h2 id="bbPopH">Find a space that looks like your picture</h2></div><button type="button" class="close" id="bbPopClose" aria-label="Close">✕</button></div>
  <div class="bb-pop-pick"><span class="dim">Try a sample:</span>${PHOTOSEARCH_SAMPLES.map(([k,s])=>`<button type="button" class="bb-ps-thumb sm" data-sample="${k}" title="${E(s.title)}"><img src="${s.src}" alt="${E(s.title)}"></button>`).join("")}<label class="btn soft" for="bbPsFile">Upload a photo</label></div>
  <div id="bbPopBody" class="bb-pop-body"></div></div></div>`);
const pop=$("bbPop");
function popOpen(){pop.hidden=false;document.documentElement.classList.add("bb-lock")}
function popClose(){pop.hidden=true;if($("bbImm").hidden)document.documentElement.classList.remove("bb-lock")}
$("bbPopClose").onclick=popClose;pop.addEventListener("click",e=>{if(e.target===pop)popClose()});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!pop.hidden)popClose()});
function spaceCard(v){const L=DEF_LAYOUT(v);return `<article class="bb-mini"><img src="${photoFor(v)}" alt=""><div><b>${E(v.space)}</b><span>${E(v.hotel)} · ${E(v.neighborhood)}</span><span>${v.measured.length_ft} × ${v.measured.width_ft} ft · seats ${num(v.capacity[L])} ${L==="banquet"?"banquet":L}</span></div><button type="button" class="btn sm" data-open="${v.id}">View in 3D</button></article>`}
function DEF_LAYOUT(v){return v.capacity.banquet?"banquet":"reception"}
async function runPhoto(src,caption){popOpen();const body=$("bbPopBody");body.innerHTML=`<p class="dim">Comparing your photo with ${PS_REFS.length} reference photos…</p>`;
  try{const m=await matchPhoto(src),top=m.ranked[0],second=m.ranked[1],C=PS_CLASSES[top.cls],pct=x=>Math.round(x*100);
    let list="";if(C.grand)list=`<article class="bb-mini"><img src="${I.photos["grand-ballroom"]}" alt=""><div><b>${E(GRAND.space)}</b><span>${E(GRAND.hotel)}</span><span>${GRAND.dims.l} × ${GRAND.dims.w} ft · ${num(GRAND.cap.banquet)} banquet · ${num(GRAND.cap.reception)} cocktail</span></div><button type="button" class="btn sm" data-grand="1">Walk in 360°</button></article>`;
    const types=C.types||["ballroom","grand ballroom"];const n=state.read?.need;
    const vs=VENUES2.filter(v=>types.includes(v.space_type)).sort((a,b)=>(n?BV.check(a,n).length-BV.check(b,n).length:0)||b.capacity.banquet-a.capacity.banquet).slice(0,C.grand?2:3);
    list+=vs.map(spaceCard).join("");
    body.innerHTML=`<div class="bb-pop-compare"><figure><img src="${src}" alt="Your photo"><figcaption>${E(caption||"Your photo")}</figcaption></figure><figure><img src="${top.src}" alt="Closest reference photo"><figcaption>Closest reference: ${E(top.name)}</figcaption></figure></div>
     <p class="bb-pop-verdict">Looks most like <b>${E(C.label)}</b> <span class="dim">(${pct(top.sim)}% similar${second?`; next: ${E(PS_CLASSES[second.cls].label)}, ${pct(second.sim)}%`:""})</span></p>
     <div class="bb-pop-list">${list}</div>
     <p class="dim bb-pop-note">This compares colors, light and layout with our reference photos, including the two team photos it was taught with. It reads the look, not exact sizes, so check capacity on each space.${state.read?.need?" Spaces that fit your request are listed first.":""}</p>`}
  catch(e){body.innerHTML=`<p>That image could not be read. Try a JPG, PNG or WebP photo.</p>`}}
document.addEventListener("click",e=>{const s=e.target.closest("[data-sample]");if(s){const S=SAMPLES[s.dataset.sample];runPhoto(S.src,S.from);return}
  if(e.target.closest("[data-photosearch]")){popOpen();if(!$("bbPopBody").innerHTML)$("bbPopBody").innerHTML=`<p class="dim">Pick a sample above or upload a photo of the look you want.</p>`;return}
  if(!pop.hidden&&e.target.closest("#bbPop [data-open],#bbPop [data-grand]"))popClose()},true);
function readFile(f){if(!f||!/^image\//.test(f.type))return;const r=new FileReader();r.onload=()=>runPhoto(r.result,f.name);r.readAsDataURL(f)}
$("bbPsFile").addEventListener("change",e=>{readFile(e.target.files[0]);e.target.value=""});
const insp=$("inspoFile");if(insp)insp.addEventListener("change",e=>readFile(e.target.files[0]));

// ---------- Space intelligence panel: the Grand Ballroom, inline (the measured-room floor plan stays in the page, hidden, because "View details" still updates it)
if(GRAND){const panels=document.querySelectorAll("#visualize .demo-grid > .panel"),lp=panels[0],rp=panels[1];
  if(lp){[...lp.children].forEach(c=>c.hidden=true);
    lp.insertAdjacentHTML("beforeend",`<div class="bb-gl"><div class="bb-gl-head"><div><h3>${E(GRAND.space)} · ${E(GRAND.hotel.replace(/ & Conference Center$/,""))}</h3>
      <div class="kicker">${num(GRAND.dims.l*GRAND.dims.w)} sq ft · ${GRAND.dims.l} × ${GRAND.dims.w} ft · ${GRAND.dims.h} ft ceiling · ${E(GRAND.area)}</div></div><span class="badge dark">Demo partner tour</span></div>
      <div class="bb-gl-seg" id="bbGlSeg" role="group" aria-label="Room setup">${Object.keys(GL).filter(k=>GRAND.cap[k]).map((k,i)=>`<button type="button" class="tab${i?"":" active"}" data-gl="${k}">${E(GL[k].label)}</button>`).join("")}</div>
      <div class="bb-gl-wrap"><div class="bb-gl-box" id="bbGlBox" tabindex="0" aria-label="360 degree view of the Grand Ballroom. Drag or use the arrow keys to look around."><span class="vhint">Drag to look around</span></div>
        <div class="bb-gl-spots" id="bbGlSpots"></div><div class="bb-card bb-glass" id="bbGlCard" hidden></div>
        <button type="button" class="bb-gbtn bb-glass bb-gl-fs" id="bbGlFs">Full screen</button></div>
      <div class="bb-gl-foot"><span class="dim" id="bbGlCount"></span><span class="dim">Tap i for room facts, ● to walk there · illustrative photos</span></div></div>`)}
  if(rp){const t=rp.querySelector("#detailsTable");if(t){t.hidden=true;const a=GRAND.amen.map(x=>`${x.n} (${x.s})`).join("; ");
    const rows=[["Size",`${GRAND.dims.l} × ${GRAND.dims.w} ft · ${num(GRAND.dims.l*GRAND.dims.w)} sq ft`],["Ceiling",`${GRAND.dims.h} ft, pillar-free`],["Capacity by layout",Object.keys(GL).filter(k=>GRAND.cap[k]).map(k=>`${GL[k].label} ${num(GRAND.cap[k])}`).join(" · ")],
      ["View",GRAND.view],["Equipment",a],["Rental",`$${num(GRAND.price.rental)} ${GRAND.price.rentalNote}`],["Food & drink",`$${num(GRAND.price.perGuest)} per guest (${GRAND.price.perGuestNote}), $${num(GRAND.price.fbMin)} minimum`],
      ["Hours",GRAND.hours.map(h=>h.join(": ")).join("; ")],["Notes",GRAND.notes.join(" · ")],["Status","Demo listing; dates and prices need hotel confirmation"]];
    t.insertAdjacentHTML("afterend",`<table class="data-table" id="bbGlTable">${rows.map(([k,v])=>`<tr><td>${E(k)}</td><td>${E(v)}</td></tr>`).join("")}</table>`)}}
  const G={vw:null,layout:"banquet",started:false};
  function glCount(){$("bbGlCount").textContent=`${GL[G.layout].label}: up to ${num(GRAND.cap[G.layout])} guests · ${GL[G.layout].note}`}
  function glBind(){const vw=G.vw;$("bbGlSpots").innerHTML=(vw.hotspots||[]).map(s=>`<button type="button" class="bb-hs${s.kind==="nav"?" nav":""}" data-ghs="${s.id}" aria-label="${E(s.title)}">${s.kind==="nav"?"●":"i"}</button>`).join("");
    vw.onframe=()=>{(vw.hotspots||[]).forEach(s=>{const b=$("bbGlSpots").querySelector(`[data-ghs="${s.id}"]`);if(!b)return;const p=vw.project(s.x,s.y,s.z);b.style.left=p.x+"px";b.style.top=p.y+"px";b.hidden=!p.visible})}}
  function glStart(){if(G.started||!window.BB3D||!BB3D.webglOK())return;G.started=true;G.vw=new BB3D.Viewer($("bbGlBox"));G.vw.show(GRAND,G.layout,Math.round(GRAND.cap[G.layout]*.6),true);glBind();glCount()}
  glCount();
  try{new IntersectionObserver(es=>{if(es.some(e=>e.isIntersecting))glStart()},{rootMargin:"200px"}).observe($("bbGlBox"))}catch(e){glStart()}
  document.addEventListener("click",e=>{const b=e.target.closest("[data-gl]");if(b){G.layout=b.dataset.gl;$("bbGlSeg").querySelectorAll("button").forEach(x=>x.classList.toggle("active",x===b));glCount();
      if(G.vw){G.vw.show(GRAND,G.layout,Math.round(GRAND.cap[G.layout]*.6),true);glBind()}$("bbGlCard").hidden=true;return}
    const h=e.target.closest("[data-ghs]");if(h&&G.vw){e.stopPropagation();const s=G.vw.hotspots.find(x=>x.id===h.dataset.ghs);if(!s)return;const c=$("bbGlCard");c.hidden=false;
      c.innerHTML=`<h3>${E(s.title)}</h3><p>${E(s.body)}</p>${s.go?`<button type="button" class="go" data-ggo="${s.go}">Go there</button>`:""}`;
      const r=h.getBoundingClientRect(),bx=$("bbGlBox").parentElement.getBoundingClientRect();let left=r.left-bx.left+22,top=r.top-bx.top-8;if(left+290>bx.width)left=r.left-bx.left-300;if(top+150>bx.height)top=Math.max(10,bx.height-160);
      c.style.left=Math.max(10,left)+"px";c.style.top=Math.max(10,top)+"px";return}
    const g=e.target.closest("[data-ggo]");if(g&&G.vw){G.vw.goTo(g.dataset.ggo);$("bbGlCard").hidden=true;return}
    if(e.target.id==="bbGlFs"){if(G.vw){G.vw.running=false}openGrand(G.layout)}});
  $("bbGlBox").addEventListener("pointerdown",e=>{if(!e.target.closest(".bb-card")&&!e.target.closest(".bb-hs"))$("bbGlCard").hidden=true});
  // pause the inline tour while the full-screen view is open, resume after
  new MutationObserver(()=>{if(!G.vw)return;if($("bbImm").hidden&&!G.vw.running){G.vw.running=true;G.vw.loop()}else if(!$("bbImm").hidden)G.vw.running=false}).observe($("bbImm"),{attributes:true,attributeFilter:["hidden"]})}

// ---------- Breeza chat as a pop-up with its own Close button
(function(){const bp=$("botPanel"),hd=bp&&bp.querySelector("header");if(!hd||hd.querySelector(".bb-chat-x"))return;
  const x=document.createElement("button");x.type="button";x.className="bb-chat-x";x.textContent="Close";x.setAttribute("aria-label","Close chat");
  x.onclick=()=>{bp.hidden=true;const b=$("botBtn");if(b){b.setAttribute("aria-expanded","false");b.focus()}};hd.appendChild(x)})();

// ---------- details panel in the full-screen view: measurements, then "Request this space" (format from the team repo), sent to the team inbox
$("bbImm").querySelector(".bb-actions").insertAdjacentHTML("afterbegin",`<button type="button" class="bb-gbtn bb-glass" id="bbDetBtn" aria-controls="bbPanel" aria-expanded="false">Details</button>`);
$("bbImm").insertAdjacentHTML("beforeend",`<aside class="bb-panel" id="bbPanel" aria-label="Space details" hidden><div class="bb-pp" id="bbPanelBody"></div></aside>`);
const AMEN={projector:"Projector",screens:"Screens",stage:"Stage",dance_floor:"Dance floor",microphone:"Microphones",buffet:"Buffet setup",parking:"Parking",accessible:"Accessible entrance",natural_light:"Natural light",ocean_view:"Ocean view"};
const money=n=>"$"+num(Math.round(n));
function info(){const v=S.v;
  if(S.kind==="grand"){const L=Object.keys(GL).filter(k=>GRAND.cap[k]);const g=guests(GRAND.cap[S.layout]),est=GRAND.price.rental+Math.max(GRAND.price.fbMin,g*GRAND.price.perGuest);
    return {space:GRAND.space,hotel:GRAND.hotel,area:GRAND.area,blurb:GRAND.blurb,sqft:GRAND.dims.l*GRAND.dims.w,dims:`${GRAND.dims.l} × ${GRAND.dims.w} ft`,ceil:`${GRAND.dims.h} ft`,ceilSub:"ceiling height",max:Math.max(...L.map(k=>GRAND.cap[k])),
      caps:L.map(k=>[k,GL[k].label,GL[k].note,GRAND.cap[k]]),equip:GRAND.amen.map(a=>[a.n,a.s]),
      price:[["Room rental",GRAND.price.rentalNote,money(GRAND.price.rental)],["Food & beverage minimum","catering and bar",money(GRAND.price.fbMin)],["Catering","per guest · "+GRAND.price.perGuestNote,money(GRAND.price.perGuest)]],
      est:{g,total:est,note:"Rental plus food and drink, before service charge and tax."},hours:GRAND.hours.map(h=>h.join(": ")),notes:[...GRAND.notes,"Demo partner listing: dates and prices need hotel confirmation"],measured:"Dimensions from the hotel's floor plan (demo listing)"}}
  const m=v.measured,L=OURLAYS.filter(([k])=>v.capacity[k]),g=guests(v.capacity[S.layout]),date=need()?.date||"2027-06-15",p=BV.priceFor(v,g,date);
  return {space:v.space,hotel:v.hotel,area:v.neighborhood,blurb:`A ${v.styles.join(", ")} ${v.space_type}, ${v.setting}.`,sqft:m.usable_sqft,dims:`${m.length_ft} × ${m.width_ft} ft`,ceil:m.ceiling_ft?`${m.ceiling_ft} ft`:"Open sky",ceilSub:m.ceiling_ft?"ceiling height":"no ceiling",max:Math.max(...L.map(([k])=>v.capacity[k])),
    caps:L.map(([k,l,n])=>[k,l,n,v.capacity[k]]),equip:[...v.amenities.map(a=>[AMEN[a]||a,"included"]),...Object.entries(v.addons||{}).filter(([a])=>!v.amenities.includes(a)).map(([a,c])=>[AMEN[a]||a,`hotel can add, +${money(c)}`])],
    price:[["Room rental","base, varies by season and weekday",money(p.rental)],["Food & drink",`${num(g)} guests`,money(p.fnb)]],est:{g,total:p.total,note:`Estimate for ${date}, before service charge and tax.`},
    hours:[v.curfew==="none"?"No curfew":"Events end by "+v.curfew],notes:[`Hotel publishes ${num(v.hotel_claimed_sqft)} sq ft; measured usable area is ${num(m.usable_sqft)} sq ft`],measured:`${m.method}, ${m.scan_date}`}}
function estFor(g,date){return S.kind==="grand"?GRAND.price.rental+Math.max(GRAND.price.fbMin,g*GRAND.price.perGuest):BV.priceFor(S.v,g,date).total}
function panelOpen(on){const p=$("bbPanel");p.hidden=!on;$("bbDetBtn").setAttribute("aria-expanded",String(on));$("bbImm").classList.toggle("panel-on",on)}
function renderDetails(){const d=info(),b=$("bbPanelBody");
  b.innerHTML=`<p class="bb-blurb">${E(d.blurb)}</p>
   <h4>Measurements</h4><div class="bb-specs"><div><b>${num(d.sqft)}</b><span>square feet</span></div><div><b>${E(d.dims)}</b><span>length × width</span></div><div><b>${E(d.ceil)}</b><span>${E(d.ceilSub)}</span></div><div><b>${num(d.max)}</b><span>max guests</span></div></div>
   <p class="bb-src">${E(d.measured)}</p>
   <h4>Capacity by layout</h4><table class="bb-tbl">${d.caps.map(([k,l,n,c])=>`<tr class="${k===S.layout?"on":""}"><td>${E(l)}<small>${E(n)}</small></td><td>${num(c)}</td></tr>`).join("")}</table>
   <h4>Equipment and features</h4><table class="bb-tbl">${d.equip.map(([a,b2])=>`<tr><td>${E(a)}</td><td>${E(b2)}</td></tr>`).join("")}</table>
   <h4>Pricing</h4><div class="bb-price">${d.price.map(([a,s2,v])=>`<div><span>${E(a)}<small>${E(s2)}</small></span><b>${v}</b></div>`).join("")}<div class="bb-est"><span>Estimate for ${num(d.est.g)} guests</span><b>${money(d.est.total)}</b><small>${E(d.est.note)}</small></div></div>
   <h4>Hours and notes</h4><ul class="bb-notes">${[...d.hours,...d.notes].map(n=>`<li>${E(n)}</li>`).join("")}</ul>
   <div class="bb-pcta"><button type="button" class="btn" id="bbReqBtn">Request this space</button></div>`;
  b.scrollTop=0}
function renderRequest(){const d=info(),b=$("bbPanelBody"),n=need()||{},today=new Date().toISOString().slice(0,10),EV={wedding:"Wedding",birthday:"Birthday",conference:"Conference",meeting:"Meeting",gala:"Gala",networking:"Networking event",workshop:"Workshop",party:"Party"};
  b.innerHTML=`<button type="button" class="bb-back" data-bbback="1">Back to details</button><h2>Request ${E(d.space)}</h2><p class="bb-lead">${E(d.hotel)} · ${E(d.area)}. Breeza filled in what she already knows.</p>
   <form class="bb-form" id="bbReqForm" novalidate>
    <label class="full">Your name<input id="rqName" autocomplete="name" required></label>
    <label>Email<input id="rqEmail" type="email" autocomplete="email" required></label><label>Phone<input id="rqPhone" type="tel" autocomplete="tel"></label>
    <label>Event<input id="rqEvent" value="${E(EV[n.event_type]||"")}" placeholder="Wedding reception" required></label><label>Guests<input id="rqGuests" type="number" min="1" max="${d.max}" value="${n.guests?Math.min(n.guests,d.max):""}" inputmode="numeric" required></label>
    <label class="full">Date<input id="rqDate" type="date" min="${today}" value="${E(n.date&&n.date>=today?n.date:"")}" required></label>
    <label>Start<input id="rqStart" type="time" value="18:00"></label><label>End<input id="rqEnd" type="time" value="23:00"></label>
    <label class="full">Setup<select id="rqLayout">${d.caps.map(([k,l,,c])=>`<option value="${k}"${k===S.layout?" selected":""}>${E(l)} (up to ${num(c)})</option>`).join("")}</select></label>
    <label class="full">Food & drink<input id="rqFood" placeholder="Plated dinner, open bar"></label>
    <label class="full">Anything else the hotel should know?<textarea id="rqNotes" rows="3" placeholder="Ceremony on site, kids attending, dietary needs"></textarea></label>
    <p class="bb-err full" id="rqErr" role="alert"></p>
    <div class="full bb-factions"><button type="submit" class="btn">Send request</button><button type="button" class="btn border" data-bbback="1">Back to details</button></div></form>`;
  b.scrollTop=0;$("rqName").focus()}
async function sendRequest(e){e.preventDefault();const d=info(),val=id=>$(id).value.trim(),errs=[];
  if(!val("rqName"))errs.push("your name");if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(val("rqEmail")))errs.push("a valid email");if(!val("rqDate"))errs.push("a date");
  const g=+val("rqGuests"),L=val("rqLayout"),cap=(d.caps.find(c=>c[0]===L)||[])[3];if(!g)errs.push("a guest count");if(g&&cap&&g>cap)errs.push(`no more than ${num(cap)} guests for that setup`);
  if(errs.length){$("rqErr").textContent=`Add ${errs.join(", ")}.`;return}
  const lay=d.caps.find(c=>c[0]===L),r={name:val("rqName"),email:val("rqEmail"),phone:val("rqPhone"),event:val("rqEvent")||"Event",date:val("rqDate"),start:val("rqStart"),end:val("rqEnd"),guests:g,layout:lay[1],food:val("rqFood"),notes:val("rqNotes")};
  const id="BB-"+Date.now().toString(36).slice(-6).toUpperCase();
  const payload={id,kind:"Venue request",space:d.space,hotel:d.hotel,guests:g,date:r.date,request:`${r.event} for ${g} guests, ${r.layout} setup, ${r.start}-${r.end}.${r.phone?" Phone: "+r.phone+".":""} Food & drink: ${r.food||"to discuss"}. Measured room: ${num(d.sqft)} sq ft, ${d.dims}.`,notes:r.notes,contact:{name:r.name,email:r.email,phone:r.phone},created:new Date().toISOString()};
  $("bbReqForm").querySelector('button[type="submit"]').disabled=true;
  let res={ok:false,why:"This copy can't reach our team. Open the live Breeze Book link to send it."};try{if(window.BBNotify)res=await window.BBNotify(payload)}catch(e2){}
  const rows=[["Space",`${d.space}, ${d.hotel} (${d.area})`],["Measured room",`${num(d.sqft)} sq ft · ${d.dims} · ${d.ceil} ceiling`],["Event",`${r.event} · ${num(g)} guests`],["Date and time",`${r.date}${r.start?` · ${r.start}–${r.end}`:""}`],
    ["Setup",`${lay[1]} (${lay[2]}), room holds ${num(lay[3])}`],["Food & drink",r.food||"To discuss"],["Estimate",`${money(estFor(g,r.date))} before service charge and tax`],["Contact",[r.name,r.email,r.phone].filter(Boolean).join(" · ")],["Notes",r.notes||"None"]];
  const text="Breeze Book request "+id+"\n"+rows.map(([a,b2])=>`${a}: ${b2}`).join("\n");
  $("bbPanelBody").innerHTML=`<h2>${res.ok?"Request sent":"Your request is ready"}</h2>
   <p class="bb-lead ${res.ok?"ok":""}">${res.ok?"Sent. Our team has been notified and will look closely at your request, then get back to you. The hotel confirms the date and the final price.":"Saved on this device, not sent yet. "+E(res.why)}</p>
   <div class="bb-receipt"><div class="rh"><b>${E(d.space)}</b><span>${id}</span></div><dl>${rows.map(([a,b2])=>`<dt>${E(a)}</dt><dd>${E(b2)}</dd>`).join("")}</dl></div>
   <div class="bb-factions"><button type="button" class="btn" id="bbCopyReq">Copy request</button><button type="button" class="btn border" data-bbback="1">Back to details</button></div>`;
  $("bbCopyReq").onclick=async()=>{try{await navigator.clipboard.writeText(text);$("bbCopyReq").textContent="Copied"}catch(e3){const t=document.createElement("textarea");t.value=text;t.readOnly=true;t.className="bb-copybox";$("bbCopyReq").after(t);t.select()}}}
$("bbDetBtn").onclick=()=>{const on=$("bbPanel").hidden;if(on)renderDetails();panelOpen(on)};
$("bbImm").addEventListener("click",e=>{if(e.target.id==="bbReqBtn"){renderRequest();return}if(e.target.closest("[data-bbback]")){renderDetails();return}});
$("bbImm").addEventListener("submit",e=>{if(e.target.id==="bbReqForm")sendRequest(e)});
// keep the panel in step with the room and layout shown
const _og=openGrand,_oo=open;
function afterOpen(){if(!$("bbPanel").hidden||matchMedia("(min-width:900px)").matches){renderDetails();panelOpen(true)}}
openGrand=function(l){_og(l);if(S.kind==="grand")afterOpen()};open=function(id,l){_oo(id,l);if(S.kind==="scale")afterOpen()};
$("bbImm").addEventListener("click",e=>{if(e.target.closest("[data-lay]")&&!$("bbPanel").hidden&&!$("bbReqForm"))renderDetails()});
window.BBView={open,openGrand,close};
})();
