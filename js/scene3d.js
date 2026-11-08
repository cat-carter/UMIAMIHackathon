/* BreezeBook 3D engine: builds a to-scale room for each venue from its measurements
   and shows it as a draggable 360° view. Uses three.js r128 (UMD build, loaded on demand from cdnjs).
   Units are feet: x runs along the room's length (stage/screens at +x), z along its width, y is up.
   Loaded before js/app.js; exposes window.BB3D. */
window.BB3D = (() => {
'use strict';
const reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

let threeP = null;
function loadThree() {
  if (window.THREE) return Promise.resolve(window.THREE);
  if (!threeP) threeP = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
    s.onload = () => window.THREE ? res(window.THREE) : rej(new Error('no THREE'));
    s.onerror = () => rej(new Error('load failed'));
    document.head.append(s);
  });
  return threeP;
}
function webglOK() { try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl'))); } catch (e) { return false; } }

function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
function hashStr(t) { let x = 2166136261; for (let i = 0; i < t.length; i++) x = Math.imul(x ^ t.charCodeAt(i), 16777619); return x >>> 0; }
function shade(hex, amt) { const c = parseInt(hex.slice(1), 16); let r = c >> 16, g = (c >> 8) & 255, b = c & 255; const t = amt < 0 ? 0 : 255, p = Math.abs(amt); r = Math.round((t - r) * p + r); g = Math.round((t - g) * p + g); b = Math.round((t - b) * p + b); return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1); }
function cnv(w, hh, draw) { const c = document.createElement('canvas'); c.width = w; c.height = hh; draw(c.getContext('2d'), w, hh); return c; }

