# Releasing 2.0.0 — the runbook

**For the owner. Read this once, make the decisions in §2 in one sitting, then hand the
session the prompt in `reports/2026-09-21-v2-release-prompt.md` and follow the checkpoints.**

Everything here rests on three reviews done on 2026-09-21 from a fresh clone
(`reports/2026-09-21-external-status-review.md`, `…-installed-as-a-new-user.md`,
`…-capabilities-reviewed-and-scored.md`) and on a triage of all 160 open tasks against the
code, whose result is in §7. Where this runbook and the board disagree, the evidence in §7 is
why.

---

## 1. What "2.0.0 released" means

All of these, at once, on one commit:

1. `master` CI green on **both** matrix jobs (Windows and Ubuntu), including the browser suite
   on Ubuntu.
2. On a fresh clone on any machine: `npm test` green, `mycontext doctor` exit 0, every
   `check:*` gate exit 0, `verify:citations` exit 0.
3. A stranger who installs from the README, creates a project, and captures one rule sees that
   rule's **body** at the next session start.
4. `CHANGELOG.md` has a `## [2.0.0] - <date>` section, `package.json` and both plugin
   manifests say `2.0.0`, the tag `v2.0.0` exists, and `release.yml` produced the GitHub release.
5. The board's open set is the 2.1 list and nothing else: every 2.0 item closed, every
   deferred item tagged `v2.1`, every obsolete item retired.

Not part of 2.0.0: accessibility conformance, Hebrew screenshots, the UI performance
redesign, new features. Those are 2.1 and the list is in §7.

---

## 2. Your decisions, before anything runs (about one hour)

The session cannot make these. Each has a default; saying "defaults" for all of them is a
valid answer and the prompt is written for that.

| # | Decision | Default | Why it is yours |
|---|---|---|---|
| A | **Freeze.** 2.0 is the blocker list in §3 plus the cleanup in §4. Everything else open today becomes 2.1. | yes | Reverses the letter of your 2026-09-05 "everything open is 2.0" ruling; keeps its spirit by dating it. |
| B | **The three mockup-parity browser specs** (`e2e/screen-parity.spec.ts`, `pixel-parity.spec.ts`, `tree-parity.spec.ts`) are retired. `styles-parity` (a unit test on tokens) stays. | retire | They enforce the 1:1 rule you replaced with `DEC-the-mockup-is-a-reference-to-initial-thoughts-and-only-a`; two of them are red on HEAD. |
| C | **A full export is not importable.** `pack import` keeps refusing it; the changelog, `pack.ts:555` and the dead branch at `import.ts:523-529` are corrected to say so. Packs (`--as-pack`) stay the way knowledge travels. | declare non-importable | The alternative (ignore `config.json` on `kind === 'export'`) keys trust on an unsigned field. |
| D | **First session shows rule bodies.** Keep your 2026-09-07 "narrow form" (spare band only when something is pinned), and make `init`, the first normative capture, and README §4 say in one line that nothing is pinned yet and how to pin. | keep the ruling, add the sentence | Changing the selector is a behaviour change you ruled on; the sentence is not. |
| E | **Content-Security-Policy on**, `script-src 'self'`, as the suspending comment in `security.ts:593` recommends. | on | You suspended it on 2026-08-22; turning it back on needs your word. |
| F | **The dispatch gate's grammar** requires a lowercase slug after the prefix. | yes | It refuses prompts containing `READ-ONLY` or `SHA-256` today. |
| G | **The 11 owner-only tasks** (§7.3): answer each in one line, or write "2.1" beside it. | see §7.3 for a default per row | Nobody else can. |
| H | **Retire the 11 obsolete tasks and close the 17 done ones** (§7.1, §7.2). | yes | Each has evidence; the session will do the writes if you say yes. |

Write your answers in one message; the prompt has a slot for them.

---

## 3. What blocks 2.0.0 (the whole list)

From the board (six tasks) and from the reviews (nine defects, six of them not on the board).
Sizes: S under an hour, M a few hours, L a day.

