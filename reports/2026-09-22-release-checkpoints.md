# 2.0.0 release — the checkpoint log

**Prepended to, newest first.** This file is the durable record of where the release stands;
the board (`mycontext ready`) is the state, `docs/superpowers/plans/2026-09-22-v2-0-release.md`
is the plan, and this is the log. After a compaction, the last entry here is the current phase.

Cite an item by id, never this file by line number — every line number here moves on the next
write (`RULE-a-citation-names-an-item-by-id-never-a-report-by-line-number`).

---

```
CHECKPOINT 4 — silent failures and disclosures
commit: e01cfa30 pushed: yes   (this entry and the phase close are the next commit)
ran:  npm test → 9350 tests, 9347 pass, 0 fail, 3 skipped, exit 0 (on 2eabb77f and again on 4eaf7d26; 9348/0 on db6ba6cb)   verify:citations → exit 0 (0 broken, 76 historical — six marked this phase for lines the phase moved)   doctor → exit 0   check:board / check:basis / check:handover / typecheck → check:board 0 · check:basis 0 · check:handover 0 · check:swallows 0 (new this phase, in CI and the release workflow) · typecheck 0   test:perf → this machine alone: JIT focus-set p95 23.8 ms (median 19.8) GREEN; two tail-heavy reds here (fallback p95 370, session-start+sweep p95 716 vs 500) that both hosted runners pass — Ubuntu JIT p95 3.0 ms (median 2.4) on the green run, where the phase's regression had read 113   test:e2e → not this phase (unit-level lanes; browser coverage for the new screen notes is release/34)
CI:   windows green  ubuntu green — run 36496608625 on 2eabb77f: both jobs through npm test, verify:citations, test:perf (Ubuntu JIT focus-set p95 3.0 ms) and, on Ubuntu, the browser suite GREEN — 1414 tests, 1400 pass, 1 (chart-scale) cleared serially, 13 skipped, 1.6 h. Round 5 (4eaf7d26) and release/38 are pushed after it and under CI as this is written.  https://github.com/Dudi-Bar-On/my-context/actions/runs/36496608625
board: 137 → 125 (release/28–38 filed; the twenty-one phase-4 tasks and release/16, /19, /22, /23, /24, /4 closed; the in-sync-verdict task superseded — 123 ready, 2 held) (release/28–36 filed; rulings/80, /81, /85, /88, swallow/9, /11, /13, /14, /15, dxfindings/6, walk/147, /148, store/7, /13, live/28, unread/6, release/16, /19, /22, /23, /24 closed; the in-sync-verdict task superseded by its decision)
closed: release/4 · the seventeen phase-4 board tasks (rulings/80 TASK-one-unreadable-directory-makes-the-audit-projection-look · swallow/14 TASK-the-restore-tier-drops-snapshot-ids-with-no-disclosure-where · swallow/13 TASK-a-corrupt-or-locked-archive-index-makes-every-retrieval · rulings/81 TASK-recordaudit-reports-whether-it-wrote-and-fourteen-of-sixteen · dxfindings/6 TASK-two-checks-route-their-only-disclosure-to-a-surface-nobody · walk/147 TASK-nine-sites-report-a-measured-zero-for-something-they-could · walk/148 TASK-one-number-means-nothing-cited-could-not-read-and-read-only · store/7 TASK-a-pack-import-can-throw-after-overwriting-config-and · store/13 TASK-a-corrupt-manifest-makes-the-next-publish-erase-the-store · live/28 TASK-an-install-whose-sources-cannot-be-walked-reports-its-code · swallow/11 TASK-twenty-one-one-line-swallows-where-the-docstring-asserts · swallow/15 + unread/6 (the swallow gate) · rulings/85 + rulings/88 (the scanners) · swallow/9 TASK-a-temporarily-disabled-boot-heartbeat-carries-no-item-no · release/19 TASK-the-audit-log-still-records-two-session-ids-that-never) · release/16, /22, /23, /24 (filed for this phase, done)
retired: TASK-the-in-sync-verdict-draws-no-chip-and-its-own-docblock-calls → superseded by DEC-the-in-sync-verdict-draws-no-chip-report-3-does-not-overturn (found still active by lane 4.11); the D map's D64 row re-pointed
filed for 2.0: release/28 TASK-the-preview-screen-draws-a-snapshot-id-that-could-not-be (phase 6)   release/29 TASK-three-surfaces-still-file-a-restore-disclosure-under-spilled (phase 6)   release/30 TASK-the-maintenance-publish-screen-draws-what-to-move-and-the (phase 6)   release/31 TASK-storemeta-answers-null-for-a-corrupt-manifest-exactly-as-for (phase 5)   release/32 TASK-the-tutorials-read-model-reports-an-unreadable-repository (phase 5)   release/33 TASK-no-doctor-check-reads-the-code-identity-so-an-install-that (phase 5)   release/34 TASK-two-conversations-screen-notes-are-pinned-only-by-reading (phase 6)   release/35 TASK-a-rule-store-test-asserts-over-the-repository-s-own-live (phase 5)   release/36 TASK-filteraudit-never-reads-sinceseq-so-a-caller-that-bounds-a (phase 5)
recorded: KNOWN-node-test-spawned-from-inside-a-test-inherits-node-test (a child node --test inherits NODE_TEST_CONTEXT and runs nothing, exit 0 — rediscovered twice); the tie sweep (32 sites, three verdicts) on release/16's body; the two documentation debts on release/8's body (the capabilities doctor-code list two codes behind; the README warning block that says hooks inject silently); the D map's D64 row re-pointed; every phase-4 lane report beside the ledger
ideas awaiting the owner: (1) a fresh install's first `mycontext doctor` now prints a nine-line info note that the audit projection has never been built, with the one command that ends it — kept on the standard's word; yours to quieten; (2) `missionText` now prints a **Coverage** line when a retrieval answered nothing because the prose index was not built — every dispatched agent reads it; (3) promoting a revision of a summary-less governing item whose content moved now exits 1 with the contradiction gate's sentence where it used to land — a new refusal a user can meet; (4) `mycontext conversation search` exits 1 over an unbuilt index (the pre-existing refusal branch, reached by a new condition); (5) 549 foreign rows sit in this repository's own audit log under 23 hand-run probe ids (428 under `lane-still-gets-the-no-git-rule`, the test that wrote them is now boxed) — the removal command is in the 4.15 report §3; nothing was deleted; (6) a `KNOWN` item is warranted: `node --test <file>` spawned from inside a test inherits NODE_TEST_CONTEXT and runs nothing, exits 0 — rediscovered twice this phase
blocked on the owner: nothing
next: phase 5 — CLI, store, types and hygiene
```

