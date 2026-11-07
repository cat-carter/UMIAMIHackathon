/* BreezeBook app: Breeza chat (AI + guided), matching, venue grid, full-screen venue view, request flow.
   Depends on js/venues.js (window.BB_DATA) and js/scene3d.js (window.BB3D). See CLAUDE.md. */
(() => {
'use strict';

/* ---------- helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat(Infinity)) { if (k == null || k === false) continue; e.append(k.nodeType ? k : document.createTextNode(String(k))); }
  return e;
}
const money = n => '$' + Math.round(n).toLocaleString('en-US');
const num = n => Math.round(n).toLocaleString('en-US');
const cap1 = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
const reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, 2400); }

/* ---------- catalog: js/venues.js ---------- */
const { AREAS, LAYOUTS, VENUES } = window.BB_DATA;
const VBY = Object.fromEntries(VENUES.map(v => [v.id, v]));
const sqft = v => v.dims.l * v.dims.w;
const dimStr = v => `${v.dims.l} × ${v.dims.w} ft`;
const ceilStr = v => v.dims.h ? `${v.dims.h} ft ceiling` : (v.scene.kind === 'pavilion' ? 'covered, open sides' : 'open-air');
const maxCap = v => Math.max(...Object.values(v.cap).filter(Boolean));
const closeLabel = h => h >= 24 ? (h === 24 ? 'midnight' : `${h - 24}:00 am`) : `${h - 12}:00 pm`;

/* ---------- brief + matching ---------- */
const NEED_LABEL = { dance: 'Dance floor', screen: 'Screen or TV', stage: 'Stage', mic: 'Microphones', dj: 'DJ booth', vc: 'Video conferencing', bridal: 'Bridal suite' };
const STYLE_SYN = { 'ocean view': ['ocean view', 'beach', 'bay view'], beach: ['beach', 'ocean view'], 'bay view': ['bay view', 'ocean view'], rooftop: ['rooftop', 'skyline'], skyline: ['skyline', 'rooftop'], garden: ['garden', 'natural', 'mediterranean'], modern: ['modern', 'bright'], classic: ['classic', 'elegant', 'historic', 'mediterranean'], elegant: ['elegant', 'classic', 'glam'], glam: ['glam', 'grand', 'elegant'], boho: ['boho', 'natural'], tropical: ['tropical', 'beach'], industrial: ['industrial', 'artsy'], intimate: ['intimate', 'cozy'], romantic: ['romantic', 'garden', 'sunset'], sunset: ['sunset'], grand: ['grand', 'glam'], artsy: ['artsy', 'industrial', 'colorful'], nightlife: ['nightlife', 'industrial'], cozy: ['cozy', 'intimate'] };

const brief = { eventType: null, guests: null, date: null, time: null, lateNight: false, area: null, setting: null, layout: null, catering: null, needs: [], budget: null, style: [] };
const skipped = new Set();
const photos = [];   // {thumb, blob}
const voiceNotes = [];
const ORDER = ['eventType', 'guests', 'when', 'place', 'catering', 'needs', 'budget', 'style'];
function known(f) {
  switch (f) {
    case 'eventType': return !!brief.eventType;
    case 'guests': return !!brief.guests;
    case 'when': return !!(brief.date || brief.time);
    case 'place': return !!(brief.area || brief.setting);
    case 'catering': return !!brief.catering;
    case 'needs': return brief.needs.length > 0;
    case 'budget': return !!brief.budget;
    case 'style': return brief.style.length > 0 || photos.length > 0;
  }
  return false;
}
const nextMissing = () => ORDER.find(f => !known(f) && !skipped.has(f)) || null;

function pickLayout(b) {
  if (b.layout) return b.layout;
  const c = (b.catering || '').toLowerCase();
  if (/cocktail|bites|passed|mingl|standing|hors/.test(c) && !/dinner|plated|buffet|family|brunch|lunch/.test(c)) return 'reception';
  const t = b.eventType || '';
  if (/conference/.test(t)) return 'theater';
  if (/corporate/.test(t)) return (b.guests && b.guests <= 24) ? 'boardroom' : 'classroom';
  if (/engagement|holiday/.test(t)) return 'reception';
  return 'banquet';
}
function capPhrase(lay, n) {
  return ({ banquet: `Seats ${num(n)} at rounds of 10`, reception: `Holds ${num(n)} standing`, theater: `Seats ${num(n)} theater-style`, classroom: `Seats ${num(n)} classroom-style`, boardroom: `Seats ${num(n)} at one table` })[lay];
}
function estimate(v, guests) {
  const g = guests || Math.round((v.cap.banquet || v.cap.reception) * 0.6);
  const food = g * v.price.perGuest;
  return { guests: g, food, total: v.price.rental + Math.max(v.price.fbMin, food), minApplies: v.price.fbMin > food };
}
function styleHits(v, wants) {
  const hits = [];
  for (const w of wants) { const syn = STYLE_SYN[w] || [w]; if (syn.some(s => v.style.includes(s))) hits.push(w); }
  return hits;
}
function scoreVenue(v, b) {
  let layout = pickLayout(b);
  let cap = v.cap[layout];
  if (!cap && layout === 'boardroom' && v.cap.classroom) { layout = 'classroom'; cap = v.cap.classroom; }
  if (!cap && layout === 'classroom' && v.cap.banquet) { layout = 'banquet'; cap = v.cap.banquet; }
  const ok = [], no = [];
  let pts = 0; const max = 110; let fits = true;
  const g = b.guests;
  if (!cap) { no.push(`No ${LAYOUTS[layout].label.toLowerCase()} setup`); fits = false; }
  else if (g) {
    const fill = g / cap;
    if (fill > 1) { no.push(`Holds ${num(cap)} ${layout === 'reception' ? 'standing' : 'seated'}, short of ${num(g)}`); pts -= 40; fits = false; }
    else if (fill >= 0.5) { pts += fill > 0.95 ? 30 : 35; ok.push(`${capPhrase(layout, cap)}, a good fit for ${num(g)}`); }
    else if (fill >= 0.28) { pts += 24; ok.push(`Plenty of room: ${capPhrase(layout, cap).toLowerCase()}`); }
    else { pts += 8; no.push(`Built for up to ${num(cap)}, so ${num(g)} may feel sparse`); }
  } else pts += 18;
  if (b.eventType) { if (v.goodFor.includes(b.eventType)) pts += 10; } else pts += 5;
  if (b.area && b.area !== 'Anywhere') { if (v.area === b.area) { pts += 15; ok.push(`In ${v.area}`); } }
  else pts += 8;
  const outdoorish = v.setting === 'outdoor';
  if (b.setting === 'outdoor') { if (outdoorish) { pts += 10; ok.push(v.kind === 'Open-air pavilion' ? 'Open-air, under a covered roof' : `Open-air ${v.kind.toLowerCase()}`); } else no.push('Indoors only'); }
  else if (b.setting === 'indoor') { if (!outdoorish) { pts += 10; ok.push('Indoors, air-conditioned'); } else no.push(`Outdoors (${(v.notes.find(n => /rain plan/i.test(n)) || 'rain plan on request').toLowerCase()})`); }
  else pts += b.setting === 'either' ? 8 : 5;
  if (b.needs.length) {
    let hit = 0;
    for (const n of b.needs) {
      const a = v.amen.find(x => x.t === n);
      if (a) { hit++; if (ok.length < 6) ok.push(`${a.n}, ${a.s}`); }
      else no.push(`No ${NEED_LABEL[n].toLowerCase()} listed`);
    }
    pts += 15 * hit / b.needs.length;
  } else pts += 8;
  if (b.style.length) { const sh = styleHits(v, b.style); pts += Math.min(10, sh.length * 5); if (sh.length) ok.push(cap1(sh.slice(0, 2).join(' and '))); }
  else pts += 5;
  const est = estimate(v, g);
  if (b.budget) {
    if (est.total <= b.budget) { pts += 15; ok.push(`About ${money(est.total)} before service and tax, within budget`); }
    else if (est.total <= b.budget * 1.15) { pts += 7; no.push(`About ${money(est.total)}, a little over budget`); }
    else no.push(`About ${money(est.total)}, over your ${money(b.budget)} budget`);
  } else pts += 8;
  if (b.lateNight) { if (v.closesAt < 24.5) { pts -= 6; no.push(`Closes at ${closeLabel(v.closesAt)}`); } else ok.push(`Open until ${closeLabel(v.closesAt)}`); }
  const score = Math.max(1, Math.min(99, Math.round(pts / max * 100)));
  return { score, ok, no, layout, cap, est, fits };
}
function ranked(b = brief) {
  return VENUES.map(v => ({ v, s: scoreVenue(v, b) })).sort((a, z) => (z.s.fits - a.s.fits) || (z.s.score - a.s.score));
}
function eventPhrase() {
  const t = brief.eventType ? brief.eventType : 'event';
  return brief.guests ? `${num(brief.guests)}-guest ${t}` : t;
}

/* ---------- text parsing (works with or without AI) ---------- */
const TYPE_RX = [
  ['quinceañera', /quince|quinceañera|quinceanera|\bxv\b|sweet fifteen/], ['rehearsal dinner', /rehearsal/], ['baby shower', /baby shower|shower/], ['engagement party', /engagement/],
  ['wedding', /wedding|ceremony|bride|groom|getting married|elopement/], ['anniversary', /anniversary/], ['graduation', /graduat/],
  ['birthday', /birthday|bday|b-day|\b\d{2}(?:st|nd|rd|th)\s+(?:party|celebration|bash)/], ['gala', /gala|fundrais|benefit/], ['conference', /conference|summit|symposium|keynote/],
  ['holiday party', /holiday|christmas|new year|nye/], ['corporate', /offsite|off-site|meeting|team|company|corporate|workshop|training|retreat|board meeting|client/]
];
const AREA_RX = [['Miami Beach', /miami beach|south beach|mid-beach|mid beach|sobe|north beach/], ['Brickell', /brickell/], ['Coral Gables', /coral gables|\bgables\b/], ['Wynwood', /wynwood|design district|edgewater/], ['Key Biscayne', /key biscayne|\bkey\b/], ['Downtown', /downtown|bayfront|biscayne blvd|\bdt\b/]];
const NEED_RX = [['dance', /danc/], ['screen', /screen|\btv\b|projector|slides|video wall|led wall|presentation|display/], ['stage', /stage|band|live music|performance|perform/], ['mic', /\bmics?\b|microphone|speech|toast|speeches|emcee|mc\b/], ['dj', /\bdj\b/], ['vc', /zoom|video call|hybrid|video conferenc|teams call|remote attendees/], ['bridal', /bridal suite|getting ready|bridal room/]];
const STYLE_RX = [['ocean view', /ocean|beach|seaside|sea view|waterfront/], ['bay view', /\bbay\b/], ['rooftop', /rooftop|roof top/], ['skyline', /skyline|city view|city lights/], ['garden', /garden|greenery|courtyard|lush/], ['modern', /modern|minimal|sleek|contemporary/], ['classic', /classic|timeless|traditional|old miami|historic/], ['elegant', /elegant|black tie|formal/], ['glam', /glam|luxe|luxur|chandelier|sparkl/], ['boho', /boho|rustic|natural|earthy/], ['tropical', /tropical|palm/], ['industrial', /industrial|loft|warehouse|edgy|artsy|mural|street art/], ['intimate', /intimate|cozy|small and/], ['romantic', /romantic/], ['sunset', /sunset|golden hour/]];
const MONTH_RX = /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may(?=\s+\d)|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?(?:\s+\d{1,2}(?:st|nd|rd|th)?)?(?:,?\s+20\d\d)?\b/i;

function parseText(raw, expect) {
  const s = raw.toLowerCase();
  const out = {};
  for (const [t, rx] of TYPE_RX) if (rx.test(s)) { out.eventType = t; break; }
  let m = s.match(/(\d{1,4})\s*(?:-|–|to)\s*(\d{1,4})\s*(?:guests?|people|ppl|persons|attendees|pax)/) ;
  if (m) out.guests = +m[2];
  else if ((m = s.match(/(\d{1,4})\s*\+?\s*(?:guests?|people|ppl|persons|attendees|pax|adults|friends|of us|employees|colleagues|family)/))) out.guests = +m[1];
  else if ((m = s.match(/\b(?:for|about|around|roughly|approx\.?|~|maybe)\s*(\d{1,4})\b(?!\s*(?:pm|am|k\b|th|st|nd|rd|ft|feet|hours?|hrs?|%|dollars|bucks|years?))/))) out.guests = +m[1];
  else if (expect === 'guests' && (m = s.match(/\b(\d{1,4})\b/))) out.guests = +m[1];
  if (out.guests && (out.guests < 2 || out.guests > 3000 || (out.guests >= 2024 && out.guests <= 2035))) delete out.guests;
  if ((m = s.match(/\$\s*([\d,.]+)\s*(k|thousand)?/)) || (m = s.match(/\b([\d,.]+)\s*(k|thousand)\b/)) || (expect === 'budget' && (m = s.match(/\b([\d,.]{3,})\b/)))) {
    let n = parseFloat(m[1].replace(/,/g, '')); if (m[2]) n *= 1000; if (n >= 500) out.budget = Math.round(n);
  }
  for (const [a, rx] of AREA_RX) if (rx.test(s)) { out.area = a; break; }
  const s2 = s.replace(/miami beach|south beach|mid-beach|mid beach|north beach|key biscayne|coral gables/g, ' ');
  const outdoor = /outdoor|outside|open-air|open air|lawn|under the stars|al fresco|rooftop|terrace|garden|courtyard|beach/.test(s2);
  const indoor = /indoor|inside|air.?condition|\ba\/?c\b|ballroom/.test(s2);
  if (outdoor && indoor) out.setting = 'either'; else if (outdoor) out.setting = 'outdoor'; else if (indoor) out.setting = 'indoor';
  if (/round tables|seated|sit-down|sit down|plated|banquet/.test(s)) out.layout = 'banquet';
  else if (/cocktail|standing|mingl|high-top|high top/.test(s)) out.layout = 'reception';
  else if (/theater|theatre|rows of chairs|auditorium/.test(s)) out.layout = 'theater';
  else if (/classroom/.test(s)) out.layout = 'classroom';
  else if (/boardroom|conference table/.test(s)) out.layout = 'boardroom';
  const food = [];
  const FOOD = [['plated dinner', /plated/], ['buffet', /buffet/], ['family-style dinner', /family.?style/], ['stations', /stations/], ['dinner', /dinner/], ['lunch', /lunch/], ['brunch', /brunch/], ['breakfast', /breakfast/], ['cocktails and bites', /cocktails?|bites|hors|appetizer|canap/], ['open bar', /open bar|drinks|bar\b/], ['cake', /cake|dessert/], ['coffee service', /coffee/]];
  for (const [l, rx] of FOOD) if (rx.test(s)) { if (l === 'dinner' && food.some(f => /dinner/.test(f))) continue; food.push(l); }
  if (food.length) out.catering = cap1(food.join(', '));
  const needs = []; for (const [n, rx] of NEED_RX) if (rx.test(s)) needs.push(n);
  if (needs.length) out.needs = needs;
  const style = []; for (const [st, rx] of STYLE_RX) if (rx.test(s2)) style.push(st);
  if (style.length) out.style = style;
  if ((m = raw.match(MONTH_RX))) out.date = m[0].trim();
  else if ((m = s.match(/\b(next|this)\s+(weekend|week|month|spring|summer|fall|autumn|winter|year)\b/))) out.date = m[0];
  else if ((m = s.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/))) out.date = m[0];
  if ((m = s.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b(?:\s*(?:-|–|to|until|till)\s*(\d{1,2})(?::\d{2})?\s*(am|pm)?)?/))) out.time = m[0];
  else if ((m = s.match(/\b(saturday|sunday|friday|weekday|weekend|monday|tuesday|wednesday|thursday)?\s*(morning|afternoon|evening|night|daytime)\b/))) out.time = m[0].trim();
  else if ((m = s.match(/\b(saturday|sunday|friday|monday|tuesday|wednesday|thursday)\b/))) out.time = cap1(m[0]);
  if (/midnight|\b1\s*am|\b2\s*am|late night|late-night|after 11|until 1|till 1|all night|party late/.test(s)) out.lateNight = true;
  if (expect === 'when' && !out.date && !out.time && raw.trim().length > 1 && !/not sure|no idea|tbd|don.?t know/.test(s)) out.date = raw.trim().slice(0, 60);
  if (expect === 'catering' && !out.catering && raw.trim().length > 2 && !/not sure|none|no food/.test(s)) out.catering = cap1(raw.trim().slice(0, 80));
  if (expect === 'style' && !out.style && raw.trim().length > 2) out.style = raw.toLowerCase().split(/,|\band\b|\//).map(x => x.trim()).filter(x => x && x.length < 24).slice(0, 4);
  return out;
}
const SKIP_RX = /^(?:not sure|no idea|anywhere|any|nothing|none|no|nope|skip|don.?t know|doesn.?t matter|whatever|tbd|flexible)\b/i;

function mergeBrief(p) {
  if (!p) return [];
  const changed = [];
  const set = (k, v) => { if (v != null && v !== '' && JSON.stringify(brief[k]) !== JSON.stringify(v)) { brief[k] = v; changed.push(k); } };
  if (p.eventType) set('eventType', String(p.eventType).toLowerCase());
  if (p.guests) set('guests', Math.round(+p.guests));
  if (p.date) set('date', String(p.date));
  if (p.time) set('time', String(p.time));
  if (p.lateNight === true) set('lateNight', true);
  if (p.area) set('area', p.area);
  if (p.setting) set('setting', p.setting);
  if (p.layout && LAYOUTS[p.layout]) set('layout', p.layout);
  if (p.catering) { const c = String(p.catering); if (c.startsWith('+')) set('catering', brief.catering ? `${brief.catering}, ${c.slice(1).toLowerCase()}` : c.slice(1)); else set('catering', c); }
  if (p.needs && p.needs.length) { const u = [...new Set([...brief.needs, ...p.needs])]; set('needs', u); }
  if (p.budget) set('budget', Math.round(+p.budget));
  if (p.style && p.style.length) { const u = [...new Set([...brief.style, ...p.style.map(x => String(x).toLowerCase())])].slice(0, 6); set('style', u); }
  return changed;
}

/* ---------- brief panel ---------- */
/* The brief has no panel of its own; re-rank the venue grid whenever it changes. */
function renderBrief() {
  renderGrid();
}

/* ---------- chat UI ---------- */
const msgsEl = $('#msgs'), chipsEl = $('#chips'), input = $('#chatInput');
function logoAv() { const img = document.createElement('img'); img.className = 'logo-mark av'; img.src = 'brand/icon.png'; img.width = 28; img.height = 28; img.alt = ''; return img; }
function nearBottom() { return msgsEl.scrollHeight - msgsEl.scrollTop - msgsEl.clientHeight < 120; }
function scrollDown(force) { if (force || nearBottom()) msgsEl.scrollTop = msgsEl.scrollHeight; }
function addBreeza(text) {
  const b = h('div', { class: 'bubble' });
  if (text != null) b.textContent = text;
  const row = h('div', { class: 'msg' }, logoAv(), b);
  msgsEl.append(row); scrollDown(true);
  return b;
}
function setTyping(b) { b.textContent = ''; b.append(h('span', { class: 'typing', 'aria-label': 'Breeza is typing' }, h('i'), h('i'), h('i'))); }
function addUser(text, imgs, voice) {
  const b = h('div', { class: 'bubble' });
  if (imgs && imgs.length) b.append(h('div', { class: 'photos' }, imgs.map(p => h('img', { src: p.thumb, alt: 'Inspiration photo' }))));
  if (voice) {
    const a = h('audio', { controls: true, src: voice.url, preload: 'metadata' });
    b.append(a, h('div', { class: 'vtag', text: `Voice note${voice.dur ? ` · ${fmtDur(voice.dur)}` : ''}${voice.transcript ? '' : ''}` }));
  }
  if (text) b.append(document.createTextNode(text));
  msgsEl.append(h('div', { class: 'msg me' }, b)); scrollDown(true);
}
function addNote(text) { msgsEl.append(h('div', { class: 'note', text })); scrollDown(); }
function addWide(node) { msgsEl.append(h('div', { class: 'msg wide' }, logoAv(), node)); scrollDown(true); }
function setChips(list) {
  chipsEl.textContent = '';
  (list || []).forEach(c => chipsEl.append(h('button', { type: 'button', class: 'chip' + (c.go ? ' go' : ''), text: c.l, onclick: () => onChip(c) })));
}
function onChip(c) {
  if (c.action) return c.action();
  send(c.say || c.l, { value: c.v, skip: c.skip, showNow: c.showNow });
}
const fmtDur = s => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

/* thumbnails for venues (rendered later by the 3D engine) */
const thumbs = {};
function phEl(v, cls = 'ph') {
  const g = { indoor: ['#F3E3C3', '#B79465'], lawn: ['#9FD3EA', '#7DB36A'], rooftop: ['#2B5C96', '#F0A46B'], courtyard: ['#9FD3EA', '#E2CFA9'], pavilion: ['#6D8FC4', '#F3C79A'] }[v.scene.kind] || ['#9fd3ea', '#e6d2a8'];
  const d = h('div', { class: cls, style: `--g1:${g[0]};--g2:${g[1]}` });
  const img = h('img', { alt: `${v.space}, ${v.hotel}`, 'data-thumb': v.id, loading: 'lazy' });
  if (thumbs[v.id]) img.src = thumbs[v.id]; else img.hidden = true;
  d.append(img);
  return d;
}
function applyThumbs() {
  document.querySelectorAll('img[data-thumb]').forEach(img => { const t = thumbs[img.dataset.thumb]; if (t && img.src !== t) { img.src = t; img.hidden = false; } });
}

function postmark(big, small, low) { return h('span', { class: 'postmark' + (low ? ' low' : ''), 'aria-hidden': 'true' }, h('span', null, h('b', { text: big }), h('small', { text: small }))); }
function matchRow(v, s) {
  const reasons = h('ul', { class: 'reasons' }, s.ok.slice(0, 2).map(t => h('li', { text: t })), s.no.slice(0, 1).map(t => h('li', { class: 'no', text: t })));
  return h('button', { type: 'button', class: 'match' + (currentVenue && currentVenue.id === v.id ? ' cur' : ''), 'data-id': v.id, onclick: () => openVenue(v.id), 'aria-label': `${v.space} at ${v.hotel}, ${s.score}% fit. Step inside in 360°` },
    phEl(v),
    h('div', { style: 'min-width:0' }, h('div', { class: 'hotel', text: `${v.hotel} · ${v.area}` }), h('div', { class: 'sp', text: v.space }), h('div', { class: 'spec mono', text: `${num(sqft(v))} sq ft · ${dimStr(v)} · ${ceilStr(v)}` }), reasons),
    postmark(s.fits ? `${s.score}%` : '—', s.fits ? 'FIT' : 'TOO SMALL', !s.fits));
}
let lastMatchKey = '';
const matchKey = () => JSON.stringify([brief.eventType, brief.guests, brief.area, brief.setting, brief.layout, brief.catering, brief.needs, brief.budget, brief.style, brief.lateNight]);
function showMatches(onlyIds) {
  const r = ranked();
  const list = onlyIds ? r.filter(x => onlyIds.includes(x.v.id)) : r.slice(0, 3);
  lastMatchKey = matchKey();
  const node = h('div', { class: 'matches' },
    h('div', { class: 'mh', text: onlyIds ? 'From the catalog' : `Top matches for your ${eventPhrase()}` }),
    list.map(x => matchRow(x.v, x.s)),
    onlyIds ? null : h('div', { class: 'mf' }, h('button', { type: 'button', class: 'chip', text: 'See all spaces ranked', onclick: () => { $('#fSort').value = 'fit'; renderGrid(); if (immOpen) closeImm(); document.getElementById('venues').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' }); } })));
  addWide(node);
  if (!onlyIds && list.length && !list[0].s.fits) addBreeza(`None of the partner spaces fit ${num(brief.guests)} guests in a ${LAYOUTS[list[0].s.layout].label.toLowerCase()} setup. The biggest is Meridian Hall, with up to 950 theater-style. Want me to try a standing reception instead?`);
}

/* ---------- guided Breeza (no AI needed) ---------- */
const Q = {
  eventType: { q: 'What are you celebrating or hosting?', chips: [['Wedding', 'wedding'], ['Quinceañera', 'quinceañera'], ['Birthday', 'birthday'], ['Baby shower', 'baby shower'], ['Rehearsal dinner', 'rehearsal dinner'], ['Company event', 'corporate']].map(([l, t]) => ({ l, v: { eventType: t } })) },
  guests: { q: 'About how many guests are you expecting?', chips: [25, 50, 100, 150, 250, 400].map(n => ({ l: n === 400 ? '400+' : String(n), say: `${n} guests`, v: { guests: n } })) },
  when: { q: 'When is it, and roughly what hours?', chips: [{ l: 'Saturday evening', v: { time: 'Saturday evening' } }, { l: 'Sunday brunch', v: { time: 'Sunday brunch', catering: 'Brunch' } }, { l: 'Weekday daytime', v: { time: 'Weekday daytime' } }, { l: 'Late night, past midnight', v: { time: 'Late night', lateNight: true } }, { l: 'Not sure yet', skip: 'when' }] },
  place: { q: 'Any part of Miami you love? Or tell me indoors or outdoors.', chips: [...AREAS.map(a => ({ l: a, v: { area: a } })), { l: 'Outdoors', v: { setting: 'outdoor' } }, { l: 'Indoors', v: { setting: 'indoor' } }, { l: 'Anywhere', skip: 'place' }] },
  catering: { q: 'What should guests eat and drink?', chips: [{ l: 'Plated dinner', v: { catering: 'Plated dinner' } }, { l: 'Buffet', v: { catering: 'Buffet' } }, { l: 'Cocktails & bites', v: { catering: 'Cocktails and passed bites', layout: 'reception' } }, { l: 'Brunch', v: { catering: 'Brunch' } }, { l: 'Not sure yet', skip: 'catering' }] },
  needs: { q: 'Any must-haves in the room?', chips: [{ l: 'Dance floor', v: { needs: ['dance'] } }, { l: 'Screen or TV', v: { needs: ['screen'] } }, { l: 'Stage', v: { needs: ['stage'] } }, { l: 'Microphones', v: { needs: ['mic'] } }, { l: 'DJ booth', v: { needs: ['dj'] } }, { l: 'Bridal suite', v: { needs: ['bridal'] } }, { l: 'Nothing special', skip: 'needs' }] },
  budget: { q: "What's your budget for the space plus food and drink?", chips: [{ l: 'Under $10k', v: { budget: 10000 } }, { l: '$10k – 25k', v: { budget: 25000 } }, { l: '$25k – 50k', v: { budget: 50000 } }, { l: '$50k+', v: { budget: 90000 } }, { l: 'Not sure', skip: 'budget' }] },
  style: { q: 'Last one: pick a vibe, or add a few inspiration photos.', chips: ['Ocean view', 'Rooftop', 'Garden', 'Modern', 'Classic', 'Industrial', 'Tropical'].map(st => ({ l: st, v: { style: [st.toLowerCase()] } })).concat([{ l: 'Surprise me', skip: 'style' }]) }
};
const STARTERS = [
  { l: 'Wedding for 120 in Miami Beach', say: 'Wedding reception for 120 guests in Miami Beach, with a dance floor' },
  { l: 'Quinceañera for 150', say: 'A quinceañera for 150 guests with a dance floor and a stage' },
  { l: 'Rooftop 30th birthday', say: 'Rooftop 30th birthday for 60 people, cocktails and bites' },
  { l: 'Team offsite for 20', say: 'Team offsite for 20 people, we need a screen and video conferencing' }
];
let expecting = null, asked = 0;
function changedPhrase(ch) {
  const bits = [];
  if (ch.includes('eventType')) bits.push(brief.eventType);
  if (ch.includes('guests')) bits.push(`${num(brief.guests)} guests`);
  if (ch.includes('area')) bits.push(brief.area);
  if (ch.includes('setting') && brief.setting !== 'either') bits.push(brief.setting);
  if (ch.includes('date')) bits.push(brief.date);
  if (ch.includes('time')) bits.push(brief.time);
  if (ch.includes('catering')) bits.push(brief.catering.toLowerCase());
  if (ch.includes('needs')) bits.push(brief.needs.map(n => NEED_LABEL[n].toLowerCase()).join(', '));
  if (ch.includes('budget')) bits.push(`up to ${money(brief.budget)}`);
  if (ch.includes('style')) bits.push(brief.style.join(', '));
  const seen = new Set(), uniq = [];
  for (const b of bits.filter(Boolean)) { const k = String(b).toLowerCase(); if (!seen.has(k)) { seen.add(k); uniq.push(b); } }
  return uniq.length ? `Got it: ${uniq.join(', ')}.` : '';
}
function readyForMatches() {
  if (!(brief.eventType && brief.guests)) return false;
  const missing = ORDER.filter(f => !known(f) && !skipped.has(f)).length;
  return missing <= 2 || asked >= 5;
}
function guidedReply(text, opts, changed) {
  let reply;
  if (immOpen && currentVenue && text && !opts.venueId && !opts.showNow && !opts.value && !opts.skip) {
    const ans = venueAnswer(currentVenue, text);
    if (ans) { addBreeza(ans); setChips(venueChips(currentVenue)); return ans; }
    if (!changed.length) { reply = `I can answer questions about ${currentVenue.space}: its size, capacity, pricing, catering, hours and equipment. Try one of these.`; addBreeza(reply); setChips(venueChips(currentVenue)); return reply; }
  }
  if (opts.venueId) {
    const v = VBY[opts.venueId], s = scoreVenue(v, brief);
    reply = `${v.space} at ${v.hotel} is ${num(sqft(v))} sq ft (${dimStr(v)}, ${ceilStr(v)}). ${capPhrase(s.layout, s.cap) || ''}. ${v.blurb}${brief.guests ? ` For your ${eventPhrase()}, I'd call it a ${s.score}% fit.` : ''} Tap it for the 360° view and full pricing.`;
    addBreeza(reply); showMatches([v.id]); return reply;
  }
  if (opts.imagesOnly) {
    expecting = 'style';
    reply = `Love ${opts.imagesOnly > 1 ? 'these' : 'this'}. I'll pass ${opts.imagesOnly > 1 ? 'them' : 'it'} to the hotel with your request. Which words fit the look you want?`;
    addBreeza(reply); setChips(Q.style.chips); return reply;
  }
  if (opts.showNow || (readyForMatches() && (changed.length || opts.skip))) {
    if (!brief.eventType || !brief.guests) {
      const f = !brief.eventType ? 'eventType' : 'guests';
      reply = `I just need ${f === 'eventType' ? 'the kind of event' : 'a guest count'} first. ${Q[f].q}`;
      expecting = f; addBreeza(reply); setChips(Q[f].chips); return reply;
    }
    reply = `${changedPhrase(changed)} Here are the best fits for your ${eventPhrase()}. Tap one for the 360° view, exact measurements and pricing.`.trim();
    addBreeza(reply); showMatches(); setChips(refineChips()); expecting = null; return reply;
  }
  const next = nextMissing();
  if (!next) { return guidedReply('', { showNow: true }, changed); }
  if (!changed.length && text && !opts.skip && expecting === next) {
    reply = `Sorry, I didn't catch that. ${Q[next].q}`;
  } else {
    reply = `${changedPhrase(changed)} ${Q[next].q}`.trim();
  }
  expecting = next; asked++;
  addBreeza(reply); setChips(Q[next].chips);
  return reply;
}
function refineChips() {
  const c = [];
  const n = nextMissing();
  if (n && Q[n]) c.push(...Q[n].chips.filter(x => !x.skip).slice(0, 4));
  c.push({ l: 'Browse every venue', action: () => { if (immOpen) closeImm(); document.getElementById('venues').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' }); } });
  return c;
}

/* ---------- AI Breeza (uses the viewer's Claude when available) ---------- */
let sample = null, mode = 'pending', imgLimits = null, busy = false, ctl = null;
const turns = [];
function hostedSample() {
  const fn = async (messages, options) => {
    const res = await fetch('/api/breeze', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: (messages || []).map(m => ({ role: m.role, content: String(m.content || '') })) }),
      signal: options && options.signal
    });
    if (res.status === 429) { const e = new Error('rate'); e.code = 'rate_limited'; throw e; }
    if (!res.ok) { const e = new Error('host'); e.code = 'not_granted'; throw e; }
    const data = await res.json();
    const text = String(data.text || '');
    if (options && options.onText) options.onText({ text });
    return { text };
  };
  fn.limits = async () => ({ images: null });
  return fn;
}
const samplePromise = (async () => {
  if (window.claude && typeof window.claude.use === 'function') {
    try { return await window.claude.use('sample'); } catch (e) { /* hosted or guided */ }
  }
  try {
    const st = await fetch('/api/status');
    if (st.ok) {
      const j = await st.json();
      if (j.live) return hostedSample();
    }
  } catch (e) { /* guided */ }
  return null;
})();
samplePromise.then(async s => {
  sample = s;
  if (s) { mode = 'ai'; try { const l = await s.limits(); imgLimits = (l && l.images) || null; } catch (e) { imgLimits = null; } }
  else mode = 'guided';
  renderMode();
});
function renderMode() {
  const p = $('#modePill');
  if (mode === 'ai') { p.textContent = 'AI'; p.className = 'pill'; p.title = 'Breeza is answering with AI'; }
  else if (mode === 'guided') { p.textContent = 'Guided'; p.className = 'pill guided'; p.title = 'Breeza is asking guided questions'; }
  else { p.textContent = 'Connecting'; p.className = 'pill guided'; }
}
function catalogText() {
  return VENUES.map(v => `${v.space}, ${v.hotel} (${v.area}) | ${v.setting} ${v.kind.toLowerCase()}, ${dimStr(v)} = ${num(sqft(v))} sq ft, ${ceilStr(v)}${v.view ? `, view: ${v.view}` : ''} | capacity: ${Object.entries(v.cap).map(([k, n]) => `${k} ${n}`).join(', ')} | ${v.amen.map(a => `${a.n} ${a.s}`).join('; ')} | rental ${money(v.price.rental)} ${v.price.rentalNote}, food & beverage minimum ${money(v.price.fbMin)}, catering from ${money(v.price.perGuest)}/guest (${v.price.perGuestNote}) | hours: ${v.hours.map(x => x.join(' ')).join('; ')} | ${v.notes.join('; ')}`).join('\n');
}
function rulesPrompt() {
  return `You are Breeza, the booking assistant on Breeze Book ("Booking should be a Breeze"). Breeze Book matches people planning events with event spaces at partner hotels in Miami.

Style: warm, brief and practical. Reply in 1 to 3 short sentences and ask at most one question. Plain text only: no markdown, lists or emoji.

Your job: learn what the guest needs, one question at a time, roughly in this order and skipping anything already known: the kind of event, number of guests, date and hours, area of Miami or indoors/outdoors, food and drink, must-have equipment (dance floor, screen, stage, microphones, DJ booth, video conferencing, bridal suite), total budget for space plus food and drink, and the look or vibe.

The page shows matching spaces from the catalog below. Never invent spaces, prices or availability, and say hotels confirm dates if asked. When you know the event type and guest count plus at least two more details, or the guest asks to see options, set showMatches to true and say in one sentence that these are the best fits. If the guest asks about a space, answer only from the catalog. If they send inspiration photos, describe the look in a few words and add style tags. Politely steer anything unrelated back to planning their event.

After your reply, write a line containing only ### and then one JSON object with everything known so far. Keep earlier values unless the guest changed them, and use null for unknowns:
{"eventType": string|null, "guests": number|null, "date": string|null, "time": string|null, "lateNight": boolean, "area": "Brickell"|"Miami Beach"|"Coral Gables"|"Wynwood"|"Key Biscayne"|"Downtown"|"Anywhere"|null, "setting": "indoor"|"outdoor"|"either"|null, "layout": "banquet"|"reception"|"theater"|"classroom"|"boardroom"|null, "catering": string|null, "needs": ["dance floor"|"screen"|"stage"|"microphones"|"dj booth"|"video conferencing"|"bridal suite"], "budget": number|null, "style": [string], "showMatches": boolean}
Use these eventType values when one fits: wedding, quinceañera, birthday, anniversary, baby shower, rehearsal dinner, engagement party, gala, conference, corporate, holiday party, graduation.

Catalog:
${catalogText()}

Known so far: ${JSON.stringify({ ...brief, inspirationPhotos: photos.length, voiceNotes: voiceNotes.length })}${immOpen && currentVenue ? `

Right now the guest is inside ${currentVenue.space} at ${currentVenue.hotel}, in a full-screen 360° view set up as ${LAYOUTS[curLayout].label.toLowerCase()} for ${guestsFor(currentVenue, curLayout)} guests. Questions like "how high is the ceiling", "will we fit" or "what does it cost" are about this space: answer them directly from its catalog line in 1 to 3 sentences. Only suggest other spaces (showMatches true) if they ask or it clearly doesn't fit.` : ''}`;
}
function cleanSay(s) { return s.replace(/\*\*|__/g, '').replace(/^\s*[-•]\s+/gm, '').trim(); }
function visiblePart(t) { const i = t.indexOf('###'); let s = i >= 0 ? t.slice(0, i) : t; s = s.replace(/#+\s*$/, ''); return cleanSay(s); }
function parseAIData(t) {
  const i = t.indexOf('###'); if (i < 0) return null;
  const j = t.slice(i + 3); const a = j.indexOf('{'), b = j.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(j.slice(a, b + 1)); } catch (e) { return null; }
}
const NEED_FROM_AI = { 'dance floor': 'dance', dance: 'dance', screen: 'screen', tv: 'screen', projector: 'screen', stage: 'stage', microphones: 'mic', microphone: 'mic', mic: 'mic', 'dj booth': 'dj', dj: 'dj', 'video conferencing': 'vc', 'bridal suite': 'bridal' };
function normalizeAI(d) {
  if (!d || typeof d !== 'object') return {};
  const o = {};
  if (typeof d.eventType === 'string' && d.eventType.trim()) o.eventType = d.eventType.trim().toLowerCase().replace('quinceanera', 'quinceañera');
  const g = Number(d.guests); if (g >= 2 && g <= 3000) o.guests = g;
  if (typeof d.date === 'string' && d.date.trim()) o.date = d.date.trim().slice(0, 60);
  if (typeof d.time === 'string' && d.time.trim()) o.time = d.time.trim().slice(0, 60);
  if (d.lateNight === true) o.lateNight = true;
  if (typeof d.area === 'string') { const a = AREAS.find(x => x.toLowerCase() === d.area.toLowerCase()); if (a) o.area = a; }
  if (['indoor', 'outdoor', 'either'].includes(d.setting)) o.setting = d.setting;
  if (LAYOUTS[d.layout]) o.layout = d.layout;
  if (typeof d.catering === 'string' && d.catering.trim()) o.catering = cap1(d.catering.trim().slice(0, 100));
  if (Array.isArray(d.needs)) o.needs = [...new Set(d.needs.map(n => NEED_FROM_AI[String(n).toLowerCase()]).filter(Boolean))];
  const bu = Number(d.budget); if (bu >= 500) o.budget = Math.round(bu);
  if (Array.isArray(d.style)) o.style = d.style.map(x => String(x).toLowerCase().trim()).filter(x => x && x.length < 30).slice(0, 5);
  return o;
}
async function aiReply(text, imgs, opts) {
  let content = text || '';
  if (opts.venueId) { const v = VBY[opts.venueId]; content = `Tell me about ${v.space} at ${v.hotel}. Would it work for my event?`; }
  if (imgs.length) content += `${content ? '\n' : ''}[I attached ${imgs.length} inspiration photo${imgs.length > 1 ? 's' : ''}.]`;
  if (opts.value && !text) content = opts.say || content;
  if (!content.trim()) content = '(no text)';
  turns.push({ role: 'user', content });
  while (turns.length > 18) turns.shift();
  const bubble = addBreeza(null); setTyping(bubble);
  ctl = new AbortController();
  const options = { cache: false, signal: ctl.signal, modelTier: 'quick', onText: ({ text: t }) => { const vis = visiblePart(t); if (vis) { bubble.textContent = vis; scrollDown(); } } };
  if (imgs.length && imgLimits) options.images = imgs.slice(0, imgLimits.maxCount || 4).map(p => p.blob);
  setBusy(true);
  try {
    const res = await sample([{ role: 'user', content: rulesPrompt() }, ...turns], options);
    const say = visiblePart(res.text) || 'Got it.';
    bubble.textContent = say;
    turns.push({ role: 'assistant', content: say });
    const d = parseAIData(res.text);
    const ch = mergeBrief(normalizeAI(d));
    renderBrief(ch);
    if (opts.venueId) showMatches([opts.venueId]);
    else if ((d && d.showMatches) || opts.showNow) {
      if (brief.eventType && brief.guests && matchKey() !== lastMatchKey) showMatches();
    }
    afterReplyChips();
    return true;
  } catch (e) {
    const code = e && e.code;
    if (code === 'cancelled') { if (e.text && visiblePart(e.text)) { bubble.textContent = visiblePart(e.text); turns.push({ role: 'assistant', content: visiblePart(e.text) }); } else { bubble.parentElement.remove(); turns.pop(); } return true; }
    bubble.parentElement.remove();
    if (code !== 'refused') turns.pop();
    if (code === 'refused') { turns.pop(); addBreeza("I can't help with that one. Tell me about the event you're planning and I'll find spaces that fit."); return true; }
    if (['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed'].includes(code)) { mode = 'guided'; renderMode(); addNote('Breeza is in guided mode: she asks set questions instead of chatting freely.'); }
    else if (code === 'images_unavailable' || code === 'image_rejected') { imgLimits = null; addNote("Breeza couldn't look at those photos, so she'll ask about the vibe instead."); }
    else if (code === 'rate_limited') addNote('Breeza is busy right now, so this reply uses guided questions.');
    else if (code === 'session_expired') addNote('Sign in to Claude again for full chat. Guided questions work meanwhile.');
    return false;
  } finally { setBusy(false); }
}
function afterReplyChips() {
  if (immOpen && currentVenue) { setChips(venueChips(currentVenue)); return; }
  const c = [];
  if (brief.eventType && brief.guests && matchKey() !== lastMatchKey) c.push({ l: 'Show my matches', go: true, showNow: true, say: 'Show me my matches' });
  const n = nextMissing();
  if (n && Q[n]) c.push(...Q[n].chips.slice(0, 6));
  setChips(c);
}
function setBusy(on) {
  busy = on;
  const b = $('#sendBtn');
  b.querySelector('.lbl').textContent = on ? 'Stop' : 'Send';
  b.classList.toggle('stop', on);
  b.setAttribute('aria-label', on ? 'Stop Breeza' : 'Send');
  b.type = on ? 'button' : 'submit';
}
$('#sendBtn').addEventListener('click', e => { if (busy && ctl) { e.preventDefault(); ctl.abort(); } });

/* ---------- send pipeline ---------- */
let guidedLock = false;
async function send(text, opts = {}) {
  text = (text || '').trim();
  if (busy || guidedLock) return;
  const imgs = opts.images || takePending();
  if (!text && !imgs.length && !opts.voice && !opts.venueId) return;
  setChips([]);
  if (opts.venueId) addUser(`Tell me about ${VBY[opts.venueId].space}. Would it work for my event?`);
  else addUser(text, imgs, opts.voice);
  if (imgs.length) imgs.forEach(p => photos.push(p));
  if (opts.skip) skipped.add(opts.skip);
  if (opts.voice) voiceNotes.push(opts.voice);
  let changed = [];
  if (opts.value) changed = changed.concat(mergeBrief(opts.value));
  if (text && !opts.value) {
    if (SKIP_RX.test(text) && expecting && !opts.skip) { skipped.add(expecting); opts = { ...opts, skip: expecting }; }
    const parsed = parseText(text, expecting);
    const isQ = immOpen && /\?\s*$|^(what|how|is|are|does|do|can|will|would|could|where|when|which|any|tell me)\b/i.test(text.trim());
    changed = changed.concat(mergeBrief(isQ ? { guests: parsed.guests } : parsed));
  }
  renderBrief(changed);
  if (opts.voice && !text) {
    const r = "I saved your voice note and I'll attach it to your request for the hotel. I can't hear audio in this window, so type the key details or use your keyboard's microphone to dictate.";
    addBreeza(r); turns.push({ role: 'user', content: '[sent a voice note]' }, { role: 'assistant', content: r });
    afterReplyChips(); return;
  }
  if (mode === 'pending') {
    guidedLock = true; const b = addBreeza(null); setTyping(b);
    await samplePromise; await new Promise(r => setTimeout(r, 0));
    b.parentElement.remove(); guidedLock = false;
  }
  if (mode === 'ai' && sample) { const handled = await aiReply(text, imgs, { ...opts, imagesOnly: imgs.length && !text ? imgs.length : 0 }); if (handled) return; }
  guidedLock = true;
  const b = addBreeza(null); setTyping(b);
  await new Promise(r => setTimeout(r, reduceMotion ? 50 : 450));
  b.parentElement.remove(); guidedLock = false;
  const reply = guidedReply(text, { ...opts, imagesOnly: imgs.length && !text ? imgs.length : 0 }, changed);
  if (mode === 'ai' && reply) turns.push({ role: 'user', content: text || '[photos]' }, { role: 'assistant', content: reply });
}

$('#composer').addEventListener('submit', e => { e.preventDefault(); if (busy) return; const t = input.value; input.value = ''; autoGrow(); send(t); });
input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); $('#composer').requestSubmit(); } });
function autoGrow() { input.style.height = 'auto'; input.style.height = Math.min(140, input.scrollHeight + 2) + 'px'; }
input.addEventListener('input', autoGrow);

function greet() {
  msgsEl.textContent = '';
  addBreeza("Hi, I'm Breeza. Tell me what you're planning and I'll match you with Miami hotel spaces that fit. Type it, record a voice note, or add a few inspiration photos.");
  setChips(STARTERS.map(s => ({ ...s })));
}
$('#resetBtn').addEventListener('click', () => {
  if (busy && ctl) ctl.abort();
  Object.assign(brief, { eventType: null, guests: null, date: null, time: null, lateNight: false, area: null, setting: null, layout: null, catering: null, needs: [], budget: null, style: [] });
  skipped.clear(); photos.length = 0; voiceNotes.length = 0; turns.length = 0; pending.length = 0; renderTray();
  expecting = null; asked = 0; lastMatchKey = '';
  renderBrief(); greet(); input.focus();
});

/* ---------- photos ---------- */
const pending = [];
$('#photoBtn').addEventListener('click', () => $('#photoInput').click());
$('#photoInput').addEventListener('change', async e => {
  const files = [...e.target.files].filter(f => /^image\//.test(f.type)).slice(0, 4 - pending.length);
  e.target.value = '';
  for (const f of files) { try { pending.push(await shrink(f)); } catch (err) { toast("That photo couldn't be opened. Try a JPEG or PNG."); } }
  renderTray();
  if (files.length && !input.value) input.placeholder = 'Add a note about these photos, or just send';
});
function shrink(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file); const img = new Image();
    img.onload = () => {
      const big = draw(img, 1400), small = draw(img, 220);
      URL.revokeObjectURL(url);
      big.toBlob(b => b ? res({ blob: b, thumb: small.toDataURL('image/jpeg', .8) }) : rej(), 'image/jpeg', .86);
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(); };
    img.src = url;
  });
  function draw(img, max) { const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight)); const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); return c; }
}
function renderTray() {
  const t = $('#tray'); t.textContent = ''; t.hidden = !pending.length;
  pending.forEach((p, i) => t.append(h('div', { class: 't' }, h('img', { src: p.thumb, alt: 'Photo to send' }), h('button', { type: 'button', 'aria-label': 'Remove photo', text: '×', onclick: () => { pending.splice(i, 1); renderTray(); } }))));
}
function takePending() { const p = pending.splice(0); renderTray(); input.placeholder = 'Describe your event…'; return p; }

