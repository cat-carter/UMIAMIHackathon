---
description: Add a partner venue to BreezeBook from a fact sheet, link or description
argument-hint: <fact sheet, link or description of the event space>
---

Add a new event space to the Breeze Book catalog in `js/venues.js`.

Source material: $ARGUMENTS

1. Read `CLAUDE.md` (the "Venue schema" section) and two existing entries in `js/venues.js` that resemble the new space (indoor vs outdoor, size).
2. Pull every fact you can from the source: hotel, area, space name, room dimensions in feet (length × width, ceiling height), capacity per layout, equipment with sizes, rental fee, food and beverage minimum, per-guest catering, hours by day, sound curfew, rain plan, parking, view and style. Convert metric to feet if needed and say so.
3. Never invent numbers. If a required field is missing (dimensions, `cap.reception`, a capacity for banquet or theater, prices, hours), ask me for it before writing, listing exactly what's missing. Optional details can be left out.
4. Set `area` to one of `AREAS`; if the hotel is in a new Miami neighborhood, add it to `AREAS`. Tag amenities with `t` (screen, dance, stage, mic, dj, vc, bridal) where they apply, and fill `goodFor` and `style` from the listing.
5. Design the `scene` so the 3D room matches the real space: pick the closest `kind`, floor, wall type, windows and view, and place the stage, screens and dance floor at their real sizes. Use colors from the hotel's photos or description.
6. Run `npm run check`, then `npm test` if Playwright is installed. Fix anything that fails.
7. If the venue is real and from an actual partner, ask me whether to remove the "Demo listings" note once no invented venues remain.
8. Summarize what you added and anything you assumed.
