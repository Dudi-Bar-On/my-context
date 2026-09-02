---
id: DEC-the-browser-suite-goes-green-on-a-two-phase-gate-default
type: decision
title: "the browser suite goes green on a two-phase gate: default workers, then only the failures one at a time"
status: active
severity: soft
always: false
summary: The browser test suite counts as passing if an automatic rerun of just its failures, one at a time, passes; whatever still fails is a real defect.
summary_of: 88f4b43b23db4a45
scope: []
tags:
  - e2e
  - gates
  - port
  - "plan:port"
  - owner-ruling
  - testing
origin: human
source_file: "C:/Users/UserC/AppData/Local/Temp/claude/D--Users-UserC-source-repos-test-mycontext-plugin/9e5b6b17-c186-4c93-a0a5-775b4eccd9e7/scratchpad/r4.md"
source_anchor: null
source_checksum: cdcc738a08fdd16d
valid_from: 2026-09-02
valid_until: null
checksum: 2772318a327f2d2b
---

# the browser suite goes green on a two-phase gate: default workers, then only the failures one at a time

> OWNER RULING, 2026-09-02. This answers the decision the port plan asked for and did not have the standing to make itself.
>
> **THE GATE.** The e2e suite is GREEN if the default-workers run passes, OR if `--last-failed --workers=1` passes. Phase 2 runs only when phase 1 is red. Anything that still fails phase 2 is a REAL DEFECT and gets its own item - it is never absorbed back into a contention list.
>
> **THE MEASURED COST.** Phase 2 on top of a red phase 1 adds 2.9 minutes to 13.7 at the worst observed red, about 21%, and is paid only when the suite is already red. The alternative of a full one-worker gate costs roughly 27 minutes on every run, red or green.
>
> **THE HONEST OBJECTION, which belongs in the record rather than in a footnote.** A two-phase gate TOLERATES contention rather than fixing it, and `playwright.config.ts` argues against exactly that, by name, in the file. The objection is correct as far as it goes.
>
> **THE DEFENCE.** Phase 2 PUBLISHES the contention set on every run. What it replaces is a hand-kept list of flaky specs drawn from a single run, which names the wrong specs by the next run and cannot tell anyone it has gone stale. A derivation that regenerates itself every time cannot go stale; a list somebody maintains always does. So the choice is not between tolerating contention and fixing it - it is between tolerating it visibly and tolerating it invisibly.
>
> **THE DECISION IS MADE AND THE IMPLEMENTATION IS NOT.** The task that asked for this ruling stays open. It now has its answer, and it still needs the gate actually changed.

## Observations
- [note] Phase 2 runs only when phase 1 is red, and costs about a fifth more time on an already-red run.
- [note] A full one-worker gate would cost roughly twice the time on every run, red or green.
- [note] The objection stands in the record: this tolerates contention, and the browser config argues against that by name.
- [note] The defence: phase 2 republishes the true failing set every run, so no hand-kept list can go stale.

## Relations
- derived_from [[TASK-decide-whether-e2e-goes-green-on-a-two-phase-default-workers]]
