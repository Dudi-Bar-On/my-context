---
id: TASK-five-cli-refusals-name-no-route-out-while-the-same-question
type: task
title: five CLI refusals name no route out, while the same question measured across the UI came back the other way
status: active
severity: soft
always: false
summary: Five refusals in the terminal tell you no on its own, although the same product does this well everywhere it was measured on the screen.
summary_of: 26eda4a55af48ec1
scope:
  - src/cli/**
tags:
  - v2
  - cli
  - refusal
  - unblocking-condition
  - "plan:walk"
  - "seq:162"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 05fdfcb289dc7d6b
plan: walk
seq: "162"
state: todo
priority: "2"
---

# five CLI refusals name no route out, while the same question measured across the UI came back the other way

FOUND BY TWO REVIEWS, AND MEASURED THE OPPOSITE WAY BY A THIRD -- both halves are kept here because the contradiction is the useful part. Row 68 of `reports/2026-09-13-the-consolidated-findings.md`.

THE MISSES. Report 6 (`reports/2026-09-13-store-cli-mcp-and-gates-reviewed.md`, C7) found five CLI refusals that name no route out, against this repository's own `RULE-a-refusal-states-its-unblocking-condition`. Report 3 (M23) found the rule-store refusal whose advertised remedy is unreachable -- that is row 44, filed separately because its audience is a model rather than a person.

AND THE OPPOSITE RESULT, WHICH MUST NOT BE LOST. Report 1 (`reports/2026-09-12-the-ui-reviewed-as-a-user.md`) measured the SAME question across the UI and found the reverse: the 401, the budget refusals, the Composer and the scope gate ALL name what would unblock them. It called this project's reputation for the defect "out of date", and both UI reviews listed the refusal and empty-state copy among the best things in the product.

SO THE WORK IS NARROW AND THE FRAMING MATTERS. Five named CLI sites, not a campaign; and the UI is the worked example to copy from, not another surface to audit.