function buildScene(v, layout, guests) {
  const THREE = window.THREE;
  const S = v.scene, L = v.dims.l, W = v.dims.w, H = v.dims.h || 14;
  if (S.tour === 'grand') return buildGrand(v, layout, guests);
  const R = rng(hashStr(v.id));
  const scene = new THREE.Scene();
  const disposables = [];
  const keep = o => { disposables.push(o); return o; };
  const T = (canvas, rx = 1, ry = 1) => { const t = keep(new THREE.CanvasTexture(canvas)); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = 4; return t; };
  const lam = (opts) => keep(new THREE.MeshLambertMaterial(opts));
  const bas = (opts) => keep(new THREE.MeshBasicMaterial(opts));
  const G = g => keep(g);
  const mesh = (g, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); scene.add(o); return o; };
  const outdoor = S.kind !== 'indoor';

  /* light */
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7a66, outdoor ? 0.75 : 0.62));
  scene.add(new THREE.AmbientLight(0xffffff, outdoor ? 0.3 : 0.42));
  const sun = new THREE.DirectionalLight(outdoor ? 0xffd9b0 : 0xfff1dc, outdoor ? 0.55 : 0.3);
  sun.position.set(outdoor ? 120 : -30, outdoor ? 60 : 80, outdoor ? -60 : 40); scene.add(sun);

  /* floor textures */
  const floorCanvas = {
    carpet: () => cnv(128, 128, (g, w, hh) => { g.fillStyle = S.carpet[0]; g.fillRect(0, 0, w, hh); g.strokeStyle = S.carpet[1]; g.globalAlpha = .38; g.lineWidth = 2; g.beginPath(); for (let i = -w; i <= w * 2; i += 64) { g.moveTo(i, 0); g.lineTo(i + hh, hh); g.moveTo(i, 0); g.lineTo(i - hh, hh); } g.stroke(); g.globalAlpha = 1; g.fillStyle = S.carpet[1]; for (let x = 0; x <= w; x += 64) for (let y = 0; y <= hh; y += 64) { g.beginPath(); g.arc(x, y, 6, 0, 7); g.fill(); } }),
    wood: () => cnv(256, 256, (g, w, hh) => { const base = S.wood || '#B98C62'; for (let x = 0; x < w; x += 32) { const rr = rng(x + 7); g.fillStyle = shade(base, (rr() - .5) * .18); g.fillRect(x, 0, 32, hh); const y = Math.floor(rr() * hh); g.fillStyle = shade(base, -.25); g.fillRect(x, y, 32, 2); g.fillRect(x, 0, 1.5, hh); } }),
    concrete: () => cnv(256, 256, (g, w, hh) => { g.fillStyle = '#8E8F92'; g.fillRect(0, 0, w, hh); const rr = rng(4); for (let i = 0; i < 2600; i++) { g.fillStyle = rr() < .5 ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.08)'; g.fillRect(rr() * w, rr() * hh, 2, 2); } g.strokeStyle = 'rgba(0,0,0,.18)'; g.strokeRect(0, 0, w, hh); }),
    grass: () => cnv(256, 256, (g, w, hh) => { g.fillStyle = '#5E8E3E'; g.fillRect(0, 0, w, hh); const rr = rng(9); for (let i = 0; i < 4000; i++) { g.fillStyle = `hsl(${95 + rr() * 20},${35 + rr() * 20}%,${28 + rr() * 18}%)`; g.fillRect(rr() * w, rr() * hh, 1.5, 4); } }),
    stone: () => cnv(128, 128, (g, w, hh) => { const rr = rng(3); for (let x = 0; x < w; x += 64) for (let y = 0; y < hh; y += 64) { g.fillStyle = shade('#E0CCA6', (rr() - .5) * .14); g.fillRect(x, y, 64, 64); } g.strokeStyle = '#BFA77E'; g.lineWidth = 3; for (let x = 0; x <= w; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, hh); g.stroke(); } for (let y = 0; y <= hh; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); } }),
    deck: () => cnv(256, 256, (g, w, hh) => { for (let y = 0; y < hh; y += 16) { const rr = rng(y + 3); g.fillStyle = shade('#A8774E', (rr() - .5) * .2); g.fillRect(0, y, w, 16); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, y, w, 1.5); g.fillRect(Math.floor(rr() * w), y, 2, 16); } })
  };
  const floorRepeat = { carpet: 8, wood: 8, concrete: 20, grass: 10, stone: 4, deck: 8 };
  const fk = S.floor;
  const fr = floorRepeat[fk];
  const floorMat = lam({ map: T(floorCanvas[fk](), L / fr, W / fr) });
  const floor = mesh(G(new THREE.PlaneGeometry(L, W)), floorMat); floor.rotation.x = -Math.PI / 2;

  /* sky (outdoor) */
  if (outdoor) {
    const sky = cnv(4, 512, (g, w, hh) => { const gr = g.createLinearGradient(0, 0, 0, hh); gr.addColorStop(0, '#24578F'); gr.addColorStop(.3, '#5F86BE'); gr.addColorStop(.44, '#E9A06E'); gr.addColorStop(.5, '#FFD6A2'); gr.addColorStop(.52, '#F2C89A'); gr.addColorStop(1, '#B9A27E'); g.fillStyle = gr; g.fillRect(0, 0, w, hh); });
    const st = keep(new THREE.CanvasTexture(sky));
    const dome = mesh(G(new THREE.SphereGeometry(1500, 32, 16)), bas({ map: st, side: THREE.BackSide, fog: false }));
    dome.position.y = S.kind === 'rooftop' ? -40 : 0;
    scene.fog = new THREE.Fog(0xf2c89a, 500, 1500);
  }
  const water = (y, x0, w2, d2, z0 = 0) => { const m = mesh(G(new THREE.PlaneGeometry(w2, d2)), lam({ color: 0x1F6E9E })); m.rotation.x = -Math.PI / 2; m.position.set(x0, y, z0); return m; };

  /* palms */
  const trunkMat = lam({ color: 0x8A6A4A }), frondMat = lam({ color: 0x3E7D3A, side: THREE.DoubleSide });
  const frondGeo = G(new THREE.PlaneGeometry(2.2, 11)); frondGeo.translate(0, 5.5, 0);
  const trunkGeo = G(new THREE.CylinderGeometry(0.45, 0.8, 1, 7)); trunkGeo.translate(0, .5, 0);
  function palm(x, z, ht) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.z = (R() - .5) * .18; g.rotation.x = (R() - .5) * .18;
    const t = new THREE.Mesh(trunkGeo, trunkMat); t.scale.y = ht; g.add(t);
    for (let i = 0; i < 9; i++) { const p = new THREE.Group(); p.position.y = ht; p.rotation.y = i / 9 * Math.PI * 2 + R() * .3; const f = new THREE.Mesh(frondGeo, frondMat); f.rotation.x = 1.7 + R() * .35; p.add(f); g.add(p); }
    scene.add(g);
  }
  /* string lights */
  const bulbPos = [];
  function strand(x1, z1, x2, z2, y, sag) {
    const pts = [];
    for (let i = 0; i <= 24; i++) { const t = i / 24; const x = x1 + (x2 - x1) * t, z = z1 + (z2 - z1) * t, yy = y - sag * 4 * t * (1 - t); pts.push(new THREE.Vector3(x, yy, z)); if (i % 2 === 0) bulbPos.push([x, yy - .25, z]); }
    const lg = G(new THREE.BufferGeometry().setFromPoints(pts));
    scene.add(new THREE.Line(lg, keep(new THREE.LineBasicMaterial({ color: 0x2c2c2c }))));
  }
  const pole = (x, z, ht) => mesh(G(new THREE.CylinderGeometry(.2, .25, ht, 6)), lam({ color: 0x3a3a3a }), x, ht / 2, z);

  /* indoor shell */
  const wallCanvas = (type, color) => {
    if (type === 'mural') return cnv(1024, 256, (g, w, hh) => { g.fillStyle = color; g.fillRect(0, 0, w, hh); const rr = rng(11); const pal = ['#FF5D8F', '#FFC145', '#3FB8C0', '#7B61FF', '#FF8A3D', '#2EC4B6', '#F7F7F7']; for (let i = 0; i < 26; i++) { g.fillStyle = pal[Math.floor(rr() * pal.length)]; g.globalAlpha = .9; g.beginPath(); const x = rr() * w, y = rr() * hh, r = 20 + rr() * 70; if (rr() < .5) g.arc(x, y, r, 0, 7); else { g.moveTo(x, y); g.quadraticCurveTo(x + r, y - r, x + r * 2, y); g.quadraticCurveTo(x + r, y + r * .6, x, y); } g.fill(); } g.globalAlpha = 1; g.lineWidth = 8; for (let i = 0; i < 8; i++) { g.strokeStyle = pal[Math.floor(rr() * pal.length)]; g.beginPath(); g.moveTo(rr() * w, rr() * hh); g.bezierCurveTo(rr() * w, rr() * hh, rr() * w, rr() * hh, rr() * w, rr() * hh); g.stroke(); } g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, hh - 30, w, 30); });
    if (type === 'books') return cnv(512, 256, (g, w, hh) => { g.fillStyle = color; g.fillRect(0, 0, w, hh); const rr = rng(5); for (let y = 16; y < hh - 40; y += 40) { g.fillStyle = shade(color, -.3); g.fillRect(0, y + 32, w, 6); for (let x = 6; x < w - 6;) { const bw = 5 + rr() * 7; g.fillStyle = `hsl(${rr() * 360},${30 + rr() * 30}%,${25 + rr() * 30}%)`; g.fillRect(x, y + 4 + rr() * 6, bw, 28); x += bw + 1; } } g.fillStyle = shade(color, -.15); g.fillRect(0, hh - 40, w, 40); });
    return cnv(512, 256, (g, w, hh) => { g.fillStyle = color; g.fillRect(0, 0, w, hh); if (type === 'panel') { g.fillStyle = shade(color, -.06); g.fillRect(0, hh * .68, w, hh * .32); g.strokeStyle = shade(color, -.14); g.lineWidth = 3; for (let x = 0; x < w; x += 128) { g.strokeRect(x + 14, hh * .72, 100, hh * .22); g.strokeRect(x + 14, 22, 100, hh * .58); } g.fillStyle = shade(color, .25); for (let x = 0; x < w; x += 256) g.fillRect(x, 0, 10, hh); } g.fillStyle = shade(color, -.18); g.fillRect(0, hh - 6, w, 6); });
  };
  const viewCanvas = (view, widthFt) => cnv(1024, 256, (g, w, hh) => {
    const sky = g.createLinearGradient(0, 0, 0, hh * .55); sky.addColorStop(0, '#7FBDE6'); sky.addColorStop(1, '#DFF1FA'); g.fillStyle = sky; g.fillRect(0, 0, w, hh);
    const rr = rng(21);
    g.fillStyle = 'rgba(255,255,255,.8)'; for (let i = 0; i < 6; i++) { const x = rr() * w, y = 20 + rr() * 60; g.beginPath(); g.ellipse(x, y, 40 + rr() * 50, 10 + rr() * 8, 0, 0, 7); g.fill(); }
    if (view === 'ocean') { const sea = g.createLinearGradient(0, hh * .55, 0, hh); sea.addColorStop(0, '#1D78AD'); sea.addColorStop(1, '#3DA9C9'); g.fillStyle = sea; g.fillRect(0, hh * .55, w, hh * .45); g.fillStyle = 'rgba(255,255,255,.5)'; for (let i = 0; i < 40; i++) g.fillRect(rr() * w, hh * .58 + rr() * hh * .4, 10 + rr() * 20, 2); g.fillStyle = '#F4E6C8'; g.fillRect(0, hh * .9, w, hh * .1); }
    else { g.fillStyle = '#4E7F3E'; g.fillRect(0, hh * .55, w, hh * .45); for (let i = 0; i < 14; i++) { g.fillStyle = `hsl(${100 + rr() * 30},40%,${25 + rr() * 15}%)`; g.beginPath(); g.arc(rr() * w, hh * .55, 30 + rr() * 50, 0, 7); g.fill(); } }
    const n = Math.max(2, Math.round(widthFt / 5)); g.fillStyle = '#F2F2F0'; for (let i = 0; i <= n; i++) g.fillRect(i * w / n - 4, 0, 8, hh); g.fillRect(0, 0, w, 6); g.fillRect(0, hh - 6, w, 6);
  });
  if (!outdoor) {
    const wallMat = (len, type) => lam({ map: T(wallCanvas(type, S.wall), type === 'mural' ? len / 40 : len / 16, 1) });
    const wt = S.wallType || 'plain';
    const walls = [
      { len: L, x: 0, z: -W / 2, ry: 0, type: wt }, { len: L, x: 0, z: W / 2, ry: Math.PI, type: wt === 'books' ? 'panel' : wt },
      { len: W, x: -L / 2, z: 0, ry: Math.PI / 2, type: wt === 'books' ? 'panel' : wt }, { len: W, x: L / 2, z: 0, ry: -Math.PI / 2, type: wt === 'mural' ? 'plain' : (wt === 'books' ? 'panel' : wt) }
    ];
    for (const w of walls) { const m = mesh(G(new THREE.PlaneGeometry(w.len, H)), wallMat(w.len, w.type), w.x, H / 2, w.z); m.rotation.y = w.ry; }
    const ceil = mesh(G(new THREE.PlaneGeometry(L, W)), bas({ color: new THREE.Color(shade(S.ceiling, -.1)) }), 0, H, 0); ceil.rotation.x = Math.PI / 2;
    if (S.windows) {
      const ww = Math.min(S.windows.width, L - 4);
      const win = mesh(G(new THREE.PlaneGeometry(ww, H - 2.4)), bas({ map: T(viewCanvas(S.windows.view, ww)) }), 0, H / 2 + .2, -W / 2 + .06);
      win.material.map.wrapS = THREE.ClampToEdgeWrapping;
    }
    if (S.chandeliers) {
      const n = S.chandeliers, rows = n >= 4 ? 2 : 1, per = Math.ceil(n / rows), k = Math.min(1, Math.max(.42, (H - 7) / 11));
      const crystal = bas({ color: 0xFFF2D2 }), ring = lam({ color: 0xC9A45C, emissive: 0x3a2a10 });
      const cg = G(new THREE.SphereGeometry(1.7, 16, 12)), rg = G(new THREE.TorusGeometry(2.8, .16, 6, 28)), rod = G(new THREE.CylinderGeometry(.06, .06, 2.5, 4));
      for (let r = 0; r < rows; r++) for (let i = 0; i < per && r * per + i < n; i++) {
        const x = -L / 2 + L * (i + .5) / per * .9 + L * .05, z = rows === 1 ? 0 : (r === 0 ? -W / 4 : W / 4);
        const cy = H - 1.2 - 3.2 * k;
        const c = mesh(cg, crystal, x, cy, z); c.scale.set(k, 1.35 * k, k);
        const ri = mesh(rg, ring, x, cy + .2 * k, z); ri.rotation.x = Math.PI / 2; ri.scale.set(k, k, k);
        const rd = mesh(rod, ring, x, H - (H - cy) / 2, z); rd.scale.y = (H - cy) / 2.5;
      }
    }
    if (S.pendants) { const pg = G(new THREE.CylinderGeometry(.9, .9, .9, 16)), pm = bas({ color: 0xFFF4DD }); for (let x = -L / 2 + 8; x < L / 2 - 4; x += 12) for (const z of [-W / 4, W / 4]) mesh(pg, pm, x, H - 2.2, z); }
    if (S.coves) { const cm = bas({ color: new THREE.Color(S.accent) }); const sg = G(new THREE.BoxGeometry(L - 6, .3, .3)), sg2 = G(new THREE.BoxGeometry(.3, .3, W - 6)); mesh(sg, cm, 0, H - .6, -W / 2 + 3); mesh(sg, cm, 0, H - .6, W / 2 - 3); mesh(sg2, cm, -L / 2 + 3, H - .6, 0); mesh(sg2, cm, L / 2 - 3, H - .6, 0); }
    if (S.trusses) { const tm = lam({ color: 0x1b1b1e }); const tg = G(new THREE.BoxGeometry(1.2, 1.6, W)); for (let x = -L / 2 + 10; x < L / 2; x += 13) { mesh(tg, tm, x, H - 1.6, 0); for (let z = -W / 2 + 4; z < W / 2 - 2; z += 4) bulbPos.push([x + (R() - .5), H - 6 - R() * 3, z]); } }
    if (S.neon) { const nm = bas({ color: 0xFF5D8F }); const ng = G(new THREE.TorusGeometry(5, .25, 6, 40, Math.PI)); const n1 = mesh(ng, nm, -L / 2 + 0.3, 11, -6); n1.rotation.y = Math.PI / 2; const n2 = mesh(ng, bas({ color: 0x3FB8C0 }), -L / 2 + 0.3, 11, 6); n2.rotation.y = Math.PI / 2; n2.rotation.x = Math.PI; }
    if (S.fireplace) { const fm = lam({ color: 0x3a2a20 }); mesh(G(new THREE.BoxGeometry(8, 5, 1.6)), fm, -6, 2.5, W / 2 - .8); mesh(G(new THREE.PlaneGeometry(4, 2.4)), bas({ color: 0xFF8A3D }), -6, 1.6, W / 2 - 1.62).rotation.y = Math.PI; mesh(G(new THREE.BoxGeometry(9.5, .5, 2)), lam({ color: 0xE8DCC8 }), -6, 5.2, W / 2 - .9); }
  }

  /* stage, screens, dance floor */
  let stageFront = L / 2 - 4;
  if (S.stage) {
    const st = S.stage;
    mesh(G(new THREE.BoxGeometry(st.d, st.h, st.w)), lam({ color: new THREE.Color(S.stagecolor || '#2A2C33') }), L / 2 - st.d / 2 - (outdoor ? 6 : 1), st.h / 2, 0);
    stageFront = L / 2 - st.d - (outdoor ? 6 : 1) - 3;
  }
  if (S.screens && !outdoor) {
    const sc = cnv(512, 288, (g, w, hh) => { const gr = g.createLinearGradient(0, 0, w, hh); gr.addColorStop(0, '#1A3328'); gr.addColorStop(1, '#89ABBD'); g.fillStyle = gr; g.fillRect(0, 0, w, hh); g.fillStyle = 'rgba(255,255,255,.95)'; g.font = '400 54px Bellefair, "Times New Roman", serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('Welcome', w / 2, hh / 2 - 12); g.font = '500 18px Montserrat, Avenir, sans-serif'; g.fillStyle = 'rgba(255,255,255,.75)'; g.fillText(`${v.space} · ${v.hotel}`, w / 2, hh / 2 + 34); });
    const smat = bas({ map: T(sc) });
    const n = S.screens.length;
    S.screens.forEach((s2, i) => {
      const z = n === 1 ? 0 : (i - (n - 1) / 2) * (W / n);
      const y0 = (S.stage ? S.stage.h : 0) + 4 + s2.h / 2;
      mesh(G(new THREE.BoxGeometry(.4, s2.h + .6, s2.w + .6)), lam({ color: 0x111111 }), L / 2 - .3, y0, z);
      const m = mesh(G(new THREE.PlaneGeometry(s2.w, s2.h)), smat, L / 2 - .52, y0, z); m.rotation.y = -Math.PI / 2;
    });
  }
  const showDance = S.dance && (layout === 'banquet' || layout === 'reception');
  let danceRect = null;
  if (showDance) {
    const d = S.dance, cx = stageFront - d.d / 2 - 1;
    danceRect = { x0: cx - d.d / 2, x1: cx + d.d / 2, z0: -d.w / 2, z1: d.w / 2 };
    if (S.danceType !== 'concrete') {
      const dc = cnv(256, 256, (g, w, hh) => { for (let x = 0; x < w; x += 64) for (let y = 0; y < hh; y += 64) { const alt = ((x + y) / 64) % 2; g.fillStyle = alt ? '#D9B98B' : '#C49A68'; g.fillRect(x, y, 64, 64); g.strokeStyle = 'rgba(0,0,0,.15)'; for (let k = 0; k < 64; k += 13) { g.beginPath(); if (alt) { g.moveTo(x + k, y); g.lineTo(x + k, y + 64); } else { g.moveTo(x, y + k); g.lineTo(x + 64, y + k); } g.stroke(); } } });
      const df = mesh(G(new THREE.PlaneGeometry(d.d, d.w)), lam({ map: T(dc, d.d / 8, d.w / 8) }), cx, .04, 0); df.rotation.x = -Math.PI / 2;
    }
  }

  /* outdoor surroundings */
  const excl = [];
  if (danceRect) excl.push(danceRect);
  if (S.kind === 'lawn') {
    const sx1 = L / 2 + 90, sw = sx1 + 1500;
    const sand = mesh(G(new THREE.PlaneGeometry(sw, 3000)), lam({ color: 0xE6D2A8 }), sx1 - sw / 2, -.08, 0); sand.rotation.x = -Math.PI / 2;
    water(-.6, sx1 + 1000, 2000, 3000);
    for (let x = -L / 2; x <= L / 2; x += 20) { palm(x, -W / 2 - 6, 22 + R() * 10); palm(x + 8, W / 2 + 6, 22 + R() * 10); }
    for (let z = -W / 2; z <= W / 2; z += 18) palm(-L / 2 - 8, z, 20 + R() * 8);
    for (let x = -L / 2 + 10; x <= L / 2 - 10; x += 16) { pole(x, -W / 2 - 1, 14); pole(x, W / 2 + 1, 14); strand(x, -W / 2 - 1, x, W / 2 + 1, 14, 3); }
  }
  if (S.kind === 'rooftop') {
    const rail = lam({ color: 0xBFE6F5, transparent: true, opacity: .28 });
    const rg = G(new THREE.PlaneGeometry(L, 3.5)), rg2 = G(new THREE.PlaneGeometry(W, 3.5));
    mesh(rg, rail, 0, 1.75, -W / 2); mesh(rg, rail, 0, 1.75, W / 2).rotation.y = Math.PI; mesh(rg2, rail, -L / 2, 1.75, 0).rotation.y = Math.PI / 2; mesh(rg2, rail, L / 2, 1.75, 0).rotation.y = -Math.PI / 2;
    const cap2 = lam({ color: 0x9aa4ad }); mesh(G(new THREE.BoxGeometry(L, .25, .3)), cap2, 0, 3.6, -W / 2); mesh(G(new THREE.BoxGeometry(L, .25, .3)), cap2, 0, 3.6, W / 2); mesh(G(new THREE.BoxGeometry(.3, .25, W)), cap2, -L / 2, 3.6, 0); mesh(G(new THREE.BoxGeometry(.3, .25, W)), cap2, L / 2, 3.6, 0);
    water(-330, 1200, 2400, 3000);
    const win = cnv(64, 128, (g, w, hh) => { g.fillStyle = '#26364A'; g.fillRect(0, 0, w, hh); const rr = rng(8); for (let y = 4; y < hh; y += 8) for (let x = 4; x < w; x += 8) { g.fillStyle = rr() < .5 ? '#FFD58A' : '#3A5068'; g.fillRect(x, y, 4, 5); } });
    const bm = bas({ map: T(win, 2, 4), color: 0xc8ccd4 });
    const bg = G(new THREE.BoxGeometry(1, 1, 1)); bg.translate(0, .5, 0);
    const mats = [];
    for (let i = 0; i < 260; i++) {
      const a = R() * Math.PI * 2; if (Math.cos(a) > .55) continue;
      const d = 160 + R() * 700, hh = 120 + R() * 460, wd = 40 + R() * 60;
      const m4 = new THREE.Matrix4().compose(new THREE.Vector3(Math.cos(a) * d, -330, Math.sin(a) * d), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, R() * 3, 0)), new THREE.Vector3(wd, hh, wd));
      mats.push(m4);
    }
    const im = new THREE.InstancedMesh(bg, bm, mats.length); mats.forEach((m4, i) => im.setMatrixAt(i, m4)); scene.add(im);
    const pg = S.pergola; const px = -L / 2 + pg.d / 2 + 1;
    const pm = lam({ color: 0xEDEDE8 });
    for (const dx of [-pg.d / 2, pg.d / 2]) for (const dz of [-pg.w / 2, pg.w / 2]) mesh(G(new THREE.BoxGeometry(.6, pg.h, .6)), pm, px + dx, pg.h / 2, dz);
    for (let z = -pg.w / 2; z <= pg.w / 2; z += 2) mesh(G(new THREE.BoxGeometry(pg.d + 1, .35, .35)), pm, px, pg.h, z);
    excl.push({ x0: px - pg.d / 2 - 1, x1: px + pg.d / 2 + 1, z0: -pg.w / 2 - 1, z1: pg.w / 2 + 1 });
    const bar = mesh(G(new THREE.BoxGeometry(3, 3.6, 18)), lam({ color: 0x2F3B45 }), px, 1.8, 0); bar.position.x = px;
    for (let x = -L / 2 + pg.d + 6; x <= L / 2 - 4; x += 12) strand(x, -W / 2, x, W / 2, 12, 2.2);
    for (let x = -L / 2 + pg.d + 6; x <= L / 2 - 4; x += 12) { pole(x, -W / 2 + .4, 12); pole(x, W / 2 - .4, 12); }
  }
  if (S.kind === 'courtyard') {
    const out2 = mesh(G(new THREE.PlaneGeometry(L + 30, W + 30)), lam({ map: T(floorCanvas.stone(), (L + 30) / 4, (W + 30) / 4) }), 0, -.06, 0); out2.rotation.x = -Math.PI / 2;
    const arch = cnv(512, 256, (g, w, hh) => { g.fillStyle = '#E9D9BD'; g.fillRect(0, 0, w, hh); for (let x = 0; x < w; x += 128) { g.fillStyle = '#7B6450'; g.beginPath(); g.moveTo(x + 24, hh); g.lineTo(x + 24, hh * .5); g.arc(x + 64, hh * .5, 40, Math.PI, 0); g.lineTo(x + 104, hh); g.fill(); g.fillStyle = '#5E4C3C'; g.fillRect(x + 24, hh * .5, 80, 6); } g.fillStyle = '#B5562E'; g.fillRect(0, 0, w, 14); g.fillStyle = '#D9C59F'; g.fillRect(0, hh * .25, w, 4); });
    const aw = (len, x, z, ry) => { const m = mesh(G(new THREE.PlaneGeometry(len, 30)), lam({ map: T(arch, len / 26, 1) }), x, 15, z); m.rotation.y = ry; };
    aw(L + 30, 0, -W / 2 - 15, 0); aw(L + 30, 0, W / 2 + 15, Math.PI); aw(W + 30, -L / 2 - 15, 0, Math.PI / 2); aw(W + 30, L / 2 + 15, 0, -Math.PI / 2);
    const fx = 0; const stone = lam({ color: 0xD8C5A0 });
    mesh(G(new THREE.CylinderGeometry(7, 7.4, 2, 28)), stone, fx, 1, 0); mesh(G(new THREE.CylinderGeometry(6.4, 6.4, .2, 28)), lam({ color: 0x3E95C0 }), fx, 1.95, 0);
    mesh(G(new THREE.CylinderGeometry(.7, 1, 5, 12)), stone, fx, 3, 0); mesh(G(new THREE.CylinderGeometry(2.6, 1.2, 1, 18)), stone, fx, 5.8, 0);
    excl.push({ x0: fx - 9, x1: fx + 9, z0: -9, z1: 9 });
    for (const [x, z] of [[-L / 2 + 4, -W / 2 + 4], [L / 2 - 4, -W / 2 + 4], [-L / 2 + 4, W / 2 - 4], [L / 2 - 4, W / 2 - 4]]) { palm(x, z, 26 + R() * 6); excl.push({ x0: x - 3, x1: x + 3, z0: z - 3, z1: z + 3 }); }
    for (let x = -L / 2; x <= L / 2; x += 14) strand(x, -W / 2 - 14, x, W / 2 + 14, 20, 4);
  }
  if (S.kind === 'pavilion') {
    const isl = mesh(G(new THREE.PlaneGeometry(L + 90, W + 90)), lam({ color: 0xD9C79E }), 0, -.06, 0); isl.rotation.x = -Math.PI / 2;
    water(-1.2, 0, 4000, 4000);
    const he = 10, post = lam({ color: 0x8B6440 });
    for (let x = -L / 2; x <= L / 2 + .1; x += 16) for (const z of [-W / 2, W / 2]) mesh(G(new THREE.CylinderGeometry(.5, .5, he, 8)), post, x, he / 2, z);
    const ov = 5, run = W / 2 + ov, rise = H - he + ov * (H - he) / (W / 2);
    const slope = Math.hypot(run, rise), ang = Math.atan2(rise, run);
    const roofM = lam({ color: 0xA07850, side: THREE.DoubleSide });
    for (const sgn of [1, -1]) { const r2 = mesh(G(new THREE.BoxGeometry(L + 10, .5, slope)), roofM, 0, H - rise / 2, sgn * run / 2); r2.rotation.x = sgn * ang; }
    const fanM = lam({ color: 0x5a4632 }); const blade = G(new THREE.BoxGeometry(4.5, .1, .6));
    for (let x = -L / 2 + 10; x < L / 2 - 5; x += 15) for (const z of [-W / 5, W / 5]) { mesh(blade, fanM, x, he + 1.2, z); const b2 = mesh(blade, fanM, x, he + 1.2, z); b2.rotation.y = Math.PI / 2; }
    const mg = lam({ color: 0x2F5A2C }); const sg = G(new THREE.SphereGeometry(1, 10, 8));
    for (let i = 0; i < 46; i++) { const m = mesh(sg, mg, -L / 2 - 40 + R() * (L + 80), 3 + R() * 5, -W / 2 - 30 - R() * 14); m.scale.set(6 + R() * 7, 4 + R() * 4, 6 + R() * 7); }
    for (let x = -L / 2 - 20; x <= L / 2 + 20; x += 24) palm(x + R() * 6, W / 2 + 24 + R() * 10, 22 + R() * 8);
    for (let x = -L / 2 + 6; x < L / 2; x += 12) bulbPos.push([x, he - .8, -W / 2 + 1], [x, he - .8, W / 2 - 1]);
  }
  if (bulbPos.length) {
    const bm2 = bas({ color: 0xFFDCA0 }); const bg2 = G(new THREE.SphereGeometry(.28, 8, 6));
    const ib = new THREE.InstancedMesh(bg2, bm2, bulbPos.length); bulbPos.forEach(([x, y, z], i) => ib.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, y, z))); scene.add(ib);
  }

  /* furniture */
  const cam = new THREE.Vector3(-L / 2 + L * (S.kind === 'courtyard' ? .2 : .3), 5.5, 0);
  const area = { x0: -L / 2 + 3, x1: stageFront, z0: -W / 2 + 3, z1: W / 2 - 3 };
  if (S.kind === 'rooftop') area.x0 = -L / 2 + S.pergola.d + 3;
  const focus = danceRect ? { x: (danceRect.x0 + danceRect.x1) / 2, z: 0 } : { x: area.x1, z: 0 };
  placeFurniture(THREE, scene, keep, v, layout, guests, area, excl, focus, cam);

  return { scene, cam, dispose: () => { disposables.forEach(d => d.dispose && d.dispose()); } };
}

