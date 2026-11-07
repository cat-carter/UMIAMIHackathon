---
description: Run BreezeBook's checks and browser smoke test, and explain any failures
---

From the repository root:

1. Run `npm run check`.
2. If `node_modules/playwright` is missing, run `npm install` and `npx playwright install chromium`, then run `npm test`.
3. For each failure, find the cause in `index.html`, `css/styles.css` or `js/*.js` (see `CLAUDE.md` for how the pieces fit) and propose a fix. Fix it only if I asked you to, or if it's clearly a bug you just introduced.
4. Report in a few lines: what passed, what failed, and what you changed.
