---
id: TASK-make-the-queue-workable-and-impossible-to-rot-unseen
type: task
title: make the queue workable, and impossible to rot unseen
status: active
severity: soft
always: false
summary: Two buttons and a clear summary for each suggestion, a memory of what was turned down, and a visible count that cannot be missed.
summary_of: 8a1d985c7508e014
acknowledged:
  - task_unverified@a2507b3e71c48bc2
scope:
  - src/**
  - test/**
  - scripts/**
tags:
  - v2
  - review-loop
  - "plan:loop"
  - "seq:4"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-08
valid_until: null
checksum: a3f405ed8c097c8b
plan: loop
seq: "4"
state: done
priority: "2"
needs: loop/3
---

# make the queue workable, and impossible to rot unseen

D36d. BUILT AND MEASURED 2026-09-11.

WHAT SHIPPED. (1) The decline ledger keyed on the claim was already landed by seq:3; what this
phase added is the ACT — src/review/decline.ts, the only path in this product that deletes an item
rather than retiring it (§8). It refuses on four conditions checked separately: draft, project
layer, origin review, and file inside .drafts/. The ledger is written BEFORE the file is removed,
so the survivable crash is "the owner declines it twice" rather than "the pass proposes it
forever". mycontext review discard now performs that act on a review-pass draft and the old
deprecation on every other kind, and --reason joins the flag table, the help table and the palette.
(2) The split queue already existed on the Work screen; this gave every draft row the REVIEW BRIEF
INLINE (served on /api/review-queue, written at capture time by briefOf, no model call anywhere on
the surface), made the id a door to the item pane, and gave Reject a SECOND sentence because
work.discardDraft says "the text is not deleted" and that is now false for a proposal.
(3) The RATION: review.queueCeiling, default 15 = §11's maxProposalsPerPass 5 x maxFiresPerPass 3,
one session at full ration. Past it a pass writes nothing and reports held {pending, ceiling};
every observation is still screened, classified, keyed and noted as a sighting, so capture
continues and proposals wait. (4) The INDICATOR: src/review/pending.ts is one definition of what is
waiting and how old the oldest of it is, read by the terminal bar, by mycontext status and by the
web strip. reviewChip returns null for an empty queue AND for one that could not be read, so
"nothing at zero" is a type rather than a rule two surfaces each remember.

MEASURED. Age bands read off this corpus's only two settle latencies (audit log, n=2, 2026-08-29):
2.0 hours and 9.6 days, so ageing at 1 day and stale at 10. They are floors and re-deriving them is
owed. The indicator's read costs p50 2.9 ms / p95 4.3 ms over 60 runs on 1,085 items, against a bar
already paying p95 26.6 ms for myctxShare — which reverses the cost refusal recorded in
test/ui/strip-parity.test.ts; the reversal is written into that file's own docblock. This corpus
has created 1,077 items and settled 2 drafts in its whole life, which is the queue-nobody-works
failure of §1 measured rather than imagined.

RESOLVED. §10 partly contradicts the owner's age-colour ruling; resolved by keeping BOTH, which is
what §10 itself asks for: the colour is the pressure signal and the ceiling is the relief valve.
The ration ships inert (maxProposalsPerPass is still 0) so nothing changes until he raises it, and
the ceiling is HIS TO CONFIRM. isCorpusFilePath was WIDENED rather than routed around: its items/
clause was shorthand for "the only directory loadLayer reads", and seq:3 gave loadLayer a second
walk root, so the clause outlived its reason. A second route would have been a second traversal
defence guarding the least trusted files in the corpus.

NOT BUILT, AND WHY. §7's "approving may offer to stage the patch it implies" has no precondition
today: AUTHORABLE is ['check'] and a check becomes a task, which proposes work to build rather than
new text for an item in force, so there is no patch to stage. Building the offer would have been
shipping a prompt nothing invokes, which is §12's fifth rule. relations.ts survives untouched:
nothing on this path calls stageRevision.

OWED. test/ui/no-writes.test.ts needs 'src/review/decline.ts': ['declineDraft'] in WRITERS; that
file was contested by another lane tonight and was left alone. e2e/review-queue.spec.ts and
e2e/review-chip.spec.ts are not written and the screen has not been looked at in either language —
e2e/** and the browser belonged to another lane.
