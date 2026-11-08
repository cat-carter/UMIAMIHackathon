// BreezeBook 3D scenes (three.js r128). Units: 1 = 1 foot. Built from each space's measured dimensions.
(function(){
const T=()=>window.THREE;
function tex(w,h,draw){const c=document.createElement("canvas");c.width=w;c.height=h;draw(c.getContext("2d"),w,h);const t=new (T().CanvasTexture)(c);t.encoding=T().sRGBEncoding;t.anisotropy=4;return t}
function noise(ctx,w,h,base,spread,n){ctx.fillStyle=base;ctx.fillRect(0,0,w,h);for(let i=0;i<n;i++){const a=Math.random()*spread;ctx.fillStyle=`rgba(${Math.random()<.5?"0,0,0":"255,255,255"},${a})`;ctx.fillRect(Math.random()*w,Math.random()*h,1+Math.random()*2,1+Math.random()*2)}}
const cache={};
function textures(){if(cache.t)return cache.t;const THREE=T();
  const carpet=tex(256,256,(c,w,h)=>{noise(c,w,h,"#5b4a63",.06,9000);c.strokeStyle="rgba(214,190,140,.25)";c.lineWidth=2;for(let i=0;i<8;i++){c.beginPath();c.arc(64+(i%2)*128,64+Math.floor(i/2)%2*128,40,0,7);c.stroke()}});
  carpet.wrapS=carpet.wrapT=THREE.RepeatWrapping;
  const wood=tex(256,256,(c,w,h)=>{for(let y=0;y<h;y+=16){c.fillStyle=`hsl(30,${35+Math.random()*10}%,${38+Math.random()*10}%)`;c.fillRect(0,y,w,16);c.fillStyle="rgba(0,0,0,.15)";c.fillRect(0,y,w,1);for(let i=0;i<40;i++){c.fillStyle="rgba(60,30,10,.08)";c.fillRect(Math.random()*w,y+Math.random()*16,30+Math.random()*60,1)}}});wood.wrapS=wood.wrapT=THREE.RepeatWrapping;
  const grass=tex(256,256,(c,w,h)=>noise(c,w,h,"#4f7d3a",.12,20000));grass.wrapS=grass.wrapT=THREE.RepeatWrapping;
  const sand=tex(256,256,(c,w,h)=>noise(c,w,h,"#d9c49a",.1,16000));sand.wrapS=sand.wrapT=THREE.RepeatWrapping;
  const stone=tex(256,256,(c,w,h)=>{noise(c,w,h,"#b3a794",.08,9000);c.strokeStyle="rgba(120,110,100,.35)";for(let x=0;x<w;x+=64)for(let y=0;y<h;y+=64)c.strokeRect(x,y,64,64)});stone.wrapS=stone.wrapT=THREE.RepeatWrapping;
  const concrete=tex(256,256,(c,w,h)=>noise(c,w,h,"#8d8a86",.08,14000));concrete.wrapS=concrete.wrapT=THREE.RepeatWrapping;
  const brick=tex(256,256,(c,w,h)=>{c.fillStyle="#b5a79a";c.fillRect(0,0,w,h);for(let y=0;y<h;y+=16)for(let x=(y/16%2)*16;x<w;x+=32){c.fillStyle=`hsl(${10+Math.random()*8},${40+Math.random()*15}%,${36+Math.random()*10}%)`;c.fillRect(x,y,30,14)}});brick.wrapS=brick.wrapT=THREE.RepeatWrapping;
  const sky=(top,bot)=>tex(2,256,(c,w,h)=>{const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,top);g.addColorStop(1,bot);c.fillStyle=g;c.fillRect(0,0,w,h)});
  const screen=tex(256,144,(c,w,h)=>{const g=c.createLinearGradient(0,0,w,h);g.addColorStop(0,"#0b3a52");g.addColorStop(1,"#1f8a9a");c.fillStyle=g;c.fillRect(0,0,w,h);c.fillStyle="rgba(255,255,255,.9)";c.font="bold 22px sans-serif";c.fillText("Welcome",20,60);c.fillStyle="rgba(255,255,255,.6)";c.fillRect(20,80,150,6);c.fillRect(20,96,110,6)});
  const water=tex(256,256,(c,w,h)=>{noise(c,w,h,"#2f8fa8",.08,6000);c.strokeStyle="rgba(255,255,255,.18)";for(let i=0;i<60;i++){c.beginPath();const x=Math.random()*w,y=Math.random()*h;c.moveTo(x,y);c.lineTo(x+20,y);c.stroke()}});water.wrapS=water.wrapT=THREE.RepeatWrapping;
  return cache.t={carpet,wood,grass,sand,stone,concrete,brick,sky,screen,water}}
const M=(p)=>new (T().MeshStandardMaterial)(p);

function palm(g,x,z,h){const THREE=T();const pts=[];for(let i=0;i<=8;i++){const t=i/8;pts.push(new THREE.Vector3(x+Math.sin(t*1.4)*h*.12,t*h,z))}
  const trunk=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),12,.45,6),M({color:0x8b6b4a,roughness:.95}));trunk.castShadow=true;g.add(trunk);
  const top=pts[8];for(let k=0;k<9;k++){const a=k/9*Math.PI*2;const leaf=new THREE.Mesh(new THREE.PlaneGeometry(1.6,9,1,4),M({color:0x2f6b35,side:THREE.DoubleSide,roughness:.8}));
    const pos=leaf.geometry.attributes.position;for(let i=0;i<pos.count;i++){const yy=pos.getY(i);pos.setZ(i,-Math.pow((yy+4.5)/9,2)*3)}leaf.geometry.computeVertexNormals();
    leaf.position.copy(top);leaf.rotation.y=a;leaf.rotation.x=-1.0;leaf.translateY(4);leaf.castShadow=true;g.add(leaf)}}
