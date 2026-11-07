# Breeze

A demonstration marketplace for hotel event spaces. Planners can search sample Miami venues, ask a browser-side assistant for a shortlist, walk a sample panoramic viewer, switch seating layouts, compare rooms, estimate a budget, and send an inquiry. Hotel partners get a separate dashboard for leads, listing edits, and sample analytics.

Nothing on the site is a live booking channel. Prices, calendars, photographs, and availability are sample data. An inquiry is not a confirmed reservation.

## Run it

```bash
python3 -m http.server 8000
```

Open http://127.0.0.1:8000.

Sample sign-in, stored only in the browser:

- Planner: `avery@example.com`
- Hotel partner for The Palmetto House: `jordan@example.com`

## Check the matcher

```bash
node tests/match.test.js
```

## Pages

Home, Discover, Find My Space, venue records, planning studio, compare, inquiry, planner dashboard, partner dashboard, partnership registration, and FAQs. Navigation uses the URL hash, so the site can be hosted as static files.
