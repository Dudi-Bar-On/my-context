---
id: TASK-three-checks-enforce-this-repository-s-own-conventions-on-a
type: task
title: three checks enforce this repository's own conventions on a stranger's project
status: active
severity: soft
always: false
summary: Three health checks apply habits that belong only to this project, so a newcomer is told their own perfectly normal layout is wrong.
summary_of: 84544a87b6694dd1
scope:
  - src/doctor/checks.ts
tags:
  - v2
  - doctor
  - consumer-install
  - "plan:dxfindings"
  - "seq:4"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 8b142130530571d4
plan: dxfindings
seq: "4"
state: todo
priority: "2"
---

# three checks enforce this repository's own conventions on a stranger's project

Raised by report 6 (`reports/2026-09-13-store-cli-mcp-and-gates-reviewed.md`, G3) as row 69 of `reports/2026-09-13-the-consolidated-findings.md`. THREE CONSUMER-REPO TRAPS IN `checks.ts`, each one this repository's own convention shipped as a universal rule:

- `citation_form` enforces THIS project's `file . fragment` convention on a stranger's prose.
- `isServableDocPath` hard-codes `docs/` and `reports/`.
- `FIXTURE_DIRS` misses `__fixtures__`, `spec/` and `e2e/`, so a consumer's own fixture directory is reported as a nested corpus.

THE CONSEQUENCE. A newcomer's first `doctor` run accuses their repository of breaking rules that belong to ours. Together with row 17's hard-coded cutoff, the first impression of this product in a strange install is a wall of findings about the install's failure to be this repository.

NOT ASSESSED BY ANYBODY, and it belongs in the first step of this work: nobody ran `mycontext init` on a throwaway workspace and drove a door through it. Every consumer-install finding in the consolidation, rows 13, 17 and 69, is source-and-render derived.
