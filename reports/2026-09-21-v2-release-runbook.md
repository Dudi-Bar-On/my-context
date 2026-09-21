# Releasing 2.0.0 — the runbook

**For the owner. Read this once, make the decisions in §2 in one sitting, then hand the
session the prompt in `reports/2026-09-21-v2-release-prompt.md` and follow the checkpoints.**

Owner's ruling for this runbook, 2026-09-21: **nothing is deferred. Every open task is 2.0.0,
no exceptions.** That keeps the 2026-09-05 ruling as written. Consequences are stated in §1
and §9 rather than softened.

Everything here rests on three reviews done on 2026-09-21 from a fresh clone
(`reports/2026-09-21-external-status-review.md`, `…-installed-as-a-new-user.md`,
`…-capabilities-reviewed-and-scored.md`) and on a triage of all 160 open tasks against the
code, whose result is in §7. Where this runbook and the board disagree, the evidence in §7 is
why.

---

## 1. What "2.0.0 released" means

All of these, at once, on one commit:

1. **`mycontext ready` prints no rows.** Every task open today is closed by a landed change,
   closed as already done with its evidence, or retired because its premise was retired. None is
   tagged for later.
2. `master` CI green on **both** matrix jobs (Windows and Ubuntu), including the browser suite
   on Ubuntu.
3. On a fresh clone on any machine: `npm test` green, `mycontext doctor` exit 0, every
   `check:*` gate exit 0, `verify:citations` exit 0.
4. A stranger who installs from the README, creates a project, and captures one rule sees that
   rule's **body** at the next session start.
5. `CHANGELOG.md` has a `## [2.0.0] - <date>` section, `package.json` and both plugin
   manifests say `2.0.0`, the tag `v2.0.0` exists, and `release.yml` produced the GitHub release.

**What that costs.** 115 of the open tasks are real work that no stranger would hit on
install: accessibility, typography, silent-failure disclosures, refactors, screenshots, the
Hebrew edition, and eight new features. With the six board blockers and nine review defects
that makes about 140 tasks of lane work. At the pace the record shows (roughly 50 tasks closed
in a good week when nothing new is filed), that is **four to six weeks**, not three days. The
plan below sequences it so the repository is green and shippable from the end of phase 3
onward; everything after that is you choosing to keep the ruling rather than cut.

**The one rule that makes it finite.** Nothing is deferred, and nothing new is filed during
the release without you seeing it: a finding a lane makes is fixed on the spot if it is in a
file that lane already holds; otherwise it appears in the checkpoint report as a count, and you
say at that checkpoint whether it joins 2.0. Filing outpaced closing for six weeks; the board
reaches zero only if every addition is a decision you make, not a reflex.

---

## 2. Your decisions, before anything runs (about one hour)

The session cannot make these. Each has a default; saying "defaults" for all of them is a
valid answer and the prompt is written for that.

| # | Decision | Default | Why it is yours |
|---|---|---|---|
| A | **New findings during the release** join 2.0 only when you say so at a checkpoint. | yes | Without it the board cannot reach zero. |
| B | **The three mockup-parity browser specs** (`e2e/screen-parity.spec.ts`, `pixel-parity.spec.ts`, `tree-parity.spec.ts`) are retired. `styles-parity` (a unit test on tokens) stays. | retire | They enforce the 1:1 rule you replaced with `DEC-the-mockup-is-a-reference-to-initial-thoughts-and-only-a`; two are red on HEAD. |
| C | **A full export is not importable.** `pack import` keeps refusing it; the changelog, `pack.ts:555` and the dead branch at `import.ts:523-529` are corrected to say so. Packs (`--as-pack`) stay the way knowledge travels. | declare non-importable | The alternative (ignore `config.json` on `kind === 'export'`) keys trust on an unsigned field. |
| D | **First session shows rule bodies.** Keep your 2026-09-07 "narrow form" (spare band only when something is pinned) and make `init`, the first normative capture, and README §4 say in one line that nothing is pinned yet and how to pin. | keep the ruling, add the sentence | Changing the selector is a behaviour change you ruled on; the sentence is not. |
| E | **Content-Security-Policy on**, `script-src 'self'`, as the suspending comment in `security.ts:593` recommends. | on | You suspended it on 2026-08-22; turning it back on needs your word. |
| F | **The dispatch gate's grammar** requires a lowercase slug after the prefix. | yes | It refuses prompts containing `READ-ONLY` or `SHA-256` today. |
| G | **The 11 owner-only tasks** (§7.3): each needs your ruling in one line; none can be parked. | see §7.3 for a default ruling per row | Nobody else can rule. |
| H | **Retire the 11 obsolete tasks and close the 17 done ones** (§7.1, §7.2). | yes | Each has evidence; the session does the writes if you say yes. |

