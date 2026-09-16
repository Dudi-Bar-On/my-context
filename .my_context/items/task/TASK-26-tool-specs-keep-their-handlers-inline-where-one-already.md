---
id: TASK-26-tool-specs-keep-their-handlers-inline-where-one-already
type: task
title: 26 tool specs keep their handlers inline where one already moved out, and a 2050-line file bundles six sub-arcs
status: active
severity: soft
always: false
summary: The file holding every tool definition has been split into four, so the handlers no longer all sit in one place.
summary_of: 6b584c2daef66d25
summary_was:
  - 2026-09-16 Two large files hold many unrelated pieces each, in one case ignoring a split that was already started and in the other with no argument for staying whole.
scope:
  - src/mcp/tools.ts
  - src/core/handover-ask.ts
tags:
  - v2
  - accretion
  - refactor
  - "plan:accretion"
  - "seq:3"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: d6fb11ea18160399
plan: accretion
seq: "3"
state: done
priority: "3"
verified_on: 2026-09-16
---

# 26 tool specs keep their handlers inline where one already moved out, and a 2050-line file bundles six sub-arcs

Raised by report 5 (`reports/2026-09-13-what-could-be-removed-or-done-differently.md`, Simplify 3 and 4) as row 84 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT WAS MEASURED, two files:
- `src/mcp/tools.ts` is 2,728 lines holding about 26 tool specs with their handlers inline. `ingest_document` ALREADY had its logic pulled out to `src/mcp/tools/ingest.ts`; the other 25 did not follow.
- `src/core/handover-ask.ts` is 2,050 lines bundling six distinguishable sub-arcs, with NO docblock arguing they must be one file.

WHY BOTH SURVIVED REPORT 5'S SCEPTICISM. That review's own headline was that the recorded argument usually holds -- it recorded fifteen large or similarly-named files that STAY EXACTLY AS THEY ARE, each with its argument. These two have no argument: one has a precedent it did not follow, the other has no docblock at all.

RELATED: row 61 is an MCP capability gap in the same file, and row 62 is annotations for the same 26 specs -- both are easier in a file where a tool spec is a module.

── CLOSED 2026-09-16 BY THE RECONCILIATION, NOT BY THE LANE ────────────

DONE IN `aebc76f0`. `tools.ts` went 3,109 lines to 2,609 across four modules — `tools/args.ts`, `tools/audit.ts`, `tools/focus.ts` and `tools/rule-store.ts`, all four resolving under `git cat-file` at that commit.

THE TEST BOUNDARY WAS MEASURED RATHER THAN INHERITED, and that is the part worth keeping: across all fourteen `test/mcp/` files only THREE name a cuttable tool set, and `tools.test.ts` names all 28 and draws no boundary. So the tests do not support one file per spec and none was manufactured. Closed by the reconciliation in `rulings/93`.
