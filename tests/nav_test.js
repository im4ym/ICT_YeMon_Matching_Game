// Navigation test: menu links reach all 9 pages, Next level links chain 1 -> 2 -> 3 -> menu.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const repo = path.resolve(process.argv[2]);
const out = path.resolve(__dirname, 'results', process.argv[3] || 'nav');
fs.mkdirSync(out, { recursive: true });
const SOLVE = { 1: [[3, 0], [1, 1], [4, 2], [2, 3]], 2: [[2, 0], [4, 1], [1, 2], [3, 3]], 3: [[5, 0], [3, 1], [6, 2], [4, 3]] };
(async () => {
  const browser = await chromium.launch();
  const rows = [];
  const page = await browser.newPage({ viewport: { width: 1180, height: 760 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('file://' + repo + '/index.html');
  await page.waitForTimeout(900);
  await page.screenshot({ path: out + '/menu.png', fullPage: true });
  const links = await page.$$eval('a.lvl', (as) => as.map((a) => a.getAttribute('href')));
  for (const href of links) {
    await page.goto('file://' + repo + '/' + href);
    const title = await page.$eval('.title', (e) => e.textContent.trim());
    const ok = fs.existsSync(path.join(repo, href)) && (await page.$('#stage')) !== null;
    rows.push(['Menu link', href, title, ok ? 'Pass' : 'Fail']);
  }
  // play Fruit Orchard Level 1 to the end, then follow Next level twice
  await page.setViewportSize({ width: 1214, height: 620 });
  let url = 'file://' + repo + '/fruit-orchard/level1.html';
  for (let lv = 1; lv <= 3; lv++) {
    await page.goto(url);
    await page.click('#playBtn');
    for (const [n, i] of SOLVE[lv]) { await page.click(`#numCol [data-n="${n}"]`); await page.click(`#basketCol [data-i="${i}"]`); }
    await page.waitForTimeout(1300);
    await page.screenshot({ path: `${out}/fruit-orchard_level${lv}_complete.png` });
    const label = await page.$eval('#nextBtn', (e) => e.textContent.trim());
    await page.click('#nextBtn');
    await page.waitForLoadState();
    const landed = page.url().split('/').slice(-2).join('/');
    const want = lv < 3 ? `fruit-orchard/level${lv + 1}.html` : 'ICT_YeMon_Matching_Game/index.html';
    rows.push(['Complete screen', `Level ${lv}: "${label}"`, landed, landed.endsWith(want.split('/').pop()) ? 'Pass' : 'Fail']);
    url = page.url();
  }
  // All levels button on a start screen
  await page.goto('file://' + repo + '/toy-box/level2.html');
  await page.screenshot({ path: out + '/toy-box_level2_start.png' });
  await page.click('#menuBtn');
  await page.waitForLoadState();
  rows.push(['Start screen', 'All levels button', page.url().split('/').pop(), page.url().endsWith('index.html') ? 'Pass' : 'Fail']);
  if (errors.length) rows.push(['JS errors', '', errors.join(' | '), 'Fail']);
  await browser.close();
  rows.forEach((r) => console.log(r.join(' | ')));
  const f = rows.filter((r) => r[3] !== 'Pass').length;
  console.log(f ? f + ' FAILED' : 'ALL ' + rows.length + ' PASS');
  fs.writeFileSync(out + '/results.json', JSON.stringify(rows, null, 1));
  process.exit(f ? 1 : 0);
})();