Write your answers in one message; the prompt has a slot for them.

---

## 3. The phases, and what each one closes

Ten phases. The repository is green and releasable at the end of phase 3; phases 4 to 8 are
the rest of the board under the no-deferral ruling; phase 9 is yours; phase 10 is the cut.

| Phase | Closes | Tasks | Lane days (estimate) |
|---|---|---|---|
| 1 — the repository tells the truth | CI green, fresh-clone green, cleanup | B1, B2, B3, B15 + cleanup | 2 |
| 2 — the board says what is left | 17 done closed, 11 obsolete retired, your 11 rulings recorded | §7.1, §7.2, §7.3 | 0.5 |
| 3 — the defects | the six board blockers and nine review defects | B4 to B14 | 2 |
| 4 — silent failures and disclosures | every "could not measure" or swallowed error says so | 17 (§7.4) | 2 |
| 5 — CLI, store, types and hygiene | flag vocabulary, closed-set types, store changelog, perf percentiles, lane safety | 28 (§7.5) | 3 |
| 6 — the web UI: function, accessibility, gates | every functional finding, WCAG conformance, keyboard, reflow, typography, help adoption, gate re-derivation | 55 (§7.6) | 8 |
| 7 — features | typed SQL on Ask, `init --rewrite-watched`, budget carry, delivery-log report, archive said/ran control, simulator anchoring | 8 (§7.7) | 4 |
| 8 — documentation | retired rulings, README claims, screenshots in every English chapter, Hebrew edition parity, chapter 10 | 7 + B5 + B14 (§7.8) | 4 |
| 9 — yours | the stranger test on Windows; every screen looked at on the real corpus (`port/99`); the nine hook events fired on your machine (`swallow/16`) | 3 | your time |
| 10 — the cut | changelog, version, gates, tag, release | `VERSIONING.md` | 0.5 |

Sizes are lane days with lanes in parallel where files do not collide; wall-clock is longer
because of your checkpoints. Phase 6 is the long pole and is the one place where a checkpoint
red is likely to take more than one round.

---

## 4. What blocks a green repository (phases 1 and 3, in detail)

Sizes: S under an hour, M a few hours, L a day.

