/**
 * One uninterrupted camera journey:
 * South Florida satellite → Coral Gables campus → oblique 3D → Frost School of Music.
 *
 * Cesium globe camera (lon/lat/height/heading/pitch/range), not CSS scale.
 * Prefers Google Photorealistic 3D Tiles when a Cesium ion token can load them.
 * Falls back to Esri World Imagery + OSM campus extrusions so the flight still runs.
 */

const FROST = {
  // Weeks Music Library / Technology Center — Frost music cluster on Lake Osceola.
  lon: -80.28024,
  lat: 25.71912,
  height: 10,
};

const START = {
  lon: -80.214,
  lat: 25.775,
  height: 0,
};

const DURATION_MS = 17000;
const HOLD_MS = 900;
const END_RANGE = 210;

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp01(t) {
  return Math.min(1, Math.max(0, t));
}

function smootherstep(t) {
  t = clamp01(t);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function poseAt(u) {
  const t = smootherstep(u);
  const land = t * t * (3 - 2 * t);
  return {
    lon: lerp(START.lon, FROST.lon, t),
    lat: lerp(START.lat, FROST.lat, t),
    height: lerp(START.height, FROST.height, t),
    heading: Cesium.Math.toRadians(lerp(18, 12, t)),
    pitch: Cesium.Math.toRadians(lerp(-88.5, -28, Math.pow(t, 1.18))),
    range: Math.exp(lerp(Math.log(56000), Math.log(END_RANGE), land)),
  };
}

function applyPose(camera, pose) {
  const target = Cesium.Cartesian3.fromDegrees(pose.lon, pose.lat, pose.height);
  camera.lookAt(target, new Cesium.HeadingPitchRange(pose.heading, pose.pitch, pose.range));
}

function hideLoader() {
  document.getElementById("loader").classList.add("hidden");
}

function showArrival() {
  document.getElementById("arrival").classList.remove("hidden");
  document.getElementById("skip").classList.add("hidden");
}

function setIonToken() {
  if (window.CESIUM_ION_TOKEN) {
    Cesium.Ion.defaultAccessToken = window.CESIUM_ION_TOKEN;
  }
}

function makeViewer() {
  const esri = new Cesium.UrlTemplateImageryProvider({
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    credit: "Esri, Maxar, Earthstar Geographics",
    maximumLevel: 19,
  });

  const viewer = new Cesium.Viewer("cesiumContainer", {
    animation: false,
    timeline: false,
    geocoder: false,
    homeButton: false,
    sceneModePicker: false,
    baseLayerPicker: false,
    navigationHelpButton: false,
    fullscreenButton: false,
    infoBox: false,
    selectionIndicator: false,
    terrainProvider: new Cesium.EllipsoidTerrainProvider(),
    baseLayer: new Cesium.ImageryLayer(esri),
    msaaSamples: 4,
  });

  viewer.clock.currentTime = Cesium.JulianDate.fromIso8601("2026-03-20T17:00:00Z");
  viewer.clock.shouldAnimate = false;
  viewer.scene.globe.enableLighting = false;
  viewer.scene.fog.enabled = true;
  viewer.scene.skyAtmosphere.show = true;
  viewer.scene.backgroundColor = Cesium.Color.fromCssColorString("#8ec6e8");
  viewer.scene.screenSpaceCameraController.enableCollisionDetection = false;
  viewer.scene.screenSpaceCameraController.enableInputs = false;
  return viewer;
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      window.setTimeout(() => reject(new Error("timed out")), ms);
    }),
  ]);
}

async function tryPhotorealTiles(viewer) {
  if (typeof Cesium.createGooglePhotorealistic3DTileset !== "function") return false;
  try {
    const tileset = await withTimeout(
      Cesium.createGooglePhotorealistic3DTileset({
        onlyUsingWithGoogleGeocoder: true,
      }),
      5000,
    );
    viewer.scene.primitives.add(tileset);
    return true;
  } catch (err) {
    console.warn("Photorealistic 3D tiles unavailable; using satellite + campus extrusions.", err);
    return false;
  }
}

async function tryOsmBuildings(viewer) {
  if (typeof Cesium.createOsmBuildingsAsync !== "function") return false;
  try {
    const buildings = await withTimeout(Cesium.createOsmBuildingsAsync(), 4000);
    viewer.scene.primitives.add(buildings);
    return true;
  } catch (err) {
    console.warn("Cesium OSM Buildings unavailable.", err);
    return false;
  }
}

async function loadCampusExtrusions(viewer) {
  const ds = await Cesium.GeoJsonDataSource.load("assets/campus-buildings.geojson");
  for (const entity of ds.entities.values) {
    if (!entity.polygon) continue;
    const height = entity.properties.height
      ? Number(entity.properties.height.getValue())
      : 14;
    const name = entity.properties.name ? String(entity.properties.name.getValue() || "") : "";
    const isFrost = /weeks|volpe|foster|gusman|rehearsal|knight center for music|studio wing|recording studio/i.test(name);
    entity.polygon.height = 0;
    entity.polygon.extrudedHeight = height;
    entity.polygon.material = Cesium.Color.fromCssColorString(isFrost ? "#f4f1ea" : "#d9cbb8").withAlpha(0.96);
    entity.polygon.outline = true;
    entity.polygon.outlineColor = Cesium.Color.fromCssColorString(isFrost ? "#c4b49a" : "#6f614c");
    entity.polygon.outlineWidth = 1;
  }
  await viewer.dataSources.add(ds);
}

function runFlight(camera, { onDone }) {
  const start = performance.now();
  applyPose(camera, poseAt(0));

  let finished = false;
  function frame(now) {
    if (finished) return;
    const u = clamp01((now - start) / DURATION_MS);
    applyPose(camera, poseAt(u));
    if (u < 1) {
      requestAnimationFrame(frame);
      return;
    }
    finished = true;
    window.setTimeout(onDone, HOLD_MS);
  }

  requestAnimationFrame(frame);
  return {
    skip() {
      if (finished) return;
      finished = true;
      applyPose(camera, poseAt(1));
      onDone();
    },
  };
}

async function main() {
  setIonToken();
  const viewer = makeViewer();
  const freeze = new URLSearchParams(location.search).get("u");
  applyPose(viewer.camera, poseAt(freeze == null ? 0 : clamp01(Number(freeze))));

  const photoreal = await tryPhotorealTiles(viewer);
  if (!photoreal) {
    const osm = await tryOsmBuildings(viewer);
    if (!osm) {
      await loadCampusExtrusions(viewer);
    }
  }

  hideLoader();
  if (freeze != null) {
    if (Number(freeze) >= 1) showArrival();
    return;
  }
  const flight = runFlight(viewer.camera, { onDone: showArrival });
  document.getElementById("skip").addEventListener("click", () => flight.skip());
}

main().catch((err) => {
  console.error(err);
  hideLoader();
  showArrival();
});