function stringLights(g,W,L,h){const THREE=T();const mat=new THREE.MeshStandardMaterial({color:0xffe2a8,emissive:0xffb347,emissiveIntensity:1.4});const geo=new THREE.SphereGeometry(.22,8,8);
  for(let s=0;s<4;s++){const z=-L/2+L*(s+.5)/4;for(let i=0;i<=24;i++){const x=-W/2+W*i/24,sag=Math.sin(Math.PI*i/24)*2.5;const b=new THREE.Mesh(geo,mat);b.position.set(x,h-sag,z);g.add(b)}}}

function instanced(geo,mat,list,shadow=true){const THREE=T();const m=new THREE.InstancedMesh(geo,mat,Math.max(1,list.length));const o=new THREE.Object3D();
  list.forEach((p,i)=>{o.position.set(p[0],p[1]||0,p[2]);o.rotation.set(0,p[3]||0,0);o.updateMatrix();m.setMatrixAt(i,o.matrix)});m.count=list.length;m.castShadow=shadow;m.receiveShadow=true;return m}

// furniture layout inside usable rectangle (W x L), front of room is -L/2
function furnish(g,layout,W,L,n,eq,outdoor){const THREE=T();
  const chairMat=M({color:outdoor?0xf3efe6:(eq.dark?0x34373c:0xc9a96a),roughness:.5,metalness:outdoor||eq.dark?0:.4}),cloth=M({color:0xf7f4ee,roughness:.9}),tableMat=M({color:0x6b4a2f,roughness:.6}),dark=M({color:0x262626,roughness:.6});
  const seat=new THREE.BoxGeometry(1.4,.2,1.4);seat.translate(0,1.5,0);const back=new THREE.BoxGeometry(1.4,1.6,.18);back.translate(0,2.4,.62);
  const chairs=[],add=(x,z,r)=>chairs.push([x,0,z,r]);let front=-L/2+3;
  if(eq.stage){const st=new THREE.Mesh(new THREE.BoxGeometry(Math.min(W*.5,28),1.5,8),dark);st.position.set(0,.75,-L/2+4.5);st.castShadow=st.receiveShadow=true;g.add(st);front+=9;
    const lect=new THREE.Mesh(new THREE.BoxGeometry(2,4,1.5),tableMat);lect.position.set(Math.min(W*.18,8),3.5,-L/2+5);lect.castShadow=true;g.add(lect)}
  if(eq.screens||eq.projector){const t=textures();const sw=Math.min(W*.35,20);[-1,1].forEach(s=>{if(!eq.screens&&s>0)return;const sc=new THREE.Mesh(new THREE.PlaneGeometry(sw,sw*.5625),new THREE.MeshStandardMaterial({map:t.screen,emissive:0xffffff,emissiveMap:t.screen,emissiveIntensity:.8}));sc.position.set(eq.screens?s*W*.25:0,outdoor?8:Math.min(14,9+sw*.2),-L/2+.6);g.add(sc)})}
  if(eq.dance_floor){const t=textures();const s=Math.min(W,L)*.3;const df=new THREE.Mesh(new THREE.PlaneGeometry(s,s),M({map:t.wood,roughness:.25,metalness:.1}));t.wood.repeat.set(2,2);df.rotation.x=-Math.PI/2;df.position.set(0,.05,front+s/2+2);df.receiveShadow=true;g.add(df);if(layout==="banquet"||layout==="buffet"||layout==="reception")front+=s+4}
  const usable={x0:-W/2+3,x1:W/2-3,z0:front,z1:L/2-3};
  const tables=[];
  if(layout==="banquet"||layout==="buffet"){const per=layout==="buffet"?8:10,need=Math.ceil(n/per),step=layout==="buffet"?10:11;
    if(layout==="buffet"){const bl=new THREE.Mesh(new THREE.BoxGeometry(Math.min(24,W*.5),2.6,2.6),cloth);bl.position.set(0,1.3,usable.z1-1.5);bl.castShadow=true;g.add(bl);for(let i=0;i<6;i++){const ch=new THREE.Mesh(new THREE.BoxGeometry(1.6,.6,1.2),M({color:0xb8b8b8,metalness:.9,roughness:.2}));ch.position.set(-Math.min(10,W*.2)+i*Math.min(4,W*.08),2.9,usable.z1-1.5);g.add(ch)}usable.z1-=7}
    let k=0;for(let z=usable.z0+5;z<=usable.z1-4&&k<need;z+=step)for(let x=usable.x0+5;x<=usable.x1-4&&k<need;x+=step,k++){tables.push([x,0,z]);for(let c=0;c<per;c++){const a=c/per*Math.PI*2;add(x+Math.cos(a)*4.1,z+Math.sin(a)*4.1,-a-Math.PI/2)}}
    const top=new THREE.CylinderGeometry(3,3.4,2.5,24);top.translate(0,1.25,0);g.add(instanced(top,cloth,tables));
    if(!outdoor){const cp=new THREE.SphereGeometry(.5,8,8);cp.translate(0,2.9,0);g.add(instanced(cp,new THREE.MeshStandardMaterial({color:0xffe9b0,emissive:0xffc766,emissiveIntensity:1.5}),tables,false))}}
  else if(layout==="theater"){let k=0;for(let z=usable.z0+2;z<=usable.z1&&k<n;z+=3.2)for(let x=usable.x0+1;x<=usable.x1-1&&k<n;x+=2.2){if(Math.abs(x)<2.2)continue;add(x,z,Math.PI);k++}}
  else if(layout==="classroom"){let k=0;const tg=[];for(let z=usable.z0+3;z<=usable.z1-1&&k<n;z+=5)for(let x=usable.x0+3;x<=usable.x1-3&&k<n;x+=7){if(Math.abs(x)<2)continue;tg.push([x,0,z]);for(let c=-1;c<=1&&k<n;c++,k++)add(x+c*2,z+1.6,Math.PI)}
    const t=new THREE.BoxGeometry(6,2.5,1.6);t.translate(0,1.25,0);g.add(instanced(t,cloth,tg))}
  else if(layout==="reception"){const hi=[];const need=Math.ceil(n/8);for(let i=0;i<need;i++){hi.push([usable.x0+Math.random()*(usable.x1-usable.x0),0,usable.z0+Math.random()*(usable.z1-usable.z0)])}
    const tg=new THREE.CylinderGeometry(1.4,1.4,.15,16);tg.translate(0,3.6,0);g.add(instanced(tg,cloth,hi));const leg=new THREE.CylinderGeometry(.12,.5,3.6,8);leg.translate(0,1.8,0);g.add(instanced(leg,M({color:0x999999,metalness:.8,roughness:.3}),hi));
    const bar=new THREE.Mesh(new THREE.BoxGeometry(Math.min(16,W*.4),3.5,2.5),tableMat);bar.position.set(-W/2+Math.min(10,W*.25),1.75,usable.z1-1);bar.castShadow=true;g.add(bar)}
  else if(layout==="ushape"){const sideL=Math.min(L*.55,Math.max(10,n*1.2)),span=Math.min(W*.5,18);const tg=[[-span/2,0,front+sideL/2,0],[span/2,0,front+sideL/2,0]];
    const side=new THREE.BoxGeometry(2.5,2.5,sideL);side.translate(0,1.25,0);g.add(instanced(side,cloth,tg));const end=new THREE.Mesh(new THREE.BoxGeometry(span+2.5,2.5,2.5),cloth);end.position.set(0,1.25,front+sideL);g.add(end);
    for(let z=front+1;z<front+sideL;z+=2.4){add(-span/2-2,z,-Math.PI/2);add(span/2+2,z,Math.PI/2)}}
  else{const len=Math.min(L*.6,Math.max(10,n*1.3));const t=new THREE.Mesh(new THREE.BoxGeometry(5,2.5,len),tableMat);t.position.set(0,1.25,0);t.castShadow=t.receiveShadow=true;g.add(t);
    for(let z=-len/2+1.2;z<len/2;z+=2.6){add(-3.6,z,-Math.PI/2);add(3.6,z,Math.PI/2)}}
  const cm=new THREE.Group();cm.add(instanced(seat,chairMat,chairs));cm.add(instanced(back,chairMat,chairs));g.add(cm);
  return {chairs:chairs.length,tables:tables.length}}

