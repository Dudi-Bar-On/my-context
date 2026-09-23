---
id: TASK-58-of-its-rows-157-269-were-written-by-test-rules-lane-still-2
type: task
title: 58% of its rows (157/269) were written by test/rules/lane-still-gets-the-no-git-rule.test.ts into…
status: superseded
severity: soft
always: false
summary: 58% of its rows (157/269) were written by test/rules/lane-still-gets-the-no-git-rule.test.ts into the owner's live workspace, corrupting the one count spec §8.2 defines; and the session-start door has never once delivered successfully — zero rows…
summary_of: dc767c21697f091a
scope:
  - test/rules/lane-still-gets-the-no-git-rule.test.ts
tags:
  - review-pass
  - "proposer:deterministic"
  - unconfirmed
  - "rec:promote"
origin: review
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-15
valid_until: 2026-09-22
checksum: b30d43a824d68b7e
---

# 58% of its rows (157/269) were written by test/rules/lane-still-gets-the-no-git-rule.test.ts into…

It makes a whole claim about test/rules/lane-still-gets-the-no-git-rule.test.ts, which is in the repository now. It rests on one session, but approving this creates work to BUILD rather than a law to obey — a check that turns out wrong is found by whoever writes it.
Decided from — subject: file test/rules/lane-still-gets-the-no-git-rule.test.ts (present); claim: whole; recurrence: one session only; evidence: 1 record(s).
--- the recommendation ends here; the brief as it was recorded follows, unchanged ---
A draft from the self-improvement pass. It governs nothing and is not committed.
Written by the DETERMINISTIC proposer, which selects a sentence from a transcript and cannot compose one. That is why it authors a task and nothing else: the sentence below is quoted, so it is offered as work to look at rather than as law.
Proposed as a task to BUILD a check rather than as a rule to obey, because it can be checked: the observation names a file under scripts/ or test/. Approving this creates work, not law: a check that is wrong is found by whoever writes it.
It is about test/rules/lane-still-gets-the-no-git-rule.test.ts, which the evidence names directly.
Seen in ONE session only, so it is UNCONFIRMED. Steps inside a single session are causally correlated and cannot confirm each other; a second, independent session is what would make this more than one observation.
Evidence: agent-a9848c15a82169403.jsonl record 297.

What was observed, quoted as evidence rather than as the content of this proposal:
""Delivery leaves no audit trace" — half true. There is a record (269 rows in .mycontext/.rules/delivered.jsonl); the audit log knows nothing about it, and both halves of that isolation argument hold. The real defect is that nothing reads the file — no CLI, MCP, doctor or UI. Two things it says that nobody has seen: 58% of its rows (157/269) were written by…"

## Relations
- superseded_by [[TASK-the-delivery-log-has-no-reporting-surface-so-a-count-instead]]
