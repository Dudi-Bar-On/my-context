---
id: TASK-a-declined-claim-comes-back-when-a-later-pass-words-it
type: task
title: a declined claim comes back when a later pass words it differently, because the ledger matches wording and not subject
status: active
severity: soft
always: false
summary: Rejecting a proposal only stops it coming back for a little while — the same claim worded differently in a later session is not recognised as one you already refused.
summary_of: d4bb9d1dfa10d36e
scope:
  - src/review/declined.ts
  - src/review/claim.ts
  - src/review/propose.ts
tags:
  - v2
  - review
  - silent-failure
  - "plan:review"
  - "seq:9"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-15
valid_until: null
checksum: 8f10cff709afe188
plan: review
seq: "9"
state: done
priority: "1"
---

# a declined claim comes back when a later pass words it differently, because the ledger matches wording and not subject

FOUND 2026-09-15 BY THE OWNER REJECTING SOMETHING AND WATCHING IT COME BACK. He declined four
drafts between 12:39:40 and 12:41:44. A pass ran at 13:06:07 and re-created two of them at
13:06:36 and 13:06:37 — twenty-five minutes after he said no, with the same titles and the same
targets.

THE LEDGER IS NOT BROKEN. IT IS DOING EXACTLY WHAT IT SAYS, AND WHAT IT SAYS IS WRONG.
Measured, end to end, on his own state file:
  — `readDeclines(‘.my_context’)` reads 4 declines. The root is right (`propose.ts` passes
    `options.workspace`, and line 573 takes its `dirname` to resolve targets, so it is the
    `.my_context` directory as required). Handed the project root instead it reads 0 and returns
    null SILENTLY — not the bug here, but worth knowing it fails that way.
  — Both re-proposals carry the SAME target as the decline they repeat
    (`scripts/check-handover.ts`, and `null` for the scope-less one), so the target gate passes.
  — `sameClaim` then compares token overlap against `NEAR_CLAIM_THRESHOLD = 0.35`.

AND THIS IS THE WHOLE FINDING — the score distribution:

    two declines of ONE subject, proposed in the SAME pass      0.593 and 0.645   suppressed
    a re-proposal of those subjects in a LATER pass             0.277 and 0.310   NOT suppressed
    unrelated claims (different target)                         0.000             not suppressed

The threshold sits ABOVE the cross-pass band and BELOW the same-pass band. So a decline suppresses
a duplicate that arrives beside it and expires against the same claim arriving tomorrow. The
discard message promises the opposite in as many words: "The claim is kept in the decline ledger
so the pass does not re-propose it."

WHY THE OVERLAP COLLAPSES. `claimKey` is a bag of up to 24 stemmed tokens taken from the
proposal’s title and body. A later pass selects a DIFFERENT SENTENCE about the same subject from a
different session, so the bag is largely different words about the same thing. Two proposals made
in one pass are adjacent sentences and share most of their vocabulary; two made a day apart do
not. THE KEY IS A FUNCTION OF THE WORDING, AND THE SUBJECT IS NOT.

THIS IS THE CROSS-PASS TWIN OF A DEFECT ALREADY NAMED. The lane that built `review/7` reported
that near-duplicate suppression is WITHIN-PASS ONLY — `const pending: Pending[] = []` starts empty
each pass, so the standing queue is never consulted. That one lets a duplicate into the queue
beside its twin; this one lets a REJECTED claim back in after it was removed. Same shape, opposite
end of the review loop.

THE DECISION, and each option has a real cost:
  1. LOWER THE THRESHOLD. There is headroom — unrelated claims score 0.000 here, not 0.2 — so ~0.25
     would have caught both of these. BUT two pairs is not a distribution, and suppressing a
     genuinely NEW claim is worse than re-proposing an old one: the owner never sees it and
     nothing tells him. Do not take this on two data points.
  2. KEY THE DECLINE ON THE EVIDENCE, NOT THE WORDING. A declined draft names its source exactly
     — "Evidence: agent-a9848c15a82169403.jsonl record 297". If the same transcript record is
     selected again, that is an EXACT match needing no threshold at all. It does not catch the
     same claim found in a different session, but what it does catch, it catches with certainty.
  3. KEEP THE DECLINED ITEM ID and refuse to re-create a draft at a filename that was declined.
     Cheapest, and narrow: it only catches a re-proposal that slugs identically — which BOTH of
     these did.
RECOMMENDATION: 3 and 2 together, and NOT 1 until the score distribution is measured across many
declines rather than two. 3 alone would have stopped both of these today.

WHAT WOULD HAVE CAUGHT IT: a test that declines a claim, then proposes THE SAME SUBJECT FROM
DIFFERENT WORDING, and asserts it is suppressed. Every existing test for this exercises the
ledger with the claim string it just wrote — which is the fixture carrying the proof’s power, and
it passes forever while the mechanism decays in the field.

WORTH KNOWING WHEN FIXING: the two drafts this was found on are still in `.my_context/.drafts/`,
unreviewed, and are the reproduction. Do not delete them to make the queue look clean.
