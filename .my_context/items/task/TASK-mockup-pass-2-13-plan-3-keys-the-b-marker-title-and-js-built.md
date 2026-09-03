---
id: TASK-mockup-pass-2-13-plan-3-keys-the-b-marker-title-and-js-built
type: task
title: "mockup pass 2: 13 plan-3 keys, the {b:} marker, title and JS-built keys, port.sub, naming"
status: active
severity: soft
always: false
summary: One editing pass over the design file covering several wording decisions at once, because separate editors of the same table would collide.
summary_of: 54375f2e82169d75
acknowledged:
  - body_disagrees_with_meta@d5d2beacba252118
scope: []
tags:
  - "plan:rulings"
  - "seq:14"
  - "state:done"
  - v2
  - ui
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-20
valid_until: null
checksum: 5836e9932057aea5
plan: rulings
seq: "14"
state: done
progress: "100"
priority: "1"
source: "reports/V2-HANDOVER.md#twelve-owner-rulings"
last_change: "2026-08-20T18:05:55Z"
---

# mockup pass 2: 13 plan-3 keys, the {b:} marker, title and JS-built keys, port.sub, naming

ONE pass over docs/design/web-ui-mockup.html, because these rulings all edit the same string table and concurrent editors collide. Rulings A3, C4, C5, C8 — and C3 as AMENDED.

A3 — the mockup gains the 13 keys plan 3 already declares: strip.ctx.known/notYetKnown/unknown/noBridge/cold, strip.myctx/myctxPartial/myctxUnavailable, ask.sqlCaption, ask.predefined x5. Real Hebrew for each. (One agent counted 14, including ask.predefined itself — check.)

C3 AMENDED BY THE OWNER, 2026-08-20 — the fourth {b:} marker is DROPPED. C3 rested on a premise that turned out to be false: I claimed a plain {name} hands direction-unknown text the paragraph direction. It does not. The mockup already renders every value slot as <span class="v"> with .v{unicode-bidi:isolate}, so plain slots are ALREADY isolated and {b:} would have duplicated {v:}. INSTEAD: fix the grammar comment, which says {name} builds "a TEXT NODE" while the mockup own slotNode() builds an isolated span. The comment is the wrong half.

C4 — key the three unkeyed classes: the 11th aria-label (Tier budget in tokens), the title attributes via a new data-t-title mirroring data-t-aria (#empty, #theme, #ctx, #gitstate), and the JS-built text (chart() SVG labels, paintProv(), CTX[], renderGlob, renderAudit) which translates by inline ternary today and is therefore INVISIBLE to the parity test.

C5 — delete the dead FIRST port.sub entry from the Hebrew table and the stray blank lines after it. The later value renders and is what both tables carry.

C8 — settle the key naming convention and record it in the mockup so the next batch does not add a third.

The parity test must see data-t-title, exactly as it had to be widened for data-t-aria. That regex has been a blind spot once already.
