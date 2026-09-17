---
id: TASK-the-contrast-figures-are-the-retired-palette-s-and-the-owner
type: task
title: the contrast figures are the retired palette’s, and the owner ruled the claim moves rather than the hue
status: active
severity: soft
always: false
summary: Correct the eight contrast figures in styles.css and state plainly that --crit is 4.45 on --panel-2 and why three carriers make that acceptable.
summary_of: 456539313edfd00a
scope:
  - src/ui/public/styles.css
  - docs/system/03-the-palette-and-the-drawn-language.md
tags:
  - v2
  - "plan:rulings"
  - "seq:112"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-17
valid_until: null
checksum: 9f01f1ca8d0ca809
plan: rulings
seq: "112"
state: todo
priority: "1"
---

# the contrast figures are the retired palette’s, and the owner ruled the claim moves rather than the hue

OWNER RULING, 2026-09-17, choosing between correcting the claim and moving the hue:
**"Correct the claim, keep the hue."**

The defect is `KNOWN-the-stylesheet-asserts-aa-compliance-under-a-heading-saying`. Read it first.

── WHAT IS TRUE, COMPUTED THREE TIMES INDEPENDENTLY ──────────────

From `styles.css:187–189`’s own token values — by the `docs/system` verification, by the main
session, and again by the final check, which recomputed all 21 ratios from the hexes BEFORE
reading any table:

    token             --paper #0f0f12   --panel #17171c   --panel-2 #1d1d24
    --ok  #22c55e            8.40              7.84              7.35
    --gold #eab308           9.98              9.31              8.74
    --warn #f97316           6.83              6.37              5.98
    --crit #ef4444           5.09              4.75          *** 4.45 ***

`--crit` is claimed at 7.00 and 6.57. **AA for normal text is 4.50, so 4.45 misses by 0.05.**

── WHAT THE CORRECTION MUST SAY, AND THIS IS THE WHOLE TASK ────────

**DO NOT QUIETLY SWAP THE DIGITS.** The comment’s heading says the figures were re-measured *"not
carried across"* — so the one signal a reader has that a number is trustworthy is present and
false. Replacing eight numbers under the same heading repeats the defect with better arithmetic.

STATE THE 4.45 PLAINLY, NAME THE GROUND, AND GIVE THE REASON IT IS ACCEPTABLE — which the same
comment block already argues and which survives the finding intact: **the level is carried three
ways.** The ink is one carrier; the ICON (⚠️ 🔶 💀, with its `aria-label`) and the WORD in the chip
beside it are the other two. That is `06-a11y.html`’s rule and the reason this is safe under
`forced-colors`, in print, and for a dichromat, where a background often vanishes and ink can be
overridden. A reader meeting 4.45 deserves that argument next to it, not a number they must
either trust or go and check.

**EVERY FIGURE NAMES ITS GROUND.** Several ratios in this stylesheet state a number with no ground
at all, which cannot be checked by anyone. A figure without a ground is not a weaker claim, it is
an uncheckable one.

── AND KEEP THE DOCUMENT AND THE SOURCE IN STEP ────────────────

`docs/system/03-the-palette-and-the-drawn-language.md` §4 was repaired on 2026-09-17 with the TRUE
ratios, so the corrected chapter and the uncorrected stylesheet currently disagree. Fixing the
source closes that. `03` §6 also says the defect was *"filed nowhere else"* — already amended to
name the `KNOWN` item; check it still reads true when you are done.

THE OWNER DECLINED THE WIDER SWEEP of every hard-coded ratio in the stylesheet. Do not do it here.
If you find others while working, NAME THEM and leave them.
