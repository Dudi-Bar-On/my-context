---
id: OPENQ-does-sessionstart-injection-actually-work
type: open_question
title: Has SessionStart injection ever been observed in a live session?
status: validated
severity: hard
always: false
scope: []
tags:
  - verification
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-13
valid_until: null
checksum: 70a7db76813e6dcf
---

# Has SessionStart injection ever been observed in a live session?

ANSWERED on 2026-08-13 — see [[DEC-sessionstart-injection-verified]]. Retained as a
record of what was unknown before Plan 2 was built, and of the fact that it went
unverified through an entire plan.

The original question: the hook produced correct output when invoked from a shell,
but the stdout → context contract with Claude Code had never been observed end to
end. Everything in Plan 2 is hooks, so the whole plan rested on it.

## Observations
- [resolved] Verified by canary: a headless session loaded with --plugin-dir reproduced a phrase that exists only in an injected item
- [history] A previously "verified" invocation path — the npm link entry guard — turned out to be dead, because the toy script used to verify it had no entry guard

## Relations
- answered_by [[DEC-sessionstart-injection-verified]]
