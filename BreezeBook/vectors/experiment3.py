import sys; sys.path.insert(0, "vectors"); import experiment as E, augment as A
S = lambda *n: [r for r in E.rows if r["split"] in n]
base = S("train", "train_aug"); tests = {"dev_zip": S("train_zip")[:400], "dev_out": S("test_out"), "val": S("val")}
for copies in [0, 2, 4]:
    tr = base + A.augment(base, copies, seed=11) if copies else base
    print("copies", copies, len(tr), {k: (v["event_type"], v["layout"], v["setting"], v["styles"], v["amen"], v["ALL"]) for k, v in E.run(tr, tests, 0, 8).items()}, flush=True)
