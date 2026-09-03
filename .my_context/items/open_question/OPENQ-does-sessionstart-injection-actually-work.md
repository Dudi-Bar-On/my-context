---
id: OPENQ-does-sessionstart-injection-actually-work
type: open_question
title: Has SessionStart injection ever been observed in a live session?
status: superseded
severity: hard
always: false
summary: Nobody has watched the text handed to a new conversation actually reach the assistant, and a whole stage of the work is built on the assumption that it does.
summary_of: 5c3d540021cad032
scope: []
tags:
  - verification
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-13
valid_until: 2026-09-03
checksum: 9ee9c64507f5d0e5
---

# Has SessionStart injection ever been observed in a live session?

ANSWERED on 2026-08-13 — see [[DEC-sessionstart-injection-verified]]. Retained as a
record of what was unknown before Plan 2 was built, and of the fact that it went
unverified through an entire plan.

The original question: the hook produced correct output when invoked from a shell,
but the stdout → context contract with Claude Code had never been observed end to
end. Everything in Plan 2 is hooks, so the whole plan rested on it.

## Observations
- [resolved] Superseded by the decision that answers it. Verified by canary: a headless session loaded with --plugin-dir reproduced a phrase that exists only in an injected item
- [history] A previously "verified" invocation path — the npm link entry guard — turned out to be dead, because the toy script used to verify it had no entry guard

## Relations
- superseded_by [[DEC-sessionstart-injection-verified]]
