#!/usr/bin/env python3
"""Project OSM campus footprints into a compact local-meter scene for the 3D map."""

from __future__ import annotations

import json
import math
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ORIGIN_LAT = 25.71905
ORIGIN_LON = -80.2789
M_PER_DEG_LAT = 110992.0
M_PER_DEG_LON = 110992.0 * math.cos(math.radians(ORIGIN_LAT))

MUSIC = {
    "foster memorial music building",
    "frost north studio wing",
    "frost south studio wing",
    "gusman concert hall",
    "knight center for music innovation",
    "rehearsal center",
    "volpe classroom building",
    "weeks music library and technology center",
    "weeks recording studio",
}

RESIDENTIAL_KEYS = ("residential", "village", "eaton", "vista", "pearson", "mahoney")
GARAGE_KEYS = ("garage",)
LIBRARY_KEYS = ("library",)
STUDENT_KEYS = ("student", "shala", "whitten", "toppel", "ring theatre")


def project(lon: float, lat: float) -> list[float]:
    x = (lon - ORIGIN_LON) * M_PER_DEG_LON
    z = (ORIGIN_LAT - lat) * M_PER_DEG_LAT
    return [round(x, 2), round(z, 2)]


def ring_from_lonlat(coords: list) -> list[list[float]]:
    pts = [project(lon, lat) for lon, lat in coords]
    if len(pts) > 1 and pts[0] == pts[-1]:
        pts = pts[:-1]
    return simplify(pts)


def area(ring: list[list[float]]) -> float:
    if len(ring) < 3:
        return 0.0
    s = 0.0
    for i, (x1, z1) in enumerate(ring):
        x2, z2 = ring[(i + 1) % len(ring)]
        s += x1 * z2 - x2 * z1
    return s * 0.5


def ensure_ccw(ring: list[list[float]]) -> list[list[float]]:
    return ring if area(ring) >= 0 else list(reversed(ring))


def simplify(ring: list[list[float]], min_step: float = 2.4) -> list[list[float]]:
    if len(ring) <= 8:
        return ring
    out = [ring[0]]
    for pt in ring[1:]:
        dx = pt[0] - out[-1][0]
        dz = pt[1] - out[-1][1]
        if dx * dx + dz * dz >= min_step * min_step:
            out.append(pt)
    if len(out) >= 3:
        return out
    return ring


def centroid(ring: list[list[float]]) -> list[float]:
    if not ring:
        return [0.0, 0.0]
    return [
        round(sum(p[0] for p in ring) / len(ring), 2),
        round(sum(p[1] for p in ring) / len(ring), 2),
    ]


def bbox(ring: list[list[float]]) -> tuple[float, float, float, float]:
    xs = [p[0] for p in ring]
    zs = [p[1] for p in ring]
    return min(xs), min(zs), max(xs), max(zs)


def point_in_ring(x: float, z: float, ring: list[list[float]]) -> bool:
    inside = False
    n = len(ring)
    for i in range(n):
        x1, z1 = ring[i]
        x2, z2 = ring[(i + 1) % n]
        if ((z1 > z) != (z2 > z)) and (x < (x2 - x1) * (z - z1) / ((z2 - z1) or 1e-9) + x1):
            inside = not inside
    return inside


def category_for(name: str) -> str:
    n = (name or "").lower()
    if n in MUSIC or "frost" in n and "chemistry" not in n:
        return "music"
    if any(k in n for k in GARAGE_KEYS):
        return "garage"
    if any(k in n for k in LIBRARY_KEYS):
        return "library"
    if any(k in n for k in RESIDENTIAL_KEYS):
        return "residential"
    if any(k in n for k in STUDENT_KEYS):
        return "student"
    if "ashe" in n or "administration" in n:
        return "admin"
    if name:
        return "academic"
    return "campus"


def parking_color(name: str) -> str:
    n = (name or "").lower()
    if "yellow" in n:
        return "#e3c85a"
    if "pink" in n or "pavia" in n:
        return "#e4a5b8"
    if "purple" in n:
        return "#b9a3d0"
    if "red" in n:
        return "#d97b6a"
    if "restricted" in n or "orange" in n:
        return "#e08a3c"
    return "#cfc6b4"


def osm_way_ring(el: dict) -> list[list[float]] | None:
    geom = el.get("geometry") or []
    if len(geom) < 4:
        return None
    pts = [project(p["lon"], p["lat"]) for p in geom]
    if pts[0] == pts[-1]:
        pts = pts[:-1]
    pts = simplify(pts)
    if len(pts) < 3:
        return None
    return ensure_ccw(pts)


