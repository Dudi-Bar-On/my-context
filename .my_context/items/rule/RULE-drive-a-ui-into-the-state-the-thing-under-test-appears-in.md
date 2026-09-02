---
id: RULE-drive-a-ui-into-the-state-the-thing-under-test-appears-in
type: rule
title: Drive a UI into the state the thing under test appears in before measuring it
status: active
severity: hard
always: false
summary: Get the screen into the state where the thing you are testing actually exists before measuring it, or the check passes happily over something never built.
summary_of: 237074d231337297
scope: []
tags: []
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-27
valid_until: null
checksum: d518988e93a83826
directive: do
---

# Drive a UI into the state the thing under test appears in before measuring it

A screen is not a state. Controls are built conditionally — after a selection, after required input is complete, after a fetch resolves — so navigating to a screen and reading what is there measures whatever the screen draws at rest, which need not include the thing under test at all.

The failure is silent in the worst direction: the walk finds plenty of other elements, any count assertion is satisfied, and the gate reports green over a control that was never built. A gate that cannot reach its subject is indistinguishable from a subject that is correct.

So reaching the state is a STEP, with its own wait and its own failure, and the step names what must be true for the subject to exist.

## Relations
- derived_from [[LESSON-a-ui-gate-must-reach-the-state-the-defect-lives-in-not]]
