# 2.0.0 release — the checkpoint log

**Prepended to, newest first.** This file is the durable record of where the release stands;
the board (`mycontext ready`) is the state, `docs/superpowers/plans/2026-09-22-v2-0-release.md`
is the plan, and this is the log. After a compaction, the last entry here is the current phase.

Cite an item by id, never this file by line number — every line number here moves on the next
write (`RULE-a-citation-names-an-item-by-id-never-a-report-by-line-number`).

---

```
CHECKPOINT 1 — the repository tells the truth   (FINAL, 2026-09-22 14:37Z; the first version of this entry was superseded by the owner's ruling that phase 1 is complete only when it is complete)
commit: 97e27289 pushed: yes   (this final entry and the three closes are the next commit)
ran:  npm test → 8980 tests, 8977 pass, 0 fail, 3 skipped, exit 0 (run alone on 4c19d8f5)   verify:citations → exit 0   doctor → exit 0   check:* → all 0 (eleven scripts)   typecheck → exit 0   test:e2e → not this phase
CI:   windows green  ubuntu green — run 35735392220 on 97e27289, three consecutive attempts, each green through npm test, verify:citations and test:perf on both jobs (Windows 8980/8977/0 fail/3 skipped ×3; Ubuntu 8980/8967/0 fail/13 skipped ×3); each attempt cut after those steps on the owner's ruling, so the phase-3 browser suite did not run. The two first-attempt failures of run 35725630027 became release/17 (reaping test: PASS ×3) and release/18 (JIT-with-focus p95 6.5 / 5.0 / 5.6 ms against 50): fixed, proved three times, closed.  https://github.com/Dudi-Bar-On/my-context/actions/runs/35735392220
board: 165 → 163 (release/16 filed for phase 4 on the owner's ruling; release/17 and release/18 filed and closed)
closed: release/1 · release/17 · release/18 · rulings/47 (TASK-the-citation-form-has-no-answer-for-html-and-six-source) · TASK-scripts-backfill-requests-ts-exists-and-was-measured-against · release/11 · release/12 · release/13 · release/14 · release/15
filed for 2.0: release/16 TASK-sweep-every-timestamp-comparison-for-the-millisecond-tie (owner ruling: taken; phase 4)   release/17 TASK-a-windows-reaping-test-passes-or-fails-by-the-hosted-runner (fixed, closed)   release/18 TASK-a-perf-ceiling-on-the-jit-hook-fails-on-the-hosted-ubuntu (fixed, closed)   release/11 TASK-gen-docs-is-not-idempotent-gen-diagrams-ts-renders-a (fixed and closed this phase)   release/12 TASK-npm-test-goes-red-on-any-machine-whose-path-mycontext-points (fixed, closed)   release/13 TASK-four-tests-are-red-on-ubuntu-and-green-on-windows-and-each (fixed, closed; site 4 was a production bug — the watch window bounded on a millisecond that ties)   release/14 TASK-the-documented-status-example-carries-the-generating-machine (fixed, closed)   release/15 TASK-the-documented-doctor-example-depends-on-whether-mycontext (fixed, closed)
ideas awaiting the owner: none — (1) the PATH scrub granularity: owner ruled DROP; (2) the millisecond-tie sweep: owner ruled TAKE → release/16
blocked on the owner: nothing
next: phase 2 — the board says what is left
```

**What phase 1 did beyond the five plan tasks.** Lanes found five bugs; under ruling A all five were filed as `release/11`–`release/15` and fixed in this phase, none deferred. Three of them are the same defect in three coats — the machine leaking into the suite: a global `npm link` on PATH (`release/12`), hook state a live session wrote under a checked-in fixture (`release/14`), and the host's PATH deciding what `doctor` prints in a documented example (`release/15`). `release/13` found a real production bug (`/api/watch/context` bounded its window on `at >= preCompactAt`, which ties in a burst; it now bounds on the audit `seq`). `release/11` found mermaid's `handDrawnSeed: 0` is falsy, so every diagram was redrawn with `Math.random()`.

**One breach, self-reported.** Lane 1.1 ran `git checkout --` on seven generated diagram files to discard churn — a git write, forbidden by `RULE-a-delegated-worker-never-runs-a-command-that-reaches-beyond`. It reported it unprompted; nothing committed by another lane was touched; the churn it discarded was the very non-determinism `release/11` later fixed. No re-dispatch.

**Two controller errors, recorded.** `scripts/doc-fixture.ts` (release/14's unfinished file) was swept into release/13's commit `7d6309ec` by a computed pathspec; it stays there, named in release/14's commit message. And a background `npm test` wrapper reported exit 0 while the log's own last line said `exit=1` — read the log's line, never the wrapper's.

**Corpus repair.** 85 items (84 with `source_file: "C:/…"`, 55 with a checksum, plus one whose `.scratch/` source was gone) stop claiming a source, through the new `mycontext edit <id> --detach-source`; `doctor` exits 0. The authorised backfill filled 29 of 1344 items with the owner's prompt and skipped 1315 with a reason each (full output in the session scratchpad, `backfill-apply.log`).

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
