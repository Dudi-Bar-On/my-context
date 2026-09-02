---
id: TASK-the-hit-testing-defect-needs-preserve-3d-not-just-a-negative
type: task
title: the hit-testing defect needs preserve-3d, not just a negative translateZ
status: active
severity: soft
always: false
summary: A narrower account of the bug that made clicks land on the wrong thing, so nobody chases a version of it that cannot happen.
summary_of: 745e40b4ca8bd454
scope: []
tags:
  - "plan:repaint"
  - "seq:3h"
  - "state:done"
  - v2
  - ui
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-21
valid_until: null
checksum: 9a4e543b14dac8ce
plan: repaint
seq: 3h
state: done
priority: "2"
---

# the hit-testing defect needs preserve-3d, not just a negative translateZ

Recorded because the hazard as written is broader than the truth, and a narrower rule is easier to follow correctly.

The original defect: a translateZ(-14px) pushed panes behind their parent's plane and elementFromPoint returned the container, so every click on a row was swallowed. Three wrong diagnoses were spent finding it.

Reproduced deliberately in a real Chromium page by the primitives agent, in an isolated fixture: translateZ(-14px) ALONE does not reproduce the swallow. It needs transform-style: preserve-3d in the chain before the parent actually occludes the child for hit-testing.

The fix stays the same - perspective on the container, no negative Z - and .pair/.plane ship with rotateY only and zero translateZ anywhere. But tasks 6 and 9 should know the trigger is the pair, not the Z alone, so they do not chase a phantom or trust a fixture that cannot reproduce it.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: DONE. A carrier task, delivered.

It existed to stop repaint tasks 6 and 9 chasing a phantom or trusting a fixture that cannot reproduce the swallow. BOTH ARE DONE, and the guidance held: styles.css carries .pair{perspective:...} for the 3D context and there is NO translateZ declaration anywhere in the stylesheet -- the only occurrences of the word are in comments explaining why it is absent.

THE KNOWLEDGE IN IT IS WORTH MORE THAN THE TASK and should not be lost by closing it: translateZ(-14px) ALONE does not reproduce the hit-testing swallow. It needs transform-style: preserve-3d in the chain. Three wrong diagnoses were spent finding that the first time. It is recorded in the stylesheet s own comments, which is where the next person will actually be standing.
