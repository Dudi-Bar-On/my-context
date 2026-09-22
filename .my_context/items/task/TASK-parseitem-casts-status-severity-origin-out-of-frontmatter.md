---
id: TASK-parseitem-casts-status-severity-origin-out-of-frontmatter
type: task
title: parseItem casts Status/Severity/Origin out of frontmatter with no check —…
status: active
severity: soft
always: false
summary: "parseItem casts Status/Severity/Origin out of frontmatter with no check — src/core/item.ts:545,546,584."
summary_of: 44ee7760bfbe4656
scope:
  - src/core/item.ts
tags:
  - review-pass
  - "proposer:deterministic"
  - unconfirmed
  - "rec:promote"
  - "rec-backfilled:2026-09-15"
  - "state:done"
origin: review
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 0f56ff7e72a09bc6
state: done
---

# parseItem casts Status/Severity/Origin out of frontmatter with no check —…

BACKFILLED on 2026-09-15 — re-derived from this draft's own fields — its scope, its confirmed/unconfirmed tag, and its summary.
It makes a whole claim about src/core/item.ts, which is in the repository now. It rests on one session, but approving this creates work to BUILD rather than a law to obey — a check that turns out wrong is found by whoever writes it.
Decided from — subject: file src/core/item.ts (present); claim: whole; recurrence: one session only; evidence: not recorded. Not recoverable, and so treated as absent rather than guessed: how many evidence records the proposal cited, and which transcript they came from; how many sessions the claim was seen in.
--- the recommendation ends here; the brief as it was recorded follows, unchanged ---
A draft from the self-improvement pass. It governs nothing and is not committed.
Written by the DETERMINISTIC proposer, which selects a sentence from a transcript and cannot compose one. That is why it authors a task and nothing else: the sentence below is quoted, so it is offered as work to look at rather than as law.
Proposed as a task to BUILD a check rather than as a rule to obey, because it can be checked: the observation describes a gate. Approving this creates work, not law: a check that is wrong is found by whoever writes it.
It is about src/core/item.ts, which the evidence names directly.
Seen in ONE session only, so it is UNCONFIRMED. Steps inside a single session are causally correlated and cannot confirm each other; a second, independent session is what would make this more than one observation.
Evidence: agent-a04d92c0e384cf082.jsonl record 205.

What was observed, quoted as evidence rather than as the content of this proposal:
"1. parseItem casts Status/Severity/Origin out of frontmatter with no check — src/core/item.ts:545,546,584. This is the finding. GOVERNINGSTATUS is Record<Status, boolean>, a total compiler-enforced table whose own docblock argues for that shape. Indexed with a laundered 'activ' it returns undefined → falsy → governsNormatively answers false, and five gates fail open together: supersede…"
