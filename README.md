# Breeze

A demonstration marketplace for hotel event spaces in Miami. Planners search sample venues, keep a profile Breeze can read, walk a 360° tour of the Palmetto House Grand Salon, and send an inquiry. Hotel partners get a sample lead dashboard.

Breeze sits along the bottom of every page. When `ANTHROPIC_API_KEY` is set it uses Claude; otherwise it uses the local matcher. Prices, calendars, and availability are sample data. An inquiry is not a confirmed reservation.

## Run it

```bash
npm install
npm start
```

Open http://127.0.0.1:8000.

Sample sign-in, stored only in the browser:

- Planner: `avery@example.com` — then edit **Your profile**
- Hotel partner for The Palmetto House: `jordan@example.com`

## Check the matcher

```bash
npm test
```