/* ---------- voice ---------- */
const micPanel = $('#micPanel');
let rec = null, recStream = null, recChunks = [], recStart = 0, recTimer = null, recog = null, transcript = '', recCancelled = false;
$('#micBtn').addEventListener('click', () => { if (rec && rec.state === 'recording') stopRec(false); else startRec(); });
async function startRec() {
  if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) || typeof MediaRecorder === 'undefined') return micFallback();
  try { recStream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (e) { return micFallback(); }
  recChunks = []; transcript = ''; recCancelled = false;
  rec = new MediaRecorder(recStream);
  rec.ondataavailable = e => { if (e.data && e.data.size) recChunks.push(e.data); };
  rec.onstop = onRecStop;
  rec.start(); recStart = Date.now();
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SR) { try { recog = new SR(); recog.lang = 'en-US'; recog.continuous = true; recog.interimResults = true; recog.onresult = ev => { let fin = '', inter = ''; for (let i = 0; i < ev.results.length; i++) { const r = ev.results[i]; if (r.isFinal) fin += r[0].transcript; else inter += r[0].transcript; } transcript = fin; const l = $('#liveTx'); if (l) l.textContent = (fin + ' ' + inter).trim() || 'Listening…'; }; recog.onerror = () => {}; recog.start(); } catch (e) { recog = null; } }
  $('#micBtn').classList.add('rec'); $('#micBtn').setAttribute('aria-label', 'Stop recording');
  micPanel.hidden = false; micPanel.textContent = '';
  micPanel.append(
    h('div', { class: 'row' }, h('span', { class: 'recdot' }), h('b', { text: 'Recording' }), h('span', { class: 'mono', id: 'recTime', text: '0:00' })),
    h('div', { class: 'live', id: 'liveTx', text: recog ? 'Listening…' : 'Speak now. Breeza will attach the recording to your request.' }),
    h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn sm', text: 'Stop and send', onclick: () => stopRec(false) }), h('button', { type: 'button', class: 'btn sm ghost', text: 'Cancel', onclick: () => stopRec(true) })));
  recTimer = setInterval(() => { const t = $('#recTime'); if (t) t.textContent = fmtDur((Date.now() - recStart) / 1000); if (Date.now() - recStart > 120000) stopRec(false); }, 250);
}
function stopRec(cancel) {
  recCancelled = cancel; clearInterval(recTimer);
  try { recog && recog.stop(); } catch (e) {}
  if (rec && rec.state !== 'inactive') rec.stop();
  $('#micBtn').classList.remove('rec'); $('#micBtn').setAttribute('aria-label', 'Record a voice note');
  micPanel.hidden = true;
}
function onRecStop() {
  if (recStream) recStream.getTracks().forEach(t => t.stop());
  const dur = (Date.now() - recStart) / 1000;
  if (recCancelled || !recChunks.length) return;
  const blob = new Blob(recChunks, { type: (rec && rec.mimeType) || 'audio/webm' });
  setTimeout(() => { const tx = transcript.trim(); send(tx, { voice: { url: URL.createObjectURL(blob), dur, transcript: tx } }); }, 350);
}
function micFallback() {
  micPanel.hidden = false; micPanel.textContent = '';
  micPanel.append(
    h('div', { text: "This window doesn't allow microphone recording. Upload a voice memo instead, or tap the microphone on your phone's keyboard to dictate." }),
    h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn sm', text: 'Upload a voice memo', onclick: () => $('#audioInput').click() }), h('button', { type: 'button', class: 'btn sm ghost', text: 'Close', onclick: () => { micPanel.hidden = true; } })));
}
$('#audioInput').addEventListener('change', e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  micPanel.hidden = true;
  const url = URL.createObjectURL(f);
  const a = new Audio(); a.preload = 'metadata'; a.src = url;
  const go = () => send('', { voice: { url, dur: isFinite(a.duration) ? a.duration : 0, transcript: '' } });
  a.onloadedmetadata = go; a.onerror = go; setTimeout(() => { if (a.readyState < 1) { a.onloadedmetadata = a.onerror = null; go(); } }, 1200);
});

