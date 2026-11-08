import re, sys, numpy as np
sys.path.insert(0, "data"); import generate as G, add_wording as W
STOPP = set("a an the of for and or with to in on at for our my some room space big lots one up style setup seating tables table set please need".split())
def words_of(phrases): return {w for p in phrases for w in re.findall(r"[a-z][a-z'-]+", p.lower()) if w not in STOPP}
def build(include_zip=True):
    P = {}
    srcs = [(G.EVT_A, "event:"), (G.EVT_C, "event:"), (G.SYN_A, "style:"), (G.SYN_C, "style:"), (G.AM_A, "amen:"), (G.AM_C, "amen:"), (G.LAY_A, "layout:"), (G.LAY_C, "layout:")]
    if include_zip: srcs += [(W.EVT_Z, "event:"), (W.SYN_Z, "style:"), (W.AM_Z, "amen:"), (W.LAY_Z, "layout:"), (W.SET_Z, "setting:")]
    P["setting:indoor"] = {"indoors", "indoor", "inside"}; P["setting:outdoor"] = {"outdoors", "outdoor", "open", "air"}
    for d, pre in srcs:
        for k, ph in d.items(): P.setdefault(pre + k, set()).update(words_of(ph))
    # a word that is a prototype for several labels is ambiguous: keep it only where it is unique
    from collections import Counter
    cnt = Counter(w for s in P.values() for w in s)
    return {k: sorted(w for w in s if cnt[w] == 1) for k, s in P.items()}
