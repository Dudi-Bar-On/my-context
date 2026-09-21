# External status review — 2026-09-21

**An independent reading of `my_context` at `62315f0` (master, 2026-09-17 22:02), made from a
fresh clone on a machine that is not the owner's.** Nothing in this document was carried forward
from a previous report. Every number was produced by a command run on 2026-09-21 and is named
with the command that produced it, or is marked as read from the record and not re-measured.

This file is the only thing this review wrote. No item was created, edited, retired or
superseded; no source or test was changed; no server was started against the owner's record.
Where the review disagrees with an item, it says so here and leaves the item alone.

---

## 0. What was run, and what could not be

| Instrument | Ran? | Result |
|---|---|---|
| `git log` over the full history (unshallowed) | yes | 1,824 commits on master, 2026-08-12 → 2026-09-17, 37 days |
| `npm run typecheck` (Node 24.21.0) | yes | **exit 0** |
| `npm test` (full unit suite, Node 24.21.0) | yes | **8,956 tests · 8,931 pass · 12 fail · 13 skipped · 264 s · exit 1** |
| the ten `check:*` gates from `ci.yml` | yes | 9 green; `verify:citations` **exit 1** |
| `npm run check:diagrams` | yes, with a substituted Chromium 1194 | 68 fences parse, 0 fail |
| `mycontext status` / `ready` / `doctor` on the real corpus | yes | 1,334 items · 160 open tasks · doctor **exit 1, 56 errors** |
| `npm run test:e2e` (two-phase browser gate) | started under Xvfb with the substituted browser | see §3.4 — read with the caveat there |
| GitHub Actions history for `master` | yes, via the API | 885 runs read; **last green run is #269, 2026-08-21** |
| GitHub issues / PRs | yes | 0 open issues; the pull-request listing returned 404 (the repository does not expose it to this session) |
| The mycontext MCP server | **no** — it failed to connect in this session | the session-start injection this project relies on did not happen here; items were read from disk instead |
| Node 24 | not installed on the machine; fetched with `npx node@24` | every command above ran on 24.21.0, not on the machine's 22.22 |

Two things about this environment shape the results and are stated once: the Playwright build
pinned by `package.json` (1.62, headless shell 1234) could not be downloaded through this
machine's proxy, so the browser-driven gates ran on the Chromium 1194 that was already present;
and `mycontext` is not on PATH here, which `doctor` reports as a warning and one test depends on.

---

## 1. The verdict, in five sentences

1. **The product is real and large.** Roughly 152k lines of TypeScript plus 61k of front-end
   JavaScript, 595 test files carrying 8,956 unit tests, 100 browser specs, a 49-command CLI,
   an MCP server, 18 hook events, 91 slash commands, a twenty-screen local web UI, and a corpus
   of 1,334 items governing its own development. `1.0.2` is tagged; `2.0.0` is the declared next
   tag and has been in preparation since 2026-08-18.
2. **The repository does not currently prove any of that.** Master CI has been red on every one
   of 761 consecutive runs since 2026-08-21. The failing step is the documentation citation gate,
   and because it sits before `typecheck`, `npm test`, `test:perf` and the browser suite in
   `ci.yml`, none of those have run in CI on any of those commits.
3. **On a fresh clone the unit suite is red and `doctor` is red**, for reasons that are about
   portability rather than logic: tests that read the owner's untracked scratch directories, a
   generated README example that no longer matches, a test that pinned a Node warning Node 24.21
   stopped printing, and 53 items whose `source_file` points at a Windows temp directory.
4. **"v2.0" has no boundary.** By the owner's ruling of 2026-09-05 it is *every open task*. Since
   then tasks have been filed faster than they have been closed, so the open count has not fallen
   below 90 in six weeks and stands at 160 today. A release defined as "everything open" cannot be
   reached while filing outpaces closing; it needs a freeze.
5. **The way out is short and mostly mechanical:** make master green and the suite portable
   (days, not weeks), freeze the v2.0 set on a date, then burn the frozen set down in four
   ordered lanes. GSD is not the tool for that — §6 says why, and what to borrow from it instead.

---

## 2. What is there

### 2.1 Surfaces and size, measured

