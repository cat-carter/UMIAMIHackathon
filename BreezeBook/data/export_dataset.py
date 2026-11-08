"""Export the dataset BreezeBook runs on to one Excel workbook for judges.
Property Information uses the team's 41 required variables (same order), filled from data/venues.json
(the exact file the website loads), plus BreezeBook columns. All data is synthetic.
Run: python data/export_dataset.py  -> data/out/BreezeBook_Dataset.xlsx (+ CSVs)"""
import json, math, random, csv, collections
from pathlib import Path
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter

ROOT = Path(__file__).resolve().parent.parent; OUT = ROOT / "data/out"; OUT.mkdir(exist_ok=True)
V = json.load(open(ROOT / "data/venues.json"))
REQ = [json.loads(l) for l in open(ROOT / "data/requests.jsonl")]
VALUE = json.load(open(ROOT / "data/value_adds.json"))
EVAL = json.load(open(ROOT / "model/eval_report.json"))
FULL = json.load(open(ROOT / "model/eval_full.json"))
CL = json.load(open(ROOT / "model/claude_eval.json")) if (ROOT / "model/claude_eval.json").exists() else None
R = random.Random(54)

FONT = "Carlito"; HEAD = Font(name=FONT, size=11, bold=True, color="FFFFFFFF"); BODY = Font(name=FONT, size=11)
FILL = PatternFill("solid", fgColor="FF111111"); BOLD = Font(name=FONT, size=11, bold=True)
AMEN_NAME = {"projector": "Projector", "screens": "Screens", "stage": "Stage", "dance_floor": "Dance floor", "microphone": "Microphone",
             "buffet": "Buffet setup", "parking": "Parking", "accessible": "Accessible entrance", "natural_light": "Natural light", "ocean_view": "Ocean view"}
HALLS = {"grand ballroom", "event hall", "exhibition hall", "convention hall"}
CLOSE = {"none": "23:59", "midnight": "23:59", "11pm": "23:00", "10pm": "22:00"}


def sheet(wb, title, header, rows, widths=None, first=False):
    ws = wb.active if first else wb.create_sheet(title)
    ws.title = title
    ws.append(header)
    for c in ws[1]: c.font, c.fill, c.alignment = HEAD, FILL, Alignment(wrap_text=True, vertical="center")
    ws.row_dimensions[1].height = 32
    for r in rows:
        ws.append(r)
    for row in ws.iter_rows(min_row=2):
        for c in row: c.font = BODY
    for i, h in enumerate(header, 1):
        w = (widths or {}).get(h) or (28 if len(str(h)) > 16 else 19)
        ws.column_dimensions[get_column_letter(i)].width = w
    ws.freeze_panes = "A2"
    return ws


