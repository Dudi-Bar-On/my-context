---
id: TASK-mycontext-does-not-register-its-own-hooks-so-it-never
type: task
title: mycontext does not register its own hooks, so it never injects into its own corpus
status: active
severity: soft
always: false
summary: The tool is not installed in its own project, so it never runs on itself and the screens meant to prove it works have nothing to show.
summary_of: d355dc03bb8fc4c7
scope: []
tags:
  - "plan:hooks"
  - "seq:23"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-23
valid_until: null
checksum: b05e96042ac45c48
plan: hooks
seq: "23"
state: done
---

# mycontext does not register its own hooks, so it never injects into its own corpus

The audit log holds 957 records: 839 mutation, 22 access, 8 hook, 2 focus and 86 injection - and the newest injection is 2026-08-20, three days before this was written. Everything since is CLI writes and UI refusals. The Audit stream therefore shows no injection rows, no gold token bars and no hatched voids, and the owner reasonably read that as missing code. It is not; it is a missing integration.

The cause: this project has no .claude directory at all. my-context/hooks/hooks.json declares all eight events - SessionStart, PreToolUse, PostToolUse, PostToolUseFailure, PreCompact, PostCompact, SessionEnd, SubagentStart - but that manifest applies where the plugin is INSTALLED, and the plugin is not installed for its own repository. So nothing injects here, and the one surface that would prove the product works on itself never runs.

Proved by hand on 2026-08-23: piping a SessionStart payload straight into my-context/src/hooks/session-start.ts wrote a real record - injection, op session-start, 42 items, 13,080 tokens - and the Audit stream immediately drew the injection row, the gold token bar and the token note exactly as the mockup does. The hook path works. It is simply never invoked.

This is the dogfooding gap in one sentence: mycontext is not a consumer of mycontext. Related to TASK-hooks-22 (make mycontext autonomous from the first second), which surveys every integration surface - this is the first and most visible instance of what that survey is for.

Note the second-order effect: with no hook running, nothing ever syncs the audit projection either, which is why it is perpetually behind. See TASK-on-a-working-corpus-the-audit-projection-is-stale-within.
