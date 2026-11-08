# Breeze Book

"Booking should be a Breeze." A web app that matches people planning events (weddings, quinceañeras, birthdays, company events) with event spaces at partner hotels in Miami. Users chat with **Breeza**, an assistant who asks about the event and ranks venues. Each venue opens full screen as a to-scale 360° room, with Breeza's chat floating beside it so the user can keep asking questions.

This repository is Breeze Book only.

## Commands

| Command | What it does |
|---|---|
| `npm start` | Serves the site at http://127.0.0.1:8000 (Express; also exposes `/api/breeze` when `ANTHROPIC_API_KEY` is set) |
| `npm run check` | Fast static checks: JS syntax, files referenced by `index.html`, brand artwork, venue catalog schema |
| `npm test` | Headless-browser smoke test of the main flows. First time: `npm install && npx playwright install chromium` |
| `npm run build` | Inlines everything into `dist/breezebook.html` (standalone) and `dist/artifact.html` (for publishing as a claude.ai artifact) |

Run `npm run check` after every change and `npm test` before committing UI or logic changes.

## Files

```
index.html        Page markup: header, ocean hero with the chat, How it works, Find a venue grid,
                  For hotels band, footer, and the full-screen venue view (#imm). Official logos are
                  <img> tags pointing at brand/; UI icons stay in <defs>.
brand/            Official artwork from the style guide: icon.png (circular), mark.png (palm–wave),
                  favicon.png. Do not stretch or redraw.
server.js         Static file server plus /api/status and /api/breeze (Anthropic, optional).
css/styles.css    All styles. Design tokens on :root (light) with dark-mode overrides. No framework.
js/venues.js      The venue catalog: window.BB_DATA = { AREAS, LAYOUTS, VENUES }. Pure data.
js/scene3d.js     3D engine (three.js r128): buildScene(), the Viewer class (drag/zoom 360° camera),
                  loadThree(), webglOK(). Exposes window.BB3D.
js/app.js         Everything else: helpers, matching/scoring, text parsing, Breeza (AI + guided),
                  chat UI, photos, voice, venue grid, full-screen view, request form, thumbnails.
scripts/          serve.mjs (dev server), check.mjs (static checks), build-single.mjs (single-file builds)
tests/smoke.cjs   Playwright smoke test
```

