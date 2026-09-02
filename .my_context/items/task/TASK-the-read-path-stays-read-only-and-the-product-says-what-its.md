---
id: TASK-the-read-path-stays-read-only-and-the-product-says-what-its
type: task
title: the read path stays read-only, and the product says what its gate cannot prove
status: active
severity: soft
always: false
summary: Keep proving that the reading side writes nothing, and state plainly in the guides what that proof does not cover.
summary_of: 6b13ff8213318014
scope: []
tags:
  - v2
  - ui
  - execute
  - security
  - docs
  - "plan:execute"
  - "seq:8"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-27
valid_until: null
checksum: afbb820f984fae91
plan: execute
seq: "8"
state: done
priority: "2"
source: owner, 2026-08-26 ruling; plan written 2026-08-27
---

# the read path stays read-only, and the product says what its gate cannot prove

This item tracks state only. The task itself is Task 8 of docs/superpowers/plans/2026-08-27-execute-a-composed-command.md, which carries the tests, the code and the commit message. The design is docs/superpowers/specs/2026-08-26-execute-a-composed-command-design.md — read section 3 AND section 6 together; 6.1 widened 3.2.

`no-writes.test.ts` is NARROWED to the read modules, never deleted, so a write sneaking into a read path still fails. Its comment must name what is now out of scope, or the next reader takes the narrowing for the rule going away.

And section 7 of BOTH READMEs carries the residual in the words a reader MEETS rather than could look up: the gate proves a request came from a browser on this machine, never that a person asked, and there is no way to turn execution off short of not running the UI. An unstated limit is how a partial claim gets read as a complete one, and a security boundary is the worst place to break that.