| # | What | Where | Size | On the board as |
|---|---|---|---|---|
| B1 | Outside-repository guard passes an absolute path on another Windows drive; 84 items carry `C:/…/Temp/…` provenance, 55 with checksums; `doctor` exits 1 on every other machine | `src/core/reference.ts:236` + a repair of the 55 items | S + S | not filed |
| B2 | 26 broken documentation citations keep `verify:citations` red, so CI has been red since 2026-08-21 | `npm run verify:citations`; e.g. `docs/superpowers/plans/2026-08-16-web-ui-1-server-and-reads.md:500-518` | M | `rulings/47` |
| B3 | Seven unit tests read the owner's machine; README `status` example stale; the Node-warning test pins a warning Node 24.21 stopped printing | `test/ui/staging-endpoint.test.ts:456`, `test/ui/palette-screen.test.ts:511`, `test/rules/seed-numbering.test.ts:122`, `test/docs/examples.test.ts` ×5, `test/cli/experimental-warning.test.ts:122` | M | not filed |
| B4 | Two browser gates red on HEAD; the suite runs in CI on Ubuntu | `ui-gates/1`; the 49 reds in `reports/2026-09-21-external-status-review.md` §8 | M | `ui-gates/1`, `rulings/114` |
| B5 | Thirteen documentation sites cite seven retired items as live rulings | `npm run check:cited-items`; `docs/capabilities/03-…:401`, `14-…:251`, `docs/system/01-…:290`, `10-rule-store.md:331,350`, `07-focus.md:224` + Hebrew twins | M | `rulings/115` |
| B6 | `mycontext --version` is "unknown command" | `src/cli/index.ts` | S | `hooks/35` |
| B7 | `status_report` (MCP) drops every could-not-measure disclosure and prints zero errors | `src/mcp/tools.ts:2119-2124` (the doctor tool at `:1501` has the sentence to copy) | S | `walk/146` |
| B8 | Review loop: read offset is per workspace, not per transcript; a second session's head is skipped and reported "read WHOLE" | `src/review/pass.ts:400`, `src/review/trigger.ts:232` | S | not filed |
| B9 | Review loop: `--ceiling 0` becomes "no ceiling" in the detached child | `src/review/pass.ts:674` | S | not filed |
| B10 | Full-export import contradiction (decision C) | `src/pack/import.ts:318`, `:523-529`, `src/cli/commands/pack.ts:555`, `CHANGELOG.md` | S | not filed |
| B11 | Dispatch gate grammar (decision F) | `src/hooks/pre-tool-use.ts:555` | S | not filed |
| B12 | Rule store seals an entry that fails to parse and `verify` reports intact; one test mutates the shipped store | `src/rules/manifest.ts:75,206`; `test/cli/rules.test.ts:59,292` | S | not filed |
| B13 | First-session sentence (decision D) | `src/cli/index.ts` (`cmdInit`, `cmdAdd`), `README.md`, `docs/README.he.md` | S | not filed |
| B14 | README false claims: `mycontext help <command>` (§3), `init` creating `items/` (§5); the generated `status` example; the changelog's "reads a full export" | `README.md`, `docs/README.he.md`, `CHANGELOG.md` | S | not filed |
| B15 | CI order: `verify:citations` sits before `npm test`, so a stale citation hides the suite | `.github/workflows/ci.yml:154` | S | not filed |

---

## 5. Cleanup for a clean repository (phase 1)

- Delete the three stray screenshots at the root: `simulate-before.png`, `simulate-rec.png`,
  `stair-after.png` (1.9 MB, referenced by nothing).
- Give `docs/ROADMAP.md` and `reports/CONTINUE-HERE.md` a retirement header like
  `reports/EXECUTION-BOARD.md` has; they still present as live.
- Retire the three parity specs (decision B) and fix or delete
  `harness/self-test/run.test.mjs:18` (asserts a warning Node no longer prints; wired to nothing).
- Fix `scripts/e2e-gate.ts:208-277` so the scratch directory is removed (`process.exit` inside
  `try/finally` skips the `finally`).
- Add `fetch-depth: 0` to `actions/checkout` in `ci.yml`, or accept that `check:board`'s drift
  tier is vacuous in CI and say so in its comment.
- Keep `.my_context.nested-44/` (two tests read it) and keep `reports/` (it is the record).

---

## 6. Running it

**Where.** Your Windows development machine, in the repository root, on a branch
`release/2.0.0` cut from `master`. Linux is verified by the Ubuntu CI job on every push of that
branch, which also runs the browser suite; you do not need a Linux machine, though one run of
§8 in WSL is worth doing if you have it.

**With what.** Claude Code with the `superpowers` plugin (the plans in `docs/superpowers/plans/`
already require its subagent-driven development skill) and this repository's own plugin
installed, which it is. Not GSD: it would add a second board beside `mycontext ready`.

**How.**

1. `git checkout -b release/2.0.0 master`, then merge `claude/hopeful-bell-adnyqk` (the three
   reviews and this runbook) into it.
2. Open Claude Code in the repository root. Paste the whole of
   `reports/2026-09-21-v2-release-prompt.md`, with your §2 answers filled into its slot.
3. The session writes a plan file under `docs/superpowers/plans/` first, files one `task` item
   per phase (the dispatch gate needs it), and then executes phase by phase. It stops at the end
   of every phase and reports. **Do not let it continue past a checkpoint whose command is not
   green.**

**The checkpoints, and what you run yourself at each** (PowerShell or bash, same commands):

