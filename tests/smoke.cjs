// End-to-end smoke test of the main flows in a headless browser.
// Setup once: npm install && npx playwright install chromium
// Run:        npm test
// Breeza runs in guided mode here (no window.claude outside claude.ai), and the test does not need
// the 3D view to render, so it passes offline as long as Chromium is installed.
const { chromium, devices } = require('playwright');
const path = require('node:path');

(async () => {
  const { createServer } = await import(path.join(__dirname, '..', 'scripts', 'serve.mjs'));
  const server = createServer().listen(0);
  const url = `http://localhost:${server.address().port}/`;
  const browser = await chromium.launch();
  const results = [];
  const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? '✓' : '✗'} ${name}${ok || !detail ? '' : ` — ${detail}`}`); };

  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    const errors = [];
    const panoHits = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => { if (/tour\/grand\/.+\.jpg/.test(r.url())) panoHits.push(r.url()); });
    await page.goto(url);
    await page.waitForSelector('.msg .bubble');
    check('Page loads with Breeza greeting', (await page.textContent('.msg .bubble')).includes("I'm Breeza"));
    check('Venue grid shows every venue', (await page.$$('.card')).length === await page.evaluate(() => window.BB_DATA.VENUES.length));
    const thumbSrcs = await page.$$eval('.card img', els => els.map(e => e.getAttribute('src')));
    check('Venue cards use photographs', thumbSrcs.length > 0 && thumbSrcs.every(s => s && s.startsWith('photos/') && s.endsWith('.jpg')), thumbSrcs.join(', '));

    await page.click('.chip >> text=Wedding for 120 in Miami Beach');
    await page.waitForTimeout(800);
    const reply = await page.$$eval('.msg .bubble', els => els.at(-1).textContent);
    check('Breeza reads the starter message', /120 guests/.test(reply) && /Miami Beach/.test(reply), reply);

    for (let i = 0; i < 6 && !(await page.$('.matches')); i++) {
      const chip = await page.$('#chips .chip'); if (!chip) break;
      await chip.click(); await page.waitForTimeout(700);
    }
    check('Breeza shows matches', (await page.$$('.matches .match')).length === 3);

    await page.click('.match >> nth=0');
    await page.waitForTimeout(600);
    check('Clicking a match opens the full-screen view', await page.isVisible('#imm'));
    check('The original chat moves into the full-screen view', await page.evaluate(() => !!document.querySelector('#immChat .chat')));

    await page.fill('#chatInput', 'How high is the ceiling?');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(900);
    const answer = await page.$$eval('.msg .bubble', els => els.at(-1).textContent);
    check('Breeza answers questions about the open venue', /ceiling|open-air/i.test(answer), answer);

    await page.click('#immClose');
    await page.waitForTimeout(300);
    check('Closing returns the chat to the page', (await page.isHidden('#imm')) && await page.evaluate(() => !!document.querySelector('.chat-wrap .chat')));

    await page.click('.card >> nth=0');
    await page.waitForTimeout(500);
    check('Clicking a venue card opens the full-screen view', await page.isVisible('#imm'));
    await page.click('#immClose');
    await page.waitForTimeout(200);
    const banquetWait = page.waitForRequest(r => /tour\/grand\/banquet\.jpg/.test(r.url()), { timeout: 15000 }).catch(() => null);
    await page.click('#tourCta');
    const banquetReq = await banquetWait;
    check('Grand Ballroom tour loads a 360 photograph', !!(banquetReq || panoHits.some(u => u.includes('banquet.jpg'))), panoHits.join(', ') || 'no pano requests');
    check('Grand Ballroom tour is open', await page.isVisible('#imm'));
    if (await page.isHidden('#immPanel')) await page.click('#immDetailsBtn');
    await page.click('text=Request this space');
    await page.fill('#rqName', 'Test Guest');
    await page.fill('#rqEmail', 'guest@example.com');
    await page.fill('#rqDate', '2027-04-17');
    await page.click('button:has-text("Send request")');
    await page.waitForTimeout(300);
    check('Request form produces a receipt', (await page.textContent('#immPanelBody')).includes('Your request is ready'));
    await page.click('#immClose');
    check('No JavaScript errors on desktop', errors.length === 0, errors.join(' | '));

    const ctx = await browser.newContext({ ...devices['iPhone 13'] });
    const phone = await ctx.newPage();
    const phoneErrors = [];
    phone.on('pageerror', e => phoneErrors.push(e.message));
    await phone.goto(url);
    await phone.waitForTimeout(500);
    const widths = await phone.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    check('No sideways scrolling on a phone', widths[0] <= widths[1], `${widths[0]} > ${widths[1]}`);
    check('No JavaScript errors on a phone', phoneErrors.length === 0, phoneErrors.join(' | '));
  } finally {
    await browser.close();
    server.close();
  }

  const failed = results.filter(r => !r.ok).length;
  console.log(failed ? `\n${failed} check(s) failed` : `\nAll ${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
