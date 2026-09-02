---
id: TASK-ruling-2-amended-scope-the-no-writes-ban-to-src-ui-and-add-a
type: task
title: "ruling 2 amended: scope the no-writes ban to src/ui/ and add a runtime no-write proof"
status: active
severity: soft
always: false
summary: Prove the read-only screens cannot change anything, both by what they are allowed to use and by checking nothing on disk moved after a run.
summary_of: 5f3d93281dbcf82b
scope: []
tags:
  - "plan:rulings"
  - "seq:11"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-20
valid_until: null
checksum: d12bfa2ca76fe170
plan: rulings
seq: "11"
state: done
progress: "100"
priority: "1"
source: "reports/V2-HANDOVER.md#twelve-owner-rulings"
last_change: "2026-08-20T13:11:01Z"
---

# ruling 2 amended: scope the no-writes ban to src/ui/ and add a runtime no-write proof

OWNER AMENDMENT, 2026-08-20. The whole-graph symbol ban was red on day one by guilt by co-location — focus.ts and seen-file.ts each hold a reader the UI needs beside a writer it does not, and readFocus/readSeen write nothing.

Two halves. (a) STATIC, Task 14: no module under src/ui/ or its re-export reach may BIND a write symbol. Importing readFocus passes; importing setFocus fails. (b) RUNTIME, Task 13's spawned-process E2E: snapshot the corpus, exercise every read route, assert byte-identical afterwards.

Both, because a static import walk can only prove the UI does not BIND a writer — never that it does not write. A read that writes internally is invisible to it, and that class is real here: Store.open self-heals on corruption.

Still binding: re-export chains resolve to the defining module; export * and import * as refused inside the graph; require( and dynamic import( refused; and the test MUST be proven red against a deliberate appendJsonlLine import three ways — direct, renamed, and laundered through a re-exporting module.
