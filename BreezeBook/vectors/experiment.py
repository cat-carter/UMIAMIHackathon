import json, re, sys, numpy as np
sys.path.insert(0, "vectors"); from load_vectors import load
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from scipy.sparse import hstack, csr_matrix
VD = __import__("os").environ.get("SPACY_VOCAB", "en_core_web_md-3.7.1/vocab")  # path to the unpacked en_core_web_md vocab
vec, words = load(VD); vn = vec / (np.linalg.norm(vec, axis=1, keepdims=True) + 1e-9)
rows = [json.loads(l) for l in open("data/requests.jsonl")]
STY = ["modern","elegant","rustic","tropical","industrial","romantic","corporate","artsy","beach","classic"]
AM = ["projector","screens","stage","dance_floor","microphone","buffet","parking","accessible","natural_light","ocean_view"]
STOP = set("a an the of for in on at to and or with we our my us is it be please need want some something like looking hi hello miami people guests thanks can do any".split())
EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+"); NAME = re.compile(r"Thanks, .*$")
def clean(t): return re.sub(r"\d", "0", NAME.sub("", EMAIL.sub("", t)).lower())
def toks(t): return [w for w in re.findall(r"[a-z][a-z'-]+", clean(t)) if w not in STOP and w in words]
def wv(t):
    ws = toks(t)
    if not ws: return np.zeros(600)
    M = vn[[words[w] for w in ws]]
    return np.concatenate([M.mean(0), M.max(0)])
def heads(rs):
    y = {"event_type": [r["gold"]["event_type"] for r in rs], "layout": [r["gold"]["layout"] or "none" for r in rs], "setting": [r["gold"]["setting"] for r in rs]}
    for s in STY: y["style:"+s] = [int(s in r["gold"]["styles"]) for r in rs]
    for a in AM: y["amen:"+a] = [int(a in r["gold"]["must_have"]) for r in rs]
    return y
def run(tr, tests, alpha, C, use_tfidf=True):
    X = [clean(r["text"]) for r in tr]
    w = TfidfVectorizer(lowercase=False, ngram_range=(1,2), min_df=2, max_features=2500, sublinear_tf=True, token_pattern=r"[a-z0-9_]{2,}")
    c = TfidfVectorizer(lowercase=False, analyzer="char_wb", ngram_range=(3,5), min_df=3, max_features=4000, sublinear_tf=True)
    def feat(rs, fit=False):
        T = [clean(r["text"]) for r in rs]; parts = []
        if use_tfidf: parts += [w.fit_transform(T) if fit else w.transform(T), c.fit_transform(T) if fit else c.transform(T)]
        if alpha: parts.append(csr_matrix(alpha * np.array([wv(r["text"]) for r in rs])))
        return hstack(parts).tocsr()
    Xtr = feat(tr, True); ytr = heads(tr); out = {}
    Xts = {k: feat(v) for k, v in tests.items()}; yts = {k: heads(v) for k, v in tests.items()}
    preds = {k: {} for k in tests}
    for h, y in ytr.items():
        m = LogisticRegression(C=C, max_iter=3000).fit(Xtr, y)
        for k in tests: preds[k][h] = m.predict(Xts[k])
    for k, rs in tests.items():
        ok = np.ones(len(rs), bool); acc = {}
        for h in ytr: hit = np.array(preds[k][h]) == np.array(yts[k][h]); ok &= hit
        for g in ["event_type","layout","setting"]: acc[g] = round(float((np.array(preds[k][g]) == np.array(yts[k][g])).mean())*100,1)
        sty = np.all([np.array(preds[k]["style:"+s]) == np.array(yts[k]["style:"+s]) for s in STY], 0); am = np.all([np.array(preds[k]["amen:"+a]) == np.array(yts[k]["amen:"+a]) for a in AM], 0)
        acc["styles"] = round(float(sty.mean())*100,1); acc["amen"] = round(float(am.mean())*100,1); acc["ALL"] = round(float(ok.mean())*100,1)
        out[k] = acc
    return out
if __name__ == "__main__":
    S = lambda *n: [r for r in rows if r["split"] in n]
    tr = S("train","train_aug"); tests = {"dev_zip": S("train_zip")[:400], "dev_out": S("test_out"), "val": S("val")}
    for alpha, C in [(0,8),(0.5,8),(1,8),(2,8),(1,2),(2,2),(3,4)]:
        print(alpha, C, run(tr, tests, alpha, C))