def main() -> None:
    buildings_geo = json.loads((ROOT / "assets" / "campus-buildings.geojson").read_text())
    ground = json.loads(Path("/tmp/um-ground.osm.json").read_text())
    lake = json.loads(Path("/tmp/lake-osceola.geojson").read_text())

    buildings = []
    building_rings = []
    for feat in buildings_geo["features"]:
        geom = feat["geometry"]
        coords = geom["coordinates"][0] if geom["type"] == "Polygon" else geom["coordinates"][0][0]
        ring = ensure_ccw(ring_from_lonlat(coords))
        if len(ring) < 3:
            continue
        props = feat.get("properties") or {}
        name = (props.get("name") or "").strip()
        height = float(props.get("height") or 8)
        if height < 4:
            height = 8 if name else 6
        cat = category_for(name)
        if cat == "music" and height < 14:
            height = 16
        item = {
            "id": str(props.get("id") or f"b{len(buildings)}"),
            "name": name or "Campus building",
            "named": bool(name),
            "category": cat,
            "height": round(height, 1),
            "footprint": ring,
            "center": centroid(ring),
        }
        buildings.append(item)
        building_rings.append(ring)

    water = []
    for feat in lake.get("features", []):
        g = feat["geometry"]
        rings = g["coordinates"] if g["type"] == "Polygon" else g["coordinates"][0]
        ring = ensure_ccw(ring_from_lonlat(rings[0]))
        water.append({"name": "Lake Osceola", "footprint": ring, "center": centroid(ring)})

    parking = []
    fields = []
    lawns = []
    for el in ground.get("elements", []):
        tags = el.get("tags") or {}
        ring = osm_way_ring(el)
        if not ring:
            continue
        a = abs(area(ring))
        if tags.get("amenity") == "parking":
            if tags.get("building"):
                continue
            if a < 80:
                continue
            parking.append(
                {
                    "name": tags.get("name") or "Parking",
                    "color": parking_color(tags.get("name") or ""),
                    "footprint": ring,
                }
            )
        elif tags.get("leisure") == "pitch":
            if a > 200:
                fields.append({"name": tags.get("name") or "Field", "footprint": ring})
        elif tags.get("landuse") == "grass" or tags.get("leisure") == "park":
            if a > 3500:
                lawns.append({"footprint": ring})

    blockers = building_rings + [p["footprint"] for p in parking] + [w["footprint"] for w in water]
    block_boxes = [bbox(r) for r in blockers]

    xs = [p[0] for b in buildings for p in b["footprint"]]
    zs = [p[1] for b in buildings for p in b["footprint"]]
    minx, maxx, minz, maxz = min(xs) - 40, max(xs) + 40, min(zs) - 40, max(zs) + 40

    rng = random.Random(7)
    trees = []
    x = minx + 12
    while x < maxx:
        z = minz + 12
        while z < maxz:
            tx = x + rng.uniform(-6, 6)
            tz = z + rng.uniform(-6, 6)
            if rng.random() > 0.38:
                z += 22
                continue
            hit = False
            for (x0, z0, x1, z1), ring in zip(block_boxes, blockers):
                if x0 - 6 <= tx <= x1 + 6 and z0 - 6 <= tz <= z1 + 6:
                    if point_in_ring(tx, tz, ring):
                        hit = True
                        break
            if not hit:
                trees.append([round(tx, 1), round(tz, 1)])
            z += 22
        x += 22
    trees = trees[:420]

    scene = {
        "origin": {"lat": ORIGIN_LAT, "lon": ORIGIN_LON},
        "bounds": {"min": [round(minx, 1), round(minz, 1)], "max": [round(maxx, 1), round(maxz, 1)]},
        "buildings": buildings,
        "water": water,
        "parking": parking,
        "fields": fields,
        "lawns": lawns,
        "trees": trees,
    }
    out = ROOT / "assets" / "campus-scene.json"
    out.write_text(json.dumps(scene, separators=(",", ":")))
    print(
        "wrote",
        out,
        "buildings",
        len(buildings),
        "named",
        sum(1 for b in buildings if b["named"]),
        "parking",
        len(parking),
        "fields",
        len(fields),
        "lawns",
        len(lawns),
        "trees",
        len(trees),
        "kb",
        round(out.stat().st_size / 1024, 1),
    )


if __name__ == "__main__":
    main()
