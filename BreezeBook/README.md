# BreezeBook

**Booking should be a breeze.** BreezeBook matches event planners with underused hotel event spaces in Miami, and helps hotels
earn money from rooms that would otherwise sit empty. Built for the UM AI Hackathon (November 2026), track: AI in Hospitality &
Entertainment.

All hotels, spaces, prices, calendars, measurements and people are synthetic demo data. No real personal data is used.

## Try it

Open `team_page/BreezeBook.html` in a browser. It is a single file and works offline. The live version
(`team_page/breezebook-team.html`) adds Claude for messages the on-device model is unsure about and the team inbox for requests.

- Describe the event in the form, or ask Breeza (bottom right), e.g. "wedding for 150 in April, $20k".
- Open any space in 3D, switch layouts, read its measurements, and send a request.
- Walk the Grand Ballroom in 360° from its card in the results.
- Search by photo with the images in `test_images/`.

## How it works

1. **Reading the request.** A small model trained on our synthetic requests (TF-IDF on words and character patterns, logistic
   regression per field) runs in the browser and reads event type, guests, budget, date, setting, layout, style and must-haves.
2. **Routing.** If the model is less than 80% sure, the request goes to Claude through the user's own Claude account. No API key
   is stored in this repo or the page.
3. **Matching.** `web/engine.js` checks every space against the request: measured capacity for the chosen layout, price for the
   date, curfew, equipment and add-ons the hotel can bring in.
4. **Seeing the room.** `web/scene.js` builds each space to scale in 3D. The Grand Ballroom tour uses the team's 360° viewer.
5. **Requesting.** Requests go to a private team inbox (5 per person per day). Nothing is booked until a person at the hotel
   approves it.

## Results (synthetic test sets, 150 requests each)

| Test set | Model on device | Notes |
|---|---|---|
| Familiar wording (test_in) | 98% fully right | Same writing style as training |
| Unfamiliar wording (test_out) | 32% | Shares some words with training data |
| New wording (test_fresh) | 12% | Frozen before training |
| Second blind test (test_blind) | 30% | Frozen before training |
| Full system on test_blind (model + Claude when unsure) | 82.7% (86.7% top 3) | |
| Claude alone on test_blind | 88% | |

When the model is at least 90% sure it is right 99.3% of the time. Full write-up: `model/RESULTS_model_D.md` and the
"Model Results" and "Failures & Improvements" sheets in `data/out/BreezeBook_Dataset.xlsx`.

## Safety

- Prompt injection: messages are screened, instruction-like sentences are removed before reaching Claude, user text is wrapped as
  data, Claude cannot send anything without the person clicking Send, and replies that invent prices or bookings get a warning.
  Details: `docs/SECURITY_prompt_injection.md`.
- Personal details are masked before any text goes to the AI.

## Repo layout

| Folder | What it is |
|---|---|
| `data/` | Scripts that generate the synthetic venues and labeled requests; `data/out/` has the dataset workbook and CSVs |
| `model/` | Training, pruning and evaluation scripts, trained models, results |
| `web/` | Matching engine, 3D scenes and the original single-file site |
| `team_page/` | The team's page design with the BreezeBook engine behind it; `look/` holds the brand layer, build script, tests and change log |
| `vectors/` | Word-vector experiments (not used in the live model) |
| `docs/` | Gate documents, business model, pitch notes, security notes |
| `test_images/` | Photos for trying Search by photo |

## Rebuild

```
pip install scikit-learn
python data/generate.py && python data/add_venues.py && python data/add_wording.py && python data/add_blind.py
ZIP=1 python model/train.py
python model/prune.py model/model_D.json model/model_web.json 0.12
node model/evaluate.js                 # accuracy on all test splits
node model/score_claude.js             # full system and Claude-only scores
python data/export_dataset.py          # data/out/BreezeBook_Dataset.xlsx
npm install                            # three.js r128 (bundled into the offline file) and Playwright for tests
npm run build                          # team_page/breezebook-team.html (live) and team_page/BreezeBook.html (offline)
npx playwright install chromium
npm test                               # Breeza chat, request form, 360° tour and prompt-injection checks
```

Screenshots from the tests go to `test-output/` (ignored by git). The team repo's 360° viewer and Grand Ballroom record are
vendored in `team_page/look/vendor/`.

## AI assistance

Built with help from Claude (Anthropic) for code, data generation, evaluation and documents, as the hackathon rules require us to
disclose. Breeza, the in-page assistant, uses Claude through the visitor's own Claude account.
