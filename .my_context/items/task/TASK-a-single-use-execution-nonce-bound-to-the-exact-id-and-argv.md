---
id: TASK-a-single-use-execution-nonce-bound-to-the-exact-id-and-argv
type: task
title: a single-use execution nonce bound to the exact id and argv shown
status: active
severity: soft
always: false
summary: A one-time permit tying a run to the exact command the user was shown, so a local page cannot quietly run something else instead.
summary_of: 524b06c6d393935a
scope: []
tags:
  - v2
  - ui
  - execute
  - security
  - "plan:execute"
  - "seq:3"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-27
valid_until: null
checksum: a67ae58b4235610f
plan: execute
seq: "3"
state: done
priority: "1"
source: owner, 2026-08-26 ruling; plan written 2026-08-27
---

# a single-use execution nonce bound to the exact id and argv shown

This item tracks state only. The task itself is Task 3 of docs/superpowers/plans/2026-08-27-execute-a-composed-command.md, which carries the tests, the code and the commit message. The design is docs/superpowers/specs/2026-08-26-execute-a-composed-command-design.md — read section 3 AND section 6 together; 6.1 widened 3.2.

The session token proves a BROWSER. This proves that this run is the one a confirm dialog rendered.

With the owner's 6.1 widening what may run — every catalogue command, no kill switch — this is the only thing standing between a silent local page and a corpus mutation. Section 6.3 says so in those words: not optional, not deferred.

One-shot, and a MISMATCHED attempt spends it too. A nonce that survives a wrong guess is a nonce an attacker may guess against. Bound by a digest of the id and the argv so the store holds no command text, and JSON-encoded rather than joined so that `['a b']` and `['a','b']` cannot collide.
