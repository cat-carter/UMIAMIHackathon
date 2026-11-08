"""Assemble the single-file site. python web/build.py [--local]  (--local swaps CDN scripts for local copies, for testing)"""
import json, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent; W = ROOT / "web"
local = "--local" in sys.argv
NPM = str(__import__("pathlib").Path(__file__).resolve().parents[1] / "node_modules/three")  # npm install three@0.128.0
three = f'<script src="file://{NPM}/build/three.min.js"></script><script src="file://{NPM}/examples/js/controls/OrbitControls.js"></script>' if local else \
        '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script><script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>'
rep = []
get = lambda m, s: next(r for r in rep if r["model"] == m and r["split"] == s)
data = "const VENUES=" + (ROOT / "data/venues.json").read_text() + ";\nconst BOARDS=" + (ROOT / "data/boards.json").read_text() + \
       ";\nconst VALUE=" + (ROOT / "data/value_adds.json").read_text() + ";\nconst MODEL=" + (ROOT / "model/model_web.json").read_text() + \
       ";\n"
html = (W / "head.html").read_text() + (W / "body.html").read_text() + three + "<script>\n" + data + (W / "engine.js").read_text() + "\n" + (W / "scene.js").read_text() + "\n" + (W / "app.js").read_text() + "\n</script>\n"
out = W / ("site_local.html" if local else "breeze-venues.html")
out.write_text(html); print(out, round(len(html) / 1024), "KB")
