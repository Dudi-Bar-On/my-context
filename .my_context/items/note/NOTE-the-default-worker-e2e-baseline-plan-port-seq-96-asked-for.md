---
id: NOTE-the-default-worker-e2e-baseline-plan-port-seq-96-asked-for
type: note
title: "the default-worker e2e baseline plan:port seq:96 asked for, measured 2026-09-02"
status: active
severity: soft
always: false
summary: Four quiet-machine e2e runs at default worker count show frequent, non-reproducing failures that all pass alone and at worker count one.
summary_of: 727dbfaad04ed916
scope: []
tags:
  - e2e
  - gates
  - port
  - "plan:port"
  - "seq:96"
origin: human
source_file: "C:/Users/UserC/AppData/Local/Temp/claude/D--Users-UserC-source-repos-test-mycontext-plugin/9e5b6b17-c186-4c93-a0a5-775b4eccd9e7/scratchpad/note-baseline-measurement.md"
source_anchor: null
source_checksum: 6da65c5697a9440e
valid_from: 2026-09-02
valid_until: null
checksum: 1e33110ccd37179d
---

# the default-worker e2e baseline plan:port seq:96 asked for, measured 2026-09-02

> # the default-worker e2e baseline `plan:port seq:96` asked for, measured 2026-09-02
>
> Four full `npm run test:e2e` runs at the default `workers: '20%'` (4 of 20 cores), headed, quiet machine:
>
> - **11 failed, 1 failed, 1 failed, 26 failed** — against 448/458/458/433 passed respectively.
> - **39 failures total; 0 reproduce alone; 39 of 39 pass at `--workers=1`.**
> - **36 distinct test×project pairs** among those 39. Pairwise overlap between runs: 0, 0, 2, 0, 0, 1. Only 3 members recurred, each exactly twice.
> - Runs 1–3 each printed failures and **exited 0** — the exit code is useless for this suite; read the summary line.
> - The named `database is locked` class is still live but rarer: **3 occurrences, all in one run**; **42** "never settled" / "never drew" / TimeoutError occurrences across the four runs.
> - The 8:2 `chrome` skew recorded on 2026-08-29 does **NOT reproduce** (run 4 was 14 chrome / 12 chromium).
> - The five specs taken off the contention list on 2026-08-29 (`pane-size`, `execute`, `app-refresh`, `tree-parity`, `served-shape`) were 62/62 clean in runs 1–3; two failed in run 4 and both passed alone. Neither cleared nor special.
> - `--workers=1` produced **0 failures in 200 re-runs** on this fixture (760 items, 2,312 audit records; the config docblock records 618 items pre-growth, +23%).
> - The pre-fixture comparison is **not measurable without a git checkout**: `.demo-corpus` is gitignored and built by `scripts/demo-corpus.ts`, so the pre-fixture corpus is an earlier revision of that script. A hand-built corpus would differ in CONTENT, and the specs assert on content, so its failures would be indistinguishable from contention. That is an honest negative result, not a gap.
>
> **What this settles and what it does not.** The load-varied result refutes "the fixture did it" as a COMPLETE explanation — concurrency is necessary to reproduce the failures — but it does not partition blame between the fixture and the contention. Both remain live; neither is closed by this measurement.
