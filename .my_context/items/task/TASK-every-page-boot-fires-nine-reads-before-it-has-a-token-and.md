---
id: TASK-every-page-boot-fires-nine-reads-before-it-has-a-token-and
type: task
title: every page boot fires nine reads before it has a token and records nine refusals
status: active
severity: soft
always: false
summary: The app makes nine requests before it is allowed to, so every page load is refused nine times and the activity log fills with its own failures.
summary_of: 8544fb5b31e9c261
scope: []
tags:
  - v2
  - ui
  - audit
  - walk
  - "plan:walk"
  - "seq:85"
  - "state:done"
origin: human
source_file: "C:/Users/UserC/AppData/Local/Temp/refused.md"
source_anchor: null
source_checksum: f65a9536ad1558b0
valid_from: 2026-08-29
valid_until: null
checksum: b461c55294a1aba1
plan: walk
seq: "85"
state: done
priority: "1"
source: "measured by plan:walk seq:84, 2026-08-29"
---

# every page boot fires nine reads before it has a token and records nine refusals

> > Measured 2026-08-29 by `plan:walk seq:84` while chasing e2e contention. It is not a test defect. It is a product defect that the test suite happened to amplify until it was visible.
>
> **What happens**
>
> Every page boot fires the shell's reads — `/api/meta`, `/api/status`, `/api/sessions`, `/api/watch/volume`, `/api/watch/stream`, `/api/select`, `/api/simulate`, `/api/items`, `/api/coverage` — **before the nonce handoff has produced a token**. The gate refuses each one with `401 token-missing` or `403 token-mismatch`, and every refusal is recorded: `recordRefusal` → `recordAudit` → `keepProjectionCurrent`, which is a `BEGIN IMMEDIATE` write.
>
> **About nine projection writes per page load, and they are all of failures.**
>
> **The volume, on both corpora**
>
>     .demo-corpus   5,207 ui-refused   vs 349 update, 257 execute
>     LIVE corpus      899 ui-refused   — 17% of the whole audit log
>
> This is not a fixture artefact. **Seventeen per cent of the owner's real audit history is the app refusing its own boot requests.**
>
> **What it costs**
>
> 1. **The audit log is one-sixth noise.** Every query, report and projection over it carries that weight, and a reader scrolling the Ask screen sees bursts of ten `ui-refused` rows where a page was opened.
> 2. **It is the e2e suite's remaining contention.** Four workers boot pages while three siblings read the same `audit.db` through `openProjectionReadOnlyChecked`, which deliberately sets **no `busy_timeout`** and throws rather than waits. The loser renders `database is locked` / `disk I/O error` into whichever card was mid-fetch. Removing these writes would delete ~5,200 of that corpus's ~6,100 records.
> 3. **Every boot does work twice** — nine requests refused, then nine repeated.
>
> **Two independent fixes, and they are not alternatives**
>
> * **`src/ui/public/app.js`** — do not fire the shell's reads until the handoff has a token. This is the real fix: it removes the writes rather than tolerating them.
> * **`src/core/audit-db.ts`** — let the read-only door wait instead of throwing. This is worth doing regardless: a reader that throws instead of waiting turns any concurrent write into a rendered error, and the deliberate absence of `busy_timeout` deserves re-examination now that a second writer is known.
>
> **Done when**
>
> A page boot records zero `ui-refused` for its own reads; a browser test asserts the count across a boot rather than the absence of a string; and the read door's behaviour under a concurrent write is decided deliberately and documented either way.