| After phase | You run | Must show |
|---|---|---|
| 1 | `npm test`; `npm run verify:citations`; `node src/cli/index.ts doctor` | 0 failures; exit 0; exit 0 |
| 2 | `node src/cli/index.ts ready` | 17 fewer rows and 11 fewer rows; your 11 rulings recorded |
| 3 | `npm test`; push; open the Actions page | green on **both** jobs, browser suite included |
| 4, 5, 7 | `npm test`; `node src/cli/index.ts ready`; the Actions page | green; the phase's rows gone |
| 6 | the same, plus `npm run test:e2e` on your machine with the pinned browser | green; the phase's rows gone |
| 8 | `npm run gen:docs`; `npm test`; `npm run verify:citations`; `npm run check:cited-items` | all clean; Hebrew mirror in lockstep |
| 9 | §8 below, then `node src/cli/index.ts ready` | the rule body appears; **no rows** |
| 10 | `git tag -l v2.0.0`; the Actions page for `release.yml` | tag exists; release created |

If a checkpoint is red, tell the session which command and paste the output. It fixes and
re-reports; it does not move on.

---

## 7. The triage of the 160 open tasks, and where each lands

Every row was checked against the code on 2026-09-21. "Done" means the task's own closing
condition is met in the tree.

### 7.1 Done but not marked (17) — phase 2 closes them

| Task | Evidence |
|---|---|
| `anchors/13` | commit `36fc10ec`; `src/cli/commands/conversation.ts:309-345`; `src/core/anchor-pass.ts:1431` |
| `rulings/109` | 17 `docs/capabilities/*.he.md` + 8 `docs/system/*.he.md`; `test/docs/parity.test.ts:233-239` |
| `rulings/112` | `src/ui/public/styles.css:1410-1450`; commit `09baab60` |
| `rulings/113` | `src/core/ui-server-record.ts:343-360`; `test/ui/server-record-claim.test.ts`, `server-record-ownership.test.ts` |
| `semantic/15` | commit `ef52818f`; `conversations.js:6187`; `styles.css:4631-4645`; `e2e/conversations-panels.spec.ts:223-232` |
| `semantic/17` | `app.js:5289-5292`; `en.js:2432`; `e2e/strip-picker.spec.ts` |
| `screens/27` (headings tick) | commit `06cb85e7`; `screens/parts.js:581-604` |
| `ui2/13` | `config.js:1291`, `:650-662`, `:405-411`, `:997`; `test/ui/config-screen.test.ts` |
| `ui2/10p` | `palette-defs.js` `FLAGS_NOT_OFFERED`; `test/ui/palette-lib.test.ts:731` (a decision filed as a task) |
| `walk/129` | its own text: closes with `builder/11`, which is done |
| `walk/161` | `src/cli/commands/rules.ts:302-318` |
| `TASK-parseitem-casts-status-severity-origin…` and its `-2` twin | `src/core/item.ts:678-679,719` via `readEnum`; `rulings/69` done |
| `TASK-the-write-must-be-in-contradiction-scope…` and its `-2` twin | `docs/capabilities/03-creation-and-gates.md:439-451` |
| `TASK-the-live-feed-notice-says-reload…` | `app.js:2790-2826`; `test/ui/live-skew-notice.test.ts` |
| `TASK-a-shared-item-id-across-ops-leaves-watch-model…` | `test/ui/watch-model.test.ts:213-218` |

### 7.2 Obsolete (11) — phase 2 retires them, naming the successor

| Task | Why |
|---|---|
| `port/93` pixel parity | value differences are ruled out by `DEC-the-mockup-is-a-reference…` test 3 |
| `port/98` screen-by-screen walk against the mockup | the 1:1 bar was retired; condition 3 was `walk/23`, done |
| `walk/4` tree walker ignores PROPOSED | `tree-parity.spec.ts:19` only measures |
| `rulings/84` CSP | contradicts your 2026-08-22 ruling; reopened as decision E instead |
| `rulings/63` demo corpus | `.demo-corpus` was retired 2026-09-07 (`scripts/demo-corpus.ts:2-10`) |
| `review/4` audit 39 skills | there is one skill; the 39 no longer exist |
| `ui2/5r` edit the mockup's reason | the mockup is frozen (`DEC-the-mockup-is-a-frozen-reference…`) |
| `walk/150` loading label | duplicate of `walk/139`, which is in phase 6 |
| `TASK-58-of-its-rows…` and its `-2` twin | duplicate: `rulings/71` done + `rulings/82` in phase 7 |
| `TASK-d33-s-gate…` | its own backfill says it names no surface |