| | Count | How |
|---|---|---|
| TypeScript under `src/` | 151,694 lines | `wc -l` |
| Front-end JS under `src/ui/public/` (vendor excluded) | 61,515 lines | `wc -l` |
| Test files / lines | 595 files / 234,667 lines | `find test -name '*.test.ts'` |
| Unit tests | 8,956 | `npm test` summary |
| Browser specs | 100 files | `find e2e -name '*.spec.ts'` |
| CLI commands | 49 | `reports/2026-09-16-the-subjects-of-this-system.md` row 11 (not re-counted) |
| Slash commands | 91 | `ls commands` |
| Hook events registered | 18 | `hooks/hooks.json` |
| Runtime dependencies | 0 | `package.json` — `CONST-zero-runtime-dependencies` holds |
| Documentation | `README.md` 445 KB · `docs/README.he.md` 585 KB · 17 capability chapters + 8 system documents, each in English and Hebrew · 48 tutorials | `wc -c`, `ls docs/**` |

### 2.2 The corpus, measured

| | Count |
|---|---|
| Items | 1,334 (active 1,259 · superseded 45 · deprecated 30) |
| Tasks | 949 — done 787 · todo 150 · doing 1 · ~11 with no `state` and no `plan` |
| Open per `mycontext ready` | **160** (156 ready, 4 held on `needs:`, 1 open question blocking one task) |
| Open by priority | P1 31 · P2 67 · P3 44 · unset ~20 |
| Open by plan (top) | walk 54 · rulings 28 · wcag 9 · screens 6 · swallow 6 · semantic 5 · store 5 · port 4 |
| Active `known_issue` | 30 |
| Active `open_question` | 9 |
| Decisions / rules / standards / invariants / constraints | 99 / 58 / 15 / 7 / 8 |

### 2.3 How it was built

The record is unusually complete. `docs/superpowers/` holds 27 design specs and 30 implementation
plans dated 2026-08-12 → 2026-09-10, each plan headed *"REQUIRED SUB-SKILL: use
`superpowers:subagent-driven-development`"*, plus the SDD ledgers and per-task implementer
reports preserved after one ledger was lost. The corpus holds 195 items that mention
superpowers. Work is dispatched as "lanes" (subagents in worktrees), the dispatching session
commits, and every gate this repository has was paid for by a named failure. That discipline is
the project's biggest asset, and §6 rests on it.

The cost of that discipline is visible too: `reports/` holds 107 files, `reports/V2-HANDOVER.md`
is 295 KB and prepended-to several times a day, and the commit log is written as narrative
sentences rather than as change descriptions. Those are not defects, but they are why an
outsider cannot tell the state of the project from the repository in less than a day.

---

## 3. Measured state

### 3.1 CI on `master`

| Runs | Window | Conclusions |
|---|---|---|
| #3 – #269 | 2026-08-13 → 2026-08-21 | last green: **#269, commit `3d125ed`, 2026-08-21 20:56** |
| #270 – #1030 | 2026-08-21 → 2026-09-17 | **761 runs: every one `failure` or `cancelled`** |

