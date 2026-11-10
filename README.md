# Green U — Coral Gables 3D campus map

Interactive 3D map of the University of Miami Coral Gables campus, in the same spirit as [CampusMapper](https://campusmapper.com/campus-map/michigan-state-university/): rotate the campus, zoom, search, and click a building.

The model is built from the official Gables campus map plus OpenStreetMap footprints. Buildings are simple extruded masses on a cream ground, with Lake Osceola, parking lots, fields, and trees. The Frost School of Music cluster is highlighted in Miami green.

## Use it

- The opener holds on the whole campus, then zooms into Frost School of Music
- Drag to orbit, scroll to zoom, click a building for its name
- Search or use the directory to fly to a hall
- **Frost School of Music** jumps to Weeks on Lake Osceola
- **2D plan** tilts the same model top-down
- From any Frost building, **Enter the LEED tour**

```bash
node server.js
```

Open http://127.0.0.1:8000.

```bash
node --test tests/campus-map.test.js
```

Rebuild projected scene data after changing footprints:

```bash
python3 scripts/build-campus-scene.py
```

## Team

U Miami Hackathon 2026 — Catherine Carter, Dalia Reisner, Eli Mercado Renner, Sampada Donahalli Dinesh, Sultanah Edrees. Mentor: Matt Jasieck.
