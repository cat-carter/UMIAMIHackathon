const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");

test("camera path uses Frost School of Music coordinates", () => {
  const src = fs.readFileSync(path.join(root, "js/flyin.js"), "utf8");
  assert.match(src, /25\.71912/);
  assert.match(src, /-80\.28024/);
  assert.match(src, /lookAt/);
  assert.match(src, /HeadingPitchRange/);
  assert.doesNotMatch(src, /transform:\s*scale/);
});

test("campus GeoJSON includes Frost music buildings", () => {
  const geo = JSON.parse(fs.readFileSync(path.join(root, "assets/campus-buildings.geojson"), "utf8"));
  const names = geo.features.map((f) => f.properties.name);
  assert.ok(names.includes("Weeks Music Library and Technology Center"));
  assert.ok(names.includes("Gusman Concert Hall"));
  assert.ok(geo.features.length > 50);
});

test("opener pages exist", () => {
  assert.ok(fs.existsSync(path.join(root, "index.html")));
  assert.ok(fs.existsSync(path.join(root, "tour.html")));
});
