---
id: TASK-the-well-and-welllabel-rules-were-not-carried-because
type: task
title: the well and welllabel rules were not carried because nothing emitted them, and app.js does
status: active
severity: soft
always: false
summary: Two styling rules were skipped because nothing used them; something does now, so a quoted body reads as ordinary page text.
summary_of: e9d29ada9ae852bf
acknowledged:
  - citation_form@e5d2e442aa1bdd91
scope: []
tags:
  - v2
  - ui
  - tree-parity
  - design
  - "plan:walk"
  - "seq:41"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-25
valid_until: null
checksum: e1411995de678121
plan: walk
seq: "41"
state: done
priority: "1"
source: "owner request 2026-08-25: the item detail pane, app vs mockup, real corpus"
---

# the well and welllabel rules were not carried because nothing emitted them, and app.js does

FOUND 2026-08-25 by owner request 2026-08-25: the item detail pane, app vs mockup, real corpus. A deliberate decision whose premise has since become false -- the fourth of that shape this week.

THE DECISION, recorded in `styles.css:889-892` in its own words: "NOT carried, deliberately: `.well`/`.welllabel`, and config s `.delta` and `.blast` families. NO BUILT MODULE EMITS THEM ... CSS for markup nothing renders is the same defect as a field no screen reads." That reasoning is right and the rule it produced is now wrong.

THE FACT: `app.js` EMITS BOTH. Verified in the rendered pane on the real corpus -- `div.welllabel` carrying "Body - as authored", and `div.well` wrapping `div.md#panebody`. The pane was built after the carry was measured.

WHAT THE OWNER SEES: the label renders as ordinary body text where the mockup shows small, uppercase, letter-spaced and dim; and the body sits on bare panel where the mockup shows an inset well -- `--sink` ground, a `--rule` border, a rounded corner and an inner shadow. Side by side the mockup s body reads as a QUOTATION and the app s reads as more page.

THE WORK IS TWO CSS BLOCKS, carried byte-identically from the mockup as every other block was:
    `.well{background:var(--sink);border:1px solid var(--rule);border-radius:var(--r-md);padding:var(--sp-3);box-shadow:inset 0 1px 3px rgb(0 0 0/.4)}`
    `.welllabel{font-size:var(--fs-00);letter-spacing:.07em;text-transform:uppercase;color:var(--dim);font-weight:700;margin-block-end:5px}`

AND CORRECT THE COMMENT IN THE SAME COMMIT, or the next person re-derives the same wrong conclusion. Its `.delta`/`.blast` half is ALSO stale for a different reason: it says they are "held in screen-parity s KNOWN_GAPS until `ctx.api` can POST", and `ctx.post` shipped 2026-08-23 (`app.js` · `ctx.post` · ~28) -- see plan:walk seq:10.

NO GATE CAN FIND THIS. `styles-parity` compares the BLOCKS the app carries against the mockup s; a block deliberately absent from the app is absent from the comparison. The measurement that would catch it is the one the file itself describes -- measuring over what the modules actually CONSTRUCT -- and it was taken before the pane existed. RE-RUN IT AS PART OF THIS TASK rather than fixing only the two blocks found by eye.

DONE 2026-08-25, code 5e69257. All seven gates green: typecheck, 4,572 node tests, 136 browser tests (Chromium and real Chrome), four static gates.

The two blocks are carried, byte-identical from the mockup. The body now sits in an inset well -- `--sink` ground, `--rule` border, inner shadow -- and the labels render as small dim uppercase. Verified in the browser: `.well` resolves to `rgb(16,16,20)` with a 1px border, `.welllabel` to `text-transform:uppercase` at 12px.

AND THE COMMENT THAT CAUSED IT IS CORRECTED, which matters more than the two blocks. BOTH its premises had gone stale and neither was re-checked:
  `.well`/`.welllabel` -- "no built module emits them". `app.js`'s `openPane()` emits both, and was written after the measurement.
  `.delta`/`.blast` -- "until `ctx.api` can POST". `ctx.post` shipped 2026-08-23 and has zero callers; that is `plan:walk seq:10`.

The note now says the thing worth carrying forward: a deliberate omission is a decision PLUS A PREMISE. The decision keeps; the premise expires, and nothing expires with it.