function grandPano(layout, vp) {
  if (vp === 'prefunction') return 'tour/grand/prefunction.jpg';
  if (vp === 'stage') return 'tour/grand/stage.jpg';
  if (vp === 'windows') return 'tour/grand/windows.jpg';
  const files = { banquet: 'tour/grand/banquet.jpg', reception: 'tour/grand/cocktail.jpg', theater: 'tour/grand/theater.jpg', classroom: 'tour/grand/classroom.jpg', ushape: 'tour/grand/ushape.jpg', boardroom: 'tour/grand/boardroom.jpg' };
  return files[layout] || files.banquet;
}
function buildGrand(v, layout) {
  const THREE = window.THREE;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x14110e);
  const disposables = [];
  const keep = o => { disposables.push(o); return o; };
  const url = grandPano(layout, 'ballroom');
  const full360 = layout === 'banquet';
  let geo;
  if (full360) {
    geo = keep(new THREE.SphereGeometry(80, 96, 64));
    geo.scale(-1, 1, 1);
  } else {
    const R = 22, wrap = 2.2, height = R * wrap * (9 / 16);
    geo = keep(new THREE.CylinderGeometry(R, R, height, 96, 1, true, Math.PI - wrap / 2, wrap));
    geo.scale(-1, 1, 1);
  }
  const mat = keep(new THREE.MeshBasicMaterial({ color: 0x1a1a1a }));
  scene.add(new THREE.Mesh(geo, mat));
  const applyTex = (tex) => {
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    if (THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
    const prev = mat.map;
    mat.map = tex; mat.color.set(0xffffff); mat.needsUpdate = true;
    if (prev && prev !== tex && prev.dispose) prev.dispose();
  };
  let currentUrl = url;
  const loader = new THREE.TextureLoader();
  loader.load(url, t => { keep(t); applyTex(t); });
  const loadPano = (next) => {
    if (!next || next === currentUrl) return;
    currentUrl = next;
    loader.load(next, t => { keep(t); applyTex(t); });
  };
  const wrap = 2.2, edge = wrap / 2 - 0.62;
  const viewpoints = [
    { id: 'ballroom', label: 'Ballroom', x: 0, y: 0, z: 0, yaw: full360 ? Math.PI / 2 : 0, pitch: full360 ? 0.02 : -0.04, panoUrl: url }
  ];
  return {
    scene,
    cam: new THREE.Vector3(0, 0, 0),
    pano: true,
    panoUrl: url,
    layout,
    loadPano,
    viewpoints,
    hotspots: [],
    lookLimits: full360
      ? { pitchMin: -1.25, pitchMax: 1.15 }
      : { yawMin: -edge, yawMax: edge, pitchMin: -0.12, pitchMax: 0.1 },
    spin360: full360,
    plan: { l: v.dims.l, w: v.dims.w, foyer: 40 },
    dispose: () => { disposables.forEach(d => d.dispose && d.dispose()); }
  };
}

