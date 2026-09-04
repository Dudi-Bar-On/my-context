---
id: TASK-ruling-37-the-citation-gate-cannot-tell-no-citation-from-a
type: task
title: "ruling 37: the citation gate cannot tell 'no citation' from 'a citation I failed to parse'"
status: active
severity: soft
always: false
summary: The reference checker silently skips any reference that wraps onto a second line, so it looks checked and is not.
summary_of: d1afc102c8fdd96c
scope: []
tags:
  - "plan:rulings"
  - "seq:37"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-21
valid_until: null
checksum: e8beacf1797b69bd
plan: rulings
seq: "37"
state: done
priority: "1"
---

# ruling 37: the citation gate cannot tell 'no citation' from 'a citation I failed to parse'

Found by ruling 33. verify-citations.ts separates the three parts with [ \t]*[middot][ \t]* - spaces and tabs, NO NEWLINE. A citation already in the checked form but split across two source lines matches nothing. It is not reported BROKEN. It is invisible: never counted, never resolved, reported nowhere.

It looks converted to a reader and is unchecked by the gate - the failure mode the form was built to end, wearing the form's own clothes.

22 were found by scanning every separator in the gated documents and asking which ones the gate's own CITATION regex consumed: categories 13, web-ui-design 5, export 2, hooks 1, web-ui-1 1. All 22 are now fixed. TEN of them came back MOVED the instant the gate could see them, which is what the silence was hiding.

The fix: a separator adjacent to a backtick that the CITATION regex did not consume is either a wrapped citation or a malformed one, and there is no third case in this corpus. Make that a fault.

This is INV-nothing-is-dropped-silently, applied to the gate that enforces it everywhere else.
