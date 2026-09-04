---
id: TASK-the-audit-stream-does-not-show-every-hook-that-is-registered
type: task
title: the audit stream does not show every hook that is registered, and nothing says which are missing
status: active
severity: soft
always: false
summary: Registered hooks are absent from the stream on screen and there is no way to tell a hook that never fired from one the screen drops.
summary_of: 09d170ceea698468
scope:
  - hooks/hooks.json
  - src/hooks/**
  - src/core/audit.ts
  - src/ui/public/screens/watch.js
tags:
  - v2
  - hooks
  - audit
  - ui
  - "plan:hooks"
  - "seq:31"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-04
valid_until: null
checksum: 6a8ad983c6ca0c70
plan: hooks
seq: "31"
state: done
priority: "1"
verified_on: 2026-09-04
---

# the audit stream does not show every hook that is registered, and nothing says which are missing

Reported by the owner on 2026-09-04, after the feed bound was raised from twenty to two
hundred and a whole lane became visible. His words: he still does not observe all the hooks
that have been registered. So the window size was one fault and is fixed, and this is a
second, separate one underneath it.

Three explanations fit and NONE has been measured. The hooks may not be firing at all. They
may be firing and writing nothing to the log. Or they may be in the log and dropped between
the log and the screen, by a kind filter, by a projection that maps only some ops, or by a
renderer that has no row shape for them.

Establish which by measuring at each boundary in turn rather than reasoning about it: what
hooks.json registers, what op names appear in the audit log and with what counts, what the
stream endpoint returns for those ops, and what the screen renders. The layer where the
count first drops is the fault, and this has been guessed at twice today already at the cost
of an hour each time.

The audit ops are a closed list grouped in families with a validate that refuses an unknown
op, so a hook writing an op the list does not carry is refused rather than stored. That is a
strong candidate and it is checkable directly.

Whatever the cause, the screen must end able to say which registered hooks have never been
seen. A hook that never fires and a hook the screen cannot draw look identical today, and
while they do, the log cannot be trusted to answer what happened.

Verify as a user in a browser, per the ruling that a screen feature is done only after being
tested the way a person uses it. Note the trap that cost time before: the page caches the ES
module it imported, so a plain reload shows old code and about:blank and back is needed.
