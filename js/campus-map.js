import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DRenderer, CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";

const COLORS = {
  ground: 0xe7e2d6,
  lawn: 0xc5d4b4,
  field: 0xb4c79a,
  water: 0x8fb8c0,
  tree: 0x6f9a62,
  trunk: 0x8a6a4b,
  music: { wall: 0xe8f0e6, roof: 0x3f7a58 },
  academic: { wall: 0xd8cbb8, roof: 0xb9a58a },
  residential: { wall: 0xd7b49a, roof: 0xc08a68 },
  garage: { wall: 0xc6c2bb, roof: 0x9e9a93 },
  library: { wall: 0xd4cfc4, roof: 0x8aa0a8 },
  student: { wall: 0xddc9a8, roof: 0xc4a06e },
  admin: { wall: 0xd5c8b2, roof: 0x8d7b66 },
  campus: { wall: 0xd5d0c6, roof: 0xb7b0a4 },
};

const CATEGORY_LABEL = {
  music: "Frost School of Music",
  academic: "Academic",
  residential: "Residential",
  garage: "Parking garage",
  library: "Library",
  student: "Student life",
  admin: "Administration",
  campus: "Campus",
};

const STORIES = {
  "Weeks Music Library and Technology Center":
    "The Weeks library sits on Lake Osceola at the heart of Frost. Start the LEED tour from here.",
  "Weeks Recording Studio":
    "Recording and performance rooms on the music quadrangle, just south of the library.",
  "Gusman Concert Hall":
    "Maurice Gusman Concert Hall is Frost’s main performance hall, next to the student center.",
  "Foster Memorial Music Building":
    "Studios and teaching rooms on the north edge of the Frost cluster along Miller Drive.",
  "Volpe Classroom Building":
    "Classrooms in the middle of the Frost School of Music block.",
  "Knight Center for Music Innovation":
    "Frost’s innovation wing on the west side of the music school.",
  "Frost North Studio Wing": "Practice and studio spaces on the north music block.",
  "Frost South Studio Wing": "Studios on the south side of the Frost cluster.",
  "Rehearsal Center": "Rehearsal rooms between the Knight Center and Music Administration.",
  "Shalala Student Center":
    "Student life on the east shore of Lake Osceola, a short walk from Frost.",
  "Otto G. Richter Library": "The university’s main library on the academic quadrangle.",
  "Ashe Administration Building": "The Coral Gables campus administration building.",
};

const DIR_ORDER = [
  ["music", "Frost School of Music"],
  ["library", "Libraries"],
  ["academic", "Academic"],
  ["student", "Student life"],
  ["residential", "Residential"],
  ["admin", "Administration"],
  ["garage", "Parking"],
];

const wallMats = {};
const roofMats = {};
for (const [key, pair] of Object.entries(COLORS)) {
  if (!pair || typeof pair !== "object" || !("wall" in pair)) continue;
  wallMats[key] = new THREE.MeshStandardMaterial({
    color: pair.wall,
    roughness: 0.9,
    metalness: 0.02,
  });
  roofMats[key] = new THREE.MeshStandardMaterial({
    color: pair.roof,
    roughness: 0.85,
    metalness: 0.04,
  });
}

const selectedWall = wallMats.music.clone();
selectedWall.emissive = new THREE.Color(0x005030);
selectedWall.emissiveIntensity = 0.18;

let scene;
let camera;
let renderer;
let labelRenderer;
let controls;
let data;
let buildingsById = new Map();
let meshesById = new Map();
let labelsById = new Map();
let selectedId = null;
let mode2d = false;
let dragged = false;
let downX = 0;
let downY = 0;
let frostCenter = new THREE.Vector3();
let campusCenter = new THREE.Vector3();
let startOffset = new THREE.Vector3();
let introActive = false;
let holdLeft = 0;
let frostMarker = null;
let frostPinLabel = null;

const HOLD_S = 2.2;
const ZOOM_S = 9.0;

const fly = {
  active: false,
  t: 0,
  duration: 1.35,
  fromPos: new THREE.Vector3(),
  toPos: new THREE.Vector3(),
  fromTarget: new THREE.Vector3(),
  toTarget: new THREE.Vector3(),
  midPos: null,
  midTarget: null,
  onDone: null,
};

