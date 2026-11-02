# Tests

Automated checks for the matching game, written with Playwright. Run them from the repository folder.

```
npm install playwright
npx playwright install chromium
WITH_T4=1 node tests/regress.js . level1
node tests/speech_test.js . speaker
node tests/levels_test.js . 2 level2
node tests/levels_test.js . 3 level3
node tests/nav_test.js . navigation
node tests/hitall.js . tap-targets
```

| File | What it checks |
|---|---|
| `regress.js` | Level 1 regression: wrong match, correct match, group before number, match line visible |
| `speech_test.js` | The speaker button reads the prompt aloud and stays silent when muted |
| `levels_test.js` | Level 2 or Level 3: cards shown, card before number, wrong match, correct match, hint, level complete |
| `nav_test.js` | Menu links to all nine pages, Next level from Level 1 to 3, All levels button |
| `hitall.js` | Every number and card can be tapped on all nine pages |

Each run prints Pass or Fail per test and saves screenshots in `tests/results/`.
