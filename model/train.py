"""Train the request-understanding model and export it for the browser.

Model: TF-IDF features -> logistic regression heads for event type, layout, setting,
styles (10 yes/no heads) and must-have amenities (10 yes/no heads). Numbers, dates and
budgets are read by a deterministic parser (engine.js), not learned.

Two feature sets are compared on validation data:
  A  word unigrams + bigrams
  B  A + character 3-5-grams (more robust to typos and unseen word forms)
Usage: python model/train.py   -> model/model_A.json, model/model_B.json, model/train_report.json
"""
import json, re, sys
from pathlib import Path
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression

ROOT = Path(__file__).resolve().parent.parent
rows = [json.loads(l) for l in open(ROOT / "data/requests.jsonl")]
STYLES = ["modern", "elegant", "rustic", "tropical", "industrial", "romantic", "corporate", "artsy", "beach", "classic"]
AMEN = ["projector", "screens", "stage", "dance_floor", "microphone", "buffet", "parking", "accessible", "natural_light", "ocean_view"]

EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+"); PHONE = re.compile(r"(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}")
NAME = re.compile(r"((?:[Tt]hanks|[Rr]egards|[Cc]heers|[Gg]racias|[Ss]aludos),?|[Mm]y name is|I am|I'm)(\s+)([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)")
def mask(t):
    t = EMAIL.sub("[EMAIL]", t); t = PHONE.sub("[PHONE]", t); return NAME.sub(lambda m: m.group(1) + m.group(2) + "[NAME]", t)
def norm(t):  # same normalisation as engine.js: mask PII, lowercase, digits -> 0 so the model learns words, not specific numbers
    return re.sub(r"\d", "0", mask(t).lower())

split = lambda s: [r for r in rows if r["split"] == s]
import os
AUG = os.environ.get("AUG") == "1"; ZIP = os.environ.get("ZIP") == "1"  # ZIP=1 -> model D: adds the team zip vocabulary (train_zip)
if ZIP: AUG = True
tr, va = split("train") + (split("train_aug") if AUG else []) + (split("train_zip") if ZIP else []), split("val")
X_tr, X_va = [norm(r["text"]) for r in tr], [norm(r["text"]) for r in va]

def heads(rs):
    y = {"event_type": [r["gold"]["event_type"] for r in rs], "layout": [r["gold"]["layout"] or "none" for r in rs],
         "setting": [r["gold"]["setting"] for r in rs]}
    for s in STYLES: y["style:" + s] = [int(s in r["gold"]["styles"]) for r in rs]
    for a in AMEN: y["amen:" + a] = [int(a in r["gold"]["must_have"]) for r in rs]
    return y

def build(char):
    w = TfidfVectorizer(lowercase=False, ngram_range=(1, 2), min_df=2, max_features=2500, sublinear_tf=True, token_pattern=r"[a-z0-9_ñáéíóú]{2,}")
    vecs = [("w", w)]
    if char: vecs.append(("c", TfidfVectorizer(lowercase=False, analyzer="char_wb", ngram_range=(3, 5), min_df=3, max_features=4000, sublinear_tf=True)))
    return vecs

def featurize(vecs, X, fit=False):
    from scipy.sparse import hstack
    mats = [(v.fit_transform(X) if fit else v.transform(X)) for _, v in vecs]
    return hstack(mats).tocsr()

def train(char):
    vecs = build(char); Xtr = featurize(vecs, X_tr, fit=True); Xva = featurize(vecs, X_va)
    ytr, yva = heads(tr), heads(va); models, acc = {}, {}
    for h in ytr:
        y = np.array(ytr[h])
        if len(set(y)) < 2: continue
        m = LogisticRegression(C=8.0, max_iter=3000); m.fit(Xtr, y); models[h] = m
        acc[h] = float((m.predict(Xva) == np.array(yva[h])).mean())
    return vecs, models, acc

def export(vecs, models, path):
    feats = []
    for kind, v in vecs:
        vocab = sorted(v.vocabulary_.items(), key=lambda kv: kv[1])
        feats.append({"kind": kind, "analyzer": "char_wb" if kind == "c" else "word", "ngram": list(v.ngram_range),
                      "vocab": [t for t, _ in vocab], "idf": [round(float(x), 3) for x in v.idf_]})
    out = {"features": feats, "heads": {}}
    for h, m in models.items():
        coef = m.coef_; cls = [str(c) for c in m.classes_]
        rowsw = []
        for r in coef:
            sparse = {int(i): round(float(x), 3) for i, x in enumerate(r) if abs(x) >= 0.03}
            rowsw.append(sparse)
        out["heads"][h] = {"classes": cls, "intercept": [round(float(x), 4) for x in m.intercept_], "coef": rowsw, "binary": coef.shape[0] == 1}
    Path(path).write_text(json.dumps(out, separators=(",", ":")))
    return Path(path).stat().st_size

report = {}
for name, char in ((("D", True),) if ZIP else (("C", True),) if AUG else (("A", False), ("B", True))):
    vecs, models, acc = train(char)
    size = export(vecs, models, ROOT / f"model/model_{name}.json")
    report[name] = {"features": "word 1-2 grams" + (" + char 3-5 grams" if char else ""), "val_head_accuracy_mean": round(float(np.mean(list(acc.values()))), 4),
                    "val_event_type": acc["event_type"], "val_layout": acc["layout"], "val_setting": acc["setting"], "export_bytes": size}
    print(name, json.dumps(report[name]))
(ROOT / ("model/train_report_zip.json" if ZIP else "model/train_report_aug.json" if AUG else "model/train_report.json")).write_text(json.dumps(report, indent=2))