function placeFurniture(THREE, scene, keep, v, layout, guests, area, excl, focus, cam) {
  const S = v.scene;
  const free = (x, z, r) => {
    if (x - r < area.x0 || x + r > area.x1 || z - r < area.z0 || z + r > area.z1) return false;
    for (const e of excl) if (x + r > e.x0 && x - r < e.x1 && z + r > e.z0 && z - r < e.z1) return false;
    return Math.hypot(x - cam.x, z - cam.z) > r + 4;
  };
  const rounds = [], chairs = [], tops = [], rects = [];
  const dist = p => Math.hypot(p.x - focus.x, (p.z - focus.z) * 1.15);
  if (layout === 'banquet') {
    const n = Math.ceil(guests / 10), sp = 11.5, cands = [];
    for (let x = area.x1 - sp / 2; x >= area.x0 + 4; x -= sp) for (let z = 0; z <= area.z1 - 4; z += sp) { for (const zz of z === 0 ? [0] : [z, -z]) if (free(x, zz, 4.8)) cands.push({ x, z: zz }); }
    cands.sort((a, b) => dist(a) - dist(b));
    let left = guests;
    for (const t of cands.slice(0, n)) { rounds.push(t); const k = Math.min(10, left); left -= k; for (let i = 0; i < k; i++) { const a = i / 10 * Math.PI * 2; chairs.push([t.x + Math.cos(a) * 4.3, t.z + Math.sin(a) * 4.3, Math.PI / 2 - a]); } }
  } else if (layout === 'reception') {
    const n = Math.ceil(guests / 8), sp = 9.5, cands = [];
    for (let x = area.x1 - 4; x >= area.x0 + 2; x -= sp) for (let z = 0; z <= area.z1 - 2; z += sp) for (const zz of z === 0 ? [0] : [z, -z]) if (free(x, zz, 2.2)) cands.push({ x, z: zz });
    cands.sort((a, b) => Math.hypot(a.x - (area.x0 + area.x1) / 2, a.z) - Math.hypot(b.x - (area.x0 + area.x1) / 2, b.z));
    cands.slice(0, n).forEach(t => tops.push(t));
  } else if (layout === 'theater') {
    let left = guests;
    for (let x = area.x1 - 5; x >= area.x0 + 1 && left > 0; x -= 3.2) for (let z = area.z0 + 1.2; z <= area.z1 - 1.2 && left > 0; z += 1.95) { if (Math.abs(z) < 2.6) continue; if (!free(x, z, .9)) continue; chairs.push([x, z, -Math.PI / 2]); left--; }
  } else if (layout === 'classroom') {
    let left = guests;
    for (let x = area.x1 - 6; x >= area.x0 + 2 && left > 0; x -= 5.2) for (let z = area.z0 + 3.4; z <= area.z1 - 3.4 && left > 0; z += 7.2) { if (Math.abs(z) < 2.8) continue; if (!free(x, z, 3.1)) continue; rects.push({ x, z, lx: 1.6, lz: 6 }); for (const dz of [-2, 0, 2]) { if (left <= 0) break; chairs.push([x - 1.8, z + dz, -Math.PI / 2]); left--; } }
  } else if (layout === 'ushape') {
    const arm = Math.max(6, Math.min(area.x1 - area.x0 - 10, 28));
    const span = Math.max(10, Math.min(area.z1 - area.z0 - 8, 22));
    const cx = area.x1 - arm / 2 - 4, cz = 0;
    rects.push({ x: cx, z: span / 2, lx: arm, lz: 2.4 });
    rects.push({ x: cx, z: -span / 2, lx: arm, lz: 2.4 });
    rects.push({ x: cx - arm / 2 + 1.2, z: 0, lx: 2.4, lz: span });
    const n = Math.max(6, guests);
    let left = n;
    for (let i = 0; i < Math.ceil(n / 2) && left; i++) {
      const t = i / Math.max(1, Math.ceil(n / 2) - 1);
      chairs.push([cx - arm / 2 + 1.4 + t * (arm - 2.8), span / 2 + 2.1, 0]); left--;
      if (left) { chairs.push([cx - arm / 2 + 1.4 + t * (arm - 2.8), -span / 2 - 2.1, Math.PI]); left--; }
    }
  } else if (layout === 'boardroom') {
    const per = Math.ceil(guests / 2); const len = Math.max(8, per * 2.6); const cx = (area.x0 + area.x1) / 2 + 2;
    rects.push({ x: cx, z: 0, lx: len, lz: 4.6 });
    for (let i = 0; i < per; i++) { const x = cx - len / 2 + 1.3 + i * 2.6; chairs.push([x, 3.5, 0]); if (chairs.length < guests) chairs.push([x, -3.5, Math.PI]); }
  }
  const M = (x, y, z, ry = 0) => { const m = new THREE.Matrix4().makeRotationY(ry); m.setPosition(x, y, z); return m; };
  const inst = (geo, mat, arr) => { if (!arr.length) return; const im = new THREE.InstancedMesh(geo, mat, arr.length); arr.forEach((m, i) => im.setMatrixAt(i, m)); scene.add(im); };
  const clothM = keep(new THREE.MeshLambertMaterial({ color: new THREE.Color(S.cloth) }));
  const chairM = keep(new THREE.MeshLambertMaterial({ color: new THREE.Color(S.chair) }));
  const accM = keep(new THREE.MeshLambertMaterial({ color: new THREE.Color(S.accent), emissive: new THREE.Color(S.accent).multiplyScalar(.15) }));
  if (rounds.length) {
    const tg = keep(new THREE.CylinderGeometry(3, 3.15, 2.5, 24)); tg.translate(0, 1.25, 0);
    inst(tg, clothM, rounds.map(t => M(t.x, 0, t.z)));
    const cg = keep(new THREE.SphereGeometry(.55, 10, 8)); cg.scale(1, .8, 1); cg.translate(0, 2.95, 0);
    inst(cg, accM, rounds.map(t => M(t.x, 0, t.z)));
  }
  if (tops.length) { const tg = keep(new THREE.CylinderGeometry(1.3, 1.5, 3.6, 16)); tg.translate(0, 1.8, 0); inst(tg, clothM, tops.map(t => M(t.x, 0, t.z))); const cg = keep(new THREE.SphereGeometry(.4, 8, 6)); cg.translate(0, 3.9, 0); inst(cg, accM, tops.map(t => M(t.x, 0, t.z))); }
  if (rects.length) { rects.forEach(r => { const g = keep(new THREE.BoxGeometry(r.lx, 2.5, r.lz)); g.translate(0, 1.25, 0); const m = new THREE.Mesh(g, clothM); m.position.set(r.x, 0, r.z); scene.add(m); }); }
  if (chairs.length) {
    const seat = keep(new THREE.BoxGeometry(1.5, .22, 1.5)); seat.translate(0, 1.5, 0);
    const back = keep(new THREE.BoxGeometry(1.5, 1.7, .18)); back.translate(0, 2.45, .68);
    const legs = keep(new THREE.BoxGeometry(1.3, 1.4, 1.3)); legs.translate(0, .7, 0);
    const mats = chairs.map(([x, z, ry]) => M(x, 0, z, ry));
    inst(seat, chairM, mats); inst(back, chairM, mats);
    const legM = keep(new THREE.MeshLambertMaterial({ color: new THREE.Color(S.chair).multiplyScalar(.8), transparent: true, opacity: .55 }));
    inst(legs, legM, mats);
  }
}

