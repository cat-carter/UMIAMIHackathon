# 3. Does the AI Work? (Gate 3)

BREEZEBOOK  |  University of Miami AI Hackathon  |  November 2026

## How we tested

2,900 synthetic requests with correct answers (event, guests, budget, date, setting, layout, style, must-haves, and the spaces that truly fit). Tests use sets of 150 never trained on: familiar wording, and two blind tests in new wording ("tying the knot", "charity ball", "tables of ten"), written and locked before training. Fully right = every key detail read correctly, a truly fitting space in the top 3, and no recommended space that breaks the request.

## Results (rerun November 7, 2026)

| Test set | Our model | Keyword search |
|---|---|---|
| Familiar wording | 98% | 21.3% |
| Blind test 2 (new wording) | 30% | 0% |
| Blind test 1 (new wording) | 12% | 0% |
| **Blind test 2, full system (model + Claude)** | **82.7%** | |
| Blind test 2, Claude alone | 88% | |

**Full system on blind test 2** (model, Claude when unsure; run 2026-11-08): **82.7% fully right**, 86.7% with a fitting space in the top 3. Claude alone: 88% (event type 97.3%, layout 87.3%, must-haves 87.3%). Model alone: 30%. Claude calls: 150, failed: 0, median 1.5 s per answer (95% under 1.9 s).

Model alone on new wording: guests, budget, date 100%; layout about 91%; event type about 49%; style weak.

## Why this matters

The model is near-perfect when people write like our examples and weak when they don't. We designed around that: its confidence score is honest.

| Confidence | Actually right |
|---|---|
| 90% or more | 99.3% |
| 80-90% | 84.6% |
| Below 50% | 23.3% |

Requests under 80% confidence go to Claude. On familiar wording the model handles 97.3% itself and gets 100% of those right; on new wording 97.3% and 90% go to Claude.

## Examples (blind test 2)

- Wrong but caught: "Could you suggest places for a turning thirty bash in Miami the 17th..." read as conference (truth: birthday), only 23% confident, so it goes to Claude. "Seeking a venue for a steering committee in Miami for 10 pax, cap of..." read as conference, 38%, also sent to Claude.
- Fixed after adding our team's wording: "vow renewal" now reads as wedding (98%); "Tulum-ish mixer al fresco" as tropical, outdoor networking (96%).

## What we still need to prove

- Our cut-off. At 80% the model keeps 10% of these requests and some of those are confidently wrong, so the full system (82.7%) scores below Claude alone (88%). A 90% cut-off would have scored 88% here, but we found that on this test set, so we will confirm it on a fresh set before changing it.
- Our own test labels. 8 of Claude's 18 misses come from a clash in our blind test: the phrase "outdoors in the sunshine" was labeled only as outdoor, and Claude also read it as natural light. We report the stricter score and are fixing the labels.
- Cost per Claude answer in production (the demo runs on the Claude platform, so tokens were not metered), and tests with real people's wording, not just synthetic requests.

**How a judge can check:** in the repo run node model/evaluate.js, model/evaluate_full.js and model/score_claude.js (rescores Claude's saved answers). Cases: data/requests.jsonl and the Event Requests tab of BreezeBook_Dataset.xlsx.
