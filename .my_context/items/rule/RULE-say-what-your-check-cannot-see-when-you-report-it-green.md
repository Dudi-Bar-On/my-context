---
id: RULE-say-what-your-check-cannot-see-when-you-report-it-green
type: rule
title: Say what your check cannot see when you report it green
status: active
severity: hard
always: false
summary: When you report that a check passed, say what it could not see, or a narrow pass gets read as an assurance that the whole thing is fine.
summary_of: 7e8da75e4ab81e79
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
checksum: 5b0e3459a89625b5
---

# Say what your check cannot see when you report it green

A green check means the thing it measures is fine. It does not mean the thing is fine. When reporting a pass, name what that pass cannot see.

THE PROOF THIS RULE EXISTS FOR

e2e/screen-parity.spec.ts compares every screen to its mockup section by element KIND. It was green while the Audit stream rendered one generic op-itemId-note-path cell for four different record kinds, where the mockup composes a distinct sentence for each: an event name and counts for hook, a check and its explanation for access, a procedure and a position in it for progress. Every element involved was the same bdi and span.m. Identical structure, different prose. The gate was blind to it by construction and always would have been.

The owner found it by looking at the two screens side by side.

DO

State the blind spot in the same breath as the result: 108 e2e green, and that suite compares element kinds, not prose, spacing or colour.
Write the limit into the check itself, where the next reader will meet it. screen-parity's header now says it, and so does the ledger entry for the kinds it cannot judge.
Pick the instrument for the question. Structure to a DOM tally, prose to reading it, layout to measuring boxes, appearance to a human looking.
Say plainly when no check can express a property, rather than letting an adjacent green stand in for it.

DO NOT

Do not offer a gate as evidence for a property it does not test. Seven green gates were offered as evidence that a page looked right; it had a diagonal fan across four screens of scroll.
Do not call a screen done because its ledger reached zero. The ledger is structural. Done is [[RULE-1-1-with-the-mockup-and-the-owner-says-when-it-is-done]], and the owner certifies it.
Do not delete a check because it cannot see everything. Narrow and honest beats broad and vague - just say which it is.
