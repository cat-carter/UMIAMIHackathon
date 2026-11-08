"""Read spaCy en_core_web_md word vectors (20k unique vectors, 300 dims) without installing spaCy.
Keys are MurmurHash64A(seed=1) of each string, as spaCy does."""
import json, msgpack, numpy as np, sys
M64 = (1 << 64) - 1
def murmur64a(data: bytes, seed=1):
    m, r = 0xc6a4a7935bd1e995, 47
    h = (seed ^ (len(data) * m)) & M64
    n = len(data) // 8
    for i in range(n):
        k = int.from_bytes(data[8*i:8*i+8], "little")
        k = (k * m) & M64; k ^= k >> r; k = (k * m) & M64
        h ^= k; h = (h * m) & M64
    tail = data[8*n:]
    if tail:
        h ^= int.from_bytes(tail, "little"); h = (h * m) & M64
    h ^= h >> r; h = (h * m) & M64; h ^= h >> r
    return h
def load(d):
    vec = np.load(d + "/vectors")
    k2r = msgpack.unpackb(open(d + "/key2row", "rb").read(), strict_map_key=False)
    strings = json.load(open(d + "/strings.json"))
    words = {}
    for s in strings:
        if s.isascii() and s.replace("-", "").replace("'", "").isalpha() and s == s.lower() and len(s) < 20:
            row = k2r.get(murmur64a(s.encode()))
            if row is not None: words[s] = row
    return vec, words
if __name__ == "__main__":
    vec, words = load(sys.argv[1]); print(vec.shape, len(words), "lowercase words with vectors")
    def sim(a, b): x, y = vec[words[a]], vec[words[b]]; return float(x @ y / np.linalg.norm(x) / np.linalg.norm(y))
    for a, b in [("wedding", "nuptials"), ("tropical", "caribbean"), ("projector", "projection"), ("elegant", "luxurious"), ("party", "shindig"), ("wedding", "knot")]:
        print(a, b, round(sim(a, b), 2) if a in words and b in words else "missing")
