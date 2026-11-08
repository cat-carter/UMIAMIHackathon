# Model D: trained with the team's unfamiliar-wording vocabulary

Training data: train (800) + train_aug (600) + train_zip (800, built from language-engine.js vocabulary). All synthetic.
New honest test: test_fresh (150), wording used in no training set and not in the zip. Written and frozen before training.
"Fully right" = every field read correctly, a correct space in the top 3, and no rule-breaking pick.

| Test set | Old model (C) | New model (D) |
|---|---|---|
| Familiar wording (test_in) | 98.0% | 98.0% |
| Old unfamiliar test (test_out)* | 8.7% | 32.0% |
| New unfamiliar test (test_fresh) | 13.3% | 12.0% |
| Seating layout read right, test_fresh | 75.3% | 90.0% |
| Correct space in top 3, test_fresh | 44.7% | 45.3% |

*test_out shares many words with the zip (vow renewal, annual convention, Tulum-ish, Gatsby, rounds of ten, beamer), so its gain is partly memorised. Use test_fresh as the real number.

Confidence routing (below 0.8 goes to Claude): familiar wording 97.3% handled locally, 100% right; test_fresh 97.3% sent to Claude.
Not covered by our labels: AC, power outlets and soundproofing (the zip reads these; BreezeBook does not filter on them yet).
Reproduce: python data/add_wording.py; ZIP=1 python model/train.py; python model/prune.py model/model_D.json model/model_web.json 0.12; node model/evaluate.js

## Second blind test and word-vector experiments (Nov 7, evening)
test_blind (150): another new wording family, frozen before any experiment. Model D (live on the site): 30.0% fully right
(old model C: 18.7%); event 53%, setting 80%, layout 91%, top-3 hit 64.7%.

Tried adding general English knowledge from spaCy word vectors (en_core_web_md). All choices made on practice sets only
(train_zip and test_out, with the model trained without them), never on test_fresh or test_blind:
| Method | Practice-set gain (fully right) | Kept? |
|---|---|---|
| Averaged word vectors as extra features | +2 pts | No |
| Similarity to each label's example words (leave-one-out) | +3 pts | No |
| Auto-generated paraphrases by nearest-neighbour word swaps | 0 to -2 pts | No |
None was worth an extra ~1 MB in the page. Generic word vectors confuse event words (wedding~holiday, rustic~elegant).
Conclusion: a small model reaches about 98% on familiar wording and 12-30% on new wording. Understanding new
wording needs a language model, which is why unsure requests are routed to Claude.

## Claude and the full system (blind test 2, run 2026-11-08 in the live page with /eval)
150 Claude calls, 0 failed, median 1.5 s, 95% under 1.9 s. Rescored offline with model/score_claude.js.
| Reader | Fully right | Fitting space in top 3 |
|---|---|---|
| Model alone | 30.0% | 64.7% |
| Claude alone | 88.0% | 90.0% |
| Full system (model when >= 80% sure, else Claude) | 82.7% | 86.7% |
Claude field accuracy: event 97.3%, guests/budget/date 100%, setting 98.7%, styles 98%, layout 87.3%, must-haves 87.3%.
8 of Claude's 18 misses come from a label clash in our test ("outdoors in the sunshine" labeled outdoor only; Claude also adds natural light). Stricter score reported.
Cut-off: 90% would have given 88.0% here (model keeps 2%), but it was found on this test set; confirm on a fresh set before changing.
