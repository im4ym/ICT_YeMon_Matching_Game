// Level 2 and Level 3 acceptance tests on all three themes, with screenshots.
// usage: node tests/levels_test.js . <2|3> <label>
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const repo = path.resolve(process.argv[2]);
const level = +process.argv[3];
const out = path.resolve(__dirname, 'results', process.argv[4] || 'level' + level);
fs.mkdirSync(out, { recursive: true });
const THEMES = ['fruit-orchard', 'under-the-sea', 'toy-box'];

const st = (page) => page.evaluate(() => ({
  big: document.getElementById('fbBig').textContent.trim(),
  small: document.getElementById('fbSmall').textContent.trim(),
  stars: document.getElementById('starTxt').textContent.replace(/\D/g, ''),
  spoken: window.__spoken.slice(),
  done: document.getElementById('doneOv').classList.contains('show'),
}));
const match = async (page, n, i) => { await page.click(`#numCol [data-n="${n}"]`); await page.click(`#basketCol [data-i="${i}"]`); await page.waitForTimeout(250); };

const PLAN = {
  2: {
    wrong: [1, 3, 'Listen again. That word is three.', 'That word is three'],
    right: [3, 3, '3 is three. 3 to go.', '3 is three'],
    first: [0, 'Tap a number, then tap a word.', 'two'],
    all: [[1, 2], [2, 0], [4, 1]],
    cards: async (page) => page.$$eval('#basketCol .word', (els) => els.map((e) => e.textContent).join(',')),
    cardsWant: 'two,four,one,three',
  },
  3: {
    wrong: [3, 0, 'Count the dots again. That card has 5.', null],
    right: [5, 0, 'That is 5 dots. 3 to go.', null],
    first: [1, 'Tap a number, then tap the dots.', null],
    all: [[3, 1], [6, 2], [4, 3]],
    cards: async (page) => page.$$eval('#basketCol .die', (els) => els.map((e) => e.querySelectorAll('.pip').length).join(',')),
    cardsWant: '5,3,6,4',
  },
}[level];

(async () => {
  const browser = await chromium.launch();
  const rows = [];
  for (const dir of THEMES) {
    const page = await browser.newPage({ viewport: { width: 1214, height: 620 }, deviceScaleFactor: 2 });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(() => {
      window.__spoken = [];
      window.SpeechSynthesisUtterance = function (t) { this.text = t; };
      Object.defineProperty(window, 'speechSynthesis', { value: { speak: (u) => window.__spoken.push(u.text), cancel: () => {} } });
    });
    await page.goto(`file://${repo}/${dir}/level${level}.html`);
    await page.screenshot({ path: `${out}/${dir}_0_start.png` });
    await page.click('#playBtn');
    await page.waitForTimeout(350);
    const id = `L${level}`;

    const cards = await PLAN.cards(page);
    rows.push([dir, `${id}-1 cards shown`, cards, cards === PLAN.cardsWant ? 'Pass' : 'Fail']);
    await page.screenshot({ path: `${out}/${dir}_1_board.png` });

    // tap a card before a number
    await page.click(`#basketCol [data-i="${PLAN.first[0]}"]`); await page.waitForTimeout(250);
    let s = await st(page);
    let ok = s.big === 'Pick a number first' && s.small === PLAN.first[1] && (!PLAN.first[2] || s.spoken.at(-1) === PLAN.first[2]);
    rows.push([dir, `${id}-2 card before number`, `${s.big}. ${s.small}${PLAN.first[2] ? ' Spoken: "' + s.spoken.at(-1) + '"' : ''}`, ok ? 'Pass' : 'Fail']);
    await page.screenshot({ path: `${out}/${dir}_2_cardfirst.png` });

    // wrong match
    await match(page, PLAN.wrong[0], PLAN.wrong[1]);
    s = await st(page);
    ok = s.big === 'Not yet!' && s.small === PLAN.wrong[2] && s.stars === '0' && (!PLAN.wrong[3] || s.spoken.at(-1) === PLAN.wrong[3]);
    rows.push([dir, `${id}-3 wrong match`, `${s.big} ${s.small} (stars ${s.stars})${PLAN.wrong[3] ? ' Spoken: "' + s.spoken.at(-1) + '"' : ''}`, ok ? 'Pass' : 'Fail']);
    await page.screenshot({ path: `${out}/${dir}_3_wrong.png` });

    // correct match
    await match(page, PLAN.right[0], PLAN.right[1]);
    s = await st(page);
    ok = s.big === '🎉 Yes!' && s.small === PLAN.right[2] && s.stars === '1' && (!PLAN.right[3] || s.spoken.at(-1) === PLAN.right[3]);
    rows.push([dir, `${id}-4 correct match`, `${s.big} ${s.small} (stars ${s.stars})${PLAN.right[3] ? ' Spoken: "' + s.spoken.at(-1) + '"' : ''}`, ok ? 'Pass' : 'Fail']);
    await page.screenshot({ path: `${out}/${dir}_4_correct.png` });

    // hint on the next number
    await page.click('#hintBtn'); await page.waitForTimeout(200);
    s = await st(page);
    rows.push([dir, `${id}-5 hint`, s.small, s.big.includes('Try this one') ? 'Pass' : 'Fail']);

    // finish the level
    for (const [n, i] of PLAN.all) await match(page, n, i);
    await page.waitForTimeout(1500);
    s = await st(page);
    rows.push([dir, `${id}-6 level complete`, `stars ${s.stars}, complete screen ${s.done ? 'shown' : 'not shown'}`, s.done && s.stars === '4' ? 'Pass' : 'Fail']);
    await page.screenshot({ path: `${out}/${dir}_5_complete.png` });
    if (errors.length) rows.push([dir, 'JS errors', errors.join(' | '), 'Fail']);
    await page.close();
  }
  await browser.close();
  rows.forEach((r) => console.log(r.join(' | ')));
  const f = rows.filter((r) => r[3] !== 'Pass').length;
  console.log(f ? f + ' FAILED' : 'ALL ' + rows.length + ' PASS');
  fs.writeFileSync(out + '/results.json', JSON.stringify(rows, null, 1));
  process.exit(f ? 1 : 0);
})();
