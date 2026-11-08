"""Brand look on top of the team page. Logic files are read as-is; only labels/markup get cosmetic changes in the output.
python build3.py            -> team_page/breezebook-team.html (live, three.js from CDN)
python build3.py --standalone -> team_page/BreezeBook.html (everything inside one file)"""
import re, sys, json
from pathlib import Path
T = Path(__file__).resolve().parent; V = T.parent; B = V.parent   # team_page/look, team_page, repo root
STRIP_HTML = ["✦ ", "✦", "✨ ", "🖼 ", "🚫 ", "↻ ", "◎ ", "▦ ", "✧", " ↗", "↗", "🌊 ", "⌁", "◉", "✓ ", "← ", "▶ ", " →"]
STRIP_JS = ["✦ ", " →", "▦ ", "♙ ", "◷ "]

def strip_markup(html):
    """remove decorative glyphs from text outside <script>/<style> only"""
    parts = re.split(r"(<script\b.*?</script>|<style\b.*?</style>)", html, flags=re.S)
    for i in range(0, len(parts), 2):
        for g in STRIP_HTML: parts[i] = parts[i].replace(g, "")
    return "".join(parts)

def strip_labels(js):
    for g in STRIP_JS: js = js.replace(g, "")
    js = js.replace('document.title="BreezeBook — Booking should be a breeze"', 'document.title="Breeze Book"')
    return js

html = (V / "index_original.html").read_text()
html = html.replace("Venuvo", "BreezeBook").replace("venuvo", "breezebook")
# official logo instead of the drawn placeholder
html = re.sub(r'<svg viewBox="0 0 48 48" aria-hidden="true">.*?</svg>breezebook<span[^>]*>AI</span>',
              '<img class="bb-mark" data-bb="mark" alt=""><span class="bb-word"><b>Breeze <i>Book</i></b><small>Booking should be a breeze</small></span>', html, count=1, flags=re.S)
html = html.replace("<b>breezebook AI</b>", "<b>Breeze Book</b>").replace('aria-label="BreezeBook home"', 'aria-label="Breeze Book home"')
html = re.sub(r"<title>.*?</title>", "<title>Breeze Book</title>", html, count=1)
html = strip_markup(html)
fonts = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bellefair&family=Montserrat:wght@400;500;600;700&display=swap">'
html = html.replace("</style>", "</style>" + fonts + "<style>\n" + (T / "theme.css").read_text() + "\n</style>", 1)

blind = json.dumps([{"id": r["id"], "text": r["text"], "gold": r["gold"], "gv": r["gold_venues"]} for r in map(json.loads, open(B / "data/requests.jsonl")) if r["split"] == "test_blind"])
data = ("const VENUES2=" + (B / "data/venues.json").read_text() + ";\nconst VALUE=" + (B / "data/value_adds.json").read_text() +
        ";\nconst MODEL=" + (B / "model/model_web.json").read_text() + ";\nconst BLIND=" + blind + ";\n")
if "--standalone" in sys.argv:
    N = B / "node_modules/three"   # npm install three@0.128.0 at the repo root
    three = "<script>\n" + (N / "build/three.min.js").read_text() + "\n</script>\n<script>\n" + (N / "examples/js/controls/OrbitControls.js").read_text() + "\n</script>\n"
else:
    three = '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script><script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>\n'
core = three + "<script>\n" + data + (B / "web/engine.js").read_text() + "\n" + (B / "web/scene.js").read_text() + "\n</script>\n"
i = html.rindex("<script>")
up = strip_labels((V / "upgrade2.js").read_text().replace("__EXTRA__", (V / "extra.js").read_text() + "\nwindow.BBNotify=notifyTeam;\n").replace("Breezy","Breeza"))
RP = T / "vendor"   # copied from the team repo (js/venues.js, js/scene3d.js)
repo_data = (RP / "venues.js").read_text()          # team repo's catalog (only the Grand Ballroom and layout names are used)
repo_3d = re.sub(r"'tour/grand/(\w+)\.jpg'", r"BB_IMG.tour.\1", (RP / "scene3d.js").read_text())  # team repo's 3D/tour engine; photos come from the bundle
look = "<script>\n" + (T / "assets/assets.js").read_text() + "\n" + (T / "assets/samples.js").read_text() + "\n" + repo_data + "\n" + repo_3d + "\n" + (T / "theme.js").read_text() + "\n</script>\n"
j = html.rindex("</body>")
html = html[:i] + core + html[i:j] + "<script>\n" + up + "\n</script>\n" + look + html[j:]
out = V / ("BreezeBook.html" if "--standalone" in sys.argv else "breezebook-team.html")
out.write_text(html); print(out, round(len(html) / 1024), "KB")