def property_rows():
    rows = []
    for v in V:
        m, cap, a, p = v["measured"], v["capacity"], v["amenities"], v["pricing"]
        L, W, H = m["length_ft"], m["width_ft"], m["ceiling_ft"]
        indoor = v["setting"] == "indoor"; area = L * W; st = v["space_type"]
        hall = st in HALLS or st == "ballroom"
        table = "Round" if hall or st in ("courtyard", "garden", "great lawn") else "Rectangular" if st in ("boardroom", "meeting room") else "High-top" if st in ("rooftop", "terrace", "beach deck", "pool deck") else "Mixed"
        rec = cap["boardroom"] if st == "boardroom" else cap["banquet"]
        tables = math.ceil(rec / (10 if table == "Round" else 8 if table != "High-top" else 4))
        windows = 0 if not indoor else (R.randint(8, 16) if "natural_light" in a else R.randint(0, 4) if not hall else 0)
        vent = "Central HVAC" if indoor else "Open air"
        light = "Dimmable LED + ring lights" if hall else "Natural + LED" if "natural_light" in a else "Ambient + LED" if indoor else "String lights + uplights"
        lights = math.ceil(area / 120)
        close = CLOSE[v["curfew"]]; hours = (24 if close == "23:59" else int(close[:2])) - 7
        park = "parking" in a
        spaces = min(400, max(20, round(cap["banquet"] * 0.4, -1))) if park else 0
        clean = min(180, 30 + round(area / 100)); setup = min(240, 30 + round(area / 60))
        rate = round(p["rental_usd"] / 5 / 5) * 5; minh = 4
        cfee = round(area * 0.02 / 5) * 5 + 50; sfee = round(area * 0.03 / 5) * 5 + 50
        screen_kind = "LED screen" if "screens" in a and hall else "Wall-mounted display" if "screens" in a else "Projector screen" if "projector" in a else "None"
        screen_avail = "Yes" if screen_kind != "None" else ("On request" if "screens" in v.get("addons", {}) or "projector" in v.get("addons", {}) else "No")
        screen_h = {"LED screen": 144, "Wall-mounted display": 55, "Projector screen": min(120, 12 * ((H or 12) - 3)), "None": None}[screen_kind]
        sound = "Partial soundproofing" if hall else "Basic acoustic treatment" if indoor else "None"
        cal = v["calendar"]; booked = sum(1 for d, n in cal.items() if n >= 2) / max(1, len(cal))
        rows.append([
            v["id"], f'{v["hotel"]} - {v["space"]}', "Miami", v["neighborhood"], st.title(), "Indoor" if indoor else "Outdoor",
            L, W, area if indoor else 0, H if indoor else None, max(L, W), 0 if indoor else area, cap["reception"], rec,
            table, tables, rec, windows, vent, light, lights, "07:00", close, hours, "Yes" if park else "No", spaces, clean, setup,
            ", ".join(AMEN_NAME[x] for x in a), "3D render from measurements (no photos)", "Simulated scan " + m["scan_date"],
            rate, minh, cfee, sfee, None, "Active (demo data)", screen_avail, screen_kind, screen_h, sound,
            # BreezeBook columns
            v["hotel"], v["space"], v["hotel_claimed_sqft"], m["usable_sqft"], round(100 * (1 - m["usable_sqft"] / v["hotel_claimed_sqft"])),
            cap["theater"], cap["classroom"], cap["banquet"], cap["buffet"], cap["reception"], cap["ushape"], cap["boardroom"],
            ", ".join(v["styles"]), ", ".join(f"{AMEN_NAME[k]} +${x:,}" for k, x in v.get("addons", {}).items()) or "None",
            "Yes" if v.get("convertible") else "No", "Yes" if v.get("large_hall") else "No",
            p["rental_usd"], p["fnb_per_guest_usd"], round(p["rental_usd"] * max(p["season_mult"].values())), round(p["rental_usd"] * min(p["season_mult"].values())),
            v["curfew"], round(100 * booked), int(100 * v["rules"]["floor_pct"]), ", ".join(v["rules"]["value_adds"]), "Yes" if v["rules"]["human_approval"] else "No"])
    return rows


HEADER = ['Property ID', 'Property Name', 'City', 'Neighborhood', 'Property Type', 'Indoor / Outdoor', 'Length (ft)', 'Width (ft)', 'Indoor Area (sq ft)',
          'Ceiling Height (ft)', 'Wall Length (ft)', 'Outdoor Area (sq ft)', 'Maximum Guests', 'Recommended Guests', 'Table Type', 'Number of Tables',
          'Number of Chairs', 'Number of Windows', 'Ventilation', 'Lighting', 'Number of Lights', 'Opening Time', 'Closing Time', 'Hours Open / Day',
          'Parking Available', 'Parking Spaces', 'Cleaning Time (min)', 'Setup Time (min)', 'Amenities', 'Photos Available', 'Measurements Verified*',
          'Rental Rate ($/hour)', 'Minimum Booking (hours)', 'Cleaning Fee ($)', 'Setup Fee ($)', 'Estimated 4-hour Cost ($)', 'Listing Status',
          'Screen Available', 'Screen Type', 'Screen Height (in)', 'Soundproofing Level']
