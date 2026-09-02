---
id: RULE-when-a-symptom-returns-after-a-verified-fix-look-for-a
type: rule
title: When a symptom returns after a verified fix, look for a second cause
status: active
severity: hard
always: false
summary: If a problem returns after a fix you actually measured, the fix was probably right and there is a second cause; look for that rather than doubting the fix.
summary_of: 517661df5eae3b56
scope: []
tags:
  - v2
  - method
  - governance
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-23
valid_until: null
checksum: fc24ccac5d895da5
---

# When a symptom returns after a verified fix, look for a second cause

When a symptom returns after a fix you verified, the fix was almost certainly right and there is a second cause. Look for it. Do not re-examine the fix, and do not apply a variation of it.

WHAT THIS COST

The owner reported a blank screen five times across two days. Four distinct bugs produced the identical white rectangle: a reload with no credential at all; a cookie scoped to a HOST rather than a port, so the previous server's token reached the next one; a stale cookie no one could clear, because HttpOnly means script cannot and no nonce meant nothing to re-handshake with; and finally a nonce pasted into a live page doing nothing, because changing the hash of a loaded page is a same-document navigation and the boot never re-runs.

Each of the first three fixes was measured before and after against a real server. Each was correct. Two extra rounds were spent doubting them.

DO

Treat recurrence as evidence of a NEW cause, not of a bad fix - provided the fix was measured.
Change the observation point. Three theories were tested against the browser; the answer was in the server's refusal log, which records the check that refused and showed POST /api/handoff had never been called at all.
Write down what each fix DID change, with its measurement, so the next round starts from a smaller space. handoff with no cookie 200, handoff with a stale cookie 403, after the fix 200.
Enumerate the paths that can produce the symptom before fixing anything, once you know there is more than one.

DO NOT

Do not revert a verified fix to see if it helps. It will not, and you lose the ground you gained.
Do not widen a fix speculatively to cover the recurrence. That is how one correct change becomes three vague ones.
Do not report the symptom as fixed after the second occurrence without saying which cause you addressed and which you did not.

Related: [[LESSON-one-symptom-four-causes-the-blank-page-that-kept-coming-back]] and [[RULE-measure-before-you-assert-and-show-the-measurement]].