No build step and no framework: plain browser scripts loaded in order (`venues.js` → `scene3d.js` → `app.js`). `app.js` is one IIFE; keep new code inside it and in the matching section (they're marked with `/* ---------- name ---------- */` headers).

## How it works

**Brief and matching.** `brief` (in `app.js`) holds what Breeza has learned: `eventType, guests, date, time, lateNight, area, setting, layout, catering, needs[], budget, style[]`. `parseText()` pulls these out of free text with regexes; `mergeBrief()` applies them. `scoreVenue(v, brief)` returns `{ score 1–99, ok[], no[], layout, cap, est, fits }`: capacity for the chosen layout matters most (35 of 110 points), then area, equipment needs, budget, setting, style and event type. `pickLayout()` infers banquet/reception/theater/classroom/boardroom from the event and catering. `ranked()` sorts venues; `showMatches()` posts the top 3 into the chat.

**Breeza has two modes.**
- *AI mode*: when the page runs as a claude.ai artifact with the `sample` capability, `window.claude.use('sample')` returns a function that calls Claude. Hosted on this server, Breeza also uses AI when `GET /api/status` reports `live: true` (`ANTHROPIC_API_KEY`). `aiReply()` sends `rulesPrompt()` (persona, rules, the full catalog as text, the current brief, and which venue is open) plus the conversation. Claude replies in plain text, then a line `###`, then JSON with the updated brief and `showMatches`. Only the text before `###` is shown (`visiblePart()`); the JSON is validated by `normalizeAI()`.
- *Guided mode*: everywhere else (local dev, public links, if the AI call fails). `guidedReply()` asks the next missing question from `Q` in `ORDER`, offers tap-to-answer chips, and shows matches once enough is known. While a venue is open, `venueAnswer()` answers questions about it (ceiling, size, capacity, price, catering, hours, AV, dance floor, stage, parking, rain, view, booking, accessibility) from the catalog.
- Never let Breeza state facts that aren't in the catalog. She can't see availability; hotels confirm dates.

**Full-screen venue view.** `openVenue(id)` shows `#imm`, asks the browser for real full screen on desktop (falls back to filling the window), builds the stage, details panel and layout switcher, and *moves the existing chat element* (`.chat`) from `.chat-wrap` into `#immChat`. `closeImm()` moves it back. Never clone or re-create the chat: moving it keeps the conversation and every listener. Clicking another match while open switches venue in place. On phones the chat is a bottom sheet and the 3D stage shrinks above it (`.imm.chat-up`); Details is a separate sheet.

**3D rooms.** `buildScene(venue, layout, guests)` draws the room to scale in feet from `dims` and `scene` (floor textures, walls, windows, chandeliers, stage, screens, dance floor, palms, string lights, skyline, water) and lays out furniture for the layout and guest count with instanced meshes. Canvas-generated textures only; no image assets. Thumbnails for cards are rendered once by `makeThumbs()` into JPEG data URLs. three.js loads lazily from cdnjs (`r128`, UMD build, which defines `window.THREE`); without WebGL a text fallback appears.

**Requests.** `renderRequest()` / `renderReceipt()` in the details panel. Nothing is sent anywhere: the receipt says so. Keep that honest until a real backend exists.

**Voice and photos.** Photos are downscaled and sent to Claude as images in AI mode. Voice uses `getUserMedia` + `MediaRecorder` with Web Speech API transcription; where the microphone is blocked (claude.ai artifacts, plain http), it falls back to uploading a voice memo, which is attached to the request but not transcribed.

## Venue schema (`js/venues.js`)

```js
{
  id: 'brisa-ballroom',            // unique, lowercase-with-dashes
  hotel: 'Coral Tide Hotel', area: 'Brickell',   // area must be one of AREAS
  space: 'Brisa Ballroom', kind: 'Grand ballroom',
  setting: 'indoor',               // 'indoor' | 'outdoor'
  view: null,                      // short text, or null for windowless rooms
  blurb: 'One sentence shown in the details panel.',
  dims: { l: 96, w: 64, h: 18 },   // feet; h = ceiling (null for open-air)
  cap: { banquet: 380, reception: 600, theater: 650, classroom: 320 }, // add boardroom if offered; omit layouts not offered; reception required
  amen: [{ n: 'Dance floor', s: '30 × 30 ft', t: 'dance' }],  // t (optional) = screen|dance|stage|mic|dj|vc|bridal, used for matching
  price: { rental: 6500, rentalNote: 'per event, up to 6 hours', fbMin: 35000, perGuest: 165, perGuestNote: 'plated dinner' },
  hours: [['Every day', '7:00 am – 1:00 am']],
  closesAt: 25,                    // 24h clock, past midnight = 24+ (1 am = 25); used for late-night matching
  notes: ['Music until 12:30 am'], // include rain plans, sound curfews, parking
  style: ['classic', 'glam'],      // matched against the brief's vibe (see STYLE_SYN in app.js)
  goodFor: ['wedding', 'gala'],    // event types from TYPE_RX in app.js
  scene: { kind: 'indoor', floor: 'carpet', carpet: ['#27324B', '#B8925A'], wall: '#EFE5D6', wallType: 'panel',
           ceiling: '#F5EFE4', chandeliers: 6, stage: { w: 24, d: 12, h: 2 }, dance: { w: 30, d: 30 },
           screens: [{ w: 20, h: 11 }], chair: '#C9A45C', cloth: '#F7F4EE', accent: '#E6A5A1' }
}
```

`scene.kind` is `indoor | lawn | rooftop | courtyard | pavilion`. Indoor options: `floor` (`carpet` + `carpet: [base, pattern]`, `wood` + `wood: color`, `concrete`), `wallType` (`panel | plain | books | mural`), `windows: { view: 'ocean' | 'garden', width }`, `chandeliers`, `pendants`, `coves`, `trusses`, `neon`, `fireplace`, `stage`, `screens`, `dance` (+ `danceType: 'concrete'` to hide the parquet). Outdoor kinds have fixed surroundings (lawn: palms and ocean; rooftop: needs `pergola: { w, d, h }`, skyline and bay; courtyard: arcade and fountain; pavilion: roof, bay and mangroves). Stage and screens go on the +x wall; screens sit above the stage.

The current venues are **fictional demo data**. Don't add real hotel names, logos or photos unless the user supplies them from a real partner, and keep the "Demo listings" note on the page while any listing is invented. `npm run check` validates the schema.

## Design system

- **Concept**: ocean over sand, from the official mark. The hero is deep water and breaks on a wave shoreline into an ivory/sand page; the For hotels band is deep water. Venue cards are slightly tilted postcards with a round postmark showing the fit score.
- **Logo**: use the supplied artwork in `brand/` (`icon.png` circular lockup, `mark.png` palm–sand–ocean graphic). Do not recreate, redraw, or stretch the logos. Display them with `object-fit: contain` and matching width/height aspect.
- **Type**: *Bellefair* for display and the "Breeze Book" wordmark (stand-in for TAN Aegean, which is not a web font). *Montserrat* for body, eyebrows, measurements and CTAs. Do not use sand or possibility-blue for small body copy; long text is dark green (`--ink`).
- **Color**: CONNECTION `--connection` (#BDA083 sand), POSSIBILITY `--possibility` (#89ABBD sky), HOSPITALITY `--hospitality` (#506458 sage). Also `--ivory`, `--palm`, `--ocean` (hospitality for buttons), `--deep`, `--abyss`, `--sand-bg`, `--surface`, `--ink`, `--muted`, `--foam`, `--sun`, plus glass tokens for the full-screen view. Every token has a dark-mode value in both dark blocks; add new tokens to all three blocks.
- **Copy**: plain, specific, active voice. Measurements in feet and inches as the hotel gives them (`96 × 64 ft`, `86 in`).
- Respect `prefers-reduced-motion`; keep a 16px side gutter; no horizontal scroll at 390px wide.

## Publishing as a claude.ai artifact

`npm run build`, then publish `dist/artifact.html` with capabilities `{ "sample": { "images": true } }`. Inside artifacts: external scripts only from cdnjs / jsdelivr / unpkg, styles only from Google Fonts, no microphone, no `window.print()`, no downloads via links. The live artifact is at https://claude.ai/artifact/Dhdf5nDxu3p57YtTeRpCkX.

## Gotchas

- In full screen, the first Escape exits browser full screen; the second closes the venue.
- While a venue is open, questions ("What screens are there?") only update the guest count in the brief, so asking about equipment doesn't add it to must-haves.
- `h()` (the element helper in app.js) skips `null`/`false` children, but native `append()` does not: filter before calling `append` with optional nodes.
- Large `box-shadow`s on a scrolling element over the WebGL canvas painted a stray band in Chromium; panels keep the shadow on a non-scrolling wrapper and scroll an inner `.pp`.
