# The 2.0.0 release prompt

**Paste everything below the line into a Claude Code session opened at the root of this
repository, on branch `release/2.0.0`, on the owner's machine, with the `superpowers` plugin and
this repository's own `mycontext` plugin installed. Fill the one slot marked `OWNER ANSWERS`
first.** The companion runbook is `reports/2026-09-21-v2-release-runbook.md`.

---

You are releasing `my_context` version 2.0.0. You are the dispatching session: you plan, you
dispatch lanes, you commit and push, you report at checkpoints. You do not tag; the owner tags.

## 0. Ground rules that override anything else

These come from this repository's own corpus and they are delivered to you at session start;
read the items named here before your first dispatch, and cite an item by id whenever you act
on it.

- **The corpus is the record.** `mycontext ready` is the board; nothing else is. Every phase
  below is filed as a `task` item before its lane is dispatched, because
  `dispatchGate.enabled` is on in this repository: an Agent prompt must name an existing item
  id or carry `no-item: <reason>`. Name the phase's task id in every dispatch prompt.
- **A delegated lane never runs a git command that writes, and never runs a command that
  reaches beyond its own process** (`RULE-a-delegated-worker-never-runs-a-command-that-reaches-beyond`
  and its sibling on git). You commit, staging by explicit pathspec, never `git add` a
  directory while lanes are live. Every commit is pushed at once
  (`RULE-a-commit-is-not-finished-until-it-is-on-the-remote`).
- **A test names the items it rests on, or says it rests on none**
  (`RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none`); `npm run check:basis`
  gates it. Every test you add or change carries `@basis`.
- **Prove by removal, and distrust a green removal proof**: plant an impossible value first
  so an assertion is shown to be able to fail.
- **Node 24 or newer, zero runtime dependencies, no build step, explicit `.ts` on relative
  imports** (`CONST-node-24-no-build-step`, `CONST-zero-runtime-dependencies`).
- **Never edit `.my_context/items/**` by hand**: use `mycontext` (`add`, `edit`, `supersede`,
  `review promote`) or the MCP tools. Never edit `src/rules/entries/` by hand.
- **Never widen the scope.** This prompt is the whole of 2.0.0. A defect you find that is not
  listed here is filed as a `task` tagged `v2.1` in one line and left alone, unless it breaks a
  checkpoint command, in which case you fix it and say so.
- **Windows and Linux both count.** The owner's machine is Windows; the Ubuntu CI job is the
  Linux evidence and it also runs the browser suite. Every checkpoint is "green on both jobs".
- **Stop at every checkpoint** and report in the format in §6. Do not proceed past a red one.

## 1. OWNER ANSWERS (filled by the owner before pasting)

```
A freeze on the list below ....................... yes / no
B retire the three mockup-parity browser specs ... yes / no
C full export is declared non-importable .......... yes / no
D keep the narrow spare band, add the sentence .... yes / no
E Content-Security-Policy on, script-src 'self' ... yes / no
F dispatch gate requires a lowercase slug ......... yes / no
G owner-only tasks (one line each, or "2.1"):
   port/99: 
   anchors/12: 
   hooks/22: 
   review/10: 
   rulings/89: 
   walk/66: 
   walk/167: 
   walk/14: 
   handover/16: 
   swallow/16: 
   backfill --apply: 
H close the 17 done tasks and retire the 11 obsolete ... yes / no
```

If an answer is blank, use the default from the runbook §2 and say so in your first report.

## 2. First: write the plan, then file the phases

1. Use the `superpowers:writing-plans` skill to write
   `docs/superpowers/plans/2026-09-2X-v2-0-release.md` from this prompt, in the format the other
   plans in that directory use, headed `REQUIRED SUB-SKILL: use
   superpowers:subagent-driven-development`. Every task below becomes a plan task with files,
   steps, and a verification command. Cite the spec as this file and the runbook.
2. File one `task` item per phase (`mycontext add task "<phase title>" --summary "…"
   --extra plan=release --extra seq=<n> --extra state=todo --yes`; check the exact `--extra`
   spelling with `mycontext help capture` first, and confirm each landed with a plan, seq and
   state, because `add task` accepts an item with none and exits 0). Tag each `v2.0`.
3. Commit the plan and the items, push, and report (checkpoint 0).

Then execute with `superpowers:subagent-driven-development`: one lane per task, lanes that
touch the same file never run together, every lane told its files and told it may not run git.

## 3. Phase 1 — the repository tells the truth

Exit: on this machine, `npm test` exits 0, `npm run verify:citations` exits 0, `node
src/cli/index.ts doctor` exits 0, all ten `check:*` scripts exit 0; then push and both CI jobs
are green through `npm test`.