| # | What | Where | Size | On the board as |
|---|---|---|---|---|
| B1 | Outside-repository guard passes an absolute path on another Windows drive; 84 items carry `C:/…/Temp/…` provenance, 55 with checksums; `doctor` exits 1 on every other machine | `src/core/reference.ts:236` + a repair of the 55 items | S + S | not filed |
| B2 | 26 broken documentation citations keep `verify:citations` red, so CI has been red since 2026-08-21 | `npm run verify:citations`; e.g. `docs/superpowers/plans/2026-08-16-web-ui-1-server-and-reads.md:500-518` | M | `rulings/47` |
| B3 | Seven unit tests read the owner's machine (`.my_context/.staging`, the real archive, a path `scrubOutput` does not know); README `status` example stale; the Node-warning test pins a warning Node 24.21 stopped printing | `test/ui/staging-endpoint.test.ts:456`, `test/ui/palette-screen.test.ts:511`, `test/rules/seed-numbering.test.ts:122`, `test/docs/examples.test.ts` ×5, `test/cli/experimental-warning.test.ts:122` | M | not filed |
| B4 | Two browser gates red on HEAD; the suite runs in CI on Ubuntu | `ui-gates/1`; the 49 reds in `reports/2026-09-21-external-status-review.md` §8 | M | `ui-gates/1`, `rulings/114` |
| B5 | Thirteen documentation sites cite seven retired items as live rulings | `npm run check:cited-items`; `docs/capabilities/03-…:401`, `14-…:251`, `docs/system/01-…:290`, `10-rule-store.md:331,350`, `07-focus.md:224` + Hebrew twins | M | `rulings/115` |
| B6 | `mycontext --version` is "unknown command" | `src/cli/index.ts` | S | `hooks/35` |
| B7 | `status_report` (MCP) drops every could-not-measure disclosure and prints zero errors | `src/mcp/tools.ts:2119-2124` (the doctor tool at `:1501` has the sentence to copy) | S | `walk/146` |
| B8 | Review loop: read offset is per workspace, not per transcript, so a second session's transcript head is skipped and reported "read WHOLE" | `src/review/pass.ts:400`, `src/review/trigger.ts:232` | S | not filed |
| B9 | Review loop: `--ceiling 0` becomes "no ceiling" in the detached child | `src/review/pass.ts:674` | S | not filed |
| B10 | Full-export import contradiction (decision C) | `src/pack/import.ts:318`, `:523-529`, `src/cli/commands/pack.ts:555`, `CHANGELOG.md` | S | not filed |
| B11 | Dispatch gate grammar (decision F) | `src/hooks/pre-tool-use.ts:555` | S | not filed |
| B12 | Rule store seals an entry that fails to parse and `verify` reports intact; one test mutates the shipped store | `src/rules/manifest.ts:75,206`; `test/cli/rules.test.ts:59,292` | S | not filed |
| B13 | First-session sentence (decision D) in `init`, the normative-capture confirmation, README §4 and its Hebrew mirror | `src/cli/index.ts` (`cmdInit`, `cmdAdd`), `README.md`, `docs/README.he.md` | S | not filed |
| B14 | README false claims: `mycontext help <command>` (§3), `init` creating `items/` (§5); the generated `status` example; the changelog's "reads a full export" | `README.md`, `docs/README.he.md`, `CHANGELOG.md` | S | not filed |
| B15 | CI order: `verify:citations` sits before `npm test`, so a stale citation hides the suite | `.github/workflows/ci.yml:154` | S | not filed |

Total: roughly three days of lane work plus your checkpoints. Nothing here is a design change.

---

## 4. Cleanup for a clean repository (in the same run)

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

## 5. Running it

**Where.** Your Windows development machine, in the repository root, on a branch
`release/2.0.0` cut from `master`. Linux is verified by the Ubuntu CI job on every push of that
branch; you do not need a Linux machine.

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
| 1 — repository tells the truth | `npm test`; `npm run verify:citations`; `node src/cli/index.ts doctor` | 0 failures; exit 0; exit 0 |
| 2 — board reconciled | `node src/cli/index.ts ready` | only the 2.0 rows left, all tagged `v2.0` |
| 3 — defects fixed | `npm test`; push; open the Actions page | green on **both** jobs |
| 4 — the stranger test | see §6 | the rule body appears |
| 5 — documentation | `npm run gen:docs`; `npm test`; `npm run verify:citations`; `npm run check:cited-items` | all clean; Hebrew mirror in lockstep (`test/docs/parity.test.ts`) |
| 6 — release cut | `git tag -l v2.0.0`; the Actions page for `release.yml` | tag exists; release created |

If a checkpoint is red, tell the session which command and paste the output. It fixes and
re-reports; it does not move on.

---

