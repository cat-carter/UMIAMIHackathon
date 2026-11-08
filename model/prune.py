"""Shrink a model for the browser: drop weights below a threshold, then drop vocabulary no head uses.
python model/prune.py model/model_D.json model/model_web.json 0.12"""
import json, sys
src, dst, th = sys.argv[1], sys.argv[2], float(sys.argv[3])
M = json.load(open(src))
for h in M["heads"].values(): h["coef"] = [{i: w for i, w in r.items() if abs(w) >= th} for r in h["coef"]]
used = {int(i) for h in M["heads"].values() for r in h["coef"] for i in r}
off, remap = 0, {}
for f in M["features"]:
    keep = [i for i in range(len(f["vocab"])) if off + i in used]
    newoff = sum(len(g["vocab"]) for g in M["features"][:M["features"].index(f)])  # recomputed below
    f["_keep"], f["_off"] = keep, off; off += len(f["vocab"])
new = 0
for f in M["features"]:
    for j, i in enumerate(f["_keep"]): remap[f["_off"] + i] = new + j
    f["vocab"] = [f["vocab"][i] for i in f["_keep"]]; f["idf"] = [f["idf"][i] for i in f["_keep"]]
    new += len(f["vocab"]); del f["_keep"], f["_off"]
for h in M["heads"].values(): h["coef"] = [{str(remap[int(i)]): w for i, w in r.items()} for r in h["coef"]]
json.dump(M, open(dst, "w"), separators=(",", ":"))
import os; print(dst, round(os.path.getsize(dst) / 1024), "KB", [len(f["vocab"]) for f in M["features"]])
