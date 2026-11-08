# 2. How We Plan to Build It (Gate 2)

BREEZEBOOK  |  University of Miami AI Hackathon  |  November 2026

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
- Results: 98% of familiar requests fully right; 12-30% on new wording, so those go to Claude. When the model is 90% or more confident it is right 99.3% of the time, which is why the 80% cut-off works. Keyword search: 21.3% and 0%.
**Full system on blind test 2** (model, Claude when unsure; run 2026-11-08): **82.7% fully right**, 86.7% with a fitting space in the top 3. Claude alone: 88% (event type 97.3%, layout 87.3%, must-haves 87.3%). Model alone: 30%. Claude calls: 150, failed: 0, median 1.5 s per answer (95% under 1.9 s).

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
