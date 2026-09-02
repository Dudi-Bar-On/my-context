---
id: TASK-apply-the-documentation-review-s-findings-after-the-repaint
type: task
title: apply the documentation review's findings after the repaint, and re-review at the same time
status: active
severity: soft
always: false
summary: Act on an earlier documentation review once the redesign settles, and review again while doing it, since these documents keep going stale unnoticed.
summary_of: bbe7c9d609733801
scope: []
tags:
  - "plan:review"
  - "seq:6b"
  - "state:blocked"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-22
valid_until: null
checksum: b2fda79e85269271
plan: review
seq: 6b
state: blocked
priority: "1"
needs: repaint/10, repaint/11, repaint/12
---

# apply the documentation review's findings after the repaint, and re-review at the same time

The first documentation review runs 2026-08-22 as a REPORT ONLY - it changes nothing, so the owner reads the findings before anything is edited and can overrule one before it lands. Its output is reports/2026-08-22-DOCS-REVIEW.md.

This task is the second half, and the owner asked for both: apply the findings AND re-review at the same time, after the repaint finishes.

Why after: repaint 10, 11 and 12 still move the mockup, the print register and the pinned counts, so a documentation fix written today may describe something that changes tomorrow. Re-reviewing while applying is what catches the difference rather than assuming there is none.

What the first pass is looking for, and what this one must check again: both READMEs have been found stale five times in two days, every time by an agent editing them for an unrelated reason and never by a reader. The derived tests hold the counts and the lists; they cannot hold a claim.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: STANDS, and its block is NEARLY over -- close enough that it should be checked rather than assumed. plan:repaint is 18 done with 5 open, and tasks 1 through 11 -- the whole visual repaint of the screens -- are done. What remains is task 12 (re-measure and derive the pinned counts), task 13 s hue rulings, and three findings split out of tasks 3, 7 and 8.

SO THE SUBJECT MATTER HAS SETTLED even though the plan has not closed, and this task waits on the SUBJECT rather than on the plan. Its own design is what makes that judgement safe: the first review was REPORT ONLY, so the findings already exist in reports/2026-08-22-DOCS-REVIEW.md and can be read against today s screens before anything is edited.

AND IT SHOULD BE MERGED INTO THE DOCUMENTATION PROGRAMME, plan:walk seq:24, rather than run beside it. seq:24 is a full documentation programme in English and Hebrew, ruled 2026-08-25; applying a 2026-08-22 review s findings separately means editing the same documents twice, which is the exact reason this task deferred itself in the first place.
