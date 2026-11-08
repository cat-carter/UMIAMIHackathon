"""Gate 2 and Gate 3 one-pagers (Word + PDF), filled from the saved evaluation files.
Run: python docs/make_gates.py   (re-run after model/claude_eval.json exists to add Claude's numbers)"""
import json, subprocess
from pathlib import Path
R = Path(__file__).resolve().parent.parent; OUT = R / "docs/out"; OUT.mkdir(exist_ok=True)
E = {(e["model"], e["split"]): e for e in json.load(open(R / "model/eval_report.json"))}
F = json.load(open(R / "model/eval_full.json"))
CL = json.load(open(R / "model/claude_eval.json")) if (R / "model/claude_eval.json").exists() else None
w = lambda s: E[("model_web", s)]; k = lambda s: E[("rules", s)]
cal = {c["band"]: c for c in F["calibration"]}; rt = {r["split"]: r for r in F["routing"]}
HEAD = "BREEZEBOOK  |  University of Miami AI Hackathon  |  November 2026"

if CL:
    claude_line = (f"**Full system on blind test 2** (model, Claude when unsure; run {CL['run_at'][:10]}): **{CL['system_success']} fully right**, {CL['system_top3']} with a fitting space in the top 3. "
                   f"Claude alone: {CL['claude_success']} (event type {CL['claude_field_acc']['event_type']}, layout {CL['claude_field_acc']['layout']}, must-haves {CL['claude_field_acc']['must_have']}). Model alone: {CL['model_success']}. "
                   f"Claude calls: {CL['claude_calls']}, failed: {CL['failed_calls']}, median {CL['median_ms']/1000:.1f} s per answer (95% under {CL['p95_ms']/1000:.1f} s).")
    t9 = CL["thresholds"]["0.9"]
    still = (f"- Our cut-off. At 80% the model keeps {CL['thresholds']['0.8']['handled_by_model']:.0f}% of these requests and some of those are confidently wrong, so the full system ({CL['system_success']}) scores below Claude alone ({CL['claude_success']}). A 90% cut-off would have scored {t9['system_success']}% here, but we found that on this test set, so we will confirm it on a fresh set before changing it.\n"
             "- Our own test labels. 8 of Claude's 18 misses come from a clash in our blind test: the phrase \"outdoors in the sunshine\" was labeled only as outdoor, and Claude also read it as natural light. We report the stricter score and are fixing the labels.\n"
             "- Cost per Claude answer in production (the demo runs on the Claude platform, so tokens were not metered), and tests with real people's wording, not just synthetic requests.")
else:
    claude_line = "- **Claude and the full system:** not measured yet; no number is claimed. The live page has a test mode (type /eval in Breezy) that runs Claude on blind test 2."
    still = "- Claude's accuracy on the requests it receives, and the full-system score.\n- Cost, retries, failures and time per Claude answer. The model alone takes about 3 ms per request and costs nothing per use.\n- Tests with real people's wording, not just synthetic requests."

gate2 = f"""# 2. How We Plan to Build It (Gate 2)

{HEAD}

## The main flow

- A planner describes the event in plain words, with guests, budget, date and city. Example: "A 70-person workshop in Miami, with a screen and classroom seating."
- Our model reads the event type, layout, indoor/outdoor, style and must-haves, and flags missing details. Guests, budget and date are read by fixed rules, not guessed. If the model is less than 80% confident, the request goes to Claude instead.
- Code, not AI, checks the hard rules: capacity for the chosen layout (from measured usable floor area), budget including seasonal price, date availability, indoor/outdoor and required amenities.
- Spaces that lack a stage, screens or a dance floor can still match when the hotel rents that equipment. The card shows "hotel adds stage (+$1,500)" and the price includes it.
- The app ranks the spaces that fit, explains each match and shows a 3D layout drawn from the measured room.
- The planner can make an offer. The hotel's assistant negotiates within the hotel's own minimum price and offers extras instead of discounts. A hotel employee approves every deal; nothing is booked automatically.
- If nothing fits, the planner leaves their details and our team is notified to look for a property. The Breezy chat assistant answers questions on every page.

## Data and model (built and tested)

- 54 synthetic Miami hotel spaces: 40 original and 14 large convertible halls. Each has measured size, capacity for 7 layouts, amenities, rentable add-ons, seasonal prices, a 12-month booking calendar and negotiation rules.
- 2,900 synthetic labeled requests: 2,200 for training (800 + 600 + 800 in our team's wording), 100 for checking during tuning, and four test sets of 150. Two are blind tests in new wording, written and locked before training.
- Model: word and letter-pattern features with logistic regression. It runs in the browser (about 3 ms per request, 1.1 MB, no server).
- Results: {w('test_in')['success_pct']}% of familiar requests fully right; {w('test_fresh')['success_pct']}-{w('test_blind')['success_pct']}% on new wording, so those go to Claude. When the model is 90% or more confident it is right {cal['90-100%']['right_pct']}% of the time, which is why the 80% cut-off works. Keyword search: {k('test_in')['success_pct']}% and 0%.
{claude_line}

## Future product

Voice notes, inspiration photos, Pinterest boards, 360-degree tours and on-site measurement. Real measurement needs a scanning tool plus hotel staff verification; AI photo analysis alone will never be presented as an exact measurement. In the demo, measurements are simulated and spaces are shown as labeled 3D renders, not photos.

## Main safety checks

- Synthetic data only. No real people, hotels or bookings.
- No API key anywhere in the code. Claude is reached through the Claude platform the page runs on.
- Emails, phone numbers and names are masked by code before any text goes to Claude. Pattern matching can miss unusual formats, so we do not claim it catches everything.
- Contact details go only to our team, and only when the planner submits the form. Text that looks like instructions to the system is detected and ignored.
- No automatic booking or binding price. The hotel approves every final offer. Each listing says it is demo data with a simulated scan.

**AI disclosure:** built with help from Claude, an AI coding assistant, for code, synthetic data and documents. The team reviewed, tested and owns the work.

**Evidence you can open:** BreezeBook_Dataset.xlsx (Model Results, Confidence & Routing, Data Dictionary), model/RESULTS_model_D.md, model/evaluate.js and model/evaluate_full.js in the repo, and the live demo.
"""

