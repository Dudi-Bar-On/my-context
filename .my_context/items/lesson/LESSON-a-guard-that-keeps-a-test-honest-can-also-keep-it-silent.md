---
id: LESSON-a-guard-that-keeps-a-test-honest-can-also-keep-it-silent
type: lesson
title: a guard that keeps a test honest can also keep it silent
status: active
severity: soft
always: false
summary: A check that only runs under the right conditions passes when those conditions never arrive, so it reports success without ever looking.
summary_of: df457a1187ef3f7f
scope: []
tags:
  - v2
  - ui
  - e2e
  - gate
  - measurement
  - fixture
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-24
valid_until: null
checksum: 72aae3b825a694ab
---

# a guard that keeps a test honest can also keep it silent

Found 2026-08-24, fixing the demo corpus s stale audit projection.

The activity-pulse layout test guards its assertion with `if (box.svgH !== null)`, and the guard is CORRECT: when the volume endpoint refuses there is genuinely no chart to measure, and asserting against a chart that was never drawn would fail for a reason that is not the one under test.

But the fixture had been refusing for weeks. So the block never ran, the test reported PASS every time, and the defect it exists to catch -- an inline SVG overflowing its plate by 28px -- sat in the shipped UI. The instant the projection was synced, it went red immediately and with the right message.

THE GENERAL FORM: a conditional assertion has two passing states -- "checked and correct" and "not checked" -- and a plain green tick cannot tell them apart. Everything else here was in place: the comment explains the guard, the failure message is excellent, the invariant is right. What was missing was any way to notice that the branch had not executed.

WHAT WOULD HAVE CAUGHT IT: a test that asserts the CONDITION holds at least once across the suite -- somewhere, on some screen, the chart must actually be drawn -- so that a fixture which silences every instance of a check fails rather than passes. The same shape would catch the next conditional assertion the fixture starves.

Fourth in this week s series of gates measuring what they were pointed at: screen-parity comparing a sorted set, styles-parity comparing only the selectors it was handed, a tree walker whose count understates whole missing subtrees, and now an assertion that was never reached.
