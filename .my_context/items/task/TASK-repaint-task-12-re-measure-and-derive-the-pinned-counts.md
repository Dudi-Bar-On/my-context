---
id: TASK-repaint-task-12-re-measure-and-derive-the-pinned-counts
type: task
title: "repaint task 12: re-measure, and derive the pinned counts"
status: active
severity: soft
always: false
summary: Re-check the visual results from what is actually drawn on screen, and work the expected numbers out rather than writing them down.
summary_of: 71085c6b9b57caf2
scope: []
tags:
  - "plan:repaint"
  - "seq:12"
  - "state:todo"
  - v2
  - ui
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-21
valid_until: null
checksum: d76b637167f9df7e
plan: repaint
seq: "12"
state: todo
priority: "1"
source: "my-context/docs/superpowers/plans/2026-08-21-web-ui-visual-repaint.md#task-12"
---

# repaint task 12: re-measure, and derive the pinned counts

Sample from rendered pixels, not getComputedStyle strings — a previous harness produced 645 fake failures parsing light-dark() through a canvas. The three pinned e2e counts are DERIVED, never re-pinned.

Task 12 of the web UI visual repaint. The full specification is the task section itself: my-context/docs/superpowers/plans/2026-08-21-web-ui-visual-repaint.md at line 762 — that file is the authority, and this item tracks state only.

The direction it implements is my-context/docs/superpowers/specs/2026-08-21-web-ui-visual-direction-design.md, approved section by section by the owner on 2026-08-21.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: STANDS. It is one of the 110 items whose body says "this item tracks state only" and hands the specification to a plan document -- the condition REQ-every-screen-has-a-task-that-implements-it-until-the-mockup s third clause exists to end, and the reason this reconciliation was widened.

ITS CITATION WAS STALE BY 307 LINES and is corrected above. It is how the whole class was found: it cited line 455 of the repaint plan, which is Task 7; Task 12 is at line 762. 104 of 109 such citations were wrong, by up to 1,426 lines. All 104 are corrected now, and the finding is filed as its own note and task.

THE WORK ITSELF IS UNCHANGED AND IS STILL RIGHT: sample from rendered PIXELS, not getComputedStyle strings -- a previous harness produced 645 fake failures parsing light-dark() through a canvas -- and the three pinned e2e counts are DERIVED, never re-pinned. `test/ui/strings-parity.test.ts` · `The count is DERIVED, never pinned` · ~64 already does exactly that for its own count and records the principle in its header: "The count is DERIVED, never pinned: it was 326 at the plan s third pass, 329 on...". That is the pattern to copy.