### 7.3 Owner-only (11) — your ruling in one line each, recorded in phase 2, done where it lands

| Task | What you must say | Default ruling | Lands in |
|---|---|---|---|
| `port/99` LAST UI TASK | you look at every screen on the real corpus and say done | you do it in phase 9 | 9 |
| `anchors/12` | answer `OPENQ-does-the-table-mark-or-the-lane-report-mark-win…`, then the rebuild runs on your archive | the table mark wins; rebuild in phase 7 | 7 |
| `hooks/22` autonomous from the first second | confirm the hooks programme is the finished ground | yes; the survey runs in phase 5 | 5 |
| `review/10` promoted items have no plan/seq | option 1, 2 or 3 in the item | option 1: `promote` asks `--plan/--seq` | 5 |
| `rulings/89` in-sync chip | does report 3 overturn your 2026-08-31 ruling | no; retire the task | 2 |
| `walk/66` ledger projection | live or batch | batch; record the decision, close | 2 |
| `walk/167` visible confirmation | approved chrome or not | approved; unify both screens | 6 |
| `walk/14` budget carry from the simulator | still wanted after the 2026-09-07 re-cut | yes; build it | 7 |
| `handover/16` pointer convention | becomes a rule or not | yes; write the rule item | 2 |
| `swallow/16` stderr disclosures | you fire the nine hook events on your machine and record which show | you do it in phase 9 | 9 |
| `TASK-scripts-backfill-requests-ts…` | authorise `node scripts/backfill-requests.ts .my_context --apply` | authorise, after B1's repair | 3 |

### 7.4 Phase 4 — silent failures and disclosures (17)

`swallow/9`, `swallow/11`, `swallow/13`, `swallow/14`, `swallow/15`, `unread/6`, `rulings/80`,
`rulings/81`, `rulings/85`, `rulings/88`, `dxfindings/6`, `walk/147`, `walk/148`, `store/7`,
`store/13`, `live/28`, `TASK-the-audit-log-still-records-two-session-ids…`.

### 7.5 Phase 5 — CLI, store, types and hygiene (28)

CLI and prose: `rulings/76`, `rulings/83`, `rulings/87`, `rulings/92`, `rulings/38`,
`rulings/93`, `cliscript/5`, `cliscript/6`, `contra/5`, `walk/11`, `walk/142`, `walk/162`,
`hooks/22` (per G), `review/10` (per G).
Store, types, perf: `rulings/77`, `rulings/78`, `rulings/86`, `rulings/91`, `store/10`,
`store/11`, `store/12`, `hooks/12q`, `accretion/6`, `repaint/12`, `dxfindings/4`, `live/20`,
`live/24`, `confirm/6`, `readmodel/2`, `readmodel/4`.

### 7.6 Phase 6 — the web UI (55)

Functional (24): `walk/2`, `walk/12`, `walk/32`, `walk/33`, `walk/39`, `walk/57`, `walk/59`,
`walk/76`, `walk/89`, `walk/100`, `walk/102`, `walk/105`, `walk/119`, `walk/134`, `walk/139`,
`walk/149`, `walk/151`, `walk/152`, `walk/153`, `walk/154`, `walk/155`, `walk/163`, `walk/164`,
`walk/166`, `walk/167` (per G).
Accessibility and typography (26): `wcag/1` to `wcag/9`, `dxfindings/2`, `screens/23`,
`screens/24`, `screens/25`, `screens/26`, `screens/27` (the question in the viewer),
`builder/12`, `builder/18`, `ui1/17b`, `walk/144`, `walk/156`, `walk/157`, `walk/158`,
`walk/159`, `walk/160`, `walk/165`, `walk/168`, `walk/169`.
Browser gates (4): `walk/15`, `walk/43`, `walk/55`, `port/101`.

### 7.7 Phase 7 — features (8)

`ui3/15` typed SQL on Ask (L), `walk/8` simulator anchored on the real window, `walk/18`
`init --rewrite-watched`, `walk/106` `watchedDocs` printed and checked, `budget/6` edited budget
shows what it was, `rulings/82` a reporting surface for the delivery log, `semantic/10` the
said/ran control on Conversations and the `tool_result` cap, `walk/141` Ask and Capture
reviewed as they are now; plus `anchors/12` and `walk/14` per G.

