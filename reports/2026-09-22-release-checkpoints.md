# 2.0.0 release — the checkpoint log

**Prepended to, newest first.** This file is the durable record of where the release stands;
the board (`mycontext ready`) is the state, `docs/superpowers/plans/2026-09-22-v2-0-release.md`
is the plan, and this is the log. After a compaction, the last entry here is the current phase.

Cite an item by id, never this file by line number — every line number here moves on the next
write (`RULE-a-citation-names-an-item-by-id-never-a-report-by-line-number`).

---

```
CHECKPOINT 0 — the plan and the phase items
commit: 32b9c93d pushed: yes
ran:  npm test → 8956 tests, 8953 pass, 0 fail, 3 skipped, exit 0   verify:citations → exit 1 (26 broken documentation citations, B2)   doctor → exit 1 (2 source_missing errors, B1)   check:* → all 0 (eleven scripts; check:diagrams is the eleventh)   test:e2e → not this phase
CI:   windows not triggered  ubuntu not triggered  — ci.yml runs on push to master and on pull_request only; no PR exists for release/2.0.0 and no run has ever been recorded for it
board: 155 → 165 (the ten release phase items, release/1 … release/10; nothing else moved)
closed: none
filed for 2.0: none
ideas awaiting the owner: none
blocked on the owner: how CI runs for this branch — see the note below
next: phase 1 — the repository tells the truth
```

**Acting on:** OWNER ANSWERS A–H exactly as given on 2026-09-21; no line was changed before pasting.

**Measured before the plan was written, not copied from the runbook** (each a one-line command,
recorded in the plan under "The board as measured"):

- 155 open tasks: 151 ready, 4 held (`walk/18`, `docsys/11`, `port/99`, `port/98`),
  `semantic/10` in `state: doing` with no lane alive (an orphaned claim; phase 7 resets it).
- Runbook §7.1 "done but not marked" is **14** open ids, not 18 and not the prompt's 17:
  `rulings/109`, `rulings/112`, `rulings/113` are already `state=done`, and `ui2/10p` and
  "`TASK-the-palette-does-not-offer…`" are one item listed twice. §7.2 is exactly 11.
  Phase 2 takes the board 155 → 130.
- Every one of the 155 is reached by exactly one phase. The 20 ids the prompt never names are
  all in §7.1 or §7.2.
- `screens/27` is carried by two distinct items; every dispatch names the full id.
- 84 items carry `source_file: "C:/…"` (the quoted form — an unquoted grep finds 0), 55 with a
  checksum: the prompt's numbers, confirmed.
- `scripts/e2e-gate.ts` leaks its scratch directory because every exit path calls
  `process.exit()` inside the `try`, which skips the `finally`.
- `OPENQ-does-the-table-mark-or-the-lane-report-mark-win-when-one` is already superseded by
  `TASK-a-turn-that-is-both-a-table-and-a-lane-report-is-one-thing` (`anchors`, done).

**The CI question, in plain words.** The workflow deliberately runs on two triggers only: a push to
`master`, and a pull request. That was done so one commit is never tested twice. This release
lives on `release/2.0.0`, so every push here runs nothing, and "green on both jobs" cannot be
reported for any checkpoint until one of these is true:

1. **A draft pull request `release/2.0.0 → master` exists** (recommended). Every push then runs
   both jobs, `cancel-in-progress` keeps only the newest commit's run, and nothing in the
   workflow changes. Merging is a separate act at the end.
2. `release/**` is added to `on.push.branches` in `ci.yml` — phase 1.4 edits that file anyway,
   but this reopens the double-run the trigger was narrowed to avoid once a PR exists.

I recommend 1 and will open the draft PR on the owner's word; opening it is outward-facing, so it
is not done unasked.
