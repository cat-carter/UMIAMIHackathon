"""Word-vector augmentation: rewrite training requests by swapping content words for nearest neighbours
in the spaCy vectors (automatic, no hand-picked synonyms). Labels are unchanged."""
import json, re, sys, random, numpy as np
sys.path.insert(0, "vectors"); import experiment as E
words, vn = E.words, E.vn
KEEP = set("no not without inside outside indoor outdoor indoors outdoors open air miami".split()) | E.STOP
rowwords = {}
for w, r in words.items(): rowwords.setdefault(r, []).append(w)
# candidate replacement vocabulary: plain words, prefer ones with their own row neighbours
from wordfreq import top_n_list
import protos
COMMON = [w for w in top_n_list("en", 30000) if w.isalpha() and len(w) >= 3]
cand = [w for w in COMMON if w in words]
LABELWORDS = {w for ws in protos.build(include_zip=False).values() for w in ws} | {"wedding","birthday","conference","meeting","gala","networking","workshop","party","dinner","reception","celebration","training","session","summit","mixer","fundraising","charity","holiday","company","launch"}
cand_rows = np.array([words[w] for w in cand]); CM = vn[cand_rows]
_cache = {}
_P = protos.build(include_zip=False); OWNER = {x: L for L, ws in _P.items() for x in ws}
for _w in ["wedding","birthday","conference","meeting","gala","networking","workshop","party"]: OWNER[_w] = "event:" + _w
def neighbours(w, k=6, th=0.6):
    if w in _cache: return _cache[w]
    s = CM @ vn[words[w]]; idx = np.argpartition(-s, 60)[:60]; idx = idx[np.argsort(-s[idx])]
    out = [cand[i] for i in idx if s[i] >= th and cand[i] != w and not cand[i].startswith(w[:4]) and OWNER.get(cand[i], OWNER.get(w)) == OWNER.get(w)][:k]
    _cache[w] = out; return out
def rewrite(text, R, p=0.7):
    def sub(m):
        w = m.group(0); lw = w.lower()
        if lw in KEEP or lw not in words or lw not in LABELWORDS or R.random() > p or len(lw) < 3: return w
        nb = neighbours(lw); return R.choice(nb) if nb else w
    head, sep, tail = text.partition(" Thanks, ")
    return re.sub(r"[A-Za-z][a-z'-]+", sub, head) + sep + tail
def augment(rows, n_copies, seed=1):
    R = random.Random(seed); out = []
    for c in range(n_copies):
        for r in rows: out.append({**r, "text": rewrite(r["text"], R), "split": "train_vec"})
    return out
if __name__ == "__main__":
    R = random.Random(3)
    rs = [json.loads(l) for l in open("data/requests.jsonl")][:5]
    for r in rs: print(r["text"][:150], "\n ->", rewrite(r["text"], R)[:150])
