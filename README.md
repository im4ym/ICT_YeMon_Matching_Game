# ICT_YeMon_Matching_Game

A number matching game for children aged 4 to 6. The child draws a line from each number to the card that matches it.

**Developer:** Ye Mon Aung

**Live demo:** https://im4ym.github.io/ICT_YeMon_Matching_Game/

## Levels

| Level | What the child matches | Numbers |
|---|---|---|
| Level 1: Count | a numeral to a group of objects | 1 to 4 |
| Level 2: Words | a numeral to its number word (the word is read aloud when tapped) | 1 to 4 |
| Level 3: Dots | a numeral to a dice-style dot pattern | 3 to 6 |

## Structure

Each theme has its own folder. Each level is a separate page inside it.

| Theme | Level 1 | Level 2 | Level 3 |
|---|---|---|---|
| `fruit-orchard` | `level1.html` | `level2.html` | `level3.html` |
| `under-the-sea` | `level1.html` | `level2.html` | `level3.html` |
| `toy-box` | `level1.html` | `level2.html` | `level3.html` |

`shared/matching-engine.js` holds the game logic used by all nine pages. Each page only sets its own `MATCH_CONFIG` (level, cards, numbers, prompt and colours), so a fix to the game logic is made once.

Open `index.html` to pick a theme and a level.

## Status

- **ICT1 Alpha:** Level 1 completed for all three themes
- **ICT2 Sprint 1:** shared engine refactor, read-aloud speaker, Level 2 number words
- **ICT2 Sprint 2:** Level 3 dot patterns, level navigation, defect fixes (match lines, hidden buttons)
