---
id: NOTE-reconciliation-batch-4-plan-port-nine-open-tasks-verdicted
type: note
title: "reconciliation batch 4: plan:port, nine open tasks verdicted"
status: active
severity: soft
always: false
summary: A fourth batch of open work read, settling the order to do it in and catching a claim the product was making on screen without ever checking it.
summary_of: 4bf5f95e1c2f1052
summary_was:
  - 2026-09-03 A fourth batch of open work read, settling the order to do it in and turning up a claim the product makes on screen without ever checking it.
acknowledged:
  - citation_form@de7d10d9c79ec145
scope: []
tags:
  - v2
  - ui
  - reconciliation
  - "plan:walk"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-25
valid_until: null
checksum: 58b6e2e855ec76cb
---

# reconciliation batch 4: plan:port, nine open tasks verdicted

plan:walk seq:23, 2026-08-25.

  95  TREE parity     DONE        it ended at the inventory, reviewed -- as written
  5c  Docs README     SUPERSEDED  by walk/25 (route) and walk/24 (content)
  94  the fixture     STANDS      UNBLOCKED, and raised to priority 1
  93  PIXEL parity    STANDS      dependency on 94 is real, not stale
  5d  tutorial state  REFINES     walk/24, and holds the best argument for it
  6   the strip       STANDS      SPLITS IN TWO -- one half is buildable today
  14  three rulings   STANDS      reduced to two; one was answered and not applied
  98  the walk        STANDS      deliberately; three conditions, one met
  99  real corpus     STANDS      terminal by ruling

THE ORDER THIS SETTLES, and it was not the order anyone was working in: 94, then 93, then 98, then 99.

FINDING ONE, AND IT IS THE BIGGEST OF THE RECONCILIATION SO FAR. `plan:port seq:94` -- build the fixture so it mirrors the mockup s own scene -- has been unblocked since seq:95 closed and nobody went back. It is the fix for a failure this project has now hit FOUR TIMES in three days: decay s heatstrip called the worst screen on the board when it was built; preview s carried block filed as a code gap when `preview.js` · `ctx.t('index.carriedFetch')` · ~1486 builds it; watch s empty pulse indistinguishable from a failed chart; three screens drawing nothing because the fixture held no drafts, procedures or packs. Every one cost a real investigation. Two nearly cost a rebuild of working code. Raised to priority 1.

FINDING TWO, A NEW DEFECT NOT PREVIOUSLY RECORDED ANYWHERE. The status strip s context group renders `strip.ctx.noBridge` UNCONDITIONALLY at `app.js` · `noBridge.append(...translate(table.strings, 'strip.ctx.noBridge'));` (gone 2026-09-03) -- it never asks. But `ui3 seq:4` and `seq:5` are DONE, `core/statusline-tee.ts` writes the sample, `watch-model.ts` · `context: classifyContext(tee.payload),` · ~405 reads it, and `/api/watch/context` IS REGISTERED and serves it. So the strip tells every user the status-line bridge is not installed, including the ones who installed it. A provenance bar asserting an unchecked fact is the exact defect that bar exists to prevent -- and it is the same shape as the Tutorials screen s twelve hard-coded checkmarks, one of which is true of no file on disk.

FINDING THREE. `port seq:14` carried three rulings and one had already been answered by a later general ruling nobody came back to apply: the owner s "more than the mockup is usually right" of 2026-08-25 settles ask s two extra element kinds. THE APP IS RIGHT. This is what the precedence order is for -- a later decision overriding an earlier open question, in a different plan, which no query would have connected.
