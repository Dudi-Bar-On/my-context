---
id: TASK-the-watch-token-bar-has-no-honest-single-denominator-and
type: task
title: the watch token bar has no honest single denominator, and watch.voidn can only name one number
status: active
severity: soft
always: false
summary: A cost bar has nothing honest to measure each row against, so every bar is drawn against a total no row could ever reach.
summary_of: 6bc32f73d5fd9562
scope: []
tags:
  - "plan:ui3"
  - "seq:11x"
  - "state:todo"
  - v2
  - ui
origin: human
source_file: null
source_anchor: null
source_checksum: 17901470e17ecd5d
valid_from: 2026-08-22
valid_until: null
checksum: ea1f35a7c63edd3a
plan: ui3
seq: 11x
state: todo
---

# the watch token bar has no honest single denominator, and watch.voidn can only name one number

> `watch.voidn` says an injection row "carries a gold bar of its cost against the {budget}-token budget", and the spec says the same — "the bar is the record's cost against the tier budget". One number, for every row.
>
> But an `AuditRecord.tokens` is "the sum of the chars/4 estimates the selector charged its BUDGETS" across every tier that ran, and no field on the record says which tiers those were. The tiers differ per event: a SessionStart injection draws on `pinned` + `index`, a PreToolUse injection on `jit`.
>
> `screens/watch.js` uses the SUM of the resolved tier budgets, because it is the only single number that is true of every row — no injection can exceed it. The cost is visible: this corpus budgets 16000/16000/24000/6000, so the sum is 62,000 and a 12,232-token `jit` injection draws a bar at 20% where the same record against `jit`'s own 16,000 would draw 76% — which is what the mockup shows (4,260 of 6,000). Compare `my-context/reports/2026-08-22-ui3-11-watch/watch-live-1568x779.png` with `mockup-watch-1568x779.png`.
>
> Two ways out, and the owner picks: derive the denominator PER ROW from the tiers named in `record.injected` (truest bar, and `watch.voidn` then needs rewording because it can no longer name one number), or have the record carry the budget it was charged against.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: STANDS -- an owner ruling, and it is the last one on the Audit stream.

Nothing since 2026-08-22 has touched it. The walk confirmed the consequence from the other side: div.tokbar and div.nt are still in the watch entry of KNOWN_GAPS, and the walk recorded them as "the known ui3 11x task", which is this one.

The choice is unchanged and is genuinely the owner s, because the two answers say different things about what an audit record IS: derive the denominator per row from the tiers named in record.injected -- the truest bar, and watch.voidn then needs rewording because it can no longer name one number -- or have the record CARRY the budget it was charged against, which makes the record self-describing and is a log-format change.

ONE THING THE RECONCILIATION ADDS: the second option touches the append-only audit log, whose format is governed by a requirement. A format change there is a bigger decision than the bar it fixes, and that is worth saying before the owner picks.