EXTRA = ['Hotel', 'Space', 'Hotel-Claimed Area (sq ft)', 'Measured Usable Area (sq ft)', 'Claimed vs Usable Gap (%)', 'Capacity: Theater', 'Capacity: Classroom',
         'Capacity: Banquet', 'Capacity: Buffet', 'Capacity: Reception', 'Capacity: U-shape', 'Capacity: Boardroom', 'Styles', 'Rentable Add-ons',
         'Convertible Space', 'Large Hall', 'Base Event Rental ($)', 'Food & Beverage per Guest ($)', 'Peak-Season Rental ($)', 'Off-Season Rental ($)',
         'Curfew', 'Fully Booked Days Next 12 Months (%)', 'Negotiation Floor (% of price)', 'Allowed Value-Adds', 'Human Approval Required']

DICT = [  # column, meaning, unit, source
    ("Property ID", "BreezeBook space ID (same ID the website uses)", "", "venues.json"),
    ("Property Name", "Hotel name - space name (fictional)", "", "venues.json"),
    ("City / Neighborhood", "Miami neighborhood of the hotel", "", "venues.json"),
    ("Property Type", "Kind of space: ballroom, loft, rooftop, garden, event hall, etc.", "", "venues.json"),
    ("Indoor / Outdoor", "Whether the space is enclosed", "", "venues.json"),
    ("Length / Width / Ceiling Height", "Measured room dimensions from the on-site scan", "ft", "Simulated scan (venues.json)"),
    ("Indoor / Outdoor Area", "Length x width, placed in the indoor or outdoor column", "sq ft", "Calculated"),
    ("Wall Length", "Longest wall (for stages, screens, buffet lines)", "ft", "Calculated"),
    ("Maximum Guests", "Standing reception capacity from usable area / 8 sq ft per guest", "guests", "Calculated (venues.json)"),
    ("Recommended Guests", "Seated banquet capacity (boardroom seats for boardrooms)", "guests", "Calculated (venues.json)"),
    ("Table Type / Tables / Chairs", "Default furniture for the recommended layout (10 per round, 8 per rectangle, 4 per high-top)", "count", "Derived from space type"),
    ("Number of Windows", "Windows; high only where natural light is listed", "count", "Simulated"),
    ("Ventilation / Lighting / Lights", "HVAC or open air; lighting type; fixtures at 1 per 120 sq ft", "", "Derived"),
    ("Opening / Closing Time", "Earliest access 07:00; closing from the hotel curfew", "24h", "venues.json curfew"),
    ("Parking", "Yes if parking is an amenity; spaces approx. 40% of banquet capacity", "", "Derived"),
    ("Cleaning / Setup Time", "Turnover time, scales with area", "min", "Derived"),
    ("Amenities", "Amenities the space has today (used as hard filters)", "", "venues.json"),
    ("Photos Available", "BreezeBook shows 3D renders built from the measurements, not photos", "", "Website"),
    ("Measurements Verified*", "Simulated scan date. NOT a real-world verification", "", "Simulated"),
    ("Rental Rate ($/hour)", "Base event rental / 5-hour event, rounded", "USD", "Derived from venues.json"),
    ("Cleaning Fee / Setup Fee", "Scales with area", "USD", "Derived"),
    ("Estimated 4-hour Cost ($)", "Excel formula: max(4, minimum hours) x rate + cleaning + setup", "USD", "Formula"),
    ("Screen Available / Type / Height", "Yes if screens or projector; 'On request' if the hotel rents one as an add-on", "in", "venues.json amenities + add-ons"),
    ("Soundproofing Level", "Halls partial; indoor rooms basic; outdoor none", "", "Simulated"),
    ("Hotel-Claimed vs Measured Usable Area", "What the hotel lists vs what the scan finds usable; the gap is a BreezeBook selling point", "sq ft / %", "venues.json"),
    ("Capacity by layout", "Theater 9, classroom 18, banquet 12, buffet 14, reception 8 sq ft per guest; U-shape and boardroom capped", "guests", "venues.json"),
    ("Styles", "Look-and-feel tags used for matching", "", "venues.json"),
    ("Rentable Add-ons", "Equipment the hotel can bring in, with price; makes a space an amber 'fits with add-ons' match", "USD", "venues.json"),
    ("Base / Peak / Off-Season Rental", "Rental before food; seasonal multipliers 0.70 (Sep) to 1.30 (Feb)", "USD", "venues.json pricing"),
    ("Food & Beverage per Guest", "Per-guest food and drink minimum", "USD", "venues.json pricing"),
    ("Fully Booked Days (%)", "Share of days Nov 2026 - Oct 2027 with both day-parts booked", "%", "venues.json calendar"),
    ("Negotiation Floor / Value-Adds / Human Approval", "Lowest price the AI may offer, extras it can offer instead of discounts, and whether a person approves", "", "venues.json rules"),
]