/* ---------- browse grid ---------- */
AREAS.forEach(a => $('#fArea').append(h('option', { value: a, text: a })));
['fArea', 'fSetting', 'fSort'].forEach(id => $('#' + id).addEventListener('change', renderGrid));
$('#fGuests').addEventListener('input', renderGrid);
function renderGrid() {
  const grid = $('#grid'); grid.textContent = '';
  const area = $('#fArea').value, setting = $('#fSetting').value, sort = $('#fSort').value;
  const g = +$('#fGuests').value || null;
  const b = { ...brief, guests: g || brief.guests, area: area || brief.area, setting: setting || brief.setting };
  const hasBrief = !!(b.guests || b.eventType || b.area || b.setting || b.needs.length || b.budget || b.style.length);
  let list = VENUES.filter(v => (!area || v.area === area) && (!setting || v.setting === setting)).map(v => ({ v, s: scoreVenue(v, b) }));
  if (sort === 'fit') list.sort((a, z) => (z.s.fits - a.s.fits) || (z.s.score - a.s.score) || (sqft(z.v) - sqft(a.v)));
  else if (sort === 'size') list.sort((a, z) => sqft(z.v) - sqft(a.v));
  else list.sort((a, z) => a.v.price.perGuest - z.v.price.perGuest);
  if (!list.length) { grid.append(h('div', { class: 'empty-state', text: 'No spaces match those filters yet. Try another area or setting.' })); return; }
  for (const { v, s } of list) {
    const ph = phEl(v);
    ph.append(h('span', { class: 'tag360', text: '360° · to scale' }));
    const cap = v.cap.banquet ? `Seats ${num(v.cap.banquet)}` : `Seats ${num(v.cap.theater)}`;
    const tilt = ((hashStr(v.id) % 13) - 6) / 10;
    grid.append(h('button', { type: 'button', class: 'card' + (b.guests && !s.fits ? ' dim' : ''), style: `--tilt:${tilt}deg`, onclick: () => openVenue(v.id), 'aria-label': `${v.space} at ${v.hotel}. Step inside in 360°` },
      ph, hasBrief ? postmark(s.fits ? `${s.score}%` : '—', s.fits ? 'FIT' : 'TOO SMALL', !s.fits) : null,
      h('div', { class: 'body' },
        h('div', { class: 'hotel', text: `${v.hotel} · ${v.area}` }),
        h('h3', { text: v.space }),
        h('div', { class: 'spec mono', text: `${num(sqft(v))} sq ft · ${dimStr(v)} · ${ceilStr(v)}` }),
        h('div', { class: 'facts' }, h('span', { text: cap }), h('span', { text: `${num(v.cap.reception)} standing` }), h('span', { text: cap1(v.setting) })),
        h('div', { class: 'price' }, h('span', null, 'From ', h('b', { text: `${money(v.price.perGuest)}` }), ' / guest'), h('span', null, 'Rental ', h('b', { text: money(v.price.rental) }))))));
  }
}

