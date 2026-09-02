---
id: RULE-make-every-bound-on-waiting-fail-as-itself
type: rule
title: Make every bound on waiting fail as itself
status: active
severity: hard
always: false
summary: When something gives up waiting it must say so itself, or a slow machine gets reported as a broken feature and someone goes hunting the wrong problem.
summary_of: d49575cbd131f70a
scope: []
tags: []
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-27
valid_until: null
checksum: 6167b0887ac7d99c
directive: do
---

# Make every bound on waiting fail as itself

A timeout, a retry cap or a settle limit that lets execution CONTINUE when it is exhausted converts a slow machine into a message about correctness. The assertion downstream then reports a defect in the code, and someone goes and looks at the code — for a failure that was wall-clock, not logic. So exhausting a bound must produce its own failure, naming itself as a bound that ran out and saying that nothing downstream was measured.

This is the absent-versus-zero standard in the time dimension: "we stopped waiting" and "it is not there" are different facts, and the reassuring wrong reading is the one that gets acted on.

The test that motivates it is the one that spent its own cap silently and then compared a half-drawn screen, reporting the load failure as a missing element — in a file whose own header already called that "the worst kind of red, because it reads exactly like a regression".

## Relations
- derived_from [[LESSON-every-bound-on-waiting-must-fail-as-itself-or-a-slow-machine]]