function shapeFromRing(ring) {
  const shape = new THREE.Shape();
  shape.moveTo(ring[0][0], -ring[0][1]);
  for (let i = 1; i < ring.length; i += 1) {
    shape.lineTo(ring[i][0], -ring[i][1]);
  }
  shape.closePath();
  return shape;
}

function meshFromFootprint(ring, height, material, y0 = 0) {
  const geom = new THREE.ExtrudeGeometry(shapeFromRing(ring), {
    depth: height,
    bevelEnabled: false,
  });
  geom.rotateX(-Math.PI / 2);
  geom.translate(0, y0, 0);
  const mesh = new THREE.Mesh(geom, material);
  mesh.castShadow = height > 2;
  mesh.receiveShadow = true;
  return mesh;
}

function addGround() {
  const { min, max } = data.bounds;
  const w = max[0] - min[0] + 180;
  const d = max[1] - min[1] + 180;
  const cx = (min[0] + max[0]) / 2;
  const cz = (min[1] + max[1]) / 2;
  campusCenter.set(cx, 0, cz);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshStandardMaterial({ color: COLORS.ground, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(cx, 0, cz);
  ground.receiveShadow = true;
  scene.add(ground);
}

function addFlat(items, color, y, h) {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 1 });
  for (const item of items) {
    const mesh = meshFromFootprint(item.footprint, h, mat, y);
    mesh.castShadow = false;
    scene.add(mesh);
  }
}

function addBuildings() {
  const group = new THREE.Group();
  const musicPts = [];
  for (const b of data.buildings) {
    const wall = wallMats[b.category] || wallMats.campus;
    const roof = roofMats[b.category] || roofMats.campus;
    const body = meshFromFootprint(b.footprint, b.height, wall);
    body.userData.id = b.id;
    const cap = new THREE.Mesh(
      new THREE.ShapeGeometry(shapeFromRing(b.footprint)),
      roof
    );
    cap.rotation.x = -Math.PI / 2;
    cap.position.y = b.height + 0.05;
    cap.receiveShadow = true;
    cap.userData.id = b.id;
    const wrap = new THREE.Group();
    wrap.add(body, cap);
    wrap.userData.id = b.id;
    group.add(wrap);
    meshesById.set(b.id, { wrap, body, cap, wall, roof, building: b });
    buildingsById.set(b.id, b);
    if (b.named) addLabel(b);
    if (b.category === "music") musicPts.push(b.center);
  }
  scene.add(group);
  if (musicPts.length) {
    frostCenter.set(
      musicPts.reduce((s, p) => s + p[0], 0) / musicPts.length,
      8,
      musicPts.reduce((s, p) => s + p[1], 0) / musicPts.length
    );
  }
}

function addLabel(building) {
  const el = document.createElement("div");
  el.className = `label${building.category === "music" ? " music" : ""} hidden`;
  el.textContent = shortName(building.name);
  const obj = new CSS2DObject(el);
  obj.position.set(building.center[0], building.height + 6, building.center[1]);
  scene.add(obj);
  labelsById.set(building.id, { obj, el, building });
}

function shortName(name) {
  return name
    .replace("University of Miami ", "")
    .replace(" and Technology Center", "")
    .replace(" Memorial Music Building", "")
    .replace(" Classroom Building", "")
    .replace(" Residential College", "");
}

function addTrees() {
  const trunkGeom = new THREE.CylinderGeometry(0.35, 0.45, 2.2, 5);
  const leafGeom = new THREE.SphereGeometry(2.1, 7, 5);
  const trunkMat = new THREE.MeshStandardMaterial({ color: COLORS.trunk, roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: COLORS.tree, roughness: 1 });
  const trunks = new THREE.InstancedMesh(trunkGeom, trunkMat, data.trees.length);
  const leaves = new THREE.InstancedMesh(leafGeom, leafMat, data.trees.length);
  trunks.castShadow = true;
  leaves.castShadow = true;
  const dummy = new THREE.Object3D();
  data.trees.forEach((pt, i) => {
    dummy.position.set(pt[0], 1.1, pt[1]);
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    dummy.position.set(pt[0], 3.4, pt[1]);
    dummy.scale.setScalar(0.7 + ((i * 17) % 9) / 18);
    dummy.updateMatrix();
    leaves.setMatrixAt(i, dummy.matrix);
    dummy.scale.setScalar(1);
  });
  scene.add(trunks, leaves);
}

