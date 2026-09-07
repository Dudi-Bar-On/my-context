# EXECUTION BOARD — RETIRED 2026-09-07

**This board is retired. Owner ruling, 2026-09-07: the handover is the single place.**

Do not add rows here. Do not read the waves below as current — they are in git
history (`git show b2f1e58:reports/EXECUTION-BOARD.md` is the last live
version, 2026-09-05).

## Where its two jobs went

**ORDER — to the product itself.** `mycontext ready [--plan <p>] [--held]`
computes what is dispatchable from the corpus' own `needs:` fields, highest
priority first. It cannot go stale, because it is not kept by hand. That is the
whole reason the board is retired: it was rewritten on 2026-09-05 to be "the
single place", declared that every new task must be added to it when filed, and
was then not touched again while forty-plus items were filed and fifteen closed.

**STATE and NARRATIVE — to `reports/V2-HANDOVER.md`**, which is written at every
percent and carries what happened, what was corrected, and what is next.

## What was verified before retiring it, because nothing may be forgotten

Every ref on the last live board was resolved against the corpus. **All of them
exist as items** — 63 refs across seven waves, none orphaned. Two rows carried
no ref at all and both were traced: the zero-data view is `rulings/26` (done),
and the UI fixture that reuses one item id is
`TASK-a-shared-item-id-across-ops-leaves-watch-model-test-ts` — **the one open
task in the whole corpus with NO `plan:` and no `seq:`**, which is why no board
built from plan and seq has ever shown it. It is the single thing this board was
holding that nothing else was.

## And retiring it found a defect of its own

`src/doctor/checks.ts` cited `reports/EXECUTION-BOARD.md:99` and
`reports/V2-HANDOVER.md:437` for a sentence about doctor findings declaring
their own remedies. **Both anchors had already rotted before this retirement.**
Line 99 held Wave 4's prose; line 437 holds last night's Playwright paragraph.
The citation now names the ITEM instead, which is addressed by id and cannot
drift.

**This generalises, and it is the argument for `walk/30`:** the handover is
PREPENDED to, so every line-anchored citation into it is invalidated by the next
write. If the handover is the single place, nothing may cite it by line.
