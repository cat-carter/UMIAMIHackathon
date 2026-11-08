# Team page (BreezeBook)
- breezebook-team.html: the live page (needs the Claude platform for Claude, Breezy AI answers and team notifications).
- BreezeBook.html: one self-contained file; opens anywhere, offline, no sign-in (model only, built-in Breezy answers).
- theme.css: the "Miami Modern" look (bay ink #10324F, terrazzo white #EEF3F2, aqua #2BA6A0, sun yellow #F4C542; Syne + Albert Sans).
  Look only: with the theme block removed, both pages are byte-for-byte identical to the previous versions in previous_look/.
- Rebuild: python build2.py (live) and python build2.py --standalone (single file).
- Tests: standalone.js (all features offline), injection_test.js (prompt-injection attacks), evaltest.js (test-mode scoring).