## 6. The stranger test (fifteen minutes, yours)

Do this on your Windows machine **and** it is worth doing once in WSL or any Linux box if you
have one; if not, the Ubuntu CI job plus the unit suite is the Linux evidence.

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

---

## 7. The triage of the 160 open tasks

Every row was checked against the code on 2026-09-21; evidence is in the four lane reports
summarised here. "Done" means the task's own closing condition is met in the tree.

### 7.1 Done but not marked (17) — close them

| Task | Evidence |
|---|---|
| `anchors/13` | commit `36fc10ec`; `src/cli/commands/conversation.ts:309-345`; `src/core/anchor-pass.ts:1431` |
| `rulings/109` | 17 `docs/capabilities/*.he.md` + 8 `docs/system/*.he.md`; `test/docs/parity.test.ts:233-239` |
| `rulings/112` | `src/ui/public/styles.css:1410-1450`; commit `09baab60` |
| `rulings/113` | `src/core/ui-server-record.ts:343-360`; `test/ui/server-record-claim.test.ts`, `server-record-ownership.test.ts` |
| `semantic/15` | commit `ef52818f`; `conversations.js:6187`; `styles.css:4631-4645`; `e2e/conversations-panels.spec.ts:223-232` |
| `semantic/17` | `app.js:5289-5292`; `en.js:2432`; `e2e/strip-picker.spec.ts` |
| `screens/27` | commit `06cb85e7`; `screens/parts.js:581-604` |
| `ui2/13` | `config.js:1291`, `:650-662`, `:405-411`, `:997`; `test/ui/config-screen.test.ts` |
| `ui2/10p` | `palette-defs.js` `FLAGS_NOT_OFFERED`; `test/ui/palette-lib.test.ts:731` (it is a decision filed as a task) |
| `walk/129` | its own text: closes with `builder/11`, which is done |
| `walk/161` | `src/cli/commands/rules.ts:302-318` |
| `TASK-parseitem-casts-status-severity-origin…` and its `-2` twin | `src/core/item.ts:678-679,719` via `readEnum`; `rulings/69` done |
| `TASK-the-write-must-be-in-contradiction-scope…` and its `-2` twin | `docs/capabilities/03-creation-and-gates.md:439-451` |
| `TASK-the-live-feed-notice-says-reload…` | `app.js:2790-2826`; `test/ui/live-skew-notice.test.ts` |
| `TASK-a-shared-item-id-across-ops-leaves-watch-model…` | `test/ui/watch-model.test.ts:213-218` |

### 7.2 Obsolete (11) — retire them, naming the successor

| Task | Why |
|---|---|
| `port/93` pixel parity | value differences are ruled out by `DEC-the-mockup-is-a-reference…` test 3 |
| `port/98` screen-by-screen walk against the mockup | the 1:1 bar was retired; condition 3 was `walk/23`, done |
| `walk/4` tree walker ignores PROPOSED | `tree-parity.spec.ts:19` only measures |
| `rulings/84` CSP | contradicts your 2026-08-22 ruling; reopened as decision E instead |
| `rulings/63` demo corpus | `.demo-corpus` was retired 2026-09-07 (`scripts/demo-corpus.ts:2-10`) |
| `review/4` audit 39 skills | there is one skill; the 39 no longer exist |
| `ui2/5r` edit the mockup's reason | the mockup is frozen (`DEC-the-mockup-is-a-frozen-reference…`) |
| `walk/150` loading label | duplicate of `walk/139` |
| `TASK-58-of-its-rows…` and its `-2` twin | duplicate: `rulings/71` done + `rulings/82` open |
| `TASK-d33-s-gate…` | its own backfill says it names no surface |

### 7.3 Owner-only (11) — one line each from you

| Task | What you must say | Default if you say nothing |
|---|---|---|
| `port/99` LAST UI TASK | look at every screen on the real corpus and say done | 2.1 |
| `anchors/12` | answer `OPENQ-does-the-table-mark-or-the-lane-report-mark-win…`, then run the rebuild on your archive | 2.1 |
| `hooks/22` autonomous from the first second | is this 2.0 or 2.1 scope | 2.1 |
| `review/10` promoted items have no plan/seq | option 1, 2 or 3 in the item | option 1 (promote asks `--plan/--seq`), 2.1 |
| `rulings/89` in-sync chip | does report 3 overturn your 2026-08-31 ruling | no; 2.1 |
| `walk/66` ledger projection | live or batch | batch; 2.1 |
| `walk/167` visible confirmation | approved chrome or not | approved; 2.1 |
| `walk/14` budget carry from the simulator | still wanted after the 2026-09-07 re-cut | no; retire |
| `handover/16` pointer convention | becomes a rule or not | yes; 2.1 |
| `swallow/16` stderr disclosures | you fire the nine hook events on your machine and record which show | 2.1 |
| `TASK-scripts-backfill-requests-ts…` | authorise `node scripts/backfill-requests.ts .my_context --apply` | authorise after B1's repair |