### 7.8 Phase 8 — documentation (7 + B5 + B14)

`rulings/101` screenshots in every English chapter and system document (the shot list the
Hebrew edition follows), `docsys/11`, `library/6`, `rulings/67`, `rulings/79`, `rulings/111`,
`walk/143`, plus B5 (retired rulings cited as live) and B14 (README claims), and chapter 10
line 453.

---

## 8. The stranger test (fifteen minutes, yours, phase 9)

On your Windows machine, and once in WSL or any Linux box if you have one:

```
mkdir C:\tmp\stranger && cd C:\tmp\stranger && git init
mycontext init
mycontext add rule "Never log customer email" --body "Logs ship to a third party." --summary "Customer email addresses must not appear in any log line." --yes
mycontext status
mycontext doctor
claude
```

In the session: the session-start block must carry the rule's **body**, not only its title
(decision D). Then `claude plugin details mycontext@mycontext` must list 18 hooks and 1 MCP
server. Then `mycontext --version` must print `2.0.0`.

Phase 9 also has your two board rows: look at every screen on the real corpus and say done
(`port/99`), and fire the nine hook events on your machine and record which show a stderr
disclosure (`swallow/16`). The session gives you the list for each.

---

## 9. What can go wrong

- **The board grows while you close it.** Every checkpoint report carries "filed for 2.0:
  <count>". If that number is not zero at three checkpoints in a row, the release is not
  converging and the only fix is your word at the checkpoint.
- **Phase 6 is eight lane days on files every lane touches** (`app.js`, `conversations.js`,
  `styles.css`). The prompt orders the lanes so two never hold the same file; if you see two on
  one file, stop one.
- **The Windows CI job fails on a perf ceiling.** `test:perf` runs in `release.yml`, not
  `ci.yml`; a hosted Windows runner is slow. If a perf test is the only red at tag time, re-run
  once; if it fails twice, widen that one ceiling with its measurement, as the existing headers
  do.
- **The browser suite needs its pinned Chromium.** On your machine `npx playwright install
  chromium` once. In CI the Ubuntu job installs the headless shell itself.
- **The session's own dispatches get refused.** The dispatch gate requires every Agent prompt
  to name an existing item or carry `no-item: <reason>`. The prompt files one task per phase and
  names it; a refusal means decision F is not yet applied, and `no-item:` is the hatch.
- **The changelog.** Its `[Unreleased]` section is 627 lines and phases 3 to 7 add to it. The
  session closes it as `## [2.0.0]`; if you want it edited down, say so at checkpoint 8 and it
  becomes part of phase 8.

---

## 10. How the lanes are dispatched, and what survives a compaction

Nothing here is a new tool. The board is the state machine and git is the memory.

- **The state is the task items.** Each task is `todo`, `doing` or `done` in its own file under
  `.my_context/items/task/`, committed. `mycontext ready` recomputes what is dispatchable from
  those fields every time it runs; nothing is kept by hand.
- **Waves.** The session picks up to three ready tasks whose files do not overlap, marks each
  `doing` (committed, pushed), dispatches one lane per task in parallel, and when a lane returns
  it verifies the evidence, runs the fast checks, commits by explicit pathspec, marks `done`,
  pushes. Tasks that share a file run one after the other. Phase 6 is pre-ordered into five lane
  groups for exactly this reason.
- **Checkpoints are a committed log.** Every checkpoint report is appended to
  `reports/2026-09-2X-release-checkpoints.md` and committed, so the last entry always says
  which phase and which wave the release is in.
- **After a compaction or a new session** the session reads the handover block the plugin
  injects, the checkpoint log, the plan file, and `mycontext ready`; any task marked `doing`
  with no lane alive is reset to `todo` and re-dispatched. That is the whole recovery: no
  reconstruction, because every claim and every close was committed the moment it happened.
- **Compared with GSD's phases:** GSD keeps `STATE.md` and `ROADMAP.md` as hand-written files
  beside the code; here the same two facts are the board (computed) and the plan file
  (committed), plus the plugin's own PreCompact snapshot and handover ask. It is the same idea
  with one copy instead of two, which is the rule this project already lives by.
