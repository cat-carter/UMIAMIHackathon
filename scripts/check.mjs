// Fast static checks: JS syntax, files referenced by index.html, and the venue catalog schema.
// Usage: npm run check
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const problems = [];
const fail = msg => problems.push(msg);

// 1. Syntax of every browser script.
for (const f of ['js/venues.js', 'js/scene3d.js', 'js/app.js']) {
  try { execFileSync(process.execPath, ['--check', join(ROOT, f)], { stdio: 'pipe' }); }
  catch (e) { fail(`${f}: syntax error\n${e.stderr}`); }
}

// 2. Every local file index.html points to exists.
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
for (const [, ref] of html.matchAll(/(?:src|href)="(?!https?:|#|data:|mailto:)([^"]+)"/g)) {
  if (!existsSync(join(ROOT, ref))) fail(`index.html references missing file: ${ref}`);
}

// 3. Venue catalog schema.
const sandbox = { window: {} };
vm.runInNewContext(readFileSync(join(ROOT, 'js/venues.js'), 'utf8'), sandbox);
const { AREAS, LAYOUTS, VENUES } = sandbox.window.BB_DATA || {};
if (!Array.isArray(VENUES)) fail('js/venues.js must set window.BB_DATA = { AREAS, LAYOUTS, VENUES }');
const ids = new Set();
const TAGS = ['screen', 'dance', 'stage', 'mic', 'dj', 'vc', 'bridal'];
const KINDS = ['indoor', 'lawn', 'rooftop', 'courtyard', 'pavilion'];
for (const v of VENUES || []) {
  const where = `venue "${v.id || v.space}"`;
  for (const k of ['id', 'hotel', 'area', 'space', 'kind', 'setting', 'blurb', 'dims', 'cap', 'amen', 'price', 'hours', 'closesAt', 'notes', 'style', 'goodFor', 'scene']) if (v[k] == null) fail(`${where}: missing "${k}"`);
  if (ids.has(v.id)) fail(`${where}: duplicate id`); ids.add(v.id);
  if (v.id && !/^[a-z0-9-]+$/.test(v.id)) fail(`${where}: id must be lowercase-with-dashes`);
  if (!AREAS.includes(v.area)) fail(`${where}: area "${v.area}" is not in AREAS`);
  if (!['indoor', 'outdoor'].includes(v.setting)) fail(`${where}: setting must be "indoor" or "outdoor"`);
  if (!(v.dims?.l > 0 && v.dims?.w > 0)) fail(`${where}: dims.l and dims.w must be positive feet`);
  if (v.setting === 'indoor' && !(v.dims?.h > 0)) fail(`${where}: indoor spaces need dims.h (ceiling height, ft)`);
  for (const k of Object.keys(v.cap || {})) if (!LAYOUTS[k]) fail(`${where}: unknown layout "${k}" in cap`);
  if (!v.cap?.reception) fail(`${where}: cap.reception is required (the cards show it)`);
  if (!v.cap?.banquet && !v.cap?.theater) fail(`${where}: needs cap.banquet or cap.theater`);
  for (const a of v.amen || []) { if (!a.n || !a.s) fail(`${where}: every amenity needs n (name) and s (size)`); if (a.t && !TAGS.includes(a.t)) fail(`${where}: amenity tag "${a.t}" must be one of ${TAGS.join(', ')}`); }
  for (const k of ['rental', 'fbMin', 'perGuest']) if (!(v.price?.[k] >= 0)) fail(`${where}: price.${k} must be a number`);
  if (!KINDS.includes(v.scene?.kind)) fail(`${where}: scene.kind must be one of ${KINDS.join(', ')}`);
  if (v.scene?.kind === 'indoor' && !['carpet', 'wood', 'concrete'].includes(v.scene.floor)) fail(`${where}: indoor scene.floor must be carpet, wood or concrete`);
  if (v.scene?.kind === 'rooftop' && !v.scene.pergola) fail(`${where}: rooftop scenes need scene.pergola {w,d,h}`);
  if (v.scene?.floor === 'carpet' && !(Array.isArray(v.scene.carpet) && v.scene.carpet.length === 2)) fail(`${where}: carpet floors need scene.carpet [base, pattern] colors`);
}

for (const f of ['brand/icon.png', 'brand/mark.png', 'brand/favicon.png']) {
  if (!existsSync(join(ROOT, f))) fail(`missing brand artwork: ${f}`);
}

if (problems.length) { console.error(`✗ ${problems.length} problem(s):\n- ${problems.join('\n- ')}`); process.exit(1); }
console.log(`✓ Scripts parse, index.html references resolve, ${VENUES.length} venues pass the schema check.`);