/* ---------- full-screen venue view with Breeza alongside ---------- */
const imm = $('#imm'), immPanel = $('#immPanel'), panelBody = $('#immPanelBody'), immChat = $('#immChat'), immPill = $('#immPill');
const chatEl = $('.chat'), chatHome = $('.chat-wrap'), stage = $('#immStage');
let viewer = null, viewerPending = false, lastFocus = null, currentVenue = null, curLayout = 'banquet', immOpen = false, panelOpen = true, chatOpen = true, lastContextId = null;
const isNarrow = () => window.matchMedia('(max-width: 760px)').matches;
const SUB_DEFAULT = 'Miami hotel venue matchmaker';

function syncImmPanels() {
  const narrow = isNarrow();
  immPanel.hidden = !panelOpen;
  const db = $('#immDetailsBtn'); db.setAttribute('aria-expanded', String(panelOpen)); db.classList.toggle('on', panelOpen);
  const showChat = chatOpen && !(narrow && panelOpen);
  immChat.hidden = !showChat;
  immPill.hidden = showChat || (narrow && panelOpen);
  imm.classList.toggle('chat-up', showChat);
}
$('#immDetailsBtn').addEventListener('click', () => { panelOpen = !panelOpen; if (narrow() && !panelOpen) chatOpen = true; syncImmPanels(); });
function narrow() { return isNarrow(); }
$('#chatMinBtn').addEventListener('click', () => { chatOpen = false; syncImmPanels(); immPill.focus(); });
immPill.addEventListener('click', () => { chatOpen = true; if (isNarrow()) panelOpen = false; syncImmPanels(); scrollDown(true); input.focus({ preventScroll: true }); });
$('#immClose').addEventListener('click', closeImm);
window.addEventListener('resize', () => { if (immOpen) syncImmPanels(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && immOpen && !document.fullscreenElement) closeImm(); });

