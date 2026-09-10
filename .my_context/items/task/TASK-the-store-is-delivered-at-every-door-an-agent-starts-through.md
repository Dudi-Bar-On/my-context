---
id: TASK-the-store-is-delivered-at-every-door-an-agent-starts-through
type: task
title: the store is delivered at every door an agent starts through, and the delivery is recorded
status: active
severity: soft
always: false
summary: The product rules reach every worker that starts, and the system can prove they arrived rather than assume it.
summary_of: 2f8dd00923d612c1
scope:
  - src/rules/**
  - src/hooks/**
  - test/rules/**
tags:
  - v2
  - store
  - "plan:store"
  - "seq:2"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-10
valid_until: null
checksum: 39cc901cb8d51564
plan: store
seq: "2"
state: todo
priority: "1"
needs: store/1
---

# the store is delivered at every door an agent starts through, and the delivery is recorded

D41 PHASE 2. Plan: docs/superpowers/plans/2026-09-10-d41-product-rule-store.md Tasks 6-8. Design: docs/superpowers/specs/2026-09-10-product-rule-store-design.md section 8.

NOTHING CAN INSPECT A CONTEXT WINDOW, so "verify it is in memory" is not the deliverable. What is
verifiable is that we injected at every door and none was missed: each injection is RECORDED and a
later hook ASSERTS the session has had one.

THE DOOR THAT CARRIES THE WEIGHT IS SUBAGENT-START, measured over 36,024 audit records: 1,082
subagent-start against 54 session-start. A design guarding only session start guards the rarest
event - and "pinned therefore delivered" is already measurably false, which is what this phase
exists to stop being true of the store as well.

Precedence lands here too: a product entry wins a conflict AND the conflict is reported, because a
silent win teaches a reader their own rule is being obeyed when it is not.
STD-the-precedence-order-when-four-sources-of-truth-disagree gains a fifth source in the same act.
