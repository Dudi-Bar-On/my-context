---
id: RULE-do-not-accept-a-test-that-passes-in-isolation-and-fails
type: rule
title: Do not accept a test that passes in isolation and fails under load as flaky until it has been measured
status: active
severity: soft
always: false
summary: A test that passes alone and fails in a crowd is not automatically unreliable; measure it before saying so, or a real fault hides behind the label.
summary_of: d762f6d5350d900d
scope: []
tags: []
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-27
valid_until: null
checksum: ae41d27e0822f1f6
directive: dont
---

# Do not accept a test that passes in isolation and fails under load as flaky until it has been measured

"Flaky" is a verdict, and it is usually reached without evidence. The same outward shape — green alone, red in a full run — covers genuine contention, a missing barrier, and a bound with no failure of its own. The last two are real defects that a flaky label hides, and hiding them costs the next reader the same afternoon.

So the shape is a prompt to measure, not a conclusion: run the file alone repeatedly, run the suite repeatedly, and run two suites concurrently. Record the numbers. If nothing reproduces, the honest record is the count of attempts and what is known — never a verdict nobody established.

## Relations
- derived_from [[LESSON-every-bound-on-waiting-must-fail-as-itself-or-a-slow-machine]]
