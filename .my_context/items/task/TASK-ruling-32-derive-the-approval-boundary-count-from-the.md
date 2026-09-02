---
id: TASK-ruling-32-derive-the-approval-boundary-count-from-the
type: task
title: "ruling 32: derive the approval-boundary count from the registry, in both documents"
status: active
severity: soft
always: false
summary: Two guides state by hand how many commands can change things with nobody approving; work that number out from the code instead.
summary_of: 08e91c816202063c
scope: []
tags:
  - "plan:rulings"
  - "seq:32"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-21
valid_until: null
checksum: d0b95160e9486c01
plan: rulings
seq: "32"
state: done
priority: "1"
last_change: "2026-08-21T05:34:35Z"
progress: "100"
---

# ruling 32: derive the approval-boundary count from the registry, in both documents

**Ruled 2026-08-21.**

README section 7 says *"Eight CLI commands change what governs this project with no human in the loop"* and lists them, and the recommended deny rules repeat the set. Both documents carry it. **No test watches any of it.**

`inbox-promote` made it nine. It was caught only because the implementing agent went looking — and the trap it nearly sprang is worse than a stale number: `previewThenHandBack` emits *"it is on the deny list this plugin's README recommends"* into the generated `commands/*.md`, so shipping the plan as written would have printed that sentence **to the model** while it was false.

Derive the set from `COMMANDS` and hold both documents to it, the way `test/docs/counts.test.ts` already does for seven other numbers. That means deciding, in code, what makes a command a member: it mutates, and its confirmation can be satisfied without a human — which is what `--yes` is.

Also enforced: every member appears in the recommended deny list in **both** languages. The Hebrew occurrence of the ratio was already unwatched by any pattern in `counts.test.ts`.

Land the count for nine first, then the derivation, so the test is seen to go red before it goes green — a checker is not verified until it has been made red.
