---
id: TASK-decide-whether-e2e-goes-green-on-a-two-phase-default-workers
type: task
title: decide whether e2e goes green on a two-phase default-workers-then-last-failed gate
status: active
severity: soft
always: false
summary: An owner needs to decide whether the browser test suite should pass on a second automatic rerun of only its failures before being called broken.
summary_of: e03e878e09e3455b
scope: []
tags:
  - e2e
  - gates
  - port
  - "plan:port"
  - "state:done"
origin: human
source_file: "C:/Users/UserC/AppData/Local/Temp/claude/D--Users-UserC-source-repos-test-mycontext-plugin/9e5b6b17-c186-4c93-a0a5-775b4eccd9e7/scratchpad/task-two-phase-gate.md"
source_anchor: null
source_checksum: d1e293bb45423427
valid_from: 2026-09-02
valid_until: null
checksum: 6cd28ee4bd674026
state: done
plan: port
verified_on: 2026-09-04
---

# decide whether e2e goes green on a two-phase default-workers-then-last-failed gate

> # decide whether e2e goes green on a two-phase gate
>
> `plan:port seq:96` measured the default-worker e2e baseline (four full runs, 39 failures total, 0 reproducing alone, 39 of 39 passing at `--workers=1`) and settled that the hand-kept contention list from 2026-08-29 should not exist: a list drawn from one run names the wrong specs by the next, and the derivation already exists — `--last-failed --workers=1` regenerates the true failing set every run and cannot go stale.
>
> What port/96 did NOT decide, because it is not port/96's call, is whether the suite's gate should change to use that derivation. This item is that decision.
>
> **The proposal.** Adopt a two-phase e2e gate: green iff phase 1 (default workers) is green, OR phase 2 (`--last-failed --workers=1`, run only when phase 1 is red) is green. Anything that still fails phase 2 is a real defect and gets its own item — not absorbed back into a contention list.
>
> **Measured cost.**
> - Phase 2 on top of a red phase 1: **+2.9 min on top of 13.7 min at the worst observed red, roughly 21%**, paid only when phase 1 is red.
> - A full `--workers=1` gate every run instead: roughly **27 min every run, about 2.5x** the default-worker time.
>
> **The honest objection.** A two-phase gate tolerates contention rather than fixing it, and `playwright.config.ts` argues against that by name. The defence: phase 2 publishes the true failing set every run instead of hiding it behind a hand-kept list, which is the failure mode port/96 just closed out.
>
> This needs an owner ruling — it is a policy choice about what "green" means for this suite, not a further measurement.
