---
id: TASK-a-refused-step-at-the-end-of-a-find-walk-replaces-the
type: task
title: a refused step at the end of a find walk replaces the landing sentence without measuring the match again
status: active
severity: soft
always: false
summary: When a reader steps past the last match and the page says so, the new sentence can be taller than the old one and push the current match out of view, and the page does not check.
summary_of: c03e13035cc6ad3a
scope: []
tags:
  - "plan:release"
  - "seq:38"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-29
valid_until: null
checksum: 14ada233139ec6af
plan: release
seq: "38"
state: todo
---

# a refused step at the end of a find walk replaces the landing sentence without measuring the match again

Found by the phase-4 browser round 5 on 2026-09-29 and confirmed by its reviewer (commit 4eaf7d26 fixed the sibling defect: step() now draws the 'match N of M' sentence before it scrolls, because the sentence above the fixed-bottom pane pushes the contents down). The REFUSED branch of step() in src/ui/public/screens/conversations.js (around lines 8836-8845, target === -1: 'that was the last match') calls sayNav and returns without landOn or a re-scroll, so a replacement sentence that wraps taller than the one it replaces can push the current match under the line beneath the pane, unmeasured. The lane did not scroll there on purpose - a reader who scrolled away would be dragged back - and that trade-off is real; the answer is not to scroll but to measure: if the current match is still meant to be on screen (the reader has not scrolled since the last step), re-reveal it; if they have, say nothing and move nothing. Closing condition: the refused branch measures whether the current match is still visible after the sentence lands and re-reveals it only when the reader's scroll position is the one the walk left, a spec section beside 18b plants a taller refused sentence in both languages and asserts the match is visible when the reader did not scroll and untouched when they did, and no pixel constant is added. Files: src/ui/public/screens/conversations.js, e2e/conversations-find-panel.spec.ts. Release phase 6 (UI).