function build(v,opts={}){const THREE=T(),t=textures();const scene=new THREE.Scene();
  const W=v.measured.width_ft,L=v.measured.length_ft,H=v.measured.ceiling_ft||0,outdoor=v.setting==="outdoor",type=v.space_type,hall=["grand ballroom","event hall","convention hall","exhibition hall"].includes(type),lawn=type==="great lawn";
  const layout=opts.layout||"banquet",eq=Object.assign({},opts.eq||{}),n=Math.min(opts.guests||Math.round(v.capacity[layout]*.7),v.capacity[layout]);
  if(outdoor){scene.background=t.sky(type==="rooftop"?"#f2a76b":"#7cc4e8",type==="rooftop"?"#ffe1b8":"#e7f4fb");scene.fog=new THREE.Fog(type==="rooftop"?0xffd9b0:0xd8eef7,140,520)}
  else{scene.background=new THREE.Color(0x1c1814)}
  const hemi=new THREE.HemisphereLight(outdoor?0xcfe8ff:0xfff2dd,outdoor?0x6b5a3c:0x3a2f25,outdoor?.5:(hall?.32:.55));scene.add(hemi);
  const sun=new THREE.DirectionalLight(outdoor?(type==="rooftop"?0xffc78a:0xfff4e0):0xfff0d6,outdoor?1.15:.7);sun.position.set(-W*.6,Math.max(W,L)*.9,L*.4);sun.castShadow=true;
  const sz=Math.max(W,L)*.75;Object.assign(sun.shadow.camera,{left:-sz,right:sz,top:sz,bottom:-sz,near:1,far:Math.max(W,L)*4});sun.shadow.mapSize.set(1024,1024);sun.shadow.bias=-.0005;scene.add(sun);
  const g=new THREE.Group();scene.add(g);
  // ground / floor
  let floorTex=t.carpet,rep=W/12;if(outdoor)floorTex=(type==="garden"||lawn)?t.grass:type==="beach deck"?t.wood:type==="courtyard"?t.stone:type==="pool deck"?t.stone:type==="rooftop"?t.wood:t.stone;
  else if(type==="loft")floorTex=t.concrete;else if(type==="meeting room"||type==="boardroom")floorTex=t.carpet;
  const ft=floorTex.clone();ft.needsUpdate=true;ft.repeat.set(W/12,L/12);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(W,L),M({map:ft,roughness:.9,color:hall?0x9a8a7c:0xffffff}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;g.add(floor);
  if(outdoor){const out=new THREE.Mesh(new THREE.PlaneGeometry(2000,2000),M({color:(type==="garden"||lawn)?0x3f6a2c:0xa8916a,roughness:1}));out.rotation.x=-Math.PI/2;out.position.y=-.05;out.receiveShadow=true;g.add(out);
    if(v.amenities.includes("ocean_view")||type==="beach deck"||type==="terrace"){const sea=new THREE.Mesh(new THREE.PlaneGeometry(2000,900),M({map:t.water,color:0x5fb6c9,roughness:.15,metalness:.3}));t.water.repeat.set(40,18);sea.rotation.x=-Math.PI/2;sea.position.set(0,-.02,-L/2-460);g.add(sea);
      const beach=new THREE.Mesh(new THREE.PlaneGeometry(2000,30),M({map:t.sand,roughness:1}));t.sand.repeat.set(80,1);beach.rotation.x=-Math.PI/2;beach.position.set(0,0,-L/2-12);g.add(beach)}
    if(type==="rooftop"){const rail=new THREE.Mesh(new THREE.BoxGeometry(W,3.5,.2),new THREE.MeshPhysicalMaterial({color:0xbfe3ee,transparent:true,opacity:.35,roughness:.05}));rail.position.set(0,1.75,-L/2);g.add(rail);
      for(let i=0;i<14;i++){const h=60+Math.random()*160,bw=20+Math.random()*30;const b=new THREE.Mesh(new THREE.BoxGeometry(bw,h,bw),M({color:new THREE.Color().setHSL(.6,.12,.3+Math.random()*.15),roughness:.4,metalness:.5,emissive:0x1a2a3a,emissiveIntensity:.4}));b.position.set(-260+i*40,h/2-120,-L/2-220-Math.random()*160);g.add(b)}}
    if(type==="pool deck"){const pool=new THREE.Mesh(new THREE.BoxGeometry(W*.35,.2,L*.3),M({map:t.water,color:0x7fd6e6,roughness:.05,metalness:.2,emissive:0x0a3d4a,emissiveIntensity:.3}));pool.position.set(W/2+W*.22+4,.05,0);g.add(pool)}
    const trees=(type==="garden"||lawn)?12:6;for(let i=0;i<trees;i++){const side=i%2?1:-1;const x=side*(W/2+4+Math.random()*10),z=-L/2+(i/trees)*L+Math.random()*4;
      if(type==="garden"||lawn){const tr=new THREE.Mesh(new THREE.SphereGeometry(6+Math.random()*3,12,10),M({color:0x3d6b2f,roughness:.9}));tr.position.set(x,12,z);tr.castShadow=true;g.add(tr);const tk=new THREE.Mesh(new THREE.CylinderGeometry(.6,.9,9,8),M({color:0x6b4f37}));tk.position.set(x,4.5,z);g.add(tk)}
      else palm(g,x,z,22+Math.random()*10)}
    if(type==="courtyard"||type==="terrace"){const beamM=M({color:0xe8e0d2,roughness:.8});for(const sx of [-1,1])for(let i=0;i<=3;i++){const p=new THREE.Mesh(new THREE.BoxGeometry(1,11,1),beamM);p.position.set(sx*(W/2-1),5.5,-L/2+L*i/3);p.castShadow=true;g.add(p)}
      for(let i=0;i<=8;i++){const b=new THREE.Mesh(new THREE.BoxGeometry(W,.6,.6),beamM);b.position.set(0,11,-L/2+L*i/8);b.castShadow=true;g.add(b)}}
    if(type!=="courtyard"||v.amenities.includes("dance_floor"))stringLights(g,W,L,13)}
  else{const wallM=M({map:type==="loft"?t.brick:null,color:type==="loft"?0xffffff:(hall?0x3d3b40:(type==="ballroom"?0xe9dfcf:0xe6e2db)),roughness:.85});if(type==="loft"){t.brick.repeat.set(W/10,H/6)}
    const ceil=new THREE.Mesh(new THREE.PlaneGeometry(W,L),M({color:type==="loft"?0x3a3a3a:(hall?0x17171c:0xf3eee6),roughness:.9}));ceil.rotation.x=Math.PI/2;ceil.position.y=H;g.add(ceil);
    const walls=[[0,H/2,-L/2,0,W],[0,H/2,L/2,Math.PI,W],[-W/2,H/2,0,Math.PI/2,L],[W/2,H/2,0,-Math.PI/2,L]];
    walls.forEach(([x,y,z,r,w],i)=>{const wm=new THREE.Mesh(new THREE.PlaneGeometry(w,H),wallM);wm.position.set(x,y,z);wm.rotation.y=r;wm.receiveShadow=true;g.add(wm);
      if((v.amenities.includes("natural_light")||v.amenities.includes("ocean_view")||type==="loft")&&i===2){const n=Math.max(2,Math.floor(L/18));for(let k=0;k<n;k++){const win=new THREE.Mesh(new THREE.PlaneGeometry(L/n*.6,H*.62),new THREE.MeshStandardMaterial({color:v.amenities.includes("ocean_view")?0x9fd6e2:0xdcefff,emissive:v.amenities.includes("ocean_view")?0x6fbfd2:0xcfe6ff,emissiveIntensity:.9}));win.position.set(x+.05,H*.5,-L/2+L*(k+.5)/n);win.rotation.y=r;g.add(win)}}});
    if(hall){const ring=new THREE.MeshStandardMaterial({color:0xffffff,emissive:0xfff3e0,emissiveIntensity:2.2});for(let i=0;i<4;i++){const tr=new THREE.Mesh(new THREE.TorusGeometry(6-i*.9,.18,8,48),ring);tr.rotation.x=Math.PI/2;tr.position.set((i%2?3:-2),H-2-i*1.6,-L*.05+i*3);g.add(tr)}
      const can=new THREE.MeshStandardMaterial({color:0xffffff,emissive:0xfff1d0,emissiveIntensity:2});for(let x=-W/2+8;x<W/2;x+=16)for(let z=-L/2+10;z<L/2;z+=18){const d=new THREE.Mesh(new THREE.CylinderGeometry(.6,.6,.2,12),can);d.position.set(x,H-.1,z);g.add(d)}
      for(const sx of [-1,1])for(let z=-L/2+12;z<L/2;z+=22){const col=new THREE.Mesh(new THREE.BoxGeometry(3,H,3),M({color:0x8c8780,roughness:.8}));col.position.set(sx*(W/2-1.5),H/2,z);g.add(col);const sc=new THREE.Mesh(new THREE.BoxGeometry(.8,2.5,.4),new THREE.MeshStandardMaterial({color:0xffe2b0,emissive:0xffc070,emissiveIntensity:1.5}));sc.position.set(sx*(W/2-3.1),H*.45,z);g.add(sc)}
      const pl=new THREE.PointLight(0xffe6c4,.9,Math.max(W,L)*1.4,1.3);pl.position.set(0,H-3,0);scene.add(pl);const pl2=new THREE.PointLight(0xffe6c4,.6,Math.max(W,L),1.3);pl2.position.set(0,H-3,L/3);scene.add(pl2)}
    else if(type==="ballroom"||type==="banquet hall"){const cm=new THREE.MeshStandardMaterial({color:0xfff6dc,emissive:0xffd98a,emissiveIntensity:1.6,metalness:.6,roughness:.2});const cols=Math.max(1,Math.round(W/35)),rows=Math.max(1,Math.round(L/35));
      for(let i=0;i<cols;i++)for(let j=0;j<rows;j++){const ch=new THREE.Group();const x=-W/2+W*(i+.5)/cols,z=-L/2+L*(j+.5)/rows;for(let k=0;k<10;k++){const a=k/10*Math.PI*2;const d=new THREE.Mesh(new THREE.SphereGeometry(.35,8,8),cm);d.position.set(Math.cos(a)*2.2,-.4*(k%2),Math.sin(a)*2.2);ch.add(d)}
        const core=new THREE.Mesh(new THREE.SphereGeometry(1.1,12,12),cm);ch.add(core);ch.position.set(x,H-3,z);g.add(ch);const pl=new THREE.PointLight(0xffd59a,.55,Math.max(W,L)*.9,1.5);pl.position.set(x,H-4,z);scene.add(pl)}}
    else{const pl=new THREE.PointLight(0xfff1dd,.6,Math.max(W,L)*1.6,1.2);pl.position.set(0,H-1,0);scene.add(pl);const pl2=new THREE.PointLight(0xfff1dd,.35,Math.max(W,L)*1.6,1.2);pl2.position.set(0,H-1,-L/3);scene.add(pl2)}}
  if(hall)eq.dark=true;
  const counts=furnish(g,layout,W,L,n,eq,outdoor);
  if(hall&&eq.stage){const sw=Math.min(W*.5,28),tm=M({color:0xbfc3c8,metalness:.9,roughness:.3});const z=-L/2+4.5,th=Math.min(H-3,18);
    for(const sx of [-1,1]){const post=new THREE.Mesh(new THREE.BoxGeometry(1,th,1),tm);post.position.set(sx*(sw/2+1),th/2,z);g.add(post)}
    const beam=new THREE.Mesh(new THREE.BoxGeometry(sw+3,1,1),tm);beam.position.set(0,th,z);g.add(beam);
    const cols=[0x3a6bff,0x8a3cff,0x2fd0ff,0xff4fa0];for(let i=0;i<8;i++){const c=cols[i%4];const head=new THREE.Mesh(new THREE.ConeGeometry(.9,1.6,10),new THREE.MeshStandardMaterial({color:c,emissive:c,emissiveIntensity:2.5}));head.position.set(-sw/2+i*(sw/7),th-1.2,z+.5);head.rotation.x=Math.PI;g.add(head);
      const sp=new THREE.SpotLight(c,.9,th*3,.35,.6,1);sp.position.copy(head.position);sp.target.position.set(head.position.x*.5,1.5,z+2);scene.add(sp);scene.add(sp.target)}
    const led=new THREE.Mesh(new THREE.PlaneGeometry(sw*.55,sw*.3),new THREE.MeshStandardMaterial({color:0x0a1430,emissive:0x1b2e7a,emissiveIntensity:.9}));led.position.set(0,1.5+sw*.15+1,-L/2+.6);g.add(led)}
  const cam=new THREE.PerspectiveCamera(outdoor?50:(W*L<1500?72:60),16/10,.5,3000);const back=Math.max(W,L);
  if(outdoor)cam.position.set(W*.35,Math.max(14,back*.28),L/2+back*.25);else if(hall)cam.position.set(0,H*.72,L/2-2);else cam.position.set(W*.42,Math.min(H*.85,Math.max(7,H-1.5)),L/2-1);
  cam.lookAt(0,outdoor?3:(hall?6:H*.25),hall?-L*.3:-L*.15);
  return {scene,camera:cam,target:new THREE.Vector3(0,outdoor?3:H*.25,-L*.15),guests:n,counts}}

let thumbR=null;
function renderer(canvas,w,h){const THREE=T();const r=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:!!canvas});r.setPixelRatio(Math.min(2,window.devicePixelRatio||1));r.setSize(w,h,false);
  r.outputEncoding=THREE.sRGBEncoding;r.toneMapping=THREE.ACESFilmicToneMapping;r.toneMappingExposure=.95;r.shadowMap.enabled=true;r.shadowMap.type=THREE.PCFSoftShadowMap;r.physicallyCorrectLights=false;return r}
