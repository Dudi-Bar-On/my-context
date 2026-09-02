---
id: TASK-the-ledger-projection-is-behind-by-construction-and-it-is-a
type: task
title: the ledger projection is behind by construction, and it is a different store from the audit one
status: active
severity: soft
always: false
summary: A second set of derived records is never updated as work happens, so it stays out of date until somebody runs one of three commands.
summary_of: 61f09cdf7b23375f
scope: []
tags:
  - v2
  - corpus
  - audit
  - "plan:walk"
  - "seq:66"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-28
valid_until: null
checksum: 317f365ca41bff1b
plan: walk
seq: "66"
state: todo
priority: "2"
source: "found by plan:walk seq:28, 2026-08-28"
---

# the ledger projection is behind by construction, and it is a different store from the audit one

> Established empirically by `plan:walk seq:28` while fixing the audit projection, 2026-08-28. **Not assumed by analogy — measured.**
>
> **The measurement**
>
> Five injection records appended; ledger rows for that session: **0**. `topUpLedger` then applies all five.
>
> `ledger.record` and `ledger.recordRestored` are called from exactly one place — `topUpLedger` — which is itself called only by `mycontext audit`, `status` and `decay`. **Nothing on the write path, and no hook.** So the ledger projection is behind its source from the moment a record is written until someone runs one of three commands.
>
> That is the same defect `seq:28` just closed for the audit projection, in a second store.
>
> **Why `seq:28` did not fix it, and the reasons are good ones**
>
> * **A different store with a different owner.** The ledger lives in `.index.db`; the audit projection is its own database. `plan:rulings seq:26` already owns the ledger's empty-state rendering, so a fix here has to be reconciled with that rather than landed beside it.
> * **It is worse-positioned than the audit projection was.** `.index.db` is the database this product actively invites a user to delete — `Store.open` self-heals it with `rmSync`. A projection that must be current, living in a file whose recovery story is "delete it", is a design question and not a patch.
> * Fixing it would mean opening `.index.db` on the append path, which is a new coupling on the hottest path in the product. `seq:28` measured the audit projection's own cost at ~2.3 ms flat; nothing equivalent has been measured for `.index.db`, and it must be before this is attempted.
>
> **What this means today, stated so it is not discovered**
>
> The Decay screen and the Ledger read a projection that is stale by construction between `mycontext audit` runs. Whatever they show is as fresh as the last time one of those three commands ran — which nothing on the screen says.
>
> **Before building anything, settle this**
>
> Is the ledger projection supposed to be current, or is it a batch artefact that is honest about being one? Those are different products. The audit projection was clearly meant to be current — a read surface refusing with a 503 proves someone thought so. The ledger has no such refusal, which may mean nobody has decided, or may mean it was always understood as batch.
>
> **Done when**
>
> The question above is answered and recorded; if the answer is "current", the cost of updating `.index.db` on the append path is measured before any code is written, and the interaction with `.index.db`'s delete-and-self-heal recovery is settled; if the answer is "batch", the screens that read it say how fresh it is.
