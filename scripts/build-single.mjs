// Inlines css/, js/, and brand artwork into single-file builds.
//   dist/breezebook.html  a standalone page you can open or host anywhere
//   dist/artifact.html    the same page without <html>/<head>/<body>, ready to publish as a claude.ai artifact
//                         (the artifact publisher adds its own document skeleton). Declare the `sample`
//                         capability with images ({ sample: { images: true } }) so Breeza can use Claude.
// Usage: npm run build
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const read = f => readFileSync(join(ROOT, f), 'utf8');
const dataUri = f => {
  const buf = readFileSync(join(ROOT, f));
  return `data:image/png;base64,${buf.toString('base64')}`;
};

let html = read('index.html');
html = html.replace(/<link rel="stylesheet" href="css\/styles\.css">/, () => `<style>\n${read('css/styles.css')}</style>`);
html = html.replace(/<script src="(js\/[\w-]+\.js)"><\/script>/g, (_, f) => `<script>\n${read(f)}</script>`);
html = html.replace(/(?:src|href)="(brand\/[\w.-]+\.png)"/g, (full, f) => full.replace(`"${f}"`, `"${dataUri(f)}"`));
html = html.replace(/src = 'brand\/icon\.png'/g, () => `src = '${dataUri('brand/icon.png')}'`);

mkdirSync(join(ROOT, 'dist'), { recursive: true });
writeFileSync(join(ROOT, 'dist/breezebook.html'), html);

const head = html.slice(html.indexOf('<title>'), html.indexOf('</head>')).trim();
const body = html.slice(html.indexOf('<body>') + '<body>'.length, html.indexOf('</body>')).trim();
writeFileSync(join(ROOT, 'dist/artifact.html'), `${head}\n${body}\n`);

console.log('Wrote dist/breezebook.html and dist/artifact.html');