**1.1 The outside-repository guard (B1).** `src/core/reference.ts:236` tests
`rel === '' || rel === '..' || rel.startsWith('../')` over `path.relative`; on Windows across
drives `path.relative` returns an absolute path and the guard passes it. Add
`path.isAbsolute(rel)` to the refusal. Add a test with a `path.win32` fixture. Then repair the
corpus: the 84 items whose `source_file` starts with `C:/` (55 also carry `source_checksum`)
must stop claiming a source; use `mycontext edit <id> --unlink` (D3.7) or the equivalent
documented route, never a hand edit, and record the repair in one commit whose message names
the count. After it, `doctor` from a fresh clone exits 0.

**1.2 The citation gate (B2, `rulings/47`).** `npm run verify:citations` lists 26 broken
documentation-tier citations (for example
`docs/superpowers/plans/2026-08-16-web-ui-1-server-and-reads.md:500,510,511,518`). Repair each
by re-anchoring to the fragment that exists now or by adding a historical marker where the
cited text is legitimately gone, as the script's own header explains. Exit 0 without
`--strict-source`. Do not flip `--strict-source` in this release.

**1.3 Portable tests (B3).** Make these pass on a machine that is not the owner's:
`test/ui/staging-endpoint.test.ts:456` and `test/ui/palette-screen.test.ts:511` (read
`.my_context/.staging`, which is gitignored: create what they read in a temp workspace, or skip
with a named reason `check:basis` accepts); `test/rules/seed-numbering.test.ts:122` (needs the
real archive: same choice); `test/docs/examples.test.ts` ×3 where `scrubOutput` does not know
this checkout's path (teach it the repository root generically, not a literal path);
`test/cli/experimental-warning.test.ts:122` (Node 24.21 no longer prints the `node:sqlite`
warning: rewrite the assertion to what the shebang still guarantees, or retire the test with
its reason); `test/ui/execute-route.test.ts:702` and `test/cli/pack-import.test.ts:529`
(isolate first; fix if real, otherwise pin the environment). Then `npm run gen:docs` so the
README `status` example matches the command again. Also fix or delete
`harness/self-test/run.test.mjs:18`, which asserts the warning and is wired to nothing.

**1.4 CI order (B15).** In `.github/workflows/ci.yml`, run `npm test` before
`verify:citations`, or add a second job that runs the unit suite regardless; keep the comment
that explains why the cheap gates come first, and add one sentence on why the suite must not
be hidden behind a doc gate (27 days of it, 2026-08-21 to 2026-09-17). Add `fetch-depth: 0`
to `actions/checkout` so `check:board`'s drift tier sees history, or state in its comment that
it is vacuous under a depth-1 clone.

**1.5 Cleanup.** Delete `simulate-before.png`, `simulate-rec.png`, `stair-after.png` at the
root. Add a retirement header to `docs/ROADMAP.md` and `reports/CONTINUE-HERE.md` in the shape
`reports/EXECUTION-BOARD.md` uses, pointing at `mycontext ready`. Fix
`scripts/e2e-gate.ts:208-277` so its scratch directory is removed on every exit path.

Checkpoint 1.

## 4. Phase 2 — the board says what is left

Exit: `mycontext ready` shows only `v2.0`-tagged rows; `npm run check:board` and
`check:needs-cycles` exit 0.

**2.1 Close the 17 done tasks** (runbook §7.1) with `mycontext edit <id> --extra state=done
--yes`, one commit, message naming each id and its evidence line.

**2.2 Retire the 11 obsolete tasks** (runbook §7.2): `mycontext supersede <id> --by <successor>
--yes` where a successor exists (the duplicates), otherwise `mycontext edit <id> --status
deprecated --yes` with the reason in `--note`. `rulings/84` is retired in favour of decision E.

**2.3 Apply the owner's G answers.** A "2.1" answer tags the task `v2.1`; a ruling is
recorded as a `decision` item citing the task, and the task is closed or tagged as the ruling
says.

**2.4 Tag the 115 deferred tasks `v2.1`** (runbook §7.5). One commit.

**2.5 Give the eleven planless tasks a plan/seq/state or retire them** (they are in §7.1 and
§7.2 already; confirm none is left without a plan). File `review/10`'s chosen option as a
2.1 task if the owner chose one.

Checkpoint 2.

## 5. Phase 3 — the defects

Exit: `npm test` green; both CI jobs green including the browser suite on Ubuntu.

Each is one lane, one commit, one test that fails before and passes after.

**3.1 `mycontext --version` (B6, `hooks/35`)**: prints `VERSION` from `src/core/version.ts`
and exits 0 inside and outside a workspace. Add it to the usage banner and to
`docs/capabilities/09-cli-and-mcp.md`.