The latest run (#1030, `62315f0`) fails on both matrix jobs at step 14, `npm run
verify:citations`; steps 15–22 (`typecheck`, `npm test`, `test:perf`, the browser suite, the
diagram gate) are `skipped`. Only the latest run's steps were read; earlier runs may have failed
at other steps, and the 27-day red streak may have more than one cause across its length.

`release.yml` runs the same gates before it publishes. **A `v2.0.0` tag pushed today would fail
at the same step and publish nothing.**

### 3.2 The gates, locally, on `62315f0`

| Gate | Exit | Note |
|---|---|---|
| `check:test-glob`, `check:basis`, `check:retired`, `check:text-files`, `check:vendor`, `check:dependencies`, `check:needs-cycles`, `check:handover`, `check:board` | 0 | `check:board` reports 23 open items claimed by no D subject and 21 subjects "open with every item done" |
| `verify:citations` | **1** | documents: 1,221 citations, **26 broken**, 655 moved, 68 historical. Reported and not gated: 38 broken in source, 63 broken in corpus items, 19 marker faults |
| `check:diagrams` | 0 | needs a browser; passes once one is present |
| `typecheck` | 0 | |

### 3.3 The unit suite, locally

12 failures out of 8,956. Read one by one, they are three kinds:

| Kind | Tests | What it means |
|---|---|---|
| **Depends on the owner's machine** | `test/ui/staging-endpoint.test.ts:456`, `test/ui/palette-screen.test.ts:511` (read `.my_context/.staging`, which is gitignored and absent here); `test/rules/seed-numbering.test.ts:122` (needs the real conversation archive); `test/docs/examples.test.ts` ×3 (`scrubOutput` does not know this checkout's path); `test/ui/execute-route.test.ts:702` (produces empty output here — most likely `mycontext` not on PATH; not proven) | The suite is green only where it was written. A contributor, a CI runner, or a new machine gets red. |
| **A real drift** | `test/docs/examples.test.ts:289` and `:559` — the README's generated `status` example says "1 session(s) recorded"; the command now prints "no sessions recorded yet". `VERSIONING.md` step 3 (`npm run gen:docs`) has not been re-run. `test/cli/experimental-warning.test.ts:122` — Node 24.21 no longer prints the `node:sqlite` experimental warning, so the assertion "the shebang suppresses it" can no longer distinguish anything; the test's own message says so. | Both would be red in CI too, if CI reached `npm test`. |
| **Uncertain** | `test/cli/pack-import.test.ts:529` — the `pack list` table wraps `2026-08 rev 3` across two lines and the regex expects one; `test/core/seen-file.test.ts:183` — a measured backoff timing. | Could be terminal width and load. Not attributed without isolating; `RULE-do-not-accept-a-test-that-passes-in-isolation-and-fails` applies to this review too. |

### 3.4 The browser suite, locally

The two-phase gate (`scripts/e2e-gate.ts`) was started under Xvfb with Chromium 1194 standing in
for the pinned 1234 build. Its result is recorded in §8 at the end of this file, because it was
still running when the rest was written; if that section is absent, the run did not finish inside
this session's limit. Independently of that run, the record itself already says two browser gates
are red on HEAD: `TASK-two-browser-gates-are-red-before-any-lane-touches-them` (`ui-gates/1`),
`e2e/screen-parity.spec.ts` for the `preview` screen and `e2e/mark-hues.spec.ts` (both recorded in
`reports/2026-09-17-the-other-two-panels.md`; the second has since been repaired).

### 3.5 `mycontext doctor` on the real corpus, from a fresh clone

Exit 1. 56 errors, all `source_missing`: **53 items cite a `source_file` under
`C:/Users/UserC/AppData/Local/Temp/claude/…`** — a scratchpad on the owner's Windows machine —
and 43 findings in this run are already acknowledged. Plus 10 warnings (`summary_stale` 5,
`reference_no_source` 3, `dead_scope` 2) and 75 informational findings. This is the same
portability finding as §3.3 seen from the corpus side: the product's own promise is that a corpus
travels, and this one carries provenance that exists on one machine.

### 3.6 The trackers

Five documents describe project state. Only one is computed.

| Document | Nature | Currency |
|---|---|---|
| `mycontext ready` / `check:board` | computed from `needs:`, `plan`, `state` | cannot go stale — **the only authority** |
| `reports/V2-HANDOVER.md` | narrative, prepended, 295 KB | current to 2026-09-17; not a status |
| `reports/2026-09-11-v2-progress.md` | computed once, under `STD-v2-0-progress-report-…` | ten days old; counts 716/626 against today's 949/787 |
| `reports/CONTINUE-HERE.md` | says of itself "STOP READING THEM HERE" | 2026-09-03 |
| `docs/ROADMAP.md` | "the single tracking document" | frozen at `v0.9.0`, 2026-08-16 |

The retirement of `EXECUTION-BOARD.md` on 2026-09-07 was correct and the reasoning in `CLAUDE.md`
is right. But three of the five above still present as live, and an outsider reads them first.

---

## 4. The gaps, ranked

Ranked by what blocks `2.0.0` first, then by blast radius. Each names the items already on the
board that cover it; where none does, it says so — that is the one kind of finding this review is
allowed to add.

### G1 — Master is red and has been for 27 days; the release pipeline cannot run

- **Evidence:** §3.1. 761 consecutive non-green runs. `release.yml` shares the gate.
- **Cause today:** 26 broken citations in the documentation tier of `verify:citations`.
- **Consequence:** every "SHIPPED" claim since 2026-08-21 rests on tests a lane ran locally and
  quoted, never on CI. The 2026-09-11 progress report says this in its own words ("*SHIPPED here
  means merged, and the test I ran is green*"). The project has, in effect, been running without
  its integration gate for most of v2's development.
- **On the board:** `rulings/38` (a plan that changes a command breaks its own survey citations),
  `rulings/47` (six stale source citations), `walk/143` (two citations name text that no longer
  exists). **Not on the board:** the fact that master is red, as a task with an owner and a
  closing condition. It should be.

### G2 — The repository is green only on the owner's machine

- **Evidence:** §3.3 (7 of 12 failures environmental), §3.5 (53 items with machine-local
  provenance), `doctor` exit 1 on a clone, `cli_not_on_path`.
- **Consequence:** `2.0.0` is the version at which four surfaces are promised frozen for other
  people's installs. A suite that cannot run on another machine cannot make that promise.
- **On the board:** `dxfindings/4` (three checks enforce this repository's conventions on a
  stranger's project), `cliscript/5` (experimental warning), `hooks/35` (no version flag /
  refuses outside a workspace). **Not on the board:** tests that read untracked state, the README
  example drift, the Node 24.21 warning test, and the 53 temp-path `source_file` values (43 are
  acknowledged, which hides them from the exit code on the owner's machine only because the files
  exist there).

### G3 — v2.0 has no boundary, and the denominator grows

- **Evidence:** `DEC-v2-0-is-everything-still-open-and-the-in-out-cut-s-forty-six` (2026-09-05:
  "*put all of them in v2.0*"). Open tasks: 89 on 2026-09-05 → 90 on 2026-09-11 → **160 on
  2026-09-21**. Measured from git on master (files added vs. files whose diff moved `state:` to
  `done`; approximate, since a commit can touch a task for other reasons): 2026-09-08→14 filed 208
  / closed 179; 2026-09-15→17 filed 74 / closed 48. Six of the six reviews of 2026-09-12/13 were
  turned into 70 open filings by 2026-09-15 (`reports/2026-09-15-the-six-reviews-audited.md`).
- **Consequence:** the 87 % figure in the 2026-09-11 report was right to call itself "a measure
  of throughput, not of distance". Closing 160 tasks at the recent net rate (~+8/week) never
  arrives.
- **On the board:** nothing. The ruling is a decision, not a task, and it is the only decision
  this review recommends the owner revisit — not by putting tasks back OUT, but by dating the IN
  set (§5, Phase 1).

### G4 — About twenty open tasks cannot be scheduled

- **Evidence:** ~11 task files carry no `plan`, no `seq` and no `state` (e.g.
  `TASK-parseitem-casts-status-severity-origin-out-of-frontmatter` and its `-2` twin,
  `TASK-the-write-must-be-in-contradiction-scope-and-governing-gated` and its twin,
  `TASK-58-of-its-rows-157-269-were-written-by-test-rules-lane-still` and its twin — three
  near-duplicate pairs: same title, bodies differing by 12–16 lines); ~20 open tasks carry no priority; `check:board` names 23 open items claimed by
  no D subject and 21 subjects "open with every item done".
- **Consequence:** `ready` cannot order them, `check:board` cannot attribute them, and the
  duplicates will be dispatched twice. `CONTINUE-HERE.md` §"A trap" recorded on 2026-09-03 that
  `mycontext add task` accepts an item with no plan/seq/state and exits 0 — the gate it asked for
  is not there.
- **On the board:** `review/10` (a promoted item arrives with no plan, no seq, no priority) covers
  the review-promotion path only.

### G5 — Documentation truth debt

- **Evidence:** 26 + 38 + 63 broken citations (§3.2); README section 8 being retired entry by
  entry (handover 2026-09-17 fourth); zero screenshots in any English document (`rulings/101`);
  the Hebrew edition of two document sets not yet written (`rulings/109`); 14 documents cite 7
  retired items as live rulings (`rulings/115`); the README `status` example stale (§3.3); the
  find-panel prose in five chapters predates its own second round (handover 2026-09-17 third,
  point 4). The 2026-09-16 subject map rates six of 32 subjects as having "NOTHING" or
  "effectively nothing" for a reader: search grammar, the board, the viewer, the palette, the
  audit/decay family, and the hooks as a whole.
- **Consequence:** the reference is checked by grammar (`check:diagrams`) and by citation
  resolution, and the project has measured that both can pass while the prose is wrong (28 false
  diagram claims in 171; 38 then 21 false claims in two passes over `docs/capabilities/`).
- **On the board:** `rulings/99`–`/102`, `/109`, `/111`, `/115`, `docsys/11`, `library/6`,
  `walk/143`. Well covered.

### G6 — The UI is not finished, and part of it can only be judged by the owner

- **Evidence:** 54 open `walk` tasks, 9 `wcag`, 6 `screens`, 5 `semantic`, 3 `dxfindings`, plus
  `port/93`, `/98`, `/99`. Among them: the Configure screen does not edit
  (`KNOWN-the-configure-screen-does-not-implement-editing…`), the Doctor screen is 20,180 px tall
  with no navigation (`dxfindings/2`), no skip link / no h1 / first content control at tab stop 23
  (`wcag/3`), reflow at 320 px pushes 2,318 text elements off an unscrollable page (`wcag/2`),
  2,052 controls share three accessible names (`wcag/4`), the provenance bar is empty on every
  screen (`walk/39`), search matches only an unbroken phrase (`walk/134`), and the Ask screen's
  queries "are not correct" (a `known_issue`).
- **Owner-gated:** the 2026-09-11 report counted 33 screen-verification tasks that close only when
  the owner looks; a grep for the rule they rest on finds only 2 today that say so in their body,
  so the true count is between those and is not knowable from the corpus alone. Either way the
  owner's time is on the critical path, and it is not scheduled.
- **On the board:** fully. The gap is sequencing and the owner's availability, not filing.

### G7 — A class of silent failure is filed and the guard for it is not built

- **Evidence:** `reports/2026-09-12-silent-failures-reviewed.md`: 625 `catch` sites, **306 swallow
  with no written argument**; 145 of 203 `readFileSync` calls do not distinguish `ENOENT`; and the
  finding underneath — `INV-hooks-fail-open` and `INV-nothing-is-dropped-silently` are both
  `severity: hard` and give opposite instructions for a corrupt config. `swallow/15`: "the gate for
  the swallow class was proposed twice and built never". `walk/146`, `walk/147`: nine sites report
  a measured zero for something they could not measure.
- **On the board:** `swallow/9`, `/11`, `/13`–`/16`, `rulings/81`, `/85`, `/88`, `unread/6`. The
  invariant contradiction itself has no item; it should be a decision.

### G8 — Hardening items open on the local server and the import path

- **Evidence:** no Content-Security-Policy on a server that composes and executes shell commands
  (`rulings/84`, P3); any throwaway server deletes the owner's UI record on exit (`rulings/113`,
  P1); a pack import can throw after overwriting config and creating part of the items, and the
  refusal reads as nothing happened (`store/7`); repo-containment guard defeated across Windows
  drive letters, a token submitted as Host recorded in the audit log, the bare server URL renders
  the whole app with no credential (all active `known_issue`s).
- **On the board:** yes. Severity here is deliberately not re-argued; the review notes only that
  `rulings/84` at P3 is low for a CSP on an execute surface, and that `2.0.0` is the version the
  changelog itself calls out for a "Security" entry class.

### G9 — Instruments that present as live and are not

- **Evidence:** §3.6. Also: `docs/ROADMAP.md` still says "This is the single tracking document.
  Every row is updated the moment its status changes" at `v0.9.0`; `reports/CONTINUE-HERE.md`
  carries a table it tells you not to read; `STD-v2-0-progress-report-…` is `always: true` and was
  found delivering a three-week-old instance at every session start (2026-09-11 report §0) — the
  question of whether it should hold an instance at all is still open (§11 of that report).
- **On the board:** `rulings/93` (the board under-reports what has shipped), `handover/16`. The
  ROADMAP and CONTINUE-HERE retirements have no item.

### G10 — Process risk: one person, one machine, narrative history

- **Evidence:** 1,824 commits in 37 days from one author identity; the SDD ledger for Plan 3 was
  lost once and reconstructed; two lanes have filed the same task (the `TASK-…-2` twins); the
  handover records "a background agent cannot return inside the turn that needs the block" and
  "never `git add` a directory while lanes run" as lessons learned by loss; the owner's machine
  holds state (`.staging`, the archive, the UI record on port 58888) that tests and docs read.
- **Not on the board**, and not really a task: it is the reason G1 and G2 matter. Every gap above
  is recoverable from the record because the record is good; none is recoverable if the one
  machine is not.

### What is not a gap

Read before acting on the list above, because several things that look alarming are recorded
decisions with their reasons attached, and re-opening them costs a morning each:

- **`check:cited-items` is not in CI on purpose** (`ci.yml`, citing `7d10c14d`): a never-gating
  check in a green log manufactures coverage.
- **The SQLite index is not a compatibility surface** (`VERSIONING.md`); a schema move is MINOR.
- **The two-phase e2e gate is a ruling** (2026-09-04), measured over four runs; it is not an
  override of the flake rule.
- **`markdown-it` is vendored, not depended on**; zero runtime dependencies holds.
- **The self-improvement loop's dials sit where they do by ruling** (D36: "his, after a week of
  `state/review-last-pass.json`").
- **`reports/` is enormous by design**: it is the project's write surface for reviews, and the
  corpus is where conclusions go. The 2026-09-15 audit found 0 of 119 review rows unfiled.
- **The in/out cut of 2026-09-04 being declined is not a mistake**; the mistake would be to
  leave "everything" undated. §5 Phase 1 keeps the ruling and adds the date.

---

## 5. The plan to close them

Five phases, in order, each with an exit condition a gate can test. Durations assume the working
pattern the record shows (one owner, several lanes, most days). Nothing below invents a new
tracker: every task named is an existing item or a proposed one to be filed as an item.

### Phase 0 — Make the repository tell the truth (2–3 days)

The only phase that is a prerequisite for everything else, and the only one that needs no
design.

1. **Fix the 26 documentation citations** and re-run `verify:citations` to exit 0. Then decide,
   once, whether `--strict-source` (38) flips on; the script's own comment says the flip is the
   repair itself.
2. **Make the suite portable.** File one task, `plan:fixes`, closing on: `npm test` green from a
   fresh clone with no `.my_context/.staging`, no archive, and `mycontext` off PATH. The seven
   environmental tests either create what they read, or skip with a *named* reason that
   `check:basis` accepts, or move to a `test:local` script — the rule
   `RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none` already gives the shape.
3. **Re-run `npm run gen:docs`** (README `status` example) and retire or rewrite the Node-warning
   test (its own failure message proposes the reason).
4. **Resolve the 53 temp-path `source_file` values**: `edit --unlink` (D3.7 exists for this) or a
   `pack`-style clearing; acknowledging them hides the exit code on one machine only.
5. **Add one CI job that runs the unit suite on a clean runner even when a doc gate is red** —
   or move `verify:citations` after `npm test`. The current order means a stale citation silences
   the whole suite. `ci.yml`'s own comment explains why it is before; the cost it did not
   anticipate is 27 days blind.
6. **Retire `docs/ROADMAP.md`'s "single tracking document" claim and `CONTINUE-HERE.md`'s table**
   the way `EXECUTION-BOARD.md` was retired: a header that names `mycontext ready` and stops.

**Exit:** master green on both matrix jobs; `npm test` green in CI; `doctor` exit 0 from a clone.

### Phase 1 — Freeze v2.0 (half a day, the owner's)

1. **Date the set.** A decision: *"v2.0 is every task open on 2026-09-2X; a task filed after that
   date is v2.1 unless it is P1 and names the shipped surface it breaks."* Implemented as a tag
   (`v2.0`) on the frozen items — the mechanism the 2026-09-04 cut noted was never applied. The
   owner's ruling ("nothing remains out") is kept; it gains a date.
2. **Triage the ~20 unschedulable tasks**: give each a `plan`/`seq`/`state`/`priority`, retire the
   three duplicate twins, and file the gate `CONTINUE-HERE.md` asked for (add refuses a task with
   no plan/seq/state, or `doctor` reports it). Fold into `review/10`.
3. **Ask `check:board`'s two questions**: close the 21 subjects "open with every item done", and
   claim or retire the 23 orphans.
4. **Measure the burn-down weekly with one number**: `mycontext ready --json | .open`. Filing
   rate must be below closing rate for three consecutive weeks before a tag is discussed. The
   existing `STD-v2-0-progress-report-…` format can carry it; the question of an embedded instance
   (its §11) should be answered "no" — the number is computed, not stored.

**Exit:** a `v2.0` tag on N items, N written in the decision, and no untagged open task.

### Phase 2 — Correctness, silent failures, hardening (2 weeks, lanes)

The P1 set that is lane-able today, plus the class guards:

- `rulings/113` (UI record deleted by throwaway servers), `rulings/80` (one unreadable directory
  makes the sync delete everything), `store/7` (partial pack import), `rulings/84` (CSP — raise
  from P3), the three active `known_issue`s on containment, Host-as-token, and the bare URL.
- The `swallow` family through `swallow/15` (build the guard), and a decision resolving
  `INV-hooks-fail-open` vs `INV-nothing-is-dropped-silently` for the corrupt-config case.
- `rulings/85`, `/86`, `/88`, `/91` (the closed-set and parse-boundary typing that the type-design
  review found), `walk/146`/`/147` (zero-for-unmeasured).
- `semantic/10` (the one `doing`; its `tool_result` cap decision is the owner's — take it).

**Exit:** no open P1 outside `walk`/`wcag`/docs; the swallow gate in CI; the two browser gates
that are red on HEAD green or retired with reason.

### Phase 3 — The UI and accessibility, with the owner's time scheduled (3 weeks)

- **Batch the owner-gated work.** Fix screen-review sessions (two a week, one hour): the lane
  prepares the screen against the mockup, the owner looks, tasks close in the session. This is
  the only way the `walk` count moves; today those tasks wait on an unscheduled event.
- **Order:** `wcag/1`–`/4` (structural: reflow, names, skip link, footer) before `wcag/5`–`/9`;
  `screens/23`/`/24` (the shared help component) before `walk/144` (hover help); `dxfindings/2`
  (Doctor screen) and the Configure screen before the remaining `walk` polish.
- **Answer the four open questions that block screens** (Export/import ever imports; credential
  survives a reload; the three PROPOSED screens; the em dash on Status) — each is a ruling, not a
  build.

**Exit:** `walk` and `wcag` at zero or explicitly re-tagged v2.1 by the owner in a screen session.

### Phase 4 — Documentation truth, then Hebrew (2 weeks, can overlap Phase 3)

`rulings/102` (README's three false claims), `/115` (retired items cited as live), section 8's
retirement to completion, `rulings/101` screenshots (the English shot list — the owner's
sequencing ruling), then `rulings/109` Hebrew. Add a chapter each for the six subjects the
2026-09-16 map rates as undocumented, starting with the board and the search grammar, because
those are what a `2.0.0` user meets first. Then `gen:docs` and `verify:citations --strict-source`.

**Exit:** `verify:citations` exit 0 with `--strict-source`; every chapter carries its date.

### Phase 5 — Cut `2.0.0` (one day)

`VERSIONING.md` §"Cutting a release" as written: close `[Unreleased] — 2.0.0 when tagged`
(627 lines today — it will need an editor's pass, not a rewrite), `set-version`, `gen:docs`, the
full gate set, tag. `release.yml` is the proof; it has not run green since `1.0.2`.

### What the plan does not do

It does not propose a date. At the observed net closing rate the frozen set decides the date, and
the frozen set does not exist yet. Phase 0 is two to three days on the evidence; Phase 1 is one
ruling; after that the number in `ready` is the schedule.

---

## 6. GSD — should it run the mission to 2.0?

**No, not as the planning or tracking system. Yes to two of its ideas, as corpus items.**

### What GSD is, as of 2026-09-21

Get Shit Done (now `@opengsd/gsd-core`, v1.7, the original repository archived 2026-06-26) is a
context-engineering and spec-driven framework: a five-step loop per phase — discuss, plan,
execute in parallel waves with fresh 200k contexts, verify, ship — over files it owns under
`.planning/` (`PROJECT.md`, `ROADMAP.md`, `STATE.md`, `REQUIREMENTS.md`, `CONTEXT.md`, per-phase
`PLAN.md`/`SUMMARY.md`/`VERIFICATION.md`), with 54 slash commands, an `/gsd-onboard` path for an
existing codebase, a plan-check loop, a verifier, and a milestone definition-of-done audit.

### Why not here

1. **It is a second board.** `.planning/ROADMAP.md` and `STATE.md` would be a hand-kept copy of
   what `mycontext ready`, `needs:`, `plan`/`seq` and the D map already compute. That is exactly
   the defect this project measured on 2026-09-07 and retired `EXECUTION-BOARD.md` over, and
   `CLAUDE.md` names it as the one rule it repeats. GSD's own `planning.commit_docs: true`
   default would put the copy in git.
2. **The project already has GSD's execution model.** `superpowers:subagent-driven-development`
   is required by every plan in `docs/superpowers/plans/`; lanes already run in worktrees with
   fresh context, the dispatcher commits, and the verification loop here (removal proofs, `@basis`,
   planted controls, "a verified claim makes its neighbours look verified") is stricter than
   GSD's plan-check. Switching would re-learn 27 specs' worth of conventions inside a framework
   that does not know them.
3. **The corpus already ruled on GSD**, twice, on 2026-08-19 (`v2-scope-decisions.md` §6f and
   §6g): *compose by convention, zero code*; `mycontext` never reads `~/.gsd/`; GSD's mandatory
   `<canonical_refs>` slot is where mycontext item paths would go if the two ran together. Those
   rulings are about interop for a *user* of both; they say nothing that supports GSD driving this
   repository's own work.
4. **The bottleneck GSD addresses is not this project's.** GSD exists to keep an agent from
   drifting across a long build without a spec. This project's problem is the opposite: the spec
   and the record are excellent, and the two things that are missing — a green gate and a frozen
   scope — are a fix and a ruling, not a methodology.
5. **Mid-stream adoption cost.** `/gsd-onboard` maps the codebase with four agents and writes
   `.planning/codebase/`; that is a fifth description of a system that already has a subject map
   (`2026-09-16-the-subjects-of-this-system.md`), 17 chapters and 8 system documents, all of which
   have just been through two verification passes. The onboarding output would be the least
   verified document in the tree on the day it was written.

### What to take from it

- **A milestone definition-of-done audit** (`/gsd-audit-milestone`). This project has no item
  that says what "2.0.0 is done" means beyond "every open task". Phase 1 above is that item:
  the frozen tag, the gate set green, `release.yml` green, `doctor` exit 0 from a clone.
- **A UAT step with an owner in the loop** (`/gsd-verify-work`). The owner-gated `walk` tasks are
  a UAT backlog without a UAT session. Phase 3's scheduled screen sessions are that step, kept as
  a `standard` item rather than a command.

### If the owner wants it anyway

Use it narrowly and keep it out of the record: `/gsd-quick` (or `--validate`) for isolated fixes
in Phase 0 and 2, `planning.commit_docs: false`, `.planning/` in `.gitignore`, never `ROADMAP.md`
or `STATE.md`, `git.branching_strategy: "none"`, and re-evaluate after Phase 0. If after two weeks
lanes report it helped, record it as a decision with the measurement; if not, remove it and record
that. Either way the corpus stays the only place a rule lives.

---

## 7. What this review could not verify, stated plainly

- Whether the 27-day red streak has one cause or several; only the latest run's steps were read.
- The browser suite's true state on a correctly pinned browser (see §8).
- Whether `test/ui/execute-route.test.ts:702` and `test/cli/pack-import.test.ts:529` are
  environmental; neither was isolated.
- The exact number of owner-gated `walk` tasks (between 2 and 33 depending on how the rule is
  cited in bodies).
- Anything the session-start injection would have delivered: the MCP server did not connect in
  this session, so pinned items were read from `.my_context/items/` directly and nothing was
  delivered as an index.
- Perf (`test:perf`) was not run.