const fsBtn = $('#immFsBtn');
if (!document.fullscreenEnabled) fsBtn.hidden = true;
fsBtn.addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  else if (imm.requestFullscreen) imm.requestFullscreen().catch(() => toast('Full screen is not available in this window'));
});
document.addEventListener('fullscreenchange', () => { fsBtn.textContent = document.fullscreenElement ? 'Exit full screen' : 'Full screen'; });

function openVenue(id, layoutOverride) {
  const v = VBY[id]; if (!v) return;
  const first = !immOpen;
  const changedVenue = !currentVenue || currentVenue.id !== v.id;
  currentVenue = v;
  if (first) {
    lastFocus = document.activeElement;
    imm.hidden = false; immOpen = true;
    document.documentElement.classList.add('imm-lock');
    immChat.append(chatEl);
    panelOpen = !isNarrow(); chatOpen = true;
    $('#immHint').style.opacity = '';
    if (document.fullscreenEnabled && window.matchMedia('(pointer: fine)').matches && !document.fullscreenElement && imm.requestFullscreen) imm.requestFullscreen().catch(() => {});
  }
  syncImmPanels();
  $('#chatSub').textContent = `Viewing ${v.space} · ${v.hotel}`;
  setupStage(v, layoutOverride, changedVenue);
  renderPanel(v);
  if (lastContextId !== v.id) {
    lastContextId = v.id;
    msgsEl.append(h('div', { class: 'ctx', text: `Now viewing ${v.space}` }));
    addBreeza(`You're inside ${v.space} at ${v.hotel}. Drag to look around, switch the setup at the bottom, and ask me anything about it: the ceiling, whether your group fits, prices, catering or hours.`);
    setChips(venueChips(v));
  }
  document.querySelectorAll('.match').forEach(m => m.classList.toggle('cur', m.dataset.id === v.id));
  scrollDown(true);
  if (first) setTimeout(() => stage.focus({ preventScroll: true }), 50);
}
function closeImm() {
  if (!immOpen) return;
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  immOpen = false; imm.hidden = true;
  document.documentElement.classList.remove('imm-lock');
  if (viewer) { viewer.destroy(); viewer = null; }
  chatHome.append(chatEl);
  $('#chatSub').textContent = SUB_DEFAULT;
  currentVenue = null;
  document.querySelectorAll('.match.cur').forEach(m => m.classList.remove('cur'));
  if (turns.length || brief.eventType || brief.guests) afterReplyChips(); else setChips(STARTERS.map(s => ({ ...s })));
  scrollDown(true);
  if (lastFocus && lastFocus.isConnected) lastFocus.focus({ preventScroll: true });
}

