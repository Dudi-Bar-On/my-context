---
id: TASK-the-reconciliation-note-and-the-mockup-disagree-about-the
type: task
title: the reconciliation note and the mockup disagree about the normal-edge token
status: active
severity: soft
always: false
summary: A note and the design name different colours for the same line; the design wins unless somebody rules otherwise.
summary_of: 812bf47573f2ab25
scope: []
tags:
  - "plan:ui1"
  - "seq:18e"
  - "state:done"
  - v2
  - ui
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-22
valid_until: null
checksum: 23e94a62c904fe89
plan: ui1
seq: 18e
state: done
priority: "2"
---

# the reconciliation note and the mockup disagree about the normal-edge token

Found by repaint task 7 while looking for two hex literals that turned out not to exist.

The ui1 task 18 reconciliation note says the relations ego graph's hardcoded colours - #a01a1a for a dangling edge, #888 for a normal one - become CSS classes backed by --pane-edge and --crit. Neither literal is anywhere in the mockup: renderEgo() already uses .edge, .edge.bearing, .edge.ref and .edge.dangling, and .edge.dangling already resolves to --crit.

The note was about src/ui/public/screens/graph.js, a ui1 task 18 file that does not exist yet - src/ui/public/screens/ is not there at all. So there was nothing to fix in the mockup, and the note is an instruction for a future implementer rather than a description of a defect.

The disagreement to settle: the note says the normal-edge stroke should use --pane-edge; the mockup's own .edge rule uses --edge-3. The mockup is the design of record, so --edge-3 wins unless someone rules otherwise - but a ui1 implementer following the note would write the other one.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: DONE -- settled by fact, in favour of the mockup, exactly as this task predicted it should be.

The task recorded a disagreement between the ui1 task 18 reconciliation NOTE (--pane-edge for a normal edge) and the mockup s own rule (--edge-3), and observed that src/ui/public/screens/ did not exist yet so there was nothing to fix.

IT EXISTS NOW, and it settled itself:
  src/ui/public/screens/graph.js draws .edge, .edge.bearing, .edge.ref and .edge.dangling -- the mockup s four classes, no hex literals
  styles.css carries `svg.chart .edge{fill:none;stroke:var(--edge-3)}`
  --pane-edge was never written into an edge stroke anywhere
Neither hex literal (#a01a1a, #888) is in either file. styles-parity and tree-parity are both green over graph.

WHAT SURVIVES IS A STALE SENTENCE IN A PLAN DOCUMENT -- the ui1 task 18 reconciliation note still instructs a future implementer to use --pane-edge, and there is no longer a future implementer. That correction is recorded in the reconciliation s plan-document ledger rather than left as an open task, because the code has already made the choice and a second reader following the note would be writing against a green gate.
