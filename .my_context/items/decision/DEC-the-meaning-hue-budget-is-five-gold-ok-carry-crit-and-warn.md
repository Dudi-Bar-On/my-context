---
id: DEC-the-meaning-hue-budget-is-five-gold-ok-carry-crit-and-warn
type: decision
title: "the meaning-hue budget is FIVE: gold, ok, carry, crit and warn"
status: active
severity: soft
always: false
summary: "\"There are five colours that carry meaning, not four: a middle caution step is genuinely needed and already in use, so the approved list is corrected.\""
summary_of: 236df0e8d1f05d68
summary_was:
  - "2026-09-03 There are five colours that carry meaning, not four: a middle caution step is genuinely needed and already in use, so the approved list is corrected."
acknowledged:
  - body_disagrees_with_meta@90c5045483a83ea0
scope: []
tags:
  - v2
  - ui
  - owner-ruling
  - design
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-25
valid_until: null
checksum: 8d8456f3a3aaad30
---

# the meaning-hue budget is FIVE: gold, ok, carry, crit and warn

OWNER RULING 2026-08-25, ratifying what shipped and correcting the record.

THE APPROVED VISUAL DIRECTION OF 2026-08-21 BUDGETS FOUR meaning-hues -- gold, ok, carry, crit. `plan:repaint seq:13a` was filed on the belief that `--warn` had been RETIRED and asked how three meanings could fit in four hues.

THAT TASK'S PREMISE WAS FALSE, found 2026-08-25 by the reconciliation. `styles.css` · `--gold:#e8c368; --ok:#7cc0a0; --carry:#8b9ce6; --crit:#e08b8b; --warn:#c78f3d;` · ~89 declares all five on one line -- `--gold:#e8c368; --ok:#7cc0a0; --carry:#8b9ce6; --crit:#e08b8b; --warn:#c78f3d;` -- and eight places use `var(--warn)`: `decay.js` (the window rule, its label and the cold row), `graph.js`, `port.js`, `watch.js` (the `access` pulse hue), `work.js` (the RTL stale marker), and `styles.css` itself (`.prov b` and `--warnbg`).

THE RULING: THE BUDGET IS FIVE. `--warn` is legitimate and stays.

WHY, and it is not merely ratifying an accident. Three of this product s most-used surfaces need a third warning-ish step that is neither "fine" nor "critical": doctor s three levels are error / WARNING / notice and they are the CLI s own vocabulary, not a design invention; the watch pulse must separate `access` (a refusal) from `mutation` (a change) from everything ordinary; and decay s window boundary is a caution, not a failure. Four hues forces two of those to double up, and the reconciliation found the pulse had already reached for the fifth on its own.

WHAT MUST FOLLOW, so this does not become a licence: the approved direction document is CORRECTED to say five, with this reason. A budget nobody updated is how the code came to disagree with the direction silently in the first place, and there is no gate comparing the declared token set against the budget -- which is why five hues shipped without anyone ruling on the fifth.

ITEMS 2 AND 3 OF `plan:repaint seq:13a` DISSOLVE with this: doctor s levels keep crit and warn rather than crit and gold, and Configure s hard-stop and advisory split `.chip.crit` / `.chip.warn`. ITEM 1 IS ALREADY DECIDED by the build -- `watch.js` · `const KIND_HUE = {` · ~164 maps four kinds to four hues plus `--faint` for a kind the build cannot name, and that unknown-hue affordance is an honesty the design never asked for and should keep.
AMENDED 2026-08-27 BY THE OWNER, ratifying colour-by-source on the seven-group strip and correcting what a hue promises.

WHAT STANDS: THE BUDGET IS FIVE. `--gold`, `--ok`, `--carry`, `--crit`, `--warn`, and no sixth meaning-hue. Every reason above is untouched -- doctor s three levels, the watch pulse s four kinds and decay s window boundary all still need the fifth step, and nothing here licenses a sixth.

WHAT CHANGED: A HUE NO LONGER IDENTIFIES A GROUP ON ITS OWN. The strip grew from four groups to seven, and the lane that built it made colour group by SOURCE, with each group s WORD telling the groups apart. That is a real loosening of what a hue promised a reader, and the lane flagged it rather than absorbing it. The owner ratifies it.

WHY, and it is a measurement rather than a preference: gold against ok is 1.04:1 contrast. Two hues a reader cannot reliably tell apart were already being separated by the word beside them on every screen that drew both. The word was doing the work before this amendment; what changes is that the design now SAYS so, instead of claiming a distinction the eye cannot make.

WHAT MUST FOLLOW: a hue may narrow a group, never name one. A surface that drops the word and leaves the colour to carry the meaning fails this amendment even where it passed under the four-group strip, and a group added later needs a word before it needs a hue.