function guestsFor(v, l) { return Math.min(v.cap[l], brief.guests || Math.round(v.cap[l] * 0.6)); }
function setupStage(v, layoutOverride, changedVenue) {
  const s = scoreVenue(v, brief);
  const offered = Object.keys(LAYOUTS).filter(k => v.cap[k]);
  curLayout = layoutOverride || (offered.includes(s.layout) ? s.layout : offered[0]);
  $('#immHotel').textContent = `${v.hotel} · ${v.area}, Miami`;
  $('#immTitle').textContent = v.space;
  $('#immSpec').textContent = `${num(sqft(v))} sq ft · ${dimStr(v)} · ${ceilStr(v)}`;
  stage.setAttribute('aria-label', `360° view of ${v.space}, built to scale. Drag or use the arrow keys to look around.`);
  const seg = $('#immSeg'); seg.textContent = '';
  offered.forEach(l => seg.append(h('button', { type: 'button', 'data-l': l, 'aria-pressed': String(l === curLayout), text: LAYOUTS[l].label, onclick: () => setLayout(l) })));
  updateCount();
  if (viewer) viewer.show(v, curLayout, guestsFor(v, curLayout), changedVenue);
  else if (!viewerPending) {
    viewerPending = true;
    start3D(stage).then(vw => {
      viewerPending = false;
      if (!vw) return;
      if (immOpen && !viewer && currentVenue) { viewer = vw; viewer.show(currentVenue, curLayout, guestsFor(currentVenue, curLayout), true); }
      else vw.destroy();
    });
  }
}
function updateCount() {
  const v = currentVenue; if (!v) return;
  const g = guestsFor(v, curLayout);
  $('#immCount').textContent = `Set for ${num(g)} guests${brief.guests && brief.guests > v.cap[curLayout] ? ` · max ${num(v.cap[curLayout])}` : ''}`;
}
function setLayout(l) {
  const v = currentVenue; if (!v) return;
  curLayout = l;
  document.querySelectorAll('#immSeg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.l === l)));
  updateCount();
  if (viewer) viewer.show(v, l, guestsFor(v, l), false);
  highlightCap(l);
}
function highlightCap(l) { document.querySelectorAll('#capTbl tbody tr').forEach(tr => tr.classList.toggle('on', tr.dataset.l === l)); }

function renderPanel(v) {
  panelBody.textContent = '';
  const s = scoreVenue(v, brief);
  const hasBrief = !!(brief.guests || brief.eventType);
  const est = estimate(v, brief.guests && brief.guests <= maxCap(v) ? brief.guests : null);
  const tile = (b, t) => h('div', { class: 'spec-tile' }, h('b', { text: b }), h('span', { text: t }));
  const prow = (a, sub, b) => h('div', { class: 'row' }, h('span', null, a, h('small', { text: sub })), h('b', { text: b }));
  panelBody.append(...[
    h('div', { class: 'grab', 'aria-hidden': 'true' }),
    h('p', { class: 'blurb', text: v.blurb }),
    h('div', { class: 'tags' }, [v.kind, cap1(v.setting), v.view, ...v.style.slice(0, 3).map(cap1)].filter(Boolean).map(t => h('span', { text: t }))),
    hasBrief ? h('div', { class: 'why' }, h('h4', null, `For your ${eventPhrase()} `, h('span', { class: 'score', text: s.fits ? `· ${s.score}% fit` : '· not a fit' })),
      h('ul', { class: 'reasons' }, s.ok.slice(0, 5).map(t => h('li', { text: t })), s.no.slice(0, 3).map(t => h('li', { class: 'no', text: t })))) : null,
    h('div', { class: 'dsec' }, h('h4', { text: 'Measurements' }),
      h('div', { class: 'specgrid' }, tile(num(sqft(v)), 'square feet'), tile(dimStr(v), 'length × width'), tile(v.dims.h ? `${v.dims.h} ft` : 'Open sky', v.dims.h ? 'ceiling height' : 'no ceiling'), tile(num(maxCap(v)), 'max guests'))),
    h('div', { class: 'dsec' }, h('h4', { text: 'Capacity by layout' }),
      h('div', { class: 'tblwrap' }, h('table', { class: 'tbl', id: 'capTbl' }, h('tbody', null, Object.keys(LAYOUTS).map(k => h('tr', { 'data-l': k, class: k === curLayout ? 'on' : null }, h('td', null, LAYOUTS[k].label, h('small', { text: LAYOUTS[k].note })), h('td', { class: 'n', text: v.cap[k] ? num(v.cap[k]) : 'Not offered' }))))))),
    h('div', { class: 'dsec' }, h('h4', { text: 'Equipment and features' }),
      h('div', { class: 'tblwrap' }, h('table', { class: 'tbl' }, h('tbody', null, v.amen.map(a => h('tr', null, h('td', { text: a.n }), h('td', { class: 'n', text: a.s }))))))),
    h('div', { class: 'dsec' }, h('h4', { text: 'Pricing' }),
      h('div', { class: 'pricecard' },
        prow('Room rental', v.price.rentalNote, money(v.price.rental)),
        prow('Food & beverage minimum', 'spend on catering and bar', money(v.price.fbMin)),
        prow('Catering', `from, per guest · ${v.price.perGuestNote}`, money(v.price.perGuest)),
        h('div', { class: 'est' }, h('div', { class: 'eyebrow', text: `Estimate for ${num(est.guests)} guests` }), h('div', { class: 'big', text: money(est.total) }),
          h('p', { text: `Rental plus ${est.minApplies ? 'the food and beverage minimum' : `${num(est.guests)} × ${money(v.price.perGuest)} catering`}, before service charge and tax.` })))),
    h('div', { class: 'dsec' }, h('h4', { text: 'Hours of operation' }),
      h('ul', { class: 'hours' }, v.hours.map(([d, t]) => h('li', null, h('span', { text: d }), h('span', { text: t })))),
      h('ul', { class: 'notes' }, v.notes.map(n => h('li', { text: n })))),
    h('div', { class: 'pcta' },
      h('button', { type: 'button', class: 'btn', text: 'Request this space', onclick: () => renderRequest(v) }),
      isNarrow() ? h('button', { type: 'button', class: 'btn ghost', text: 'Ask Breeza about it', onclick: () => immPill.click() }) : null)].filter(Boolean));
  panelBody.scrollTop = 0;
}

function venueChips(v) {
  const g = brief.guests;
  return [
    { l: 'How high is the ceiling?' },
    { l: g ? `Will ${num(g)} guests fit?` : 'How many guests fit?' },
    { l: 'What does it cost?' },
    { l: 'What screens and sound are there?' },
    { l: 'What are the hours?' },
    v.setting !== 'indoor' ? { l: 'What if it rains?' } : { l: "What's the view?" },
    { l: 'Show me other options', showNow: true }
  ];
}
function venueAnswer(v, raw) {
  const s = raw.toLowerCase(); const out = [];
  const add = t => { if (t && !out.includes(t)) out.push(t); };
  const list = a => a.map(x => `${x.n.toLowerCase()} (${x.s})`).join(', ');
  const parsedG = parseText(raw).guests;
  if (/ceiling|how (tall|high)|\btall\b|height/.test(s)) add(v.dims.h ? `The ceiling is ${v.dims.h} ft high${v.scene.kind === 'pavilion' ? ' at the peak of the roof, with open sides' : ''}.` : `It's open-air, so there's no ceiling, just sky.`);
  if (/\bsize\b|how big|square|sq\.? ?ft|dimension|measure|\bwide\b|width|\blong\b|length|footage/.test(s)) add(`${v.space} is ${num(sqft(v))} sq ft: ${dimStr(v)}${v.dims.h ? `, with a ${v.dims.h} ft ceiling` : ''}.`);
  if (/\bfit\b|capacity|\bhold|\bseat|how many|guests|people|room for/.test(s)) {
    const g = parsedG || brief.guests;
    const caps = Object.entries(v.cap).filter(([, n]) => n).map(([k, n]) => `${num(n)} ${k === 'reception' ? 'standing' : LAYOUTS[k].label.toLowerCase()}`).join(', ');
    let t = `It holds ${caps}.`;
    if (g) { const lay = curLayout || pickLayout(brief), c = v.cap[lay] || maxCap(v); t += g <= c ? (g / c > .9 ? ` ${num(g)} guests fit in the ${LAYOUTS[lay].label.toLowerCase()} setup, but it'll be snug.` : ` ${num(g)} guests fit in the ${LAYOUTS[lay].label.toLowerCase()} setup with room to spare.`) : ` That's short of ${num(g)} guests in the ${LAYOUTS[lay].label.toLowerCase()} setup.`; }
    add(t);
  }
  const priceQ = /price|cost|how much|minimum|rental|\bfee|expensive|budget|afford|\$/.test(s);
  if (priceQ) { const e = estimate(v, parsedG || brief.guests); add(`Room rental is ${money(v.price.rental)} (${v.price.rentalNote}), with a ${money(v.price.fbMin)} food and beverage minimum and catering from ${money(v.price.perGuest)} per guest. For ${num(e.guests)} guests that's about ${money(e.total)} before service charge and tax.`); }
  if (!priceQ && /cater|food|menu|dinner|lunch|brunch|\bbar\b|drink|\beat\b|meal|chef/.test(s)) add(`Catering starts at ${money(v.price.perGuest)} per guest (${v.price.perGuestNote}), with a ${money(v.price.fbMin)} food and beverage minimum.`);
  if (/\bhours?\b|\bopen\b|clos|\blate\b|curfew|music|midnight|until|what time/.test(s)) { const mus = v.notes.filter(n => /music|curfew/i.test(n)); add(`Hours: ${v.hours.map(([d, t]) => `${d}, ${t}`).join('; ')}.${mus.length ? ' ' + mus.join('. ') + '.' : ''}`); }
  if (/screen|\btv\b|projector|\bav\b|a\/v|audio|sound|speaker|display|\bled\b|video|presentation/.test(s)) { const a = v.amen.filter(x => ['screen', 'mic', 'dj', 'vc'].includes(x.t)); add(a.length ? `For AV there's ${list(a)}.` : `No built-in screens are listed; ${v.hotel} can arrange rentals.`); }
  else if (/\bmic|microphone|speech|toast/.test(s)) { const a = v.amen.filter(x => x.t === 'mic'); add(a.length ? `Microphones: ${a[0].s}.` : 'No microphones are listed for this space.'); }
  if (/danc/.test(s)) { const a = v.amen.filter(x => x.t === 'dance'); add(a.length ? `${a[0].n}: ${a[0].s}.` : `There's no dedicated dance floor listed.`); }
  if (/stage|\bband\b|perform/.test(s)) { const a = v.amen.filter(x => x.t === 'stage'); add(a.length ? `${a[0].n}: ${a[0].s}.` : `No built-in stage is listed; staging can be rented.`); }
  if (/\bdj\b/.test(s)) { const a = v.amen.filter(x => x.t === 'dj'); add(a.length ? `${a[0].n}: ${a[0].s}.` : `There's no DJ booth, but DJs can set up on a table near the dance floor.`); }
  if (/park|valet|garage/.test(s)) { const n = v.notes.find(x => /park|valet|garage/i.test(x)); add(n ? `${n}.` : `Parking isn't listed for this space; ${v.hotel} can confirm.`); }
  if (/rain|weather|storm|hurricane|indoor|outdoor|air.?con|\ba\/?c\b|\bhot\b|heat/.test(s)) add(v.setting === 'indoor' ? `It's indoors and air-conditioned.` : `It's an outdoor ${v.kind.toLowerCase()}. ${(v.notes.find(x => /rain/i.test(x)) || 'The hotel has a rain plan')}.`);
  if (/bridal|getting ready|dressing/.test(s)) { const a = v.amen.filter(x => x.t === 'bridal'); add(a.length ? `${a[0].n}: ${a[0].s}.` : `No bridal suite is listed with this space.`); }
  if (/\bview|window|ocean|sunset|skyline|look like/.test(s)) add(v.view ? `The view: ${v.view}.` : `${v.space} is an interior room without windows, which makes lighting and screens easy to control.`);
  if (/\bbook\b|reserve|availab|\bhold\b|request/.test(s)) add(`I can't see live availability; ${v.hotel} confirms dates. Tap "Request this space" in Details and they'll get everything they need to quote you.`);
  if (/wheelchair|accessib|elevator|\bada\b|stairs/.test(s)) add(`Accessibility details aren't in this listing yet; ${v.hotel} can confirm step-free access and elevators.`);
  return out.length ? out.slice(0, 3).join(' ') : null;
}

/* ---------- request form (inside the details panel) ---------- */
function renderRequest(v) {
  panelOpen = true; syncImmPanels();
  panelBody.textContent = '';
  const lay = curLayout;
  const offered = Object.keys(LAYOUTS).filter(k => v.cap[k]);
  const dateGuess = (() => { if (!brief.date) return ''; let d = new Date(brief.date); if (isNaN(d)) return ''; const now = new Date(); if (d.getFullYear() < now.getFullYear()) d.setFullYear(now.getFullYear()); if (d < now) d.setFullYear(d.getFullYear() + 1); return d.toISOString().slice(0, 10); })();
  const today = new Date().toISOString().slice(0, 10);
  const fld = (label, el, full) => h('label', { class: full ? 'full' : null }, label, el);
  const f = h('form', { class: 'form', novalidate: true },
    fld('Your name', h('input', { id: 'rqName', name: 'name', autocomplete: 'name', required: true }), true),
    fld('Email', h('input', { id: 'rqEmail', name: 'email', type: 'email', autocomplete: 'email', required: true })),
    fld('Phone', h('input', { id: 'rqPhone', name: 'phone', type: 'tel', autocomplete: 'tel' })),
    fld('Event', h('input', { id: 'rqEvent', name: 'event', value: brief.eventType ? cap1(brief.eventType) : '', placeholder: 'Wedding reception', required: true })),
    fld('Guests', h('input', { id: 'rqGuests', name: 'guests', type: 'number', min: '1', max: String(maxCap(v)), inputmode: 'numeric', value: brief.guests ? String(Math.min(brief.guests, maxCap(v))) : '', required: true })),
    fld('Date', h('input', { id: 'rqDate', name: 'date', type: 'date', min: today, value: dateGuess, required: true }), true),
    fld('Start', h('input', { id: 'rqStart', name: 'start', type: 'time', value: '18:00' })),
    fld('End', h('input', { id: 'rqEnd', name: 'end', type: 'time', value: '23:00' })),
    fld('Setup', (() => { const s = h('select', { id: 'rqLayout', name: 'layout' }); offered.forEach(k => s.append(h('option', { value: k, text: `${LAYOUTS[k].label} (up to ${num(v.cap[k])})`, selected: k === lay }))); return s; })(), true),
    fld('Food & drink', h('input', { id: 'rqFood', name: 'food', value: brief.catering || '', placeholder: 'Plated dinner, open bar' }), true),
    h('label', { class: 'check full' }, h('input', { type: 'checkbox', id: 'rqRooms', name: 'rooms' }), 'I also need guest rooms', h('input', { id: 'rqRoomCount', name: 'roomCount', type: 'number', min: '1', placeholder: 'How many?', 'aria-label': 'How many guest rooms', style: 'max-width:110px;margin-left:auto' })),
    fld('Anything else the hotel should know?', h('textarea', { id: 'rqNotes', name: 'notes', placeholder: 'Ceremony on site, kids attending, dietary needs…' }), true),
    h('div', { class: 'err full', id: 'rqErr', role: 'alert' }),
    h('div', { class: 'full form-actions' }, h('button', { type: 'submit', class: 'btn', text: 'Send request' }), h('button', { type: 'button', class: 'btn ghost', text: 'Back to details', onclick: () => renderPanel(v) })));
  f.addEventListener('submit', e => {
    e.preventDefault();
    const val = id => $('#' + id).value.trim();
    const errs = [];
    if (!val('rqName')) errs.push('your name');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(val('rqEmail'))) errs.push('a valid email');
    if (!val('rqDate')) errs.push('a date');
    const g = +val('rqGuests');
    if (!g) errs.push('a guest count');
    const L = val('rqLayout');
    if (g && g > v.cap[L]) errs.push(`no more than ${num(v.cap[L])} guests for a ${LAYOUTS[L].label.toLowerCase()} setup`);
    if (errs.length) { $('#rqErr').textContent = `Add ${errs.join(', ')}.`; return; }
    renderReceipt(v, { name: val('rqName'), email: val('rqEmail'), phone: val('rqPhone'), event: val('rqEvent'), date: val('rqDate'), start: val('rqStart'), end: val('rqEnd'), guests: g, layout: L, food: val('rqFood'), rooms: $('#rqRooms').checked ? (val('rqRoomCount') || 'Yes') : 'No', notes: val('rqNotes') });
  });
  panelBody.append(h('div', { class: 'grab', 'aria-hidden': 'true' }), h('div', { class: 'req' },
    h('button', { type: 'button', class: 'back', text: '← Details', onclick: () => renderPanel(v) }),
    h('h2', { text: `Request ${v.space}` }),
    h('p', { class: 'lead', text: `${v.hotel} · ${v.area}. Breeza filled in what she already knows.` }), f));
  panelBody.scrollTop = 0;
}
function fmtDate(iso) { const d = new Date(iso + 'T12:00:00'); return isNaN(d) ? iso : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }); }
function fmtTime(t) { if (!t) return ''; const [H, M] = t.split(':').map(Number); return `${((H + 11) % 12) + 1}:${String(M).padStart(2, '0')} ${H < 12 ? 'am' : 'pm'}`; }
function renderReceipt(v, r) {
  panelBody.textContent = '';
  const est = estimate(v, r.guests);
  const rows = [
    ['Space', `${v.space}, ${v.hotel} (${v.area})`],
    ['Event', `${r.event || 'Event'} · ${num(r.guests)} guests`],
    ['Date and time', `${fmtDate(r.date)}${r.start ? ` · ${fmtTime(r.start)} – ${fmtTime(r.end)}` : ''}`],
    ['Setup', `${LAYOUTS[r.layout].label} (${LAYOUTS[r.layout].note}), room holds ${num(v.cap[r.layout])}`],
    ['Food & drink', r.food || 'To discuss'],
    ['Must-haves', brief.needs.length ? brief.needs.map(n => NEED_LABEL[n]).join(', ') : 'None listed'],
    ['Budget', brief.budget ? `Up to ${money(brief.budget)}` : 'Not shared'],
    ['Estimate', `${money(est.total)} before service charge and tax`],
    ['Guest rooms', r.rooms],
    ['Inspiration', `${photos.length} photo${photos.length === 1 ? '' : 's'} · ${voiceNotes.length} voice note${voiceNotes.length === 1 ? '' : 's'}`],
    ['Contact', [r.name, r.email, r.phone].filter(Boolean).join(' · ')],
    ['Notes', r.notes || '—']
  ];
  const text = `Breeze Book request\n${rows.map(([a, b]) => `${a}: ${b}`).join('\n')}`;
  const ok = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); const u = document.createElementNS('http://www.w3.org/2000/svg', 'use'); u.setAttribute('href', '#i-check'); ok.append(u);
  panelBody.append(h('div', { class: 'grab', 'aria-hidden': 'true' }), h('div', { class: 'req' },
    h('div', { class: 'okmark' }, ok),
    h('h2', { text: 'Your request is ready' }),
    h('p', { class: 'lead', text: `This is exactly what ${v.hotel}'s events team receives, so they can quote you without back-and-forth.` }),
    h('div', { class: 'receipt' }, h('div', { class: 'rh' }, h('b', { text: v.space }), h('span', { class: 'mono', style: 'font-size:11px;color:var(--muted)', text: `BB-${Date.now().toString(36).slice(-6).toUpperCase()}` })),
      h('dl', null, rows.map(([a, b]) => [h('dt', { text: a }), h('dd', { text: b })]))),
    h('div', { class: 'demo', text: `Demo: nothing is sent from this page. On the live site, this request goes straight to ${v.hotel}'s events inbox and they reply with a quote.` }),
    h('div', { class: 'form-actions' },
      h('button', { type: 'button', class: 'btn', text: 'Copy request', onclick: async e => { try { await navigator.clipboard.writeText(text); toast('Request copied'); } catch (err) { const pre = h('textarea', { style: 'width:100%;min-height:200px;margin-top:12px', readonly: true, 'aria-label': 'Request text' }); pre.value = text; e.target.closest('.req').append(pre); pre.select(); toast('Select the text to copy it'); } } }),
      h('button', { type: 'button', class: 'btn ghost', text: 'Back to details', onclick: () => renderPanel(v) }))));
  panelBody.scrollTop = 0;
  addBreeza(`Your request for ${v.space} is ready. Copy it from the Details panel, or keep exploring other spaces with me.`);
}