function setupLights() {
  scene.add(new THREE.HemisphereLight(0xf7f1e4, 0xb7c4a8, 0.95));
  const sun = new THREE.DirectionalLight(0xfff4e0, 1.15);
  sun.position.set(220, 280, 160);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 40;
  sun.shadow.camera.far = 900;
  sun.shadow.camera.left = -420;
  sun.shadow.camera.right = 420;
  sun.shadow.camera.top = 420;
  sun.shadow.camera.bottom = -420;
  scene.add(sun);
}

function frameCampus() {
  const { min, max } = data.bounds;
  const span = Math.max(max[0] - min[0], max[1] - min[1]);
  startOffset.set(
    campusCenter.x + span * 0.42,
    span * 0.52,
    campusCenter.z + span * 0.48
  );
  camera.position.copy(startOffset);
  controls.target.copy(campusCenter);
  controls.minDistance = 60;
  controls.maxDistance = 1400;
  controls.minPolarAngle = 0.12;
  controls.maxPolarAngle = 1.22;
  controls.update();
}

function frostTarget() {
  const weeks = weeksBuilding();
  if (weeks) {
    return {
      x: weeks.center[0],
      y: weeks.height * 0.45,
      z: weeks.center[1],
      height: weeks.height,
    };
  }
  return { x: frostCenter.x, y: 8, z: frostCenter.z, height: 18 };
}

function frostPose() {
  const t = frostTarget();
  return {
    pos: new THREE.Vector3(t.x + 34, t.height + 20, t.z + 54),
    target: new THREE.Vector3(t.x, t.y, t.z),
  };
}

function midPose() {
  const t = frostTarget();
  return {
    pos: new THREE.Vector3(t.x + 140, 155, t.z + 210),
    target: new THREE.Vector3(t.x, 10, t.z),
  };
}

function addFrostMarker() {
  const weeks = weeksBuilding();
  if (!weeks) return;
  const x = weeks.center[0];
  const z = weeks.center[1];
  const group = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.4, 0.5, weeks.height + 12, 8),
    new THREE.MeshStandardMaterial({
      color: 0x005030,
      emissive: 0x005030,
      emissiveIntensity: 0.3,
    })
  );
  pole.position.set(x, (weeks.height + 12) / 2, z);
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(3.4, 16, 12),
    new THREE.MeshStandardMaterial({
      color: 0xf47321,
      emissive: 0xf47321,
      emissiveIntensity: 0.5,
    })
  );
  ball.position.set(x, weeks.height + 14, z);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(7, 11.5, 40),
    new THREE.MeshBasicMaterial({
      color: 0xf47321,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.88,
    })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(x, 0.45, z);
  group.add(pole, ball, ring);
  group.userData.pulse = ring;
  scene.add(group);
  frostMarker = group;

  const el = document.createElement("div");
  el.className = "label music frost-pin";
  el.textContent = "Frost School of Music";
  const obj = new CSS2DObject(el);
  obj.position.set(x, weeks.height + 22, z);
  scene.add(obj);
  frostPinLabel = { obj, el };
}

function bezier(out, a, b, c, t) {
  const u = 1 - t;
  out.copy(a).multiplyScalar(u * u);
  out.addScaledVector(b, 2 * u * t);
  out.addScaledVector(c, t * t);
}

function flyTo(target, pos, duration = 1.35, mid, onDone) {
  fly.fromPos.copy(camera.position);
  fly.fromTarget.copy(controls.target);
  fly.toPos.copy(pos);
  fly.toTarget.copy(target);
  fly.midPos = mid ? mid.pos.clone() : null;
  fly.midTarget = mid ? mid.target.clone() : null;
  fly.duration = duration;
  fly.onDone = onDone || null;
  fly.t = 0;
  fly.active = true;
}

