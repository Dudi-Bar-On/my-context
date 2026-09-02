---
id: DEC-the-capture-screen-shows-a-scope-match-and-never-a-score
type: decision
title: the Capture screen shows a scope match and never a score
status: active
severity: soft
always: false
summary: When you write something down, the tool shows what already covers the same files, and no similarity score or ranking, because that guess is unproven.
summary_of: 7838ce0d2c294c34
scope: []
tags:
  - v2
  - ui
  - owner-ruling
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-24
valid_until: null
checksum: 277a8db4a5a028a0
---

# the Capture screen shows a scope match and never a score

OWNER RULING, 2026-08-24, settling plan:ui2 seq:5q - open question 1, which has blocked the rendering half since Task 5 built the endpoint.

THE QUESTION, in the task's own words: at capture time, does the Capture screen show the user that a similar item already exists - and if so, as a count, an unordered list, or a ranked one?

THE ANSWER: none of the three. The screen shows the items whose SCOPE MATCHES, which is what `/api/capture` already serves and what the screen already draws. No count, no ranking, no score.

WHY, and it is not that the score is bad - nobody knows whether it is good. `overlapScore` is a heuristic that has never been validated against a person's judgement of "these two are the same rule". A ranked list asserts that the order MEANS something; a count asserts that the number does. Rendering either invites a trust the metric has not earned, at the exact moment a user is deciding whether to write an item - which is the moment a wrong signal is most expensive.

A scope match makes no such claim. It says "these govern this path", which is checkable by looking.

WHAT STAYS AVAILABLE: `POST /api/overlap` is built, tested and unrendered. It is not dead code - the Work screen asks a different question, about revisions rather than captures, and the ruling here does not touch it. And `capture-model.ts` already holds the line structurally rather than by intention: "nothing below reads overlapScore, and the response carries no score field for a screen to sort on by accident."

WHAT WOULD REOPEN IT: a validation of the score against real duplicate judgements in this corpus. If it turns out to agree with a person most of the time, the ranked list becomes the obviously right answer and this ruling should be reversed on that evidence. The order to do it in is validate, then render - not render, then find out.
