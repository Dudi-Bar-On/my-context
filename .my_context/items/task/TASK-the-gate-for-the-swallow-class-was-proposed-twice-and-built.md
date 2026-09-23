---
id: TASK-the-gate-for-the-swallow-class-was-proposed-twice-and-built
type: task
title: the gate for the swallow class was proposed twice and built never, so the twelve instances have no successor guard
status: active
severity: soft
always: false
summary: The instances of one defect are being repaired one at a time, and nothing stops the thirteenth being written tomorrow.
summary_of: e215510a3a3e0b9a
scope:
  - scripts/**
  - test/**
tags:
  - v2
  - gates
  - silent-failure
  - "plan:swallow"
  - "seq:15"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-15
valid_until: null
checksum: a4bcca60f9dc2b30
plan: swallow
seq: "15"
state: done
priority: "2"
---

# the gate for the swallow class was proposed twice and built never, so the twelve instances have no successor guard

DROPPED BY THE CONSOLIDATION, AND THIS ITEM IS THE RECOVERY. Report 3 (`reports/2026-09-12-silent-failures-reviewed.md`) closed its pattern P1 by proposing a GATE. The consolidation carried every INSTANCE into D66 and carried the gate nowhere. Found 2026-09-15 by the audit at `rulings/90`; verified absent by scanning `scripts/check-*.ts` and `test/` for any check that reads catch blocks - there is none.

WHAT REPORT 3 PROPOSED, quoted: "The gate this project would build for it: a check that every `catch` wrapping an `fs` read either rethrows, inspects `.code`, or names the directory it could not read. That is testable, it is the shape of gate this repo already builds (`check-basis`, `check-retired`, `no-writes`), and IT WOULD HAVE CAUGHT B2, B5, B6, M5, M15 AND HALF THE MINORS."

THE MEASUREMENT THAT MAKES IT CHEAP, also report 3: the discipline already exists in twelve files - `code-identity.ts` keeps an ABSENT set, and `imported-audit.ts`, `jsonl-log.ts`, `focus.ts`, `continuity.ts`, `ledger.ts`, `session-names.ts`, `window-state.ts`, `revision.ts`, `seen-file.ts`, `ingest/session.ts` and `help/index.ts` all discriminate. "15 sites do; 145 do not. This is an inconsistency, not an unknown - which makes it mechanical to close."

WHY IT MATTERS NOW RATHER THAN WHEN D66 IS DONE. Eight of the twelve D66 items are already closed. When the last four close, the subject reads finished and the only thing that made the class findable - a review - will not run again. A gate is what makes the thirteenth instance cost nothing to find.

AND IT MUST NOT BE BUILT AS AN ALLOW-LIST. `rulings/85` is the standing rule for exactly this kind of scanner: a scanner enumerates what it will SKIP, not what it will scan. A gate over `src/**` with a named exception list is the shape; a gate over a list of directories somebody keeps by hand is the defect it is about.