function flyToBuilding(building) {
  const target = new THREE.Vector3(building.center[0], building.height * 0.35, building.center[1]);
  const pos = new THREE.Vector3(
    building.center[0] + 70,
    Math.max(48, building.height + 42),
    building.center[1] + 90
  );
  flyTo(target, pos);
}

function weeksBuilding() {
  return data.buildings.find((b) => b.name.startsWith("Weeks Music Library"));
}

function finishIntro() {
  introActive = false;
  holdLeft = 0;
  document.body.classList.remove("is-intro");
  document.getElementById("skip").classList.add("hidden");
  document.getElementById("journey").classList.add("hidden");
  document.getElementById("arrival").classList.remove("hidden");
  controls.enabled = true;
  const weeks = weeksBuilding();
  if (weeks) selectBuilding(weeks.id, { fly: false });
  window.setTimeout(() => {
    const arrival = document.getElementById("arrival");
    if (arrival) arrival.classList.add("hidden");
  }, 4200);
}

function skipIntro() {
  const end = frostPose();
  camera.position.copy(end.pos);
  controls.target.copy(end.target);
  controls.update();
  fly.active = false;
  fly.onDone = null;
  finishIntro();
}

function playFrostZoom() {
  const end = frostPose();
  const mid = midPose();
  if (!introActive && camera.position.distanceTo(end.pos) < 50) return;
  introActive = true;
  holdLeft = 0;
  document.body.classList.add("is-intro");
  document.getElementById("skip").classList.remove("hidden");
  document.getElementById("journey").classList.remove("hidden");
  document.getElementById("arrival").classList.add("hidden");
  document.getElementById("card").classList.add("hidden");
  controls.enabled = false;
  flyTo(end.target, end.pos, ZOOM_S, mid, finishIntro);
}

function playIntro() {
  const start = { pos: startOffset.clone(), target: campusCenter.clone() };
  camera.position.copy(start.pos);
  controls.target.copy(start.target);
  controls.update();
  introActive = true;
  holdLeft = HOLD_S;
  document.body.classList.add("is-intro");
  document.getElementById("skip").classList.remove("hidden");
  document.getElementById("arrival").classList.add("hidden");
  controls.enabled = false;
}

function filmStart() {
  const frost = frostTarget();
  const target = new THREE.Vector3(
    campusCenter.x * 0.35 + frost.x * 0.65,
    2,
    campusCenter.z * 0.35 + frost.z * 0.65
  );
  return {
    pos: new THREE.Vector3(target.x + 360, 320, target.z + 410),
    target,
  };
}

function filmEnd() {
  const t = frostTarget();
  return {
    pos: new THREE.Vector3(t.x + 78, t.height + 42, t.z + 110),
    target: new THREE.Vector3(t.x + 4, t.height * 0.35, t.z - 6),
  };
}

function filmMid() {
  const t = frostTarget();
  return {
    pos: new THREE.Vector3(t.x + 190, 165, t.z + 250),
    target: new THREE.Vector3(t.x, 10, t.z),
  };
}

function filmProgress(p) {
  const start = filmStart();
  const end = filmEnd();
  const mid = filmMid();
  const total = HOLD_S + ZOOM_S;
  const tsec = Math.max(0, Math.min(1, p)) * total;
  camera.fov = 42;
  camera.updateProjectionMatrix();
  if (tsec <= HOLD_S) {
    camera.position.copy(start.pos);
    controls.target.copy(start.target);
  } else {
    const raw = (tsec - HOLD_S) / ZOOM_S;
    const t = raw * raw * (3 - 2 * raw);
    bezier(camera.position, start.pos, mid.pos, end.pos, t);
    bezier(controls.target, start.target, mid.target, end.target, t);
  }
  controls.update();
  updateLabels();
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
}

function isFilmMode() {
  return new URLSearchParams(window.location.search).has("film");
}

function selectBuilding(id, opts = {}) {
  const fromDir = opts.fromDir;
  if (selectedId && meshesById.has(selectedId)) {
    const prev = meshesById.get(selectedId);
    prev.body.material = prev.wall;
  }
  selectedId = id;
  const entry = meshesById.get(id);
  if (!entry) return;
  entry.body.material = selectedWall;
  const building = entry.building;
  if (opts.fly !== false) flyToBuilding(building);
  showCard(building);
  highlightDir(id);
  if (fromDir) document.getElementById("search").blur();
}

