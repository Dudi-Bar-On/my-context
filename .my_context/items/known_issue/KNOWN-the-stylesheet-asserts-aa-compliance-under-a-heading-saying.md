---
id: KNOWN-the-stylesheet-asserts-aa-compliance-under-a-heading-saying
type: known_issue
title: the stylesheet asserts AA compliance under a heading saying the figures were re-measured, and one of them fails AA
status: active
severity: soft
always: false
summary: A comment claims contrast figures for the shipped colours; they are the retired colours’ figures, and one of the true values does not clear AA.
summary_of: 4a0f46d038597e33
scope:
  - src/ui/public/styles.css
tags:
  - v2
  - silent-failure
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-17
valid_until: null
checksum: ef7fd510696ebb87
---

# the stylesheet asserts AA compliance under a heading saying the figures were re-measured, and one of them fails AA

FOUND BY THE `docs/system/` VERIFICATION ON 2026-09-17 AND **RE-COMPUTED INDEPENDENTLY BY THE MAIN
SESSION**, from `styles.css`’s own token values, before filing.

`styles.css:1319–1320` carries eight contrast figures for the level tokens, under a heading stating
they were re-measured *"not carried across"*. **ALL EIGHT ARE THE RETIRED PALETTE’S RATIOS WEARING
THE SHIPPED TOKENS’ NAMES.** The true values, computed from `styles.css:187–189`:

    token             --paper #0f0f12   --panel #17171c   --panel-2 #1d1d24
    --ok  #22c55e            8.40              7.84              7.35
    --gold #eab308           9.98              9.31              8.74
    --warn #f97316           6.83              6.37              5.98
    --crit #ef4444           5.09              4.75          *** 4.45 ***

**`--crit` IS CLAIMED AT 7.00 AND 6.57. IT IS 4.75 AND 4.45, AND 4.45 DOES NOT CLEAR AA FOR NORMAL
TEXT (4.50).** It misses by 0.05.

── WHAT MAKES THIS WORSE THAN A STALE NUMBER ───────────────────

The comment does not merely state figures — **IT ASSERTS THEY WERE RE-MEASURED RATHER THAN CARRIED
ACROSS.** So the one signal a reader has that a number is trustworthy is present and false. A stale
figure invites checking; a figure labelled "re-measured" forbids it.

This is the SAME SWAP the documentation carried — shipped hexes paired with the ratios of the
colours `styles.css:101–110` records as replaced (`#7cc0a0`/`#e8c368`/`#c78f3d`/`#e08b8b`). The
documents were repaired on 2026-09-17 (`5ffc5e6a`); **the stylesheet the documents were describing
was not**, so the corrected chapters and the source now disagree.

── WHAT IS NOT WRONG, AND IT MATTERS FOR THE FIX ────────────────

The same comment block records that **the level is carried three ways** — the ink, the ICON
(⚠️ 🔶 💀 with its `aria-label`) and the WORD in the chip beside it — *"the reason this is safe under
`forced-colors`, in print, and for a dichromat, where a background often vanishes and ink can be
overridden."* **THAT REASONING IS SOUND AND SURVIVES THIS FINDING.** Colour is not the sole
carrier, so a 4.45 does not make the level unreadable.

SO THE DEFECT IS THE CLAIM, NOT NECESSARILY THE COLOUR. Two honest fixes exist and they are not the
same: **correct the figures and say plainly that `--crit` on `--panel-2` is 4.45 and why that is
acceptable given the three carriers**, or **move `--crit` until it clears 4.50 on every ground it
is drawn on**. The first is one comment; the second changes a shipped hue and `--crit` has the
least headroom of the five. RECOMMEND, and let the owner rule — `DEC-the-meaning-hue-budget-is-five`
makes a hue change his decision, not a lane’s.

── AND FIND THE OTHERS ────────────────────────────────

This block was found because a document described it. **NOTHING SWEEPS THE STYLESHEET FOR CONTRAST
CLAIMS**, and the palette has been replaced at least once. Every hard-coded ratio in `styles.css`
should be recomputed from the tokens as they stand, and every one that is stated should say which
GROUND it is against — several state a number with no ground, which cannot be checked at all.

A CHECK IS CHEAP AND WOULD NOT GO STALE: the ratios are pure arithmetic over values already in the
file. Recommend whether one belongs beside `check:vendor` and the rest; do not build it here.
