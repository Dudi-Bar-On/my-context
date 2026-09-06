---
id: TASK-the-handover-is-checked-for-truth-not-only-for-currency
type: task
title: the handover is checked for truth, not only for currency
status: active
severity: soft
always: false
summary: The notes handed from one session to the next are held to the same standard as everything else written down here.
summary_of: a9de712ea9eff374
scope:
  - scripts/verify-citations.ts
  - src/hooks/session-start.ts
  - reports/V2-HANDOVER.md
tags:
  - v2
  - handover
  - quality
  - "plan:handover"
  - "seq:15"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-06
valid_until: null
checksum: fafb706fe6527fd0
plan: handover
seq: "15"
state: done
priority: "1"
verified_on: 2026-09-06
---

# the handover is checked for truth, not only for currency

Owner ruling 2026-09-06 (plan D19), marked important. D14 made the handover CURRENT. Nothing makes
it TRUE, and this is that half.

THE EVIDENCE, and it is a real defect that shipped nothing only by luck. The handover carried the
instruction "widen isServableDocPath to serve .my_context/items/**" SIX times across six
compactions. It was wrong: SKIP_DIRS at src/doctor/checks.ts:297 contains `.my_context`, so
listRepoFiles never yields a corpus path and the predicate would have been asked about no corpus
file, ever. A lane following that instruction faithfully would have shipped a feature that served
NOTHING, looked done, and passed every gate. It was caught only because a lane measured instead of
trusting.

MEASURED GAP 1 - THE HANDOVER IS THE ONE DOCUMENT THE CITATION GATE DOES NOT SCAN.
`scripts/verify-citations.ts` checks 1,198 citations across 47 documents and reads the handover
ZERO times. So it is the only place in this project where a claim can point at code and never be
compared to it. It already carries 45 item-id references, so it is most of the way to being
checkable already.

MEASURED GAP 2 - REPETITION WITHOUT CLOSURE IS UNMEASURED, AND IT IS THE SIGNATURE OF THE BUG.
A wrong or impossible instruction has a shape: it is carried forward again and again and never
becomes a closed item, BECAUSE IT CANNOT BE. Six carries and no closure was the tell, and nothing
looked for it. Note the handover ACCUMULATES - it is 2,831 lines and rewritten by appending, so
the repetition is inside one file and countable without git archaeology. Verify that before
relying on it.

THE STRUCTURAL HALF, and it is the one that matters most: THE HANDOVER SHOULD CARRY POINTERS, NOT
CLAIMS. Today it carries both. The second finding of 2026-09-06 is the argument: a hard requirement
appeared to contradict the product for days, and the owner had ALREADY ruled on it - the ruling was
in the handover five times and in NO ITEM. So every reader who consulted the corpus instead of the
handover re-found the same contradiction and re-raised it. The corpus governs; the handover is a
bridge between sessions. A claim that lives only on the bridge is re-litigated forever, and a
correction to it corrects only one session.

What that implies, to be designed rather than assumed: an actionable instruction in the handover
names an item id, and the claim itself lives in the item - where doctor checks it, supersession can
retire it, and one correction reaches every future session.

WHAT MUST NOT HAPPEN. The handover is written under pressure at high occupancy, by an assistant with
little room left. A check that makes writing it harder, slower or refusable at 97% occupancy defeats
the feature it is protecting. Whatever lands must fail the way a linter fails - naming the suspect
line, after the fact - and must never block the WRITE.