/* ---------- 3D: js/scene3d.js ---------- */
const { loadThree, webglOK, buildScene, Viewer, hashStr } = window.BB3D;
async function start3D(box) {
  try { if (!webglOK()) throw 0; await loadThree(); return new Viewer(box); }
  catch (e) { box.append(h('div', { class: 'vfallback', text: "The 360° view needs WebGL, which this browser has turned off. Measurements and capacities are below." })); return null; }
}

async function makeThumbs() {
  try { if (!webglOK()) return; await loadThree(); } catch (e) { return; }
  const THREE = window.THREE;
  const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  r.setPixelRatio(1); r.setSize(640, 400, false);
  const cam = new THREE.PerspectiveCamera(70, 640 / 400, .3, 4000); cam.rotation.order = 'YXZ';
  for (const v of VENUES) {
    await new Promise(res => setTimeout(res, 30));
    try {
      const lay = v.cap.banquet ? 'banquet' : 'theater';
      const b = buildScene(v, lay, Math.round(v.cap[lay] * .62));
      cam.position.copy(b.cam); cam.rotation.set(-.08, -Math.PI / 2 + .42, 0);
      r.render(b.scene, cam);
      thumbs[v.id] = r.domElement.toDataURL('image/jpeg', .82);
      b.dispose();
      applyThumbs();
    } catch (e) { /* keep gradient placeholder */ }
  }
  r.dispose(); try { r.forceContextLoss(); } catch (e) {}
}

/* ---------- start ---------- */
renderMode();
renderBrief();
greet();
const kick = () => makeThumbs();
if ('requestIdleCallback' in window) requestIdleCallback(kick, { timeout: 1500 }); else setTimeout(kick, 600);
})();
