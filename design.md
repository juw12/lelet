# Lelet design rules

One idea: **a receipt for what you were sold and what you got.** Paper, ink, one red stamp.

## Tokens (see `styles.css`)

| Token | Light | Dark | Use |
|---|---|---|---|
| `--paper` | `#f4efe6` | `#161513` | page background |
| `--surface` | `#fbf8f2` | `#211f1c` | cards |
| `--receipt` | `#fffdf8` | `#262420` | the receipt and the letter |
| `--ink` | `#1b1a17` | `#efe9dd` | text |
| `--ink-2` | `#5a554c` | `#aaa294` | secondary text |
| `--rule` | `#d8cfbf` | `#3a362f` | lines and borders |
| `--accent` | `#d9381e` | `#e8492c` | the one primary button, the stamp, "below plan" |
| `--ok` | `#1f7a3d` | `#6cc98a` | only for "matches plan" data |

## Type

- Headings: system serif stack (Iowan Old Style, Palatino, Georgia).
- Body: system sans. Numbers, the receipt and the letter: system monospace.
- No web fonts. Nothing is downloaded except the app's own files.

## Rules

1. One primary (red) button per screen. Everything else is a quiet outline button or a link.
2. The start button is visible without scrolling on a 390 x 844 phone.
3. Numbers come with their unit and what they are compared against. Never a bare percentage.
4. Estimates say "perkiraan" / "estimate". Sample data carries a "CONTOH" / "SAMPLE" mark everywhere it shows.
5. No icons made of emoji. No gradients. No decoration that does not carry information.
6. Indonesian first, English complete. Both fit at 360 px wide with no sideways scroll.
7. Focus rings are visible (3 px accent outline). Buttons, tabs and form fields are at least 44 px tall.
8. Motion is limited to the meter while a test runs, and is switched off under `prefers-reduced-motion`.

## Checked by

`tests/e2e.py` checks rules 2 and 6 (no sideways scroll on all four screens at phone width) and takes the
screenshots used for review. The anti-slop gate is `slop_check.py` from the hone skill: 0 blockers, 0 warnings.
