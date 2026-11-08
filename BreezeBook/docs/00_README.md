# BreezeBook

**Booking should be a breeze.** BreezeBook helps people find and book empty hotel event spaces in Miami, like ballrooms, meeting rooms, rooftops, gardens and beach decks, and helps hotels earn money from space that would otherwise sit empty.

Built for the UM AI Hackathon, track: AI in Hospitality & Entertainment.

## What it does, in plain words

- **You describe your event your way.** Type it, say it, or upload a photo or Pinterest ideas. The app works out guests, budget, date, style, seating layout and must-haves.
- **You see real, measured spaces.** We measure each space on site, so sizes and capacities are true, not rounded up. Every space has a 3D view you can look around, with the seating layout you pick.
- **You see the price before you ask.** A calendar shows the estimated price for each day. A green, amber or red badge shows how well each space fits your budget and needs.
- **You can make an offer.** The hotel's AI assistant negotiates within the hotel's own rules. It often adds extras, like an extra hour or an AV package, instead of cutting the price. A person at the hotel approves every deal.
- **Hotels see their empty space.** A dashboard shows how booked each space is by month and how much money the empty time is worth.

## How to run it

- **Website:** open `web/breeze-venues.html` in a browser. Everything else runs in the page.
- **Rebuild the data and model:** see the commands in `README.md` at the top of the repo (Python + Node).

## What's in this repo
| Folder / file | What it is |
|---|---|
| `data/` | Script that makes the fake (synthetic) hotels, calendars and 1,800 labeled requests |
| `model/` | Training and testing scripts, the trained model, and the accuracy report |
| `web/` | The website: engine, 3D scenes, app screens, build script |
| `docs/` | These one-page documents (problem, design, evidence, run plan, business model, pitch) |

## Honest notes

- **All data is fake.** Hotels, prices, calendars, measurements and people are all synthetic. No real personal data was used.
- **The pictures are 3D renders** made from each space's measurements, not photos.
- **AI disclosure:** we built the code with help from Claude, an AI coding assistant. The app uses Claude only when the on-device model is unsure or when the user picks it.
