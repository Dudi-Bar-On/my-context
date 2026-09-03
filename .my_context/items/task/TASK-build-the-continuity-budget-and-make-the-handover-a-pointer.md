---
id: TASK-build-the-continuity-budget-and-make-the-handover-a-pointer
type: task
title: build the continuity budget, and make the handover a pointer that fits it
status: active
severity: soft
always: false
summary: Give handover notes their own allowance and shrink the note to a pointer, because today it is far too large ever to reach a session.
summary_of: c4e209157a2ccd30
acknowledged:
  - state_unaudited@817c0d35fcd56c16
scope: []
tags:
  - v2
  - selection
  - continuity
  - "plan:live"
  - "seq:9"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-28
valid_until: null
checksum: d1e19ff3829c8900
plan: live
seq: "9"
state: done
priority: "1"
source: owner, 2026-08-28
---

# build the continuity budget, and make the handover a pointer that fits it

> Implements `DEC-continuity-gets-its-own-budget-and-the-item-it-holds-must-be`, which carries the measurement, the reasoning and both halves of the owner's ruling. Read it first.
>
> In one line: **the handover has never been injected on any event — it is a single index line and costs 37,831 tokens, 2.4x the largest budget in force.** The fix is a fifth budget whose content is bounded by construction.
>
> ## Two deliverables, and the second is worthless without the first
>
> **1. A fifth budget.** `Budgets` declares exactly four keys and `requireBudgets` REFUSES an unknown one by name — measured, it throws *"which are not budgets this config understands"* — so this is not a config edit. It reaches, at minimum:
>
> * `core/config.ts` — `Budgets`, `DEFAULT_BUDGETS`, `requireBudgets`
> * `core/select.ts` — the tier union (`:57`), the run order (`:907`), the tier list (`:917`), and the tier's own predicate
> * `core/budgets-write.ts` — its field list, which the UI's budget write validates against
> * the preview ribbon's four tracks (`screens/preview.js`) and the simulator's tier picker and sweep
> * `docs/design/web-ui-mockup.html` — the design of record, edited FIRST, app following
> * both string tables, with `{m:...}` markers in the Hebrew copy or `e2e/bidi.spec.ts` fails on a run-count mismatch
>
> **2. The handover item becomes a pointer plus a bounded digest.** It names `reports/V2-HANDOVER.md`, says to read it before changing the web UI, and carries the current state — what landed, what is open, what is ruled — in a form that fits the budget. The 37,831-token document stays on disk and is read on demand, which is already what happens.
>
> Deliverable 1 without 2 is a tier that delivers for some weeks and then silently stops: the document grew ~4,000 tokens on 2026-08-28 alone, so any budget chosen today expires. That is the failure this tier exists to prevent, arriving later and harder to see.
>
> ## Dedupe against what the window already holds — the owner, same day

*"you could also dedupe it if already in context."*

**Do not invent a mechanism for this: the corpus already has one.** The `seen` ledger records what was injected, `restoredFor(seenState, snapshot.capturedAt)` filters ids already restored for a snapshot, and `seen` is rung 5 of the preview's own gate ladder — the one rung the header notes cannot be answered from item state alone. Continuity is exactly the shape that ledger was built for: a thing that must arrive once per context window and must not be re-sent on every event inside it.

Two cases the implementation must keep apart, because they look identical and are not:

* **Within one window** — already delivered, do not send again. This is the owner's point and the ledger answers it directly.
* **After a compact** — the window was REBUILT, so what it "already holds" is gone. `compact-restore` exists precisely because the previous window's contents do not survive, and continuity must be re-delivered there even though the ledger has seen it. `restoredFor` is keyed on `snapshot.capturedAt` for this reason; use that, do not compare on id alone.

Getting this backwards fails silently in the worse direction: a continuity item deduped across a compact is a session that starts over with nothing, which is the exact failure the tier exists to prevent.
