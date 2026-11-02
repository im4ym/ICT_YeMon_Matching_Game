// Level 1 regression tests: run on all three themes, print a results table, save screenshots.
// Set WITH_T4=1 to include the match line check.
// usage: node tests/regress.js . <label>
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const repo = path.resolve(process.argv[2]);
const label = process.argv[3] || 'run';
const outDir = path.resolve(__dirname, 'results', label);
fs.mkdirSync(outDir, { recursive: true });

const THEMES = [
  { dir: 'fruit-orchard', name: 'apples' },
  { dir: 'under-the-sea', name: 'fish' },
  { dir: 'toy-box', name: 'balls' },
];

async function state(page) {
  return page.evaluate(() => ({
    big: document.getElementById('fbBig').textContent.trim(),
    small: document.getElementById('fbSmall').textContent.trim(),
    stars: document.getElementById('starTxt').textContent.replace(/\D/g, ''),
    show: document.getElementById('feedback').className,
  }));
}

(async () => {
  const browser = await chromium.launch();
  const rows = [];
  for (const t of THEMES) {
    const page = await browser.newPage({ viewport: { width: 1214, height: 620 }, deviceScaleFactor: 2 });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('file://' + repo + '/' + t.dir + '/level1.html');
    await page.click('#playBtn');
    await page.waitForTimeout(350);

    // T1 wrong match: numeral 1 to the first group (3 objects)
    await page.click('#numCol [data-n="1"]');
    await page.click('#basketCol [data-i="0"]');
    await page.waitForTimeout(300);
    let s = await state(page);
    const t1 = s.big === 'Not yet!' && s.small === 'Count again. That group has 3.' && s.stars === '0';
    rows.push([t.dir, 'T1 wrong match', `${s.big} ${s.small} (stars ${s.stars})`, t1 ? 'Pass' : 'Fail']);
    await page.screenshot({ path: `${outDir}/${t.dir}_T1_wrong.png` });

    // T2 correct match: numeral 3 to the first group
    await page.click('#numCol [data-n="3"]');
    await page.click('#basketCol [data-i="0"]');
    await page.waitForTimeout(300);
    s = await state(page);
    const want = `That is 3 ${t.name}. 3 to go.`;
    const t2 = s.big === '🎉 Yes!' && s.small === want && s.stars === '1';
    rows.push([t.dir, 'T2 correct match', `${s.big} ${s.small} (stars ${s.stars})`, t2 ? 'Pass' : 'Fail']);
    await page.screenshot({ path: `${outDir}/${t.dir}_T2_correct.png` });

    // T4 the match line is visible (line layer must cover the whole stage)
    if (process.env.WITH_T4) {
      const ln = await page.evaluate(() => {
        const r = document.getElementById('lines').getBoundingClientRect();
        const s = document.getElementById('stage').getBoundingClientRect();
        return { w: Math.round(r.width), h: Math.round(r.height), sw: Math.round(s.width), lines: document.querySelectorAll('#lines line').length };
      });
      const t4 = ln.lines === 1 && ln.w === ln.sw;
      rows.push([t.dir, 'T4 match line visible', `line layer ${ln.w}x${ln.h} px on a ${ln.sw} px stage, ${ln.lines} line drawn`, t4 ? 'Pass' : 'Fail']);
    }

    // T3 group before number
    await page.click('#resetBtn');
    await page.click('#basketCol [data-i="1"]');
    await page.waitForTimeout(300);
    s = await state(page);
    const t3 = s.big === 'Pick a number first' && s.small === 'Tap a number, then tap a group.';
    rows.push([t.dir, 'T3 group first', `${s.big} ${s.small}`, t3 ? 'Pass' : 'Fail']);
    await page.screenshot({ path: `${outDir}/${t.dir}_T3_groupfirst.png` });

    if (errors.length) rows.push([t.dir, 'JS errors', errors.join(' | '), 'Fail']);
    await page.close();
  }
  await browser.close();
  fs.writeFileSync(`${outDir}/results.json`, JSON.stringify(rows, null, 1));
  for (const r of rows) console.log(r.join(' | '));
  const fails = rows.filter((r) => r[3] !== 'Pass').length;
  console.log(fails ? `${fails} FAILED` : `ALL ${rows.length} PASS`);
  process.exit(fails ? 1 : 0);
})();
