# Green U — Frost School of Music fly-in

Cinematic satellite-to-3D approach from the University of Miami Coral Gables campus to the Frost School of Music. This is the opening of the Green U LEED tour.

## How the camera works

The opener is a **CesiumJS globe**, not a CSS zoom of a still map.

1. A real Esri World Imagery globe starts high over Miami / Biscayne Bay.
2. One `camera.lookAt` trajectory interpolates longitude, latitude, height, heading, pitch, and range for 17 seconds, with exponential altitude so the move feels like Google Earth.
3. If a Cesium ion token can load **Google Photorealistic 3D Tiles**, the campus buildings are the actual photogrammetry of Frost (the same family of data as Google Earth).
4. Otherwise the flight keeps the satellite globe and extrudes OpenStreetMap footprints for the Frost music cluster (Weeks, Volpe, Foster, Gusman, Knight Center).

The look-at target is the Weeks Music Library and Technology Center in the Frost cluster, `25.71912, -80.28024`, approached from the south over Lake Osceola.

After the camera settles, **Enter the tour** opens `tour.html`.

## Run it

```bash
node server.js
```

Open http://127.0.0.1:8000.

```bash
node --test tests/flyin.test.js
```

Photoreal 3D tiles need a Cesium ion token with Google Photorealistic 3D Tiles enabled. Set `CESIUM_ION_TOKEN` in the environment (or the app secrets form). Without it, the satellite flight and campus extrusions still run.

## Team

U Miami Hackathon 2026 — Catherine Carter, Dalia Reisner, Eli Mercado Renner, Sampada Donahalli Dinesh, Sultanah Edrees. Mentor: Matt Jasieck.