**What the phase found beyond its seventeen tasks.** Two product bugs that were not on the board: the perf regression the phase itself caused — appendSeen paid the log directory's marker check (release/25's guard) and a torn-tail heal once per injected item, twenty per JIT call; fixed at the cause (a stat-verified memo per process, one append per delivery), JIT p95 64–117 ms → 14–16 ms measured interleaved, ceilings untouched — and inverseOf('constructor') returning a function while an undeclared relation type silently disabled the mirror gate, found only because the scanners now walk what they scan (503 files became 3,214). Nine findings filed as release/28–36; nine of the phase's own items grew a follow-up because a reviewer proved the disclosure on the function and not on the surface, and the lesson is now in every reviewer prompt.

**Named, as the prompt asks.** One lane breach, self-reported: 4.4b ran `git checkout --` on the shared basis file to revert its own edit (nothing else was in it). Two controller staging errors: 4.6's `ledgerReadFailureNote` hunk landed under 4.7's commit, and 4.11's `server.ts` hunk under 4.10's — both because two lanes had touched one file and I staged from one lane's reported list; both credited in the later commit's message; the rule since: read each file's diff against the lane's report before staging, never the list alone. One prescription of mine measured wrong by a lane and reversed (4.7: "an empty index is a known empty set" would have re-opened a closed capture miss); accepted, ledgered. Nine CI reds on pushed heads, each fixed at its cause and none retried: a bare `rmSync` in a new test (the repository-wide meta-tests run only under `npm test`); a plan citation quoting a renamed function; the hook hot-path regression the phase itself caused (twenty per-item appends, each paying release/25's marker guard and a torn-tail heal — p95 113 ms on Ubuntu, back to 3.0); then, after the phase's code was complete, six more found only by the hosted runners: five plan citations quoting seen-file.ts lines the perf fix moved; a piped stdout dropped by `process.exit` on Linux (ten gate scripts now set `process.exitCode`); four browser specs that had been living off a fixture session CI's `npm test` step used to leak into the checkout — 4.15 stopped the leak and the frozen e2e corpus now seeds one delivery through the real hook; two composer waits that raced the Composer's own honest redraw (a render generation it now stamps); and a "match N of M" sentence drawn after the scroll that measured, pushing the match under the pane on Linux fonts. Twenty-two lane dispatches, five browser rounds, every one landed from its reported file list.

**The standing lesson of this phase**, learned from 4.6's Critical: a disclosure proven on the function edited is not proven on the surface the item names — the screen called a sibling function. Every reviewer prompt since carries it, and two more misses were caught by it (4.6c's mission text, 4.11's route).

---

```
CHECKPOINT 3 — the defects
commit: 4affcb70 pushed: yes   (this entry and the phase close are the next commit)
ran:  npm test → 9045 tests, 9042 pass, 0 fail, 3 skipped, exit 0 (on 4affcb70)   verify:citations → exit 0 (0 broken, 70 historical)   doctor → exit 0 (0 errors; 190 warnings / 91 infos are hygiene, see the owner's question below)   check:* → check:board 0, check:basis 0, typecheck 0   test:e2e → GREEN on 016483a4: 1414 tests, 1401 pass, 5 phase-1 failures cleared by the serial pass (cli-help, composer-staging, conversations, live-refresh — the gate's known contention set), 8 skipped, exit 0, 51.9 min, headless, and `git diff -- .gitignore` empty after it
CI:   windows green  ubuntu green — run 35852467906 on 36bd274d (the phase head minus two corpus-only commits): Windows 9045/9042/0 fail/3 skipped through npm test, verify:citations, test:perf; Ubuntu the same three steps green and the browser suite GREEN — 1414 tests, 1398 pass, 4 phase-1 failures cleared serially (chart-css-authority, conversations-panels), 12 skipped, 1.7 h.  https://github.com/Dudi-Bar-On/my-context/actions/runs/35852467906
board: 136 → 137 (release/24, /25, /26, /27 filed; ui-gates/1, rulings/114, release/25 closed; rulings/84 superseded — 135 ready, 2 held)
closed: release/3 · hooks/35 (TASK-there-is-no-version-flag-and-the-argued-alternative-refuses) · walk/146 (TASK-status-report-drops-every-could-not-measure-disclosure-and) · ui-gates/1 (TASK-two-browser-gates-are-red-before-any-lane-touches-them-and) · rulings/114 (TASK-forty-six-browser-failures-are-recorded-as-unknown-so-the) · release/20 (TASK-two-surfaces-still-describe-importing-a-full-export-after) · release/25 (TASK-the-product-overwrote-the-repository-s-root-gitignore-with-a) · the eight B-items (B6–B13) that had no corpus item, each landed by its task
retired: rulings/84 (TASK-no-content-security-policy-header-and-no-meta-on-a-local) → superseded by DEC-the-ui-sends-a-content-security-policy-with-script-src-self, as §7.2 and checkpoint 2 said it would; the D map's D58 row re-pointed at the decision
filed for 2.0: release/21 TASK-thirteen-test-files-name-a-retired-item-as-what-they-rest-on (phase 8)   release/22 TASK-promoterevision-reuses-the-summary-unchanged-switch-and (phase 4)   release/23 TASK-mycontext-ready-counts-a-review-draft-as-open-work-so-the (phase 4)   release/24 TASK-a-locked-projection-file-makes-discard-fail-silently-so-a (phase 4)   release/25 (fixed and closed this phase — a user-damaging bug does not wait)   release/26 TASK-the-browser-gate-reports-green-while-eight-tests-are-skipped (phase 6)   release/27 TASK-the-capture-screen-offers-execute-for-a-command-its-own (phase 6)
recorded: DEC-a-full-export-is-an-archive-to-copy-back-never-an-artefact (ruling C) · DEC-the-dispatch-gate-reads-an-item-id-as-a-known-prefix (ruling F) · DEC-the-browser-suite-runs-headless-by-default-a-person-who (your 2026-09-23 word, reversing 2026-08-22) · DEC-the-three-mockup-parity-browser-specs-are-retired-screen (ruling B) · DEC-the-ui-sends-a-content-security-policy-with-script-src-self (ruling E) · DEC-a-turn-that-is-both-a-table-and-a-lane-report-carries-both (anchors/12, on your word) · rulings/114 carries the green baseline on both machines
ideas awaiting the owner: (1) `review.enabled` during a release — the review pass drafted ten items from the dispatcher's own prompts (discarded; release/23 filed for the count); should the pass be off while a release session drives the corpus? (2) no static check catches a flag named in `commands/lesson.md` that the CLI does not accept — the doc was wrong for a day; (3) the review trigger path has no mutual exclusion — two passes on one transcript can each cost the other a window (the race is disclosed in code, not closed)
blocked on the owner: nothing — anchors/12 was ruled on 2026-09-23 ("as recommended": both marks, no precedence)
next: phase 4 — silent failures and disclosures
```

**Task 3.9 took three rounds and found a product bug.** The gate was red on this machine for two rounds with "preview never settled": the preview DOM kept mutating with nothing in flight. The cause was `GET /api/injection-history` taking 5.1 s on this corpus's 254,466 audit rows (a rowid join decoding jsonb per row, and an index without the tier column); it is 148 ms with two indexes, and the projection upgrades in place on the next open. The first green gate on this machine came at 5664e55c; Ubuntu agreed on fc4817b2 (1394 pass / 12 skipped) and again on the phase head. A locked projection file making `discard()` fail silently was found on the way and is release/24.

**release/25 is the phase's severe finding, and it is named.** The product wrote a lone `*` into this repository's root `.gitignore` (every file ignored; `git add reports/…` refused). The writer is now one guarded function (`src/core/private-gitignore.ts`) with four refusals, each disclosed and each planted by a test; eleven sites route through it. The invocation was found with evidence: a bare `node --test` (no file argument, cwd the repo root) that a lane's shell launched at 02:30:14Z ran every `.ts` under `test/**` as a top-level script, and `test/fixtures/force-stat-failure.ts` defaulted its directory to `.`; the run then hung on argument-less fixtures for seven hours. The default is gone; the fixture refuses to run without its arguments.

**Two lane breaches, both self-reported, nothing lost.** Lane 1.1 (phase 1) ran `git checkout --`; lane 3.10 ran `git stash` / `git stash pop`. Lane 3.8 died on an Opus weekly rate limit mid-gate; its code was complete and reviewed clean, and the controller ran its gate and `npm test` and says so in its report.

**Three controller push errors, one rule.** Three pushes (one by a filing script, two by hand) cancelled CI runs that were still needed, under `cancel-in-progress`. Standing rule since: scripts never push; the controller pushes only when no needed run is in flight, and reads the suite's own exit line, never a wrapper's.

**Three CI reds on the phase head, each fixed at its cause, none retried.** Two plan citations quoted the `ledger.ts` line release/25 replaced (marked historical); a Windows test read a pid file in the instant between its creation and its write and ran `taskkill /PID 0` (the reader now waits for a real pid); the board check gated the D map's row that still named the superseded rulings/84 (re-pointed at the decision).

**The owner's question about doctor's 138 findings**, answered in the session: 0 errors; 149 unacknowledged items, of which 131 are `task_unverified` (tasks closed in the dogfooding with no `verified_on`), 33 are `citation_form`, 10 `body_disagrees_with_meta`, 7 small. Recommendation given: one hygiene lane in phase 8 that verifies each against git and stamps or reopens — not a bulk acknowledgement. Also raised and awaiting a word: the title-bar session picker (shows ids because no session carries a my_context name — the renames are Claude's titles, a different store; lists every session that ever injected here, 20 of them; changes nothing on Conversations because only Injected, Preview and Simulate subscribe to it), and a test-fixture session id (`lane-still-gets-the-no-git-rule`) writing into the real ledger — a lane's test reaching beyond its process, to be filed once the lane is named.

---

```
CHECKPOINT 2 — the board says what is left
commit: e2031c10 pushed: yes   (this entry is the next commit)
ran:  npm test → 8980 tests, 8977 pass, 0 fail, 3 skipped, exit 0   verify:citations → exit 0 (phase 1, unchanged tree outside the corpus)   doctor → exit 0   check:* → check:board 0, check:needs-cycles 0 (the two this phase gates on)   test:e2e → not this phase
CI:   windows pending  ubuntu pending — run 35743218944 on e2031c10; corpus-only changes since the three green attempts on 97e27289  https://github.com/Dudi-Bar-On/my-context/actions/runs/35743218944
board: 163 → 136 (every open row has a plan, a seq and a state; 134 ready, 2 held)
closed: release/2 · 14 done-but-not-marked (anchors/13, semantic/15, semantic/17, ui2/13, ui2/10p, walk/129, walk/161, the screens/27 headings tick, parseItem casts ×2, contradiction-scope write ×2, the live-feed reload notice, the shared watch-model id) · 4 on ruling G (rulings/89, walk/66, handover/16, port/99)
retired: 9 — superseded: walk/150 → walk/139, the two "58% of its rows" twins → rulings/82; deprecated with the reason in the body: port/93, port/98, walk/4, rulings/63, review/4, D33's gate.  NOT retired, against runbook §7.2: ui2/5r is TASK-the-mockup-gives-a-true-conclusion-a-false-reason-a and your 2026-09-22 ruling keeps it for phase 8; rulings/84 retires after 3.8 files decision E.
filed for 2.0: walk/170 "the Decay and Ledger screens say when the ledger projection was last rebuilt" (the screen half of your walk/66 ruling; phase 6, not a bug)   release/19 = TASK-the-audit-log-still-records-two-session-ids-that-never (planless survivor given a plan; phase 4)
recorded: eight decision items and one hard rule (RULE-a-handover-line-that-is-actionable-names-an-item-id-and-a), each linked to its task; hooks/22, review/10, walk/167, walk/14, swallow/16 carry their phase in the body
ideas awaiting the owner: none
blocked on the owner: anchors/12 — two rulings of yours disagree. On 2026-09-16 you answered OPENQ-does-the-table-mark-or-the-lane-report-mark-win-when-one with "make them 2 different anchor types with 2 distinguished marks" (no precedence; recorded in TASK-a-turn-that-is-both-a-table-and-a-lane-report-is-one-thing, done). Ruling G on 2026-09-21 says "the LANE REPORT mark wins over the table mark". Which stands? The rebuild is phase 7 either way; the decision item is filed on your word.
next: phase 3 — the defects
```

**Two things check:board reports without gating.** D46 named walk/150, superseded today; the row already carried its successor walk/139, so the seat was dropped and the gate is green again. And 22 subjects (D8, D13a/b, D14, D16, D17, D20, D21, D22, D23, D29, D31, D34, D35, D36, D38, D40, D42, D59, D65, D71, D73, D74) read "open" with every item done — a subject closes on a judgement, not a count, and `reports/2026-09-22-the-d-board-live.md` already lists them for phase 9.

**One process lesson.** The first attempt at the eight decisions ran with stderr hidden; the contradiction gate refused every write (each lexically matched the D-number map or the mockup decision) and nothing said so, leaving four closed tasks pointing at "see ." — caught by the empty ids, repaired the same hour, and every write was re-sent with `--distinct` naming the candidates. The gate did its job; hiding its voice was mine.

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
