import json, re, sys, numpy as np
sys.path.insert(0, "vectors"); from load_vectors import load; import protos, experiment as E
from sklearn.linear_model import LogisticRegression
from sklearn.feature_extraction.text import TfidfVectorizer
from scipy.sparse import hstack, csr_matrix
vec, words, vn = E.vec, E.words, E.vn
def make_sim(P):
    labs = sorted(P); mats = {}
    for L in labs:
        ws = [w for w in P[L] if w in words]
        mats[L] = (ws, vn[[words[w] for w in ws]] if ws else np.zeros((0, 300)))
    def feats(text):
        ws = E.toks(text); f = np.zeros(len(labs))
        if not ws: return f
        Q = vn[[words[w] for w in ws]]
        for j, L in enumerate(labs):
            pw, M = mats[L]
            if not len(pw): continue
            S = Q @ M.T
            for i, w in enumerate(ws):  # leave-one-out: a word never matches itself, so train and test look alike
                for k, p in enumerate(pw):
                    if p == w: S[i, k] = -1
            f[j] = max(0, S.max())
        return f
    return labs, feats
def run(tr, tests, P, beta, C, tfidf=True):
    labs, sf = make_sim(P)
    w = TfidfVectorizer(lowercase=False, ngram_range=(1,2), min_df=2, max_features=2500, sublinear_tf=True, token_pattern=r"[a-z0-9_]{2,}")
    c = TfidfVectorizer(lowercase=False, analyzer="char_wb", ngram_range=(3,5), min_df=3, max_features=4000, sublinear_tf=True)
    def feat(rs, fit=False):
        T = [E.clean(r["text"]) for r in rs]; parts = []
        if tfidf: parts += [w.fit_transform(T) if fit else w.transform(T), c.fit_transform(T) if fit else c.transform(T)]
        S = np.array([sf(r["text"]) for r in rs]); parts.append(csr_matrix(beta * np.hstack([S, S**3])))
        return hstack(parts).tocsr()
    Xtr = feat(tr, True); ytr = E.heads(tr); res = {}
    for k, rs in tests.items():
        Xt = feat(rs); yt = E.heads(rs); ok = np.ones(len(rs), bool); acc = {}
        for h, y in ytr.items():
            p = LogisticRegression(C=C, max_iter=3000).fit(Xtr, y).predict(Xt) if k == list(tests)[0] or True else None
            hit = p == np.array(yt[h]); ok &= hit
            if h in ("event_type","layout","setting"): acc[h] = round(hit.mean()*100,1)
        acc["ALL"] = round(ok.mean()*100,1); res[k] = acc
    return res
if __name__ == "__main__":
    S = lambda *n: [r for r in E.rows if r["split"] in n]
    tr = S("train","train_aug"); tests = {"dev_zip": S("train_zip")[:300], "dev_out": S("test_out"), "val": S("val")}
    P = protos.build(include_zip=False)
    for beta, C, tf in [(1,8,True),(3,8,True),(3,4,True),(3,4,False)]:
        print(beta, C, tf, run(tr, tests, P, beta, C, tf), flush=True)
