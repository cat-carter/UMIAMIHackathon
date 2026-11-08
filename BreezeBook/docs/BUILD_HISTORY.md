# BreezeBook: hackathon build
All data is synthetic. Rebuild everything:
```
pip install scikit-learn
python data/generate.py        # 40 venues, calendars, rules; 1,800 labeled requests
python model/train.py          # models A (words) and B (+ character patterns)
AUG=1 python model/train.py    # model C (+ 600 requests in a third writing style)
node model/evaluate.js         # true accuracy on familiar and unfamiliar phrasing -> model/eval_report.json
python web/build.py            # single-file website web/breeze-venues.html (uses model_web.json)
```
Splits: train 800, train_aug 600, val 100, test_in 150 (familiar phrasing), test_out 150 (phrasing never seen in training).
Caveat: the number/date parser in web/engine.js was written by the same team that wrote the unseen phrasing, so its 100% on
guests/budget/date in test_out is optimistic. Only real planner messages give real-world accuracy.
