---
id: TASK-deliveratdoor-returns-whether-it-recorded-the-delivery-and
type: task
title: deliverAtDoor returns whether it recorded the delivery and both doors drop the answer
status: active
severity: soft
always: false
summary: A component reports whether it managed to write its record, says in writing that the caller must pass that on, and both callers throw the answer away.
summary_of: 7855a17e5c9c87b2
scope:
  - src/rules/delivered.ts
  - src/hooks/**
tags:
  - v2
  - core
  - store
  - silent-failure
  - "plan:unread"
  - "seq:2"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 40fa6151704ed28e
plan: unread
seq: "2"
state: todo
priority: "2"
---

# deliverAtDoor returns whether it recorded the delivery and both doors drop the answer

FOUND INDEPENDENTLY BY TWO REVIEWS. Report 3 (`reports/2026-09-12-silent-failures-reviewed.md`, M2) traced it; report 6 (`reports/2026-09-13-store-cli-mcp-and-gates-reviewed.md`) names it in its own "What I could not assess" section and credits report 3 for finding it. Row 32 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT WAS MEASURED. `deliverAtDoor` returns `recorded: boolean`, and `delivered.ts` · the contract comment on `deliverAtDoor` (line 159) documents the contract in so many words -- "the caller discloses, this module does not". BOTH DOORS END `}).text;`. `grep -rn "\.recorded"` finds no consumer anywhere.

THE CONSEQUENCE, and it is a contradiction the product prints at itself. With the rule store's log unwritable, the rules WERE delivered and nothing says the record of that failed; later in the same session `assertDoor` prints "this session has no record of the product rule store being delivered to it".

THE CLASS. This is report 3's pattern P2: a function computes whether it succeeded, returns that answer honestly, documents that the caller must disclose it, and the caller drops it on the floor.
