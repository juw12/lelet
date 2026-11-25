# Lelet design rules

One idea: **a receipt for what you were sold and what you got.** Slips of white paper on a grey counter, black ink, one red stamp.

## Tokens (see `styles.css`)

| Token | Light | Dark | Use |
|---|---|---|---|
| `--paper` | `#e3e6e2` | `#101211` | page background (the counter) |
| `--surface` | `#f6f7f4` | `#1a1d1b` | slips (cards) |
| `--receipt` | `#ffffff` | `#232725` | the receipt and the letter |
| `--ink` | `#111312` | `#eef1ee` | text, rules on top of slips, the primary button |
| `--ink-2` | `#4a4f4b` | `#a4aaa5` | secondary text |
| `--rule` | `#b9bfb9` | `#3b403c` | lines and borders |
| `--accent` | `#c9151e` | `#f0463c` | the verdict only: the stamp and "below plan" |
| `--ok` | `#17663a` | `#6cc98a` | only for "matches plan" data |

## Type

- Page titles and the verdict: heavy system sans (weight 800, tight tracking). No serif.
- Section headings: monospace, small spaced capitals, like the headings printed on a form.
- Body: system sans. Numbers, the receipt and the letter: system monospace.
- No web fonts. Nothing is downloaded except the app's own files.

## Rules

1. One primary (ink) button per screen. Everything else is a quiet outline button or a link. Red is never a button colour; it is kept for the verdict.
2. The start button is visible without scrolling on a 390 x 844 phone.
3. Numbers come with their unit and what they are compared against. Never a bare percentage.
4. Estimates say "perkiraan" / "estimate". Sample data carries a "CONTOH" / "SAMPLE" mark everywhere it shows.
5. No icons made of emoji. No gradients. No decoration that does not carry information.
6. Indonesian first, English complete. Both fit at 360 px wide with no sideways scroll.
7. Focus rings are visible (3 px accent outline). Buttons, tabs and form fields are at least 44 px tall.
8. Motion is limited to the meter while a test runs, and is switched off under `prefers-reduced-motion`.
9. A card is a slip: a 2 px ink rule on top, square corners, no outline box. Corners are 2 px at most.

## Checked by

`tests/e2e.py` checks rules 2 and 6 (no sideways scroll on all four screens at phone width) and takes the
screenshots used for review. The anti-slop gate is `slop_check.py` from the hone skill: 0 blockers, 0 warnings.