function thumbnail(v,opts){if(!window.THREE)return null;if(!thumbR){const c=document.createElement("canvas");thumbR=renderer(c,480,300)}
  const {scene,camera}=build(v,opts);thumbR.render(scene,camera);const url=thumbR.domElement.toDataURL("image/jpeg",.82);
  scene.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material&&o.material.dispose&&!o.material.map)o.material.dispose()});return url}
function viewer(canvas,v,opts){const THREE=T();const r=renderer(canvas,canvas.clientWidth||800,canvas.clientHeight||500);let s=build(v,opts);let ctl=null;
  if(THREE.OrbitControls){ctl=new THREE.OrbitControls(s.camera,canvas);ctl.target.copy(s.target);ctl.enableDamping=true;ctl.maxPolarAngle=Math.PI*.49;ctl.minDistance=6;ctl.maxDistance=Math.max(v.measured.width_ft,v.measured.length_ft)*2.2;ctl.update()}
  let alive=true,raf=0;const loop=()=>{if(!alive)return;ctl&&ctl.update();r.render(s.scene,s.camera);raf=requestAnimationFrame(loop)};loop();
  const ro=new ResizeObserver(()=>{const w=canvas.clientWidth,h=canvas.clientHeight;if(w&&h){r.setSize(w,h,false);s.camera.aspect=w/h;s.camera.updateProjectionMatrix()}});ro.observe(canvas);
  return {update(o){const cam=s.camera.position.clone(),tg=ctl?ctl.target.clone():null;s.scene.traverse(x=>{x.geometry&&x.geometry.dispose()});s=build(v,o);s.camera.aspect=(canvas.clientWidth||16)/(canvas.clientHeight||10);s.camera.updateProjectionMatrix();if(ctl){ctl.object=s.camera;s.camera.position.copy(cam);ctl.target.copy(tg);ctl.update()}return s},
    dispose(){alive=false;cancelAnimationFrame(raf);ro.disconnect();ctl&&ctl.dispose();r.dispose();s.scene.traverse(x=>{x.geometry&&x.geometry.dispose()})},get info(){return s}}}
window.BVScene={build,thumbnail,viewer};
})();