function showCard(building) {
  const card = document.getElementById("card");
  document.getElementById("card-title").textContent = building.name;
  document.getElementById("card-cat").textContent = CATEGORY_LABEL[building.category] || "Campus";
  document.getElementById("card-copy").textContent =
    STORIES[building.name] ||
    (building.category === "music"
      ? "Part of the Frost School of Music cluster on Lake Osceola."
      : "On the University of Miami Coral Gables campus.");
  const photo = document.getElementById("card-photo");
  const cta = document.getElementById("card-cta");
  const isMusic = building.category === "music";
  photo.hidden = !isMusic;
  photo.src = isMusic ? "assets/frost-3d.jpg" : "";
  photo.alt = isMusic ? "Frost School of Music" : "";
  cta.classList.toggle("hidden", !isMusic);
  card.classList.remove("hidden");
}

function closeCard() {
  document.getElementById("card").classList.add("hidden");
  if (selectedId && meshesById.has(selectedId)) {
    const prev = meshesById.get(selectedId);
    prev.body.material = prev.wall;
  }
  selectedId = null;
  highlightDir(null);
}

function highlightDir(id) {
  document.querySelectorAll(".dir-group button").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.id === id);
  });
}

function renderDirectory(filter = "") {
  const q = filter.trim().toLowerCase();
  const named = data.buildings.filter((b) => b.named);
  const host = document.getElementById("dir-list");
  host.innerHTML = "";
  for (const [cat, title] of DIR_ORDER) {
    const items = named
      .filter((b) => b.category === cat && (!q || b.name.toLowerCase().includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name));
    if (!items.length) continue;
    const group = document.createElement("div");
    group.className = "dir-group";
    const h = document.createElement("h3");
    h.textContent = title;
    group.appendChild(h);
    for (const b of items) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = b.name;
      btn.dataset.id = b.id;
      btn.addEventListener("click", () => selectBuilding(b.id, { fromDir: true }));
      group.appendChild(btn);
    }
    host.appendChild(group);
  }
}

function onPointer(event) {
  if (introActive || fly.active || dragged) return;
  const rect = renderer.domElement.getBoundingClientRect();
  const mouse = new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1
  );
  const ray = new THREE.Raycaster();
  ray.setFromCamera(mouse, camera);
  const meshes = [...meshesById.values()].map((e) => e.body);
  const hits = ray.intersectObjects(meshes, false);
  if (!hits.length) return;
  selectBuilding(hits[0].object.userData.id);
}

function setMode(next2d) {
  mode2d = next2d;
  document.getElementById("btn-mode").setAttribute("aria-pressed", String(mode2d));
  document.getElementById("btn-mode").textContent = mode2d ? "3D view" : "2D plan";
  if (mode2d) {
    controls.enableRotate = false;
        const pos = new THREE.Vector3(campusCenter.x, 980, campusCenter.z + 4);
    flyTo(campusCenter.clone(), pos);
  } else {
    controls.enableRotate = true;
    flyTo(campusCenter.clone(), startOffset.clone());
  }
}

function updateLabels() {
  const dist = camera.position.distanceTo(controls.target);
  const showAll = dist < 240 || (introActive && dist < 420);
  for (const [id, label] of labelsById) {
    const show = id === selectedId || showAll;
    label.el.classList.toggle("hidden", !show);
  }
  if (frostPinLabel) frostPinLabel.el.classList.remove("hidden");
}

