// Speaker test: checks the speaker button reads the prompt aloud, and stays silent when muted.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const repo = path.resolve(process.argv[2]);
const out = path.resolve(__dirname, 'results', process.argv[3] || 'speech');
fs.mkdirSync(out, { recursive: true });
const THEMES = [['fruit-orchard', 'Count the fruits!'], ['under-the-sea', 'Count the animals!'], ['toy-box', 'Count the toys!']];
(async () => {
  const browser = await chromium.launch();
  const rows = [];
  for (const [dir, prompt] of THEMES) {
    const page = await browser.newPage({ viewport: { width: 1214, height: 620 }, deviceScaleFactor: 2 });
    // record what the game asks the browser voice to say
    await page.addInitScript(() => {
      window.__spoken = [];
      window.SpeechSynthesisUtterance = function (t) { this.text = t; };
      Object.defineProperty(window, 'speechSynthesis', { value: { speak: (u) => window.__spoken.push(u.text), cancel: () => {} } });
    });
    await page.goto('file://' + repo + '/' + dir + '/level1.html');
    await page.click('#playBtn');
    await page.click('#speakerBtn');
    await page.waitForTimeout(250);
    let spoken = await page.evaluate(() => window.__spoken.slice());
    const want = prompt + ' Draw a line to the matching group.';
    rows.push([dir, 'S1 speaker reads prompt', JSON.stringify(spoken), spoken[0] === want ? 'Pass' : 'Fail']);
    await page.screenshot({ path: `${out}/${dir}_S1_speaker.png` });
    await page.click('#muteBtn');
    await page.click('#speakerBtn');
    spoken = await page.evaluate(() => window.__spoken.slice());
    rows.push([dir, 'S2 muted stays silent', `${spoken.length} utterance(s)`, spoken.length === 1 ? 'Pass' : 'Fail']);
    await page.close();
  }
  await browser.close();
  rows.forEach((r) => console.log(r.join(' | ')));
  const f = rows.filter((r) => r[3] !== 'Pass').length;
  console.log(f ? f + ' FAILED' : 'ALL ' + rows.length + ' PASS');
  fs.writeFileSync(out + '/results.json', JSON.stringify(rows, null, 1));
  process.exit(f ? 1 : 0);
})();
