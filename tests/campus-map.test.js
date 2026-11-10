const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

test("campus scene includes Frost music buildings and Lake Osceola", () => {
  const scene = JSON.parse(read("assets/campus-scene.json"));
  const names = scene.buildings.map((b) => b.name);
  assert.ok(names.includes("Weeks Music Library and Technology Center"));
  assert.ok(names.includes("Gusman Concert Hall"));
  assert.ok(names.includes("Knight Center for Music Innovation"));
  assert.ok(scene.buildings.filter((b) => b.category === "music").length >= 6);
  assert.equal(scene.water[0].name, "Lake Osceola");
  assert.ok(scene.water[0].footprint.length > 8);
  assert.ok(scene.buildings.length > 50);
  assert.ok(scene.trees.length > 50);
});

test("3D map page is the opener and does not load Cesium", () => {
  const html = read("index.html");
  assert.match(html, /campus-map\.js/);
  assert.match(html, /Coral Gables Campus/);
  assert.match(html, /tour\.html/);
  assert.doesNotMatch(html, /Cesium/);
  assert.ok(fs.existsSync(path.join(root, "js/campus-map.js")));
  assert.ok(fs.existsSync(path.join(root, "tour.html")));
});

test("map script orbits, flies to buildings, and can open the LEED tour", () => {
  const src = read("js/campus-map.js");
  assert.match(src, /OrbitControls/);
  assert.match(src, /flyToBuilding/);
  assert.match(src, /Weeks Music Library/);
  assert.match(src, /frost-3d\.jpg/);
  assert.match(src, /Raycaster/);
});
