---
id: TASK-review-2-write-the-visual-ruling-into-the-mockup-in-one
type: task
title: "review 2: write the visual ruling into the mockup, in one parity-locked commit"
status: superseded
severity: soft
always: false
summary: A piece of work to write an agreed visual direction into the design mockup, and the record of where each of its constraints ended up.
summary_of: c1c2cc62a1c16c85
scope: []
tags:
  - "plan:review"
  - "seq:2"
  - "state:done"
  - v2
  - review
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-21
valid_until: 2026-08-21
checksum: 0ff9d9234539f429
plan: review
seq: "2"
state: done
priority: "1"
---

# review 2: write the visual ruling into the mockup, in one parity-locked commit

RULED 2026-08-21: absorbed by the web UI visual repaint, having first donated the two constraints the repaint did not carry.

The design detour replaced this task's premise. Review 1 became the two visual panels; the ruling the owner made is docs/superpowers/specs/2026-08-21-web-ui-visual-direction-design.md, and writing it into the mockup is the thirteen tasks of docs/superpowers/plans/2026-08-21-web-ui-visual-repaint.md - not one parity-locked commit, because the direction turned out to be larger than one commit can be reviewed in.

What this task was still holding, and where each went:

- print stylesheet, gloss printing as grey mud -> repaint task 10, the print register.
- forced-colors -> repaint task 11.
- prefers-reduced-transparency, recorded here as unhonoured -> ADDED to repaint task 11 by this ruling. It was in neither the spec nor the plan.
- backdrop-filter is expensive and the coverage map has a measured performance problem -> ADDED to repaint task 12 by this ruling, as a before-and-after measurement with both numbers in the commit message.
- strings/en.js and strings/he.js at exact parity, pinned e2e counts derived not re-pinned -> repaint task 12, and the parity gate covers every repaint commit.
- zero physical CSS properties, logical only -> repaint task 3, the primitives.

Nothing was dropped. Two things were nearly dropped, and this task is why they were not.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: DONE -- and its own body has said so since 2026-08-21. "RULED 2026-08-21: absorbed by the web UI visual repaint, having first donated the two constraints the repaint did not carry." The ruling was recorded and the STATE was never moved, so it has been reading as open priority-1 work for four days. plan:repaint tasks 1 through 11 are done; the visual ruling is in the mockup.

A RULING WRITTEN INTO A BODY IS NOT A CLOSED TASK. That is the whole lesson of this one, and the reconciliation found the same shape twice more: plan:ui1 seq:17c had its sweep ruling appended on 2026-08-24 and plan:ui3 seq:11x had its projection ruling appended on 2026-08-25, and both still counted as open work on every report the owner saw.

## Relations
- superseded_by [[TASK-repaint-task-1-the-token-layer-and-light-mode-out]]