**3.2 `status_report` health (B7, `walk/146`)**: `src/mcp/tools.ts:2119-2124` filters
disclosures out of `real` and prints health from it; print the dropped could-not-measure
disclosures the way the doctor tool does at `:1501`.

**3.3 Review pass offset (B8)**: `lastReadTo` (`src/review/pass.ts:279`, used at `:400` and
`src/review/trigger.ts:232`) is one number per workspace; key it by transcript path (store
`{ [transcriptPath]: readTo }` in `review-last-pass.json`, reading the old shape as the
current transcript's). Test: two sessions through one workspace, the second's head is read.

**3.4 Review ceiling (B9)**: `src/review/pass.ts:674` turns a present `--ceiling 0` into
`NO_QUEUE_CEILING`; parse presence explicitly. Test through the child path, not in-process.

**3.5 Export/import (B10, decision C)**: `src/pack/import.ts:523-529` is dead; `pack.ts:555`
and the changelog's "reads a full export and not only a pack" are false. Make `pack import` of
a `kind: export` artefact refuse in one sentence that says a full export is an archive to copy
back, not to import, and points at `--as-pack`; delete the dead branch; fix
`test/cli/pack-import.test.ts:820-833` to feed a real export projection; correct the changelog
entry and README §5 and `docs/capabilities/12-…` and their Hebrew mirrors.

**3.6 Dispatch gate (B11, decision F)**: `src/hooks/pre-tool-use.ts:555` `AGENT_ID_TOKEN`
requires a lowercase slug after the hyphen and a left boundary, or derives the prefix
alternation from `ws.config.categories[*].prefix` already resolved at `:627`. Test with
`READ-ONLY`, `SHA-256`, `UTF-8`, `X-MYCONTEXT-TOKEN` in a prompt: none is a candidate.

**3.7 Rule store seal (B12)**: `src/rules/manifest.ts:75` and `:206` seal an entry that failed
to parse; `planPublish` at `:427` must refuse when any entry is `refused`. Move the shipped-store
mutation in `test/cli/rules.test.ts:59` and `:292` onto a copy, as every other rules test does.
Make `rules verify` say what it proves: "matches the checksum it was last sealed with".

**3.8 CSP (decision E)**: in `src/ui/security.ts` add
`Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'`
(the vendored stylesheet and the SVG sprite decide the two exceptions; verify by loading every
screen in the browser suite with no console CSP error). Update `test/ui/server-e2e.test.ts:89`,
which asserts the header is absent, and the suspending comment at `security.ts:593`.

**3.9 The browser gates (B4, `ui-gates/1`, `rulings/114`, decision B)**: install the pinned
browser (`npx playwright install chromium`), run `npm run test:e2e`. Retire
`e2e/screen-parity.spec.ts`, `e2e/pixel-parity.spec.ts`, `e2e/tree-parity.spec.ts` with a
`decision` item citing `DEC-the-mockup-is-a-reference-to-initial-thoughts-and-only-a`; keep
`test/ui/styles-parity.test.ts`. For every remaining red spec: fix the product if the spec is
right; fix the spec if its scenario is stale (the 13 `strip.spec.ts` reds are a scenario that
never supplies a warm session: route `/api/sessions` in every scenario the way line 355 does;
`doctor-outcome` and `doctor-settle` need a workspace with one deliberate finding, per
`CONTINUE-HERE.md`'s note). Record the clean baseline on the pinned browser as `rulings/114`
asks. Exit: `npm run test:e2e` exit 0 on this machine and on the Ubuntu job.

**3.10 First-session sentence (B13, decision D)**: `cmdInit` prints one line after
"initialized": nothing is pinned yet, so governing items arrive as titles until one is pinned
with `--always` or `mycontext pin`. The normative-capture confirmation in `cmdAdd` says the
same when the corpus has zero pinned items. README §4 "Pinned" and its Hebrew mirror carry the
sentence. A test pins the message on a zero-pinned corpus.

**3.11 Summary gate order and back doors**: in `src/cli/index.ts`, resolve the category
(`Object.hasOwn(ws.config.categories, type)`) before the summary refusal at `:956`; give
`mycontext lesson` a `--summary` flag (`src/core/command-flags.ts:409`, `lesson.ts:161-164`);
`inbox-promote` asks for one; `promoteRevision` records `SUMMARY_OMITTED_NOTE`.

Checkpoint 3.

## 6. Phase 4 — the stranger test

Exit: the owner runs runbook §6 on Windows and reports the rule body arrived, `plugin details`
lists 18 hooks and 1 MCP server, and `mycontext --version` prints the version. You do not run
this; you wait for the owner's report. If it fails, fix and return to checkpoint 3.

## 7. Phase 5 — documentation

Exit: `npm run gen:docs` clean; `npm test` green (including `test/docs/parity.test.ts` and
`system-parity.test.ts`); `npm run verify:citations` exit 0; `npm run check:cited-items`
reports zero live citations of retired items; both CI jobs green.

**5.1 Retired items cited as live (B5, `rulings/115`)**: `npm run check:cited-items` names 13
sites (`docs/capabilities/03-creation-and-gates.md:401`, `14-search-over-the-archive.md:251`,
`docs/system/01-the-board.md:290`, `docs/capabilities/10-rule-store.md:331,350`,
`docs/system/07-focus.md:224`, and the Hebrew twins). Each becomes a citation of the successor
or is marked historical.

**5.2 README false claims (B14)**: §3 `mycontext help <command>` (it does not exist; `help`
takes seven topics; `<command> --help` is the per-command form); §5 `init` "creates … an
`items/` directory" (it does not until the first capture); the `status` example (regenerated in
1.3); the export/import sentences (3.5); `--version` (3.1); the pinned sentence (3.10). Every
change lands in `docs/README.he.md` in the same commit, because `test/docs/parity.test.ts`
holds them in lockstep.

**5.3 Chapter 10 line 453** says no maintenance screen exists and recommends editing the store
by hand; `docs/the-store.he.md` and the code say otherwise. Correct it. Also
`docs/capabilities/11-self-improvement-loop.md` states the loop's dials; confirm its sentence
matches the shipped defaults (`enabled: false`, `maxProposalsPerPass: 0`, `model: null`) and
this repository's config, and retire the 2026-09-16 subject map's "switched off" sentence with
a note.

**5.4 The changelog**: under `## [Unreleased] — 2.0.0 when tagged`, add `### Fixed` entries
for B1, B6, B7, B8, B9, B12 and the summary-gate back doors, in the voice `VERSIONING.md` asks
for ("what changes in practice"); correct the export/import sentence; add a `### Removed` for
the three retired browser specs. Do not rewrite the section.

Checkpoint 5.

## 8. Phase 6 — the release cut (the owner does steps 4 and 5)

Follow `VERSIONING.md` "Cutting a release" exactly:

1. Close `## [Unreleased] — 2.0.0 when tagged` as `## [2.0.0] - <today>` and open a fresh
   `## [Unreleased] — 2.1.0 when tagged` above it.
2. `node scripts/set-version.ts 2.0.0` (writes `package.json`, `.claude-plugin/plugin.json`,
   `.claude-plugin/marketplace.json` twice; refuses a manifest whose shape moved).
3. `npm run gen:docs`, then `npm test && npx tsc --noEmit && claude plugin validate --strict .`
   and every `check:*`, `verify:citations`, and `npm run test:e2e`.
4. Commit "2.0.0", push, wait for both CI jobs green. **Stop and report.** The owner runs
   `git tag v2.0.0 && git push origin v2.0.0`.
5. Watch `release.yml`: it re-runs every gate plus `test:perf`, checks the tag equals
   `package.json`, and creates the GitHub release from `scripts/changelog-section.ts`. If a perf
   ceiling is the only red on the Windows job, report it with the measurement; do not widen a
   ceiling without the owner's word.

After the tag: the open board is the 2.1 list. Report it as the last checkpoint and stop.

## 9. How you report at every checkpoint

One message, this shape, nothing else:

```
CHECKPOINT <n> — <phase title>
commit: <sha> pushed: yes
ran:  npm test → <pass/fail counts>   verify:citations → exit <n>   doctor → exit <n>   check:* → <all 0 | which failed>
CI:   windows <green|red|pending>  ubuntu <green|red|pending>  <link>
done: <task ids closed this phase>
filed for 2.1: <ids, one line each, or none>
blocked on the owner: <what, or nothing>
next: <phase n+1 title>
```

If any line is red, the message ends at that line with what you tried and what you need.

## 10. What you must not do

- Do not touch `docs/design/web-ui-mockup.html` (frozen, `DEC-the-mockup-is-a-frozen-reference…`).
- Do not change the selector's spare band, budgets, tiers or categories: those are compatibility
  surfaces under `VERSIONING.md` and this release adds no behaviour change beyond the listed
  fixes.
- Do not skip, disable or quarantine a test to go green; retire a spec only with a decision item
  and the owner's B answer.
- Do not run `taskkill`, `pkill`, or restart the owner's UI server on port 58888.
- Do not start GSD, `.planning/`, or any second board.
- Do not file more than the one-line 2.1 tasks §0 allows. Filing kept pace with closing for six
  weeks; this release exists to stop that.