function tick(now) {
  const last = tick.prev || now;
  const dt = Math.min(0.05, (now - last) / 1000);
  tick.prev = now;
  if (introActive && holdLeft > 0) {
    holdLeft -= dt;
    if (holdLeft <= 0) {
      holdLeft = 0;
      playFrostZoom();
    }
    controls.update();
  } else if (fly.active) {
    fly.t += dt / fly.duration;
    const raw = fly.t >= 1 ? 1 : fly.t;
    const t = raw * raw * (3 - 2 * raw);
    if (fly.midPos) {
      bezier(camera.position, fly.fromPos, fly.midPos, fly.toPos, t);
      bezier(controls.target, fly.fromTarget, fly.midTarget, fly.toTarget, t);
    } else {
      camera.position.lerpVectors(fly.fromPos, fly.toPos, t);
      controls.target.lerpVectors(fly.fromTarget, fly.toTarget, t);
    }
    controls.update();
    if (fly.t >= 1) {
      fly.active = false;
      const done = fly.onDone;
      fly.onDone = null;
      if (done) done();
    }
  } else {
    controls.update();
  }
  if (frostMarker) {
    const s = 1 + Math.sin(now * 0.004) * 0.16;
    frostMarker.userData.pulse.scale.set(s, s, s);
  }
  updateLabels();
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
  requestAnimationFrame(tick);
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  labelRenderer.setSize(window.innerWidth, window.innerHeight);
}

function bindUi() {
  document.getElementById("search").addEventListener("input", (e) => {
    renderDirectory(e.target.value);
  });
  document.getElementById("card-close").addEventListener("click", closeCard);
  document.getElementById("btn-reset").addEventListener("click", () => {
    closeCard();
    document.getElementById("arrival").classList.add("hidden");
    mode2d = false;
    document.getElementById("btn-mode").setAttribute("aria-pressed", "false");
    document.getElementById("btn-mode").textContent = "2D plan";
    controls.enableRotate = true;
    flyTo(campusCenter.clone(), startOffset.clone(), 3.6);
  });
  document.getElementById("btn-mode").addEventListener("click", () => setMode(!mode2d));
  document.getElementById("btn-frost").addEventListener("click", () => {
    if (introActive) {
      skipIntro();
      return;
    }
    playFrostZoom();
  });
  document.getElementById("skip").addEventListener("click", skipIntro);
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (introActive) skipIntro();
      else closeCard();
    }
  });
}

export async function startCampusMap(host = document.getElementById("map")) {
  data = await fetch("assets/campus-scene.json").then((r) => r.json());
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe7e2d6);
  scene.fog = new THREE.Fog(0xe7e2d6, 900, 2000);

  camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 1, 4000);
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.appendChild(renderer.domElement);

  labelRenderer = new CSS2DRenderer();
  labelRenderer.setSize(window.innerWidth, window.innerHeight);
  labelRenderer.domElement.style.position = "absolute";
  labelRenderer.domElement.style.inset = "0";
  labelRenderer.domElement.style.pointerEvents = "none";
  host.appendChild(labelRenderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.screenSpacePanning = true;

  setupLights();
  addGround();
  addFlat(data.lawns, COLORS.lawn, 0.08, 0.35);
  addFlat(data.fields, COLORS.field, 0.1, 0.4);
  for (const lot of data.parking) {
    addFlat([lot], lot.color, 0.12, 0.45);
  }
  addFlat(data.water, COLORS.water, 0.02, 0.7);
  addBuildings();
  addFrostMarker();
  addTrees();
  frameCampus();
  renderDirectory();
  bindUi();

  renderer.domElement.addEventListener("pointerdown", (e) => {
    dragged = false;
    downX = e.clientX;
    downY = e.clientY;
  });
  renderer.domElement.addEventListener("pointermove", (e) => {
    const dx = e.clientX - downX;
    const dy = e.clientY - downY;
    if (dx * dx + dy * dy > 25) dragged = true;
  });
  renderer.domElement.addEventListener("click", onPointer);
  window.addEventListener("resize", onResize);
  document.getElementById("loader").classList.add("hidden");
  if (isFilmMode()) {
    document.body.classList.add("film-mode");
    controls.enabled = false;
    filmProgress(0);
    window.__filmFrame = filmProgress;
    window.__filmReady = true;
  } else {
    playIntro();
  }
  requestAnimationFrame(tick);
  return { scene, data, selectBuilding, playIntro, skipIntro, playFrostZoom, filmProgress };
}

if (!window.__CAMPUS_MAP_TEST__) {
  startCampusMap().catch((err) => {
    const loader = document.getElementById("loader");
    if (loader) loader.querySelector("h1").textContent = "Could not load the campus map";
    console.error(err);
  });
}