ex = F["examples"]; right = [e for e in ex if e["right"]][:1]; wrong = [e for e in ex if not e["right"] and e["conf"] < 50][:2]
q = lambda e, n=70: '"' + (e["text"][:n].rsplit(" ", 1)[0] + "...") + '"'
gate3 = f"""# 3. Does the AI Work? (Gate 3)

{HEAD}

## How we tested

2,900 synthetic requests with correct answers (event, guests, budget, date, setting, layout, style, must-haves, and the spaces that truly fit). Tests use sets of 150 never trained on: familiar wording, and two blind tests in new wording ("tying the knot", "charity ball", "tables of ten"), written and locked before training. Fully right = every key detail read correctly, a truly fitting space in the top 3, and no recommended space that breaks the request.

## Results (rerun November 7, 2026)

| Test set | Our model | Keyword search |
|---|---|---|
| Familiar wording | {w('test_in')['success_pct']}% | {k('test_in')['success_pct']}% |
| Blind test 2 (new wording) | {w('test_blind')['success_pct']}% | {k('test_blind')['success_pct']}% |
| Blind test 1 (new wording) | {w('test_fresh')['success_pct']}% | {k('test_fresh')['success_pct']}% |
{"| **Blind test 2, full system (model + Claude)** | **" + CL["system_success"] + "** | |" + chr(10) + "| Blind test 2, Claude alone | " + CL["claude_success"] + " | |" + chr(10) if CL else ""}
{claude_line}

Model alone on new wording: guests, budget, date 100%; layout about {round((w('test_fresh')['field_acc_pct']['layout']+w('test_blind')['field_acc_pct']['layout'])/2)}%; event type about {round((w('test_fresh')['field_acc_pct']['event_type']+w('test_blind')['field_acc_pct']['event_type'])/2)}%; style weak.

## Why this matters

The model is near-perfect when people write like our examples and weak when they don't. We designed around that: its confidence score is honest.

| Confidence | Actually right |
|---|---|
| 90% or more | {cal['90-100%']['right_pct']}% |
| 80-90% | {cal['80-90%']['right_pct']}% |
| Below 50% | {cal['0-50%']['right_pct']}% |

Requests under 80% confidence go to Claude. On familiar wording the model handles {rt['test_in']['local_pct']}% itself and gets {rt['test_in']['right_when_local_pct']}% of those right; on new wording {rt['test_fresh']['to_claude_pct']}% and {rt['test_blind']['to_claude_pct']}% go to Claude.

## Examples (blind test 2)

- Wrong but caught: {q(wrong[0])} read as {wrong[0]['got'].split(' /')[0]} (truth: {wrong[0]['truth'].split(' /')[0]}), only {wrong[0]['conf']}% confident, so it goes to Claude. {q(wrong[1])} read as {wrong[1]['got'].split(' /')[0]}, {wrong[1]['conf']}%, also sent to Claude.
- Fixed after adding our team's wording: "vow renewal" now reads as wedding (98%); "Tulum-ish mixer al fresco" as tropical, outdoor networking (96%).

## What we still need to prove

{still}

**How a judge can check:** in the repo run node model/evaluate.js, model/evaluate_full.js and model/score_claude.js (rescores Claude's saved answers). Cases: data/requests.jsonl and the Event Requests tab of BreezeBook_Dataset.xlsx.
"""

for name, md in [("Gate2_How_We_Build_BreezeBook", gate2), ("Gate3_Does_the_AI_Work", gate3)]:
    p = OUT / f"{name}.md"; p.write_text(md)
    subprocess.run(["pandoc", str(p), "-o", str(OUT / f"{name}.docx"), "--reference-doc", str(R / "docs/ref_plain.docx")], check=True)
    subprocess.run(["soffice", "--headless", "--convert-to", "pdf", "--outdir", str(OUT), str(OUT / f"{name}.docx")], check=True, capture_output=True)
    print(name, "ok")