class Viewer {
  constructor(box) {
    const THREE = window.THREE;
    this.box = box;
    this.canvas = document.createElement('canvas');
    box.prepend(this.canvas);
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(1.75, window.devicePixelRatio || 1));
    if (THREE.sRGBEncoding) this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.camera = new THREE.PerspectiveCamera(72, 1, .3, 4000);
    this.camera.rotation.order = 'YXZ';
    this.yaw = -Math.PI / 2; this.pitch = -.06; this.auto = !reduceMotion; this.running = false;
    this.built = null;
    this.viewpoints = []; this.hotspots = []; this.plan = null; this.vpId = null;
    this._walk = null; this.onframe = null;
    this.hint = box.querySelector('.vhint');
    const pts = new Map(); let lastPinch = 0;
    const down = e => { if (e.target.closest('.seg')) return; box.setPointerCapture && box.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); this.stopAuto(); };
    const move = e => {
      if (!pts.has(e.pointerId)) return;
      const p = pts.get(e.pointerId);
      if (pts.size === 1) {
        this.yaw += (e.clientX - p.x) * .0055 * (this.camera.fov / 72);
        this.pitch += (e.clientY - p.y) * .0045;
        this.clampLook();
      }
      p.x = e.clientX; p.y = e.clientY;
      if (pts.size === 2) { const [a, b] = [...pts.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); if (lastPinch) this.zoom((lastPinch - d) * .15); lastPinch = d; }
    };
    const up = e => { pts.delete(e.pointerId); if (pts.size < 2) lastPinch = 0; };
    box.addEventListener('pointerdown', down); box.addEventListener('pointermove', move); box.addEventListener('pointerup', up); box.addEventListener('pointercancel', up);
    box.addEventListener('wheel', e => { e.preventDefault(); this.zoom(e.deltaY * .03); this.stopAuto(); }, { passive: false });
    box.addEventListener('keydown', e => { const k = { ArrowLeft: [-.12, 0], ArrowRight: [.12, 0], ArrowUp: [0, -.08], ArrowDown: [0, .08] }[e.key]; if (k) { e.preventDefault(); this.yaw -= k[0]; this.pitch -= k[1]; this.clampLook(); this.stopAuto(); } });
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(box);
    this.resize();
  }
  zoom(d) {
    const limited = this.built && this.built.lookLimits && this.built.lookLimits.yawMin != null;
    const lo = limited ? 42 : 38, hi = limited ? 56 : 88;
    this.camera.fov = Math.max(lo, Math.min(hi, this.camera.fov + d));
    this.camera.updateProjectionMatrix();
  }
  stopAuto() { this.auto = false; if (this.hint) this.hint.style.opacity = '0'; }
  clampLook() {
    const L = this.built && this.built.lookLimits;
    if (L) {
      if (L.yawMin != null) this.yaw = Math.max(L.yawMin, Math.min(L.yawMax, this.yaw));
      this.pitch = Math.max(L.pitchMin, Math.min(L.pitchMax, this.pitch));
    } else {
      this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));
    }
  }
  resize() { const w = this.box.clientWidth, hh = this.box.clientHeight; if (!w || !hh) return; this.renderer.setSize(w, hh, false); this.camera.aspect = w / hh; this.camera.updateProjectionMatrix(); }
  show(v, layout, guests, resetView) {
    if (this.built) { this.built.dispose(); }
    this.built = buildScene(v, layout, guests);
    this.viewpoints = this.built.viewpoints || [];
    this.hotspots = this.built.hotspots || [];
    this.plan = this.built.plan || { l: v.dims.l, w: v.dims.w, foyer: 0 };
    if (resetView || !this.vpId) {
      const home = this.viewpoints[0];
      this.yaw = home ? home.yaw : -Math.PI / 2;
      this.pitch = home ? home.pitch : -.06;
      this.camera.fov = (this.built && this.built.pano && !this.built.spin360) ? 48 : 72;
      this.camera.updateProjectionMatrix();
      this.camera.position.copy(home ? new window.THREE.Vector3(home.x, home.y, home.z) : this.built.cam);
      this.vpId = home ? home.id : 'home';
    } else {
      const keep = this.viewpoints.find(p => p.id === this.vpId);
      if (keep) this.camera.position.set(keep.x, keep.y, keep.z);
      else this.camera.position.copy(this.built.cam);
    }
    if (this.built.pano) {
      this.camera.position.set(0, 0, 0);
      const here = this.viewpoints.find(p => p.id === this.vpId);
      if (here && here.panoUrl && here.panoUrl !== this.built.panoUrl) this.built.loadPano(here.panoUrl);
    }
    this._walk = null;
    this.clampLook();
    if (!this.running) { this.running = true; this.loop(); }
    if (this.onframe) this.onframe();
  }
  resetView() {
    const home = this.viewpoints[0];
    this.stopAuto();
    this.camera.fov = (this.built && this.built.pano && !this.built.spin360) ? 48 : 72;
    this.camera.updateProjectionMatrix();
    if (home) this.goTo(home.id);
    else { this.yaw = -Math.PI / 2; this.pitch = -.06; this.camera.position.copy(this.built.cam); }
  }
  goTo(id) {
    const vp = this.viewpoints.find(p => p.id === id); if (!vp || !this.built) return;
    this.stopAuto();
    this.vpId = id;
    if (this.built.pano && vp.panoUrl) this.built.loadPano(vp.panoUrl);
    this._walk = {
      t: 0,
      px: this.camera.position.x, py: this.camera.position.y, pz: this.camera.position.z,
      yaw: this.yaw, pitch: this.pitch,
      tx: this.built.pano ? 0 : vp.x, ty: this.built.pano ? 0 : vp.y, tz: this.built.pano ? 0 : vp.z,
      tyaw: vp.yaw, tpitch: vp.pitch
    };
  }
  project(x, y, z) {
    const v = new window.THREE.Vector3(x, y, z).project(this.camera);
    const w = this.box.clientWidth, h = this.box.clientHeight;
    return { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h, visible: v.z > -1 && v.z < 1 };
  }
  loop() {
    if (!this.running) return;
    if (this._walk) {
      this._walk.t = Math.min(1, this._walk.t + (reduceMotion ? 1 : 0.045));
      const e = 1 - Math.pow(1 - this._walk.t, 3);
      const w = this._walk;
      this.camera.position.set(w.px + (w.tx - w.px) * e, w.py + (w.ty - w.py) * e, w.pz + (w.tz - w.pz) * e);
      let dy = w.tyaw - w.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
      this.yaw = w.yaw + dy * e; this.pitch = w.pitch + (w.tpitch - w.pitch) * e;
      if (this._walk.t >= 1) { this._walk = null; this.clampLook(); }
    } else if (this.auto) {
      const L = this.built && this.built.lookLimits;
      if (L && L.yawMin != null) {
        this._autoDir = this._autoDir || 1;
        this.yaw += 0.0009 * this._autoDir;
        if (this.yaw >= L.yawMax) this._autoDir = -1;
        if (this.yaw <= L.yawMin) this._autoDir = 1;
        this.clampLook();
      } else this.yaw += .0016;
    }
    this.camera.rotation.set(this.pitch, this.yaw, 0);
    this.renderer.render(this.built.scene, this.camera);
    if (this.onframe) this.onframe();
    this.raf = requestAnimationFrame(() => this.loop());
  }
  destroy() { this.running = false; cancelAnimationFrame(this.raf); this.ro.disconnect(); if (this.built) this.built.dispose(); this.renderer.dispose(); try { this.renderer.forceContextLoss(); } catch (e) {} this.canvas.remove(); }
}

return { loadThree, webglOK, buildScene, Viewer, hashStr };
})();
