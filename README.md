# Breeze Book

**Booking should be a Breeze.** Breeze Book helps people book event spaces at Miami hotels.

1. **Tell Breeza.** Describe your event in your own words, record a voice note or add inspiration photos. She asks a few questions and ranks the spaces that fit.
2. **Walk it in 360°.** Each venue opens full screen as a to-scale 3D room, set up for your guest count as a banquet, reception, theater, classroom or boardroom.
3. **Request in one step.** The hotel gets every detail it needs to quote you.

Official artwork, type, and color come from the Breeze Book style guide: the palm–sand–ocean mark, Bellefair for display, Montserrat for body and buttons, and CONNECTION / POSSIBILITY / HOSPITALITY. The wordmark is never stretched.

> The venues in this repo are fictional demo listings, and the request form does not send anything yet.

## Run it

```bash
npm install
npm start
```

Open http://127.0.0.1:8000.

Breeza uses Claude when `ANTHROPIC_API_KEY` is set. Without it, she stays in guided mode: set questions with tap-to-answer chips, plus instant answers about whichever venue is open. Matching always runs in the page from `js/venues.js`.

## Check

```bash
npm run check      # syntax, links, brand files and venue data
```

Browser smoke test (needs Playwright Chromium):

```bash
npx playwright install chromium
npm test
```

`npm run build` writes single-file versions to `dist/`.
