# Look update (Nov 8, 2026)

What changed (look only):
- Brand from the team repo's style guide: palm/sand/ocean colors, Bellefair headings, Montserrat text, official palm-wave logo, favicon.
- Breezy shows the Breeza mascot on the chat button and in the chat header.
- Decorative icon characters and emoji removed from labels and buttons.
- Venue cards use the team repo's photos, labeled "Illustrative photo of a similar space" (they are not photos of the listed spaces).
- New full-screen venue view: 3D to scale (seven layouts with seat counts) and a photo tour (360° banquet panorama plus theater,
  classroom, reception, U-shape, boardroom, stage, pre-function and window views of a sample ballroom, labeled illustrative).
  Opens from "View in 3D" on each card, the venue details dialog, and the Space intelligence section. Breezy moves into the view.

What did not change (checked):
- sha256 of model_web.json, venues.json, requests.jsonl, value_adds.json, engine.js, scene.js, upgrade2.js, extra.js and
  index_original.html identical before and after (restyle/before.sha256).
- node model/evaluate.js: 98% familiar, 30% blind test 2, 12% blind test 1 (unchanged).
- node model/score_claude.js: full system 82.7%, Claude 88%, model 30% (unchanged).
- injection_test.js: attack blocked with 0 Claude calls, warnings added, nothing sent without a click, injected sentence never reaches Claude.
- /eval test mode, lead form, team inbox privacy, Breezy built-in answers, search results (10 and 11 fits) identical to the previous version.
Build: python team_page/look/build3.py (live) and --standalone (single offline file). Labels are cleaned in the output only; source files are untouched.
Note: the 360 panorama source photo has a stitching seam; the view starts facing away from it.

## Grand Ballroom tour (Nov 8, 2026, second update)
- The full-screen view now uses the team repo's own 3D/tour engine (js/scene3d.js, BB3D.Viewer) and its Grand Ballroom record (js/venues.js).
- The Grand Ballroom: photographic 360° tour with layouts Banquet, Cocktail, Theater, Classroom, U-Shape, Boardroom; viewpoints Ballroom,
  Stage, Windows, Pre-function; "i" pins open room facts (capacity, dimensions, AV & stage, daylight, catering, entrance & access);
  "●" pins walk to the stage, windows or foyer; floor plan with your position; zoom and reset. Opened from the hero, a featured
  postcard above the results, and the Space intelligence section. Labeled as a demo partner tour, not one of the 54 matched spaces.
- Our 54 spaces open in the same full-screen frame with the to-scale 3D view and seven layouts. The earlier generic "photo tour"
  for other spaces was removed, so Grand Ballroom photos are never shown as another room.
- Cards show the repo photos only (the 3D render thumbnail was removed from the "View in 3D" button).
- Known: the 360° banquet photo has a stitching seam just right of the stage in the source image.
Verification rerun: logic hashes 9/9 identical; evaluate.js 98/32/12/30; Claude rescore 82.7%; injection, core-flow and /eval tests pass.

## Space intelligence panel (Nov 8, 2026, third update)
- The measured-room floor plan (Azul Ballroom) in "See the space. Understand the setup." is replaced by the Grand Ballroom: an inline
  360° tour with Banquet, Cocktail, Theater, Classroom, U-Shape and Boardroom, info pins, room-facts cards and a Full screen button.
- "Know before you book" shows the Grand Ballroom's facts (size, ceiling, capacities, view, equipment, rental, food & drink, hours, notes).
- The old floor-plan elements stay in the page, hidden, because the cards' "View details" still updates them; removing them would break it.
- Pins and buttons sit above the viewer (not inside it) so real clicks reach them.
Verification rerun: logic hashes 9/9; injection, core-flow, tour and panel tests pass; no horizontal scroll on phones.

## Breeza, photo search and request a space (Nov 8, 2026, fourth update)
- Assistant renamed Breezy to Breeza everywhere in the page (chat, greeting, button, prompt text). Renamed in the build output only.
- Breeza's chat opens as a pop-up card with a Close button in its header (bottom sheet on phones). It closes at any time.
- The Grand Ballroom card in the results row is the same size as the other cards and uses the team's Grand Ballroom photo.
- Search by photo: a pop-up where judges pick a sample or upload a photo. It was taught with the team's two photos (Grand Ballroom,
  dark event hall). Test photos in look/judge_photos (cropped and mirrored so they are not the training images) match: grand
  ballroom -> grand, event hall -> hall, rooftop -> rooftop, courtyard -> garden. It reads colors, light and layout, not sizes.
- Full-screen view has a Details panel (open by default on wide screens): measurements (sq ft, length x width, ceiling, max guests),
  capacity by layout (current one highlighted), equipment and hotel add-ons with prices, pricing and an estimate, hours and notes.
- "Request this space" form, modeled on the team repo's request form: name, email, phone, event, guests, date, start, end, setup
  (with capacity), food & drink, notes. Checks required fields and the setup's capacity. Sends through the same team inbox as the
  lead form (5 per day, signed-in Claude users, owner-only reading). The receipt shows the measurements and estimate, says
  "Request sent" or "Saved on this device, not sent yet" honestly, and has Copy request.
Verification rerun: logic hashes 9/9 identical; evaluate.js unchanged; Claude rescore 82.7% / 88%; injection, core-flow (10 and 11 fits),
/eval, tour, panel and request tests pass; no horizontal scroll at 390 px.

## Hero and faster Breeza (Nov 8, 2026, fifth update)
- Removed the "Walk the Grand Ballroom" button from the hero. "Search by photo" stays. The Grand Ballroom is still reachable from
  its card in the results and from the Space intelligence section.
- Breeza answers on the device first, in under 0.2 s, for event searches ("wedding for 150 in April, $20k"), follow-ups ("outdoor",
  "80"), greetings and common questions (prices, sizes, adding a stage, privacy, offers). Replies read back what she understood,
  list the best 3 spaces with seats, price estimate and a View in 3D button, and offer tap-to-answer chips. If guests are missing
  she asks for them. A new event type starts a fresh search. Anything else still goes to Claude, now with a 15 second limit and a
  "Breeza is thinking…" line, then the on-device fallback.
- This is a change to the chat code (team_page/extra.js), so its hash differs from restyle/before.sha256. The matching engine,
  model, data and scene files are unchanged (8 of 8 hashes identical).
Verification rerun: evaluate.js and Claude rescore unchanged; injection test passes (a Claude-bound question still gets price and
booking warnings and nothing is sent without a click); core flow, /eval, tour, panel, request and chat tests pass.
