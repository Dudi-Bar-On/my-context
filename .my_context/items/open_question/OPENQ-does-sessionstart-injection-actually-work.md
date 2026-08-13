---
id: OPENQ-does-sessionstart-injection-actually-work
type: open_question
title: Has SessionStart injection ever been observed in a live session?
status: active
severity: hard
always: true
scope: []
tags:
  - verification
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-13
valid_until: null
checksum: 83d0fc2df2efb932
---

# Has SessionStart injection ever been observed in a live session?

No. The hook produces correct output when invoked from a shell, but the
stdout → context contract with Claude Code has never been observed end to end.
Do not assume it works. Everything in Plan 2 is hooks, so if the assumption is
wrong the whole plan rests on it.

## Observations
- [unknown] Whether the matcher fires, whether ${CLAUDE_PLUGIN_ROOT} interpolates on Windows, and whether the missing "shell" field matters
- [method] Verify with `claude --plugin-dir` in a scratch directory, plus a negative control in a directory with no workspace
- [history] A previously "verified" invocation path — the npm link entry guard — turned out to be dead, because the toy script used to verify it had no entry guard

## Relations
- blocks [[REQ-plan-2-precision-injection]]