def main():
    wb = Workbook()
    # 1 How to read
    how = [("PURPOSE", "BreezeBook: AI matchmaking that fills unused and underused hotel event spaces in Miami."),
           ("Who uses this", "Event planners and individuals looking for a space; hotels listing spare rooms, lawns and off-season dates."),
           ("What the AI does", "Reads a plain-English request, finds spaces that fit guests, budget, date, layout and must-haves, shows a 3D layout, and negotiates with extras instead of discounts."),
           ("Key differentiator", "Measured usable space (not hotel-claimed), capacity per layout, add-ons the hotel can rent, and seasonal gaps."),
           ("What is in this file", "Property Information (54 spaces, the 41 required variables + BreezeBook fields), Pricing by Month, Availability by Month, Negotiation Rules, Value-Adds, Event Requests (2,900 labeled requests used to train and test the model), Model Results, Confidence & Routing, Examples (Blind Test 2), Failures & Improvements, Data Dictionary."),
           ("Same data as the website", "Every row comes from data/venues.json and data/requests.jsonl, the files the website and model use. Regenerate with python data/export_dataset.py."),
           ("Dimensions", "Feet (ft) and square feet (sq ft)."),
           ("Pricing", "Illustrative USD. Recommendations prioritize the customer's requirements, then price."),
           ("Photos", "No real photos. The site draws 3D renders from the measured dimensions and labels them as renders."),
           ("Verification*", "Scans are simulated and MUST NOT be treated as real-world measurement verification."),
           ("Data quality", "All spaces, hotels, people, emails and phone numbers are synthetic. No real personal data."),
           ("Model split", "train 800, train_aug 600, train_zip 800 (training); val 100; test_in 150 (familiar wording); test_out 150 (old unfamiliar test, partly overlaps train_zip wording); test_fresh 150 and test_blind 150 (new wording, frozen before training)."),
           ("Business model", "First 2-3 events free for hotels, then subscription + booking fee + paid top placement")]
    ws = sheet(wb, "How to Read", ["Item", "Explanation"], how, {"Item": 28, "Explanation": 100}, first=True)
    for r in ws.iter_rows(min_row=2):
        r[0].font = BOLD; r[1].alignment = Alignment(wrap_text=True, vertical="top")

    # 2 Property Information
    rows = property_rows()
    ws = sheet(wb, "Property Information", HEADER + EXTRA, rows, {"Property Name": 40, "Amenities": 44, "Photos Available": 34, "Rentable Add-ons": 36, "Allowed Value-Adds": 40})
    for i in range(2, len(rows) + 2):  # live formula for the 4-hour cost
        ws[f"AJ{i}"] = f"=MAX(4,AG{i})*AF{i}+AH{i}+AI{i}"; ws[f"AJ{i}"].font = BODY
    H = HEADER + EXTRA; L = lambda h: get_column_letter(H.index(h) + 1)
    for h in ("Rental Rate ($/hour)", "Cleaning Fee ($)", "Setup Fee ($)", "Estimated 4-hour Cost ($)", "Base Event Rental ($)", "Food & Beverage per Guest ($)", "Peak-Season Rental ($)", "Off-Season Rental ($)"):
        for i in range(2, len(rows) + 2): ws[f"{L(h)}{i}"].number_format = '"$"#,##0'
    for h in ("Indoor Area (sq ft)", "Outdoor Area (sq ft)", "Hotel-Claimed Area (sq ft)", "Measured Usable Area (sq ft)"):
        for i in range(2, len(rows) + 2): ws[f"{L(h)}{i}"].number_format = '#,##0'
    ws.auto_filter.ref = ws.dimensions

    # 3 Pricing by month
    MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    prow = [[v["id"], f'{v["hotel"]} - {v["space"]}', v["pricing"]["rental_usd"], v["pricing"]["fnb_per_guest_usd"], v["pricing"]["weekday_mult"], v["pricing"]["weekend_mult"]]
            + [round(v["pricing"]["rental_usd"] * v["pricing"]["season_mult"][str(m)]) for m in range(1, 13)] for v in V]
    ws = sheet(wb, "Pricing by Month", ["Property ID", "Property Name", "Base Rental ($)", "F&B per Guest ($)", "Weekday Multiplier", "Weekend Multiplier"] + [f"{m} Rental ($)" for m in MON], prow, {"Property Name": 40})
    for row in ws.iter_rows(min_row=2, min_col=7, max_col=18):
        for c in row: c.number_format = '"$"#,##0'

    # 4 Availability by month (share of day-parts booked)
    order = [(2026, 11), (2026, 12)] + [(2027, m) for m in range(1, 11)]
    arow = []
    for v in V:
        r = [v["id"], f'{v["hotel"]} - {v["space"]}']
        for y, m in order:
            ds = [n for d, n in v["calendar"].items() if d.startswith(f"{y}-{m:02d}")]
            r.append(round(100 * sum(ds) / (2 * len(ds))) if ds else None)
        arow.append(r)
    sheet(wb, "Availability by Month", ["Property ID", "Property Name"] + [f"{MON[m-1]} {y} Booked (%)" for y, m in order], arow, {"Property Name": 40})

    # 5 Negotiation rules + value adds
    nrow = [[v["id"], f'{v["hotel"]} - {v["space"]}', int(100 * v["rules"]["floor_pct"]), int(100 * v["rules"]["offseason_extra_pct"]), ", ".join(v["rules"]["value_adds"]),
             v["rules"]["max_rounds"], "Yes" if v["rules"]["human_approval"] else "No"] for v in V]
    sheet(wb, "Negotiation Rules", ["Property ID", "Property Name", "Price Floor (% of list)", "Extra Off-Season Room (%)", "Value-Adds AI May Offer", "Max Counter-Offers", "Human Approval"], nrow, {"Property Name": 40, "Value-Adds AI May Offer": 44})
    sheet(wb, "Value-Adds", ["Key", "What the Planner Gets", "Cost to Hotel ($)", "Value to Planner ($)"], [[x["key"], x["label"], x["hotel_cost"], x["planner_value"]] for x in VALUE], {"What the Planner Gets": 40})

    # 6 Event requests
    rrow = [[r["id"], r["split"], r["text"], r["gold"]["event_type"], r["gold"]["guests"], r["gold"]["budget"], r["gold"]["date"], r["gold"]["setting"],
             r["gold"]["layout"] or "(none)", ", ".join(r["gold"]["styles"]), ", ".join(r["gold"]["must_have"]), ", ".join(r["gold_venues"])] for r in REQ]
    ws = sheet(wb, "Event Requests", ["Request ID", "Split", "Request Text (synthetic)", "Event Type", "Guests", "Budget ($)", "Date", "Setting", "Layout", "Styles", "Must-Haves", "Spaces That Truly Fit"],
               rrow, {"Request Text (synthetic)": 90, "Spaces That Truly Fit": 30})
    ws.auto_filter.ref = ws.dimensions
    cnt = collections.Counter(r["split"] for r in REQ)

    # 7 Model results
    name = {"rules": "Keyword search (baseline)", "model_C": "Old model (before team zip)", "model_web": "Live model on the website"}
    split_name = {"test_in": "Familiar wording", "test_out": "Old unfamiliar test (partly overlaps training)", "test_fresh": "New wording test 1 (frozen)", "test_blind": "New wording test 2 (frozen)"}
    mrow = [[split_name[e["split"]], name[e["model"]], e["n"], e["success_pct"], e["top3_hit_pct"], e["all_fields_exact_pct"], e["field_acc_pct"]["event_type"], e["field_acc_pct"]["layout"],
             e["field_acc_pct"]["setting"], e["field_acc_pct"]["styles"], e["field_acc_pct"]["must_have"], e["field_acc_pct"]["guests"], e["field_acc_pct"]["budget"], e["field_acc_pct"]["date"]]
            for e in EVAL if e["model"] in name]
    mrow.sort(key=lambda r: (list(split_name.values()).index(r[0]), list(name.values()).index(r[1])))
    if CL:
        f = CL["claude_field_acc"]; P = lambda x: float(str(x).rstrip("%"))
        mrow.append([split_name["test_blind"], "Claude alone (all 150)", CL["n"], P(CL["claude_success"]), P(CL["claude_top3"]), None, P(f["event_type"]), P(f["layout"]), P(f["setting"]), P(f["styles"]), P(f["must_have"]), P(f["guests"]), P(f["budget"]), P(f["date"])])
        mrow.append([split_name["test_blind"], "Full system (model, Claude when unsure)", CL["n"], P(CL["system_success"]), P(CL["system_top3"])] + [None] * 9)
    else:
        mrow.append([split_name["test_blind"], "Claude / full system", 150, "Not run yet: type /eval in Breezy on the live page"] + [None] * 10)
    ws = sheet(wb, "Model Results", ["Test Set", "Reader", "Requests", "Fully Right (%)", "Correct Space in Top 3 (%)", "All Fields Exact (%)", "Event Type (%)", "Layout (%)",
                                     "Setting (%)", "Styles (%)", "Must-Haves (%)", "Guests (%)", "Budget (%)", "Date (%)"], mrow, {"Test Set": 44, "Reader": 30})
    n = ws.max_row + 2
    notes = ["Fully right = event, guests, budget, date and setting read correctly, a truly fitting space in the top 3, and no pick that breaks the request.",
             "Live model: TF-IDF (words + character pieces) with logistic regression, trained on train + train_aug + train_zip. Guests, budget and date are read by rules.",
             "When the model's confidence is below 0.8 the website hands the request to Claude: 97% of familiar requests stay local (100% right); 90-97% of new-wording requests go to Claude.",
             ("Claude test (blind test 2, run in the live page with /eval): 150 calls, 0 failed. 8 of Claude's 18 misses come from a label clash in our test ('outdoors in the sunshine' labeled outdoor only; Claude also read natural light). We report the stricter score." if CL else "Claude not tested yet."),
             f"Request counts: " + ", ".join(f"{k} {v}" for k, v in cnt.items()) + "."]
    for i, t in enumerate(notes): ws.cell(n + i, 1, t).font = BODY

    # 7b confidence and routing
    crow = [[c["band"], c["n"], c["right_pct"]] for c in FULL["calibration"]]
    ws = sheet(wb, "Confidence & Routing", ["Model Confidence", "Requests (all 4 test sets)", "Actually Right (%)"], crow, {"Model Confidence": 22, "Requests (all 4 test sets)": 26, "Actually Right (%)": 22})
    n0 = ws.max_row + 2
    for j, h in enumerate(["Test Set", "Handled by Model (%)", "Right When Handled (%)", "Sent to Claude (%)"], 1):
        c = ws.cell(n0, j, h); c.font, c.fill = HEAD, FILL
    for i, r in enumerate(FULL["routing"], 1):
        for j, v in enumerate([split_name[r["split"]], r["local_pct"], r["right_when_local_pct"], r["to_claude_pct"]], 1): ws.cell(n0 + i, j, v).font = BODY
    n1 = n0 + len(FULL["routing"]) + 2
    if CL:
        for j, h in enumerate(["Cut-off (blind test 2, with Claude)", "Full System Fully Right (%)", "Fitting Space in Top 3 (%)", "Handled by Model (%)"], 1):
            c = ws.cell(n1, j, h); c.font, c.fill = HEAD, FILL
        for i, (t, v) in enumerate(CL["thresholds"].items(), 1):
            for j, x in enumerate([("Always Claude" if t.startswith("always") else f"{float(t):.0%} (live)" if t == "0.8" else f"{float(t):.0%}"), v["system_success"], v["system_top3"], v["handled_by_model"]], 1): ws.cell(n1 + i, j, x).font = BODY
        n1 += len(CL["thresholds"]) + 2
    notes2 = ["Right = event type, layout and indoor/outdoor all read correctly. Requests under 80% confidence go to Claude.",
              f'On new wording the model misses {FULL["must_have"]["missed"]} of {FULL["must_have"]["total"]} must-haves but invents only {FULL["must_have"]["invented"]}; it misses {FULL["styles"]["missed"]} of {FULL["styles"]["total"]} style words.',
              f'Speed: median {FULL["speed_ms"]["median"]} ms per request in the browser, 95% under {FULL["speed_ms"]["p95"]} ms.',
              "Most common mistakes on new wording: " + "; ".join(f"{k} ({v})" for k, v in FULL["mistakes"][:6]) + "."]
    for i, t in enumerate(notes2): ws.cell(n1 + i, 1, t).font = BODY
    # 7c examples
    erow = [[e["text"], e["conf"], e["got"], e["truth"], "Right" if e["right"] else ("Wrong, sent to Claude" if e["conf"] < 80 else "Wrong")] for e in FULL["examples"]]
    ws = sheet(wb, "Examples (Blind Test 2)", ["Request (synthetic)", "Model Confidence (%)", "Model Read (event / layout / setting)", "Correct Answer", "Result"], erow, {"Request (synthetic)": 90, "Model Read (event / layout / setting)": 34, "Correct Answer": 34, "Result": 24})
    for r in ws.iter_rows(min_row=2): r[0].alignment = Alignment(wrap_text=True, vertical="top")

    # 7d failures and improvements
    ER = {(e["model"], e["split"]): e for e in EVAL}
    sp = lambda m, s_: f'{ER[(m, s_)]["success_pct"]}%'
    imp = [
        ["1", "Keyword search (baseline)", "Matches words like 'stage' or 'garden'", f"Familiar {sp('rules','test_in')}; new wording {sp('rules','test_blind')}", "Baseline only"],
        ["2", "Model A: word features + logistic regression", "Trained on 800 synthetic requests", f"Familiar {sp('model_A','test_in')}; blind test 2 {sp('model_A','test_blind')}", "Replaced"],
        ["3", "Model B: + letter-pattern features", "Catches spelling variants and word pieces", f"Familiar {sp('model_B','test_in')}; blind test 2 {sp('model_B','test_blind')}", "Replaced"],
        ["4", "Model C: + 600 requests in a third phrasing style", "More wording variety", f"Familiar {sp('model_C','test_in')}; blind test 2 {sp('model_C','test_blind')}", "Replaced"],
        ["5", "Model D (live): + 800 requests in the team's wording", "Team's vocabulary file (offsite, rounds of ten, beamer, no rooftop...)", f"Familiar {sp('model_web','test_in')}; blind test 2 {sp('model_web','test_blind')}; blind test 1 {sp('model_web','test_fresh')}; layout on new wording 90-91%", "Live"],
        ["6", "Word-vector experiments (spaCy)", "Averaged vectors; label similarity; auto-paraphrasing", "+2, +3 and 0 points on practice sets", "Not kept: too small for +1 MB"],
        ["7", "Confidence routing to Claude", "Requests under 80% confidence go to Claude", (f"Blind test 2 full system {CL['system_success']} (model alone {CL['model_success']})" if CL else "Not measured"), "Live"],
        ["8", "14 large convertible halls + rentable add-ons", "Stage, screens, dance floor can be added by the hotel for a fee", "A 380-guest gala went from no fits to 6+ fits with priced add-ons", "Live"],
        ["9", "'We'll find it for you' + team inbox", "When nothing fits, the request goes to the team", "Tested: impossible requests show the form and the closest options", "Live"],
        ["10", "Prompt-injection defenses", "Screening, data tags, Send button, price and booking warnings", "Attack test passed; accuracy unchanged", "Live"]]
    ws = sheet(wb, "Failures & Improvements", ["#", "Improvement", "What changed", "Measured effect", "Status"], imp, {"#": 5, "Improvement": 40, "What changed": 50, "Measured effect": 52, "Status": 22})
    for r in ws.iter_rows(min_row=2):
        for c in r: c.alignment = Alignment(wrap_text=True, vertical="top")
    fails = [
        ["Model on new wording", f"Only {sp('model_web','test_fresh')}-{sp('model_web','test_blind')} of never-seen requests fully right; event type about 50%; misses about 55% of must-haves; style about 5%", "Unsure requests go to Claude (90-97% of new wording)", "Real planner wording in training; human review of misreads"],
        ["Unsafe picks when the model is wrong", f"Model alone recommended a space that breaks the real request in {ER[('model_web','test_blind')]['violation_cases']} of 150 blind requests", "Only happens if routing is off; always demo with Claude on", "Ask the planner to confirm key details before showing results"],
        ["Confident but wrong", (f"At the 80% cut-off the model keeps {CL['thresholds']['0.8']['handled_by_model']:.0f}% of blind requests and some are wrong, so the full system ({CL['system_success']}) scores below Claude alone ({CL['claude_success']})" if CL else "Not measured"), "Reported openly", (f"A 90% cut-off scored {CL['thresholds']['0.9']['system_success']}% on this test; confirm on a fresh test before changing" if CL else "")],
        ["Claude misses", (f"18 of 150 blind requests not fully right" if CL else "Not measured"), "8 caused by our own test labels (below); 3 read every field right but the matcher ranked other spaces first; 4 read a wedding (e.g. marriage reception) as a party; 3 small layout or equipment misreads", "Fix labels; tune ranking; add wedding wording examples to Claude's instructions"],
        ["Our test labels", "'Outdoors in the sunshine' was labeled outdoor only, but 'sunshine' is also a natural-light word in that test, so Claude's natural-light answer was marked wrong", "Stricter score kept (not corrected after the fact)", "Relabel and rerun"],
        ["Old unfamiliar test reused", "The team's wording file shares words with test_out, so its 32% is partly memorised", "Two new blind tests written and locked before training", "Keep future tests locked away from training"],
        ["Matching ceiling", "Even with every field read perfectly, the right space is in the top 3 for 97.3% of blind requests", "Known limit of ranking", "Better ranking for style and add-ons"],
        ["Synthetic data only", "All spaces, requests and scans are made up; nothing is tested with real planners or hotels", "Stated on every sheet and document", "Pilot with 3 Miami hotels"],
        ["Generator wording bug", "Some dates are written as '1th of June'", "Does not change labels or scores", "Fix the date wording in the generator"],
        ["Not measured", "Claude token cost per answer in production; results with real people's wording", "Stated in Gate 3", "Measure during the pilot"]]
    n = ws.max_row + 2
    for j, h in enumerate(["Failure", "What happens", "How we handle it now", "Next step"], 1):
        c = ws.cell(n, j + 1, h); c.font, c.fill = HEAD, FILL
    for i, f in enumerate(fails, 1):
        for j, v in enumerate(f, 1):
            c = ws.cell(n + i, j + 1, v); c.font = BODY; c.alignment = Alignment(wrap_text=True, vertical="top")
    ws.cell(n, 1, "").fill = FILL

    # 8 Data dictionary
    ws = sheet(wb, "Data Dictionary", ["Column(s)", "Meaning", "Unit", "Source"], DICT, {"Column(s)": 36, "Meaning": 90, "Source": 32})
    for r in ws.iter_rows(min_row=2): r[1].alignment = Alignment(wrap_text=True, vertical="top")

    path = OUT / "BreezeBook_Dataset.xlsx"; wb.save(path)
    with open(OUT / "property_information.csv", "w", newline="") as f:
        w = csv.writer(f); w.writerow(HEADER + EXTRA)
        for r in rows:
            r = list(r); r[35] = max(4, r[32]) * r[31] + r[33] + r[34]; w.writerow(r)
    with open(OUT / "event_requests.csv", "w", newline="") as f:
        w = csv.writer(f); w.writerow(["request_id", "split", "text", "event_type", "guests", "budget", "date", "setting", "layout", "styles", "must_have", "gold_venues"]); w.writerows(rrow)
    print(path, len(rows), "spaces,", len(rrow), "requests")


if __name__ == "__main__":
    main()