### 7.4 Blocks 2.0 (6 from the board)

`rulings/47`, `rulings/114`, `rulings/115`, `ui-gates/1`, `hooks/35`, `walk/146` — all in §3.

### 7.5 Defer to 2.1 (115) — tag them `v2.1`, do not touch them now

By theme, ids only; every one has a line of evidence in the lane reports.

- **UI accessibility and polish (36):** `wcag/1-9` (except none done), `walk/2`, `/12`, `/32`,
  `/33`, `/39`, `/57`, `/59`, `/76`, `/89`, `/100`, `/102`, `/105`, `/119`, `/139`, `/141`,
  `/142`, `/144`, `/149`, `/151`, `/152`, `/153`, `/154`, `/155`, `/156`, `/157`, `/158`,
  `/159`, `/160`, `/162`, `/163`, `/164`, `/165`, `/166`, `/168`, `/169`, `dxfindings/2`,
  `screens/23`, `/24`, `/25`, `/26`, `builder/12`, `/18`, `ui1/17b`.
- **Silent-failure disclosures needing a corrupt file to trigger (11):** `swallow/9`, `/11`,
  `/13`, `/14`, `/15`, `rulings/80`, `/81`, `/85`, `/88`, `dxfindings/6`, `walk/147`, `walk/148`,
  `unread/6`, `store/7`, `store/13`, `live/28`.
- **Refactors and type hardening (9):** `rulings/77`, `/86`, `/91`, `/78`, `cliscript/5`, `/6`,
  `accretion/6`, `hooks/12q`, `repaint/12`.
- **Documentation that is incomplete, not false (7):** `rulings/101` screenshots,
  `docsys/11`, `library/6`, `rulings/67`, `rulings/79`, `rulings/111` (one floor re-pin),
  `walk/143`.
- **Measurements and gate refinements (8):** `port/101`, `walk/15`, `walk/43`, `walk/55`,
  `rulings/38`, `rulings/76`, `rulings/93`, `screens/27`-check half.
- **New features (7):** `ui3/15`, `walk/8`, `walk/18`, `walk/106`, `budget/6`, `rulings/82`,
  `rulings/92`, `semantic/10` residue.
- **Lane process safety (5):** `live/20`, `live/24`, `confirm/6`, `walk/11`, `rulings/87`,
  `rulings/83`, `readmodel/2`, `readmodel/4`, `dxfindings/4`, `store/10`, `store/11`,
  `store/12`, `contra/5`, `TASK-the-audit-log-still-records-two-session-ids…`.

Two of these you may want to pull into 2.0 because a new user meets them early: `dxfindings/2`
(the Doctor screen with no navigation) and `wcag/1` (the strip below 1200 px). Both are M.

---

## 8. What can go wrong

- **The Windows CI job fails on a perf ceiling.** `test:perf` runs in `release.yml`, not
  `ci.yml`; a hosted Windows runner is slow and the ceilings are widened for it. If a perf test
  is the only red at tag time, re-run once; if it fails twice, widen that one ceiling with its
  measurement, as the existing headers do.
- **The browser suite needs its pinned Chromium.** On your machine `npx playwright install
  chromium` once. In CI the Ubuntu job installs the headless shell itself.
- **The session's own dispatches get refused.** This repository's dispatch gate requires
  every Agent prompt to name an existing item or carry `no-item: <reason>`. The prompt tells the
  session to file one task per phase and name it; if a refusal appears anyway, it is decision F
  not yet applied, and `no-item:` is the hatch.
- **A lane starts editing files another lane holds.** The prompt forbids it and tells each
  lane its files; if you see two lanes on `app.js`, stop one.
- **The changelog.** Its `[Unreleased]` section is 627 lines. The session will close it as
  `## [2.0.0]`, not rewrite it; if you want it edited down, that is a separate pass after the tag.
