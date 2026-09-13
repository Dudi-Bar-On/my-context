---
id: TASK-two-screens-answer-the-visible-confirmation-question
type: task
title: two screens answer the visible-confirmation question opposite ways, and one of them calls the other unapproved
status: active
severity: soft
always: false
summary: One screen shows a short message confirming a copy and another deliberately refuses to, so the same action behaves differently depending on where you do it.
summary_of: cab6d5df8fb9fcaf
scope:
  - src/ui/public/app.js
  - src/ui/public/screens/conversations.js
tags:
  - v2
  - ui
  - confirmation
  - needs-ruling
  - "plan:walk"
  - "seq:167"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: dc955e5024ba6b2e
plan: walk
seq: "167"
state: todo
priority: "2"
---

# two screens answer the visible-confirmation question opposite ways, and one of them calls the other unapproved

THE DECISION COMES FIRST. The question is no longer whether a visible confirmation is permitted -- it is which of two live answers the product keeps. `app.js` · the chrome-not-approved comment (line 5118) calls a visible confirmation "chrome the owner has not approved" and confirms Copy and Execute into a 1x1 px screen-reader-only span. THE NEWER CONVERSATIONS CODE ALREADY SHIPS THE OTHER ANSWER: `conv.recall.copied` -- "Copied. Nothing has been sent anywhere" -- with a refusal path. Two screens now answer the same question opposite ways, which is a worse state than either answer.

THE RECOMMENDATION ON THE TABLE, from the consolidation: approve the visible half. A 1.5-second text swap on the button costs no new chrome and no new slot, and the live region stays exactly as it is.

FOUND BY BOTH UI REVIEWS. Report 1 measured the invisible confirmation and quoted the refusal; report 2 found the question had already been settled the other way in shipped code. Row 31 of `reports/2026-09-13-the-consolidated-findings.md`.

WHY IT IS UNDER D50. The surface exists -- a live region, a refusal, a recorded reason -- and what is missing is anything a sighted user can see filling it.
