---
id: DEC-claude-drafts-the-mockup-and-the-owner-approves-the-1-1-rule
type: decision
title: "Claude drafts the mockup and the owner approves; the 1:1 rule is untouched"
status: active
severity: soft
always: false
summary: The assistant may prepare changes to the design document and show them rendered, but the owner still approves each one and still says when it is finished.
summary_of: 82cb18ffe43e8833
scope: []
tags:
  - v2
  - ui
  - owner-ruling
  - mockup
  - process
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-25
valid_until: null
checksum: fe7e138bb9a7ab3f
---

# Claude drafts the mockup and the owner approves; the 1:1 rule is untouched

OWNER RULING 2026-08-25, taken because sixteen items across five plans had converged on one file and none of them could move.

WHAT CHANGES: WHO HOLDS THE PEN, AND NOTHING ELSE. Claude prepares the edit to `docs/design/web-ui-mockup.html` and shows it; the owner approves or rejects each change. `RULE-1-1-with-the-mockup-and-the-owner-says-when-it-is-done` is NOT softened -- the mockup is still the design of record, the app still matches it 1:1, and the owner still says when it is done. He stops being the typist and stays the decider.

WHY IT WAS THE BOTTLENECK: the mockup gates about a third of the open board. `strings-parity` compares key sets in BOTH directions and `styles-parity` carries CSS blocks byte-identically, so ANY new sentence or style rule in the app requires a mockup edit FIRST. That is why sixteen unrelated tasks -- a builder pattern, a config composer, Hebrew emphasis, nine unnameable facts, six palette keys, a false sentence about similarity -- all wait on one person opening one file.

HOW A CHANGE IS PRESENTED, and this is the part that keeps approval meaningful:
  ONE PARITY-LOCKED PATCH per change -- the mockup, BOTH string tables and `styles.css` together, because the gates compare all of them in both directions and a half-landed change is a red suite rather than a partial feature.
  RENDERED BEFORE AND AFTER, not a diff of markup. The owner has said plainly that raw HTML is "almos impossible to work on" as a human, and the tree-parity inventory exists because of it. A change presented as markup is a change presented in the form he already rejected.
  WHAT IT UNBLOCKS, named per change, so the cost of rejecting one is visible.

WHAT CLAUDE STILL MAY NOT DECIDE: where stress falls in Hebrew (plan:walk seq:1h -- placing it by pattern-matching is guessing), and any change that alters what a screen MEANS rather than what it says. Those are drafted as options, never as a chosen answer.
