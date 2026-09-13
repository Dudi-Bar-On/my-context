---
id: TASK-26-tool-specs-keep-their-handlers-inline-where-one-already
type: task
title: 26 tool specs keep their handlers inline where one already moved out, and a 2050-line file bundles six sub-arcs
status: active
severity: soft
always: false
summary: Two large files hold many unrelated pieces each, in one case ignoring a split that was already started and in the other with no argument for staying whole.
summary_of: 84d7aef586cc869b
scope:
  - src/mcp/tools.ts
  - src/core/handover-ask.ts
tags:
  - v2
  - accretion
  - refactor
  - "plan:accretion"
  - "seq:3"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 98d47a740c0a1be3
plan: accretion
seq: "3"
state: todo
priority: "3"
---

# 26 tool specs keep their handlers inline where one already moved out, and a 2050-line file bundles six sub-arcs

Raised by report 5 (`reports/2026-09-13-what-could-be-removed-or-done-differently.md`, Simplify 3 and 4) as row 84 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT WAS MEASURED, two files:
- `src/mcp/tools.ts` is 2,728 lines holding about 26 tool specs with their handlers inline. `ingest_document` ALREADY had its logic pulled out to `src/mcp/tools/ingest.ts`; the other 25 did not follow.
- `src/core/handover-ask.ts` is 2,050 lines bundling six distinguishable sub-arcs, with NO docblock arguing they must be one file.

WHY BOTH SURVIVED REPORT 5'S SCEPTICISM. That review's own headline was that the recorded argument usually holds -- it recorded fifteen large or similarly-named files that STAY EXACTLY AS THEY ARE, each with its argument. These two have no argument: one has a precedent it did not follow, the other has no docblock at all.

RELATED: row 61 is an MCP capability gap in the same file, and row 62 is annotations for the same 26 specs -- both are easier in a file where a tool spec is a module.
