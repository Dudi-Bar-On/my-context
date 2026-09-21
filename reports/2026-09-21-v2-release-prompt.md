# The 2.0.0 release prompt

**Paste everything below the line into a Claude Code session opened at the root of this
repository, on branch `release/2.0.0`, on the owner's machine, with the `superpowers` plugin and
this repository's own `mycontext` plugin installed. Fill the one slot marked `OWNER ANSWERS`
first.** The companion runbook is `reports/2026-09-21-v2-release-runbook.md`.

---

You are releasing `my_context` version 2.0.0. You are the dispatching session: you plan, you
dispatch lanes, you commit and push, you report at checkpoints. You do not tag; the owner tags.

**The owner's ruling that shapes everything: nothing is deferred. Every task open today is
2.0.0. The release is done when `mycontext ready` prints no rows.**

## 0. Ground rules that override anything else

These come from this repository's own corpus and are delivered to you at session start; read
the items named here before your first dispatch, and cite an item by id whenever you act on it.

- **The corpus is the record.** `mycontext ready` is the board; nothing else is. Every phase
  below is filed as a `task` item before its lane is dispatched, because
  `dispatchGate.enabled` is on in this repository: an Agent prompt must name an existing item
  id or carry `no-item: <reason>`. Name the phase's task id, or the board task the lane closes,
  in every dispatch prompt.
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
- **Nothing is deferred, and nothing is filed silently.** A **bug** a lane finds is always
  2.0: fixed on the spot, with `superpowers:systematic-debugging`, if it is in a file the lane
  already holds; otherwise filed as a `task` with `--extra plan=release` and reported in the
  checkpoint line "filed for 2.0". A lane does not complete while a bug in its own files is
  open. A finding that is **not a bug** (a design gap, a feature idea, an open question) is not
  filed; it is counted in the checkpoint line "ideas awaiting the owner" with one line each,
  and the owner says at that checkpoint whether it joins 2.0 (decision A). You never tag
  anything for a later version.
- **Windows and Linux both count.** The owner's machine is Windows; the Ubuntu CI job is the
  Linux evidence and it also runs the browser suite. Every checkpoint is "green on both jobs".
- **Stop at every checkpoint** and report in the format in §11. Do not proceed past a red one.
- **Lanes never share a file.** Before dispatching a phase, list each lane's files; two lanes
  with a file in common run one after the other. `app.js`, `conversations.js` and `styles.css`
  are the three that collide most; phase 6 is ordered around them.

## 1. OWNER ANSWERS (given by the owner on 2026-09-21, in the session that wrote this prompt)

```
A bugs a lane finds are always 2.0: fixed now if in the lane's own files, otherwise
  filed as a release task. Only non-bugs (design gaps, feature ideas, open questions)
  are counted at the checkpoint and join only on my word ................. yes
B retire the three mockup-parity browser specs ............................. yes
C full export is declared non-importable ................................... yes
D keep the narrow spare band, add the sentence ............................. yes
E Content-Security-Policy on, script-src 'self', styles unrestricted, AND the
  lane proves every command-executing screen (composer, palette, builder,
  config) still executes its commands under the header before it lands ..... yes
F dispatch gate requires a lowercase slug .................................. yes
G owner-only tasks, one ruling each:
   port/99: close now on the mechanical work; no screen walk in phase 9
   anchors/12: the LANE REPORT mark wins over the table mark; rebuild in phase 7
   hooks/22: the hooks programme is finished ground; survey runs in phase 5
   review/10: option 1, `review promote` asks --plan/--seq
   rulings/89: report 3 does not overturn 2026-08-31; in-sync stays silent; retire
   walk/66: batch; the two screens say when the projection was last rebuilt
   walk/167: the visible confirmation is approved; unify both screens
   walk/14: still wanted; build the carry, only after a simulation succeeded
   handover/16: yes, the pointer convention becomes a rule item
   swallow/16: I fire the nine hook events on my machine in phase 9
   backfill --apply: authorised, after B1's repair, committed alone
H close the 17 done tasks and retire the 11 obsolete ....................... yes
```

These are rulings, not defaults. If the owner changes one before pasting, the changed line
wins; say in your first report which answers you are acting on.

## 2. First: write the plan, then file the phases

1. Use the `superpowers:writing-plans` skill to write
   `docs/superpowers/plans/2026-09-2X-v2-0-release.md` from this prompt, in the format the other
   plans in that directory use, headed `REQUIRED SUB-SKILL: use
   superpowers:subagent-driven-development`. Every task below becomes a plan task with files,
   steps and a verification command; the board tasks in phases 4 to 8 are listed by id and each
   plan task links to its item, whose body is the specification.
2. File one `task` item per phase (`mycontext add task "<phase title>" --summary "…"
   --extra plan=release --extra seq=<n> --extra state=todo --yes`; check the exact `--extra`
   spelling with `mycontext help capture` first, and confirm each landed with a plan, seq and
   state, because `add task` accepts an item with none and exits 0).
3. Commit the plan and the items, push, and report (checkpoint 0).

Then execute with `superpowers:subagent-driven-development`: one lane per task or per small
group of tasks in the same files, every lane told its files, its item ids and that it may not
run git. A lane closes a board task by meeting the task's own closing condition; you set
`state=done` after you have read the lane's evidence yourself.

## 2b. The dispatch loop, and what survives a compaction

The board is the state machine. There is no `STATE.md`; the `state` field of each task item
(`todo` → `doing` → `done`) is the state, it lives in git, and `mycontext ready` recomputes
the frontier from it on every call. Run this loop for every phase:

1. **Frontier.** `mycontext ready --json --plan <phase plan>` lists the tasks that are open
   and unheld. A task held on `needs:` or on an open question stays out until its blocker
   closes; `mycontext ready --held` shows why.
2. **Wave.** Pick up to three frontier tasks whose files do not overlap (each item's body names
   its files; when it does not, read the code once and record the files in the item with
   `mycontext edit <id> --observation "files: …" --yes`). Two tasks sharing a file never ride
   in one wave. Phase 6's five lane groups are already ordered this way.
3. **Claim.** For each picked task: `mycontext edit <id> --extra state=doing --yes`, one commit,
   pushed. The claim is on disk before the lane exists, so a restart can see it.
4. **Dispatch** the wave's lanes in parallel with `superpowers:subagent-driven-development`,
   each prompt naming its task id (the dispatch gate reads it), its files, its closing condition
   quoted from the item, and the two prohibitions: no git, nothing beyond its own process.
5. **Land.** When a lane returns: read its evidence yourself, run the fast checks
   (`npm run check:basis`, the affected test files, `typecheck`), stage by explicit pathspec,
   `mycontext edit <id> --extra state=done --yes`, commit, push. A lane that returns without
   meeting the closing condition is re-dispatched once with the gap named; a second miss is
   reported at the checkpoint as blocked.
6. **Repeat** until the phase plan has no open rows, then run the phase's exit commands and
   write the checkpoint report. Also append the report to
   `reports/2026-09-2X-release-checkpoints.md` and commit it: that file is the durable log of
   where the release stands.

**After a compaction or a new session, do exactly this before anything else:**

1. Read what the session start delivered (the handover block, `reports/V2-HANDOVER.md`, and
   the restore tier bring the pinned rules and the last snapshot back).
2. Read `reports/2026-09-2X-release-checkpoints.md` (last entry = current phase) and
   `docs/superpowers/plans/2026-09-2X-v2-0-release.md`.
3. Run `mycontext ready --json --plan <current phase>`. Any task in `state: doing` with no lane
   alive is an orphaned claim: reset it to `todo` and re-dispatch it. Nothing else needs
   reconstructing, because every claim and every close was committed when it happened.
4. Continue the loop from step 1.

Before a compaction the repository's own `PreCompact` hook snapshots the window and, at 90 %
occupancy, asks for a handover (`handover.path` in `.my_context/config.json`). Write the handover
yourself when asked: the current phase, the wave in flight, and the task ids it holds. That plus
the committed state is what makes this resistant to compaction: the plan is a file, the state is
the board, the progress is a committed log, and the lanes are stateless.

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
the count. After it, `doctor` from a fresh clone exits 0. Then, if the owner authorised it, run
`node scripts/backfill-requests.ts .my_context --apply` and report its output.

**1.2 The citation gate (B2, `rulings/47`).** `npm run verify:citations` lists 26 broken
documentation-tier citations (for example
`docs/superpowers/plans/2026-08-16-web-ui-1-server-and-reads.md:500,510,511,518`). Repair each
by re-anchoring to the fragment that exists now or by adding a historical marker where the
cited text is legitimately gone, as the script's own header explains. Exit 0 without
`--strict-source`. The task's other half, the `.html` citation form, is closed by ruling that
the mockup is frozen and cited as a historical marker.

**1.3 Portable tests (B3).** Make these pass on a machine that is not the owner's:
`test/ui/staging-endpoint.test.ts:456` and `test/ui/palette-screen.test.ts:511` (read
`.my_context/.staging`, which is gitignored: create what they read in a temp workspace, or skip
with a named reason `check:basis` accepts); `test/rules/seed-numbering.test.ts:122` (needs the
real archive: same choice); `test/docs/examples.test.ts` ×3 where `scrubOutput` does not know
this checkout's path (teach it the repository root generically); `test/cli/experimental-warning.test.ts:122`
(Node 24.21 no longer prints the `node:sqlite` warning: rewrite the assertion to what the
shebang still guarantees, or retire the test with its reason); `test/ui/execute-route.test.ts:702`
and `test/cli/pack-import.test.ts:529` (isolate first; fix if real, otherwise pin the
environment). Then `npm run gen:docs` so the README `status` example matches the command again.
Fix or delete `harness/self-test/run.test.mjs:18`, which asserts the warning and is wired to
nothing.

**1.4 CI order (B15).** In `.github/workflows/ci.yml`, run `npm test` before
`verify:citations`, or add a second job that runs the unit suite regardless; keep the comment
that explains why the cheap gates come first, and add one sentence on why the suite must not
be hidden behind a doc gate (27 days of it, 2026-08-21 to 2026-09-17). Add `fetch-depth: 0`
to `actions/checkout` so `check:board`'s drift tier sees history.

**1.5 Cleanup.** Delete `simulate-before.png`, `simulate-rec.png`, `stair-after.png` at the
root. Add a retirement header to `docs/ROADMAP.md` and `reports/CONTINUE-HERE.md` in the shape
`reports/EXECUTION-BOARD.md` uses, pointing at `mycontext ready`. Fix
`scripts/e2e-gate.ts:208-277` so its scratch directory is removed on every exit path.

Checkpoint 1.

## 4. Phase 2 — the board says what is left

Exit: `mycontext ready` shows the remaining rows only; `npm run check:board` and
`check:needs-cycles` exit 0; every remaining row has a plan, seq and state.

**2.1 Close the 17 done tasks** (runbook §7.1) with `mycontext edit <id> --extra state=done
--yes`, one commit, message naming each id and its evidence line.

**2.2 Retire the 11 obsolete tasks** (runbook §7.2): `mycontext supersede <id> --by <successor>
--yes` where a successor exists (the duplicates), otherwise `mycontext edit <id> --status
deprecated --yes` with the reason in `--note`. `rulings/84` is retired in favour of decision E.

**2.3 Record the owner's G rulings.** Each becomes a `decision` item citing the task. Where
the ruling closes the task (`rulings/89` no, `walk/66` batch with the "last rebuilt" line
filed as a phase 6 row, `handover/16` yes with the rule written, `port/99` closed on the
mechanical work already in `e2e/app.ts`), close it now. Where it lands in a later phase
(`anchors/12` with the lane-report mark winning, `hooks/22`, `review/10`, `walk/167`,
`walk/14`, `swallow/16`), leave it open and note the phase in the item. Answer
`OPENQ-does-the-table-mark-or-the-lane-report-mark-win-when-one` with the owner's ruling.

**2.4 The planless tasks.** After 2.1 and 2.2 none should remain without a plan; confirm with
`mycontext ready --json` and give any survivor `plan=release`.

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
entry, README §5, `docs/capabilities/12-…` and their Hebrew mirrors.

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
(the vendored stylesheet and the SVG sprite decide the two exceptions; styles stay
unrestricted on the owner's word so live UI experimenting keeps working; verify by loading every
screen in the browser suite with no console CSP error). **The owner's condition, part of the
closing condition:** a browser test executes a real command from the Composer, from the
Palette, from the Builder and from the Config screen under the header and asserts the server
ran it; if any of those breaks, fix the policy or the screen, never remove the capability.
Update `test/ui/server-e2e.test.ts:89`, which asserts the header is absent, and the
suspending comment at `security.ts:593`.

**3.9 The browser gates (B4, `ui-gates/1`, `rulings/114`, decision B)**: install the pinned
browser (`npx playwright install chromium`), run `npm run test:e2e`. Retire
`e2e/screen-parity.spec.ts`, `e2e/pixel-parity.spec.ts`, `e2e/tree-parity.spec.ts` with a
`decision` item citing `DEC-the-mockup-is-a-reference-to-initial-thoughts-and-only-a`; keep
`test/ui/styles-parity.test.ts`. For every remaining red spec: fix the product if the spec is
right; fix the spec if its scenario is stale (the 13 `strip.spec.ts` reds are a scenario that
never supplies a warm session: route `/api/sessions` in every scenario the way line 355 does;
`doctor-outcome` and `doctor-settle` need a workspace with one deliberate finding). Record the
clean baseline on the pinned browser as `rulings/114` asks. Exit: `npm run test:e2e` exit 0 on
this machine and on the Ubuntu job.

**3.10 First-session sentence (B13, decision D)**: `cmdInit` prints one line after
"initialized": nothing is pinned yet, so governing items arrive as titles until one is pinned
with `--always` or `mycontext pin`. The normative-capture confirmation in `cmdAdd` says the
same when the corpus has zero pinned items. README §4 "Pinned" and its Hebrew mirror carry the
sentence. A test pins the message on a zero-pinned corpus.

**3.11 Summary gate order and back doors**: in `src/cli/index.ts`, resolve the category
(`Object.hasOwn(ws.config.categories, type)`) before the summary refusal at `:956`; give
`mycontext lesson` a `--summary` flag (`src/core/command-flags.ts:409`, `lesson.ts:161-164`);
`inbox-promote` asks for one; `promoteRevision` records `SUMMARY_OMITTED_NOTE`.

Checkpoint 3. From here the repository is releasable; the owner has ruled that it is not
released until the board is empty.

## 6. Phase 4 — silent failures and disclosures (17 board tasks)

Exit: each task's closing condition met; `npm test` green; both jobs green.

The items are the specification; read each body first. Group by file: `src/core/audit.ts`
(`rulings/80`), `src/core/select.ts` (`swallow/14`: disclose dropped restore ids as a spill the
way `carriedDropReason` at `:1123` does for the carry tier), `src/ui/read-model-retrieval.ts`
(`swallow/13`: distinguish the two empty classes the way `read-model-conversations.ts:2191-2206`
does), the sixteen `recordAudit` call sites in `src/hooks/` (`rulings/81`),
`src/doctor/state-verification.ts:138` (`dxfindings/6`), `src/cli/commands/status.ts:112` and
`src/mcp/tools.ts:247` and `read-model-tutorials.ts:170` (`walk/147`), `src/core/ledger.ts:923-954`
and `pre-compact.ts` (`walk/148`), `src/pack/import.ts` (`store/7`: pre-flight
`unknownExtraFieldError` per item in `planImport`, and write config with temp-plus-rename),
`src/rules/manifest.ts:473-490` (`store/13`), `src/core/code-identity.ts:418-431` (`live/28`),
the seven remaining one-line swallows (`swallow/11`), the swallow-class gate itself
(`swallow/15`, `unread/6`: a script under `scripts/` that reads catch blocks and refuses an
unargued one, wired into `ci.yml`), `rulings/85` and `rulings/88`, `swallow/9`, and the test
that writes into the live audit log (`TASK-the-audit-log-still-records-two-session-ids…`: fork
test rows the way `delivered.ts:132` does).

Checkpoint 4.

## 7. Phase 5 — CLI, store, types and hygiene (28 board tasks)

Exit: each closing condition met; `npm test` green; both jobs green.

CLI and prose lane group: `rulings/76` (derive every banner from `COMMAND_FLAGS` the way `add`
does at `src/cli/index.ts:581`), `rulings/83`, `rulings/87` (`src/doctor/checks.ts:355-357`),
`rulings/92`, `rulings/38`, `rulings/93` (part 3, the per-D reading), `cliscript/5`,
`cliscript/6` (the two renames), `contra/5` (`edit.ts:91-98` usage), `walk/11`, `walk/142`
(every printed time names its clock), `walk/162` (five refusals name a route out),
`hooks/22` (the integration survey, per G), `review/10` (per G; default: `review promote`
takes `--plan` and `--seq`).

Store, types and perf lane group: `rulings/77` (a `Covers<>` helper and the fifteen lists),
`rulings/78` (`statusline-powerline.ts:96` and the 24 hand-written `usage:` strings),
`rulings/86` (`assertNever` at every outcome switch; `hooks/stop.ts:611`), `rulings/91` (the
`as Item` and `as Origin` sites in `store.ts`, `verdict-store.ts:121`, `pack/history.ts:555`),
`store/10` (replay the store changelog and add the five missing entries), `store/11` (`verify`
parses every entry), `store/12` (`deliver.ts:252` prints the tier), `hooks/12q` (the percentile
index, six files under `test/perf`), `accretion/6` (split `conversation-index.ts` or record
"it stays" with the reason), `repaint/12` (steps 2 and 4), `dxfindings/4` (the two remaining
checks), `live/20` (a git guard on Bash for delegated workers; the item records the cost
argument, answer it), `live/24` (the three remaining), `confirm/6`, `readmodel/2` (the client
request shape), `readmodel/4`.

Checkpoint 5.

## 8. Phase 6 — the web UI (55 board tasks)

Exit: each closing condition met; `npm test` green; `npm run test:e2e` green on this machine
and on Ubuntu.

Order the lanes by file so no two hold `app.js`, `conversations.js` or `styles.css` at once:

1. **Shell and rail** (`app.js`, `index.html`, `styles.css`): `wcag/3` (skip link, `h1`, a
   `document.title` per screen), `wcag/5`, `wcag/9`, `wcag/1` and `wcag/2` (a second breakpoint
   and a rail collapse; the strip wraps or scrolls below 1200 px), `walk/153`, `walk/154`,
   `walk/155` (language switch without a reload, if the closures allow; otherwise record why),
   `walk/157` (keyboard jumps between screens), `walk/169`, `walk/139`, `walk/151`, `walk/167`
   (per G), `builder/18`, `screens/25`.
2. **Conversations** (`conversations.js` and its libs): `wcag/4` (per-row accessible names on
   rename and drop), `wcag/7`, `wcag/8`, `walk/160`, `walk/166`, `screens/27` (the question in
   the viewer: the check half in `scripts/check-ask-numbering.ts:168-196`), `screens/26`
   (the viewer-wide glyph survey).
3. **Individual screens**, one lane per screen module: `dxfindings/2` (Doctor: filter,
   collapse, a table of contents), `walk/2` (proc), `walk/12` (every standing refusal
   enumerated and driven to zero), `walk/32` and `walk/33` (watch model refusals), `walk/39`
   (the provenance bar: decide what it is for and fill it or remove it), `walk/57`, `walk/59`
   (simulate: the opening tier and a `div.at` test), `walk/76` (audit tab cap disclosure:
   `audit-db.ts:1238` `LIMIT` plus one), `walk/89` (status: `st.staged`/`st.ingest` from
   `/api/staging`), `walk/100` (ask cap sentence), `walk/102` (preview literals keyed),
   `walk/105` (config `skippedNotice` keyed), `walk/119` (a summary trigger on every item
   surface), `walk/134` (search ranks and matches words in any order: `src/core/search.ts:291`),
   `walk/144` (hover and click help on every button; adopt `lib/disclosure.js` in the six
   screens that hand-build it, `screens/23`), `screens/24` (the unmeasured mark on proc, port,
   packs), `walk/149` (glob tester cap note), `walk/152` (watch table sizing), `walk/163`
   (help screen `dir` and count), `walk/164` (plural rules in both string tables), `walk/165`,
   `walk/168` (`aria-errormessage`, `role=status`), `builder/12` (ack picker offers only items
   with a finding), `ui1/17b` (index-tier ghost on the ribbon).
4. **Typography and palette** (`styles.css` only): `walk/156` (type scale, `.body`
   `max-width`), `walk/158`, `walk/159`, `wcag/6` (`@media (forced-colors)` blocks).
5. **Browser gates**: `walk/15` (styles-parity compares resolved cascade), `walk/43`
   (a regression test on `applyStatic`), `walk/55` (Capture out of `KNOWN_GAPS` and
   `EXPECTED_EMPTY`), `port/101` (ledgers re-derived over the real corpus, dated).

Checkpoint 6.

## 9. Phase 7 — features (8 board tasks plus two rulings)

Exit: each closing condition met; the feature documented in its chapter and Hebrew mirror;
`npm test` green; both jobs green.

`ui3/15` (typed SQL surface on Ask, per the owner ruling in the item; size L), `walk/8`
(`drawStair` draws the free-space line from the real window), `walk/18` (`init
--rewrite-watched`, offered from the Doctor screen; needs `walk/106` first), `walk/106`
(`watchedDocs` printed by `status` and checked by `doctor`), `budget/6` (Configure shows the
in-force value beside a typed one and a restore control), `rulings/82` (a reporting surface
for `.my_context/.rules/delivered.jsonl`: a `mycontext rules delivered` command or a doctor
line), `semantic/10` (the said/ran/both control on Conversations, and the `tool_result` cap
recorded as the owner's decision), `walk/141` (Ask and Capture reviewed as they are now, with
the findings fixed in the same phase), `anchors/12` (per G: apply the ruling and run the
rebuild on the owner's archive with `MYCONTEXT_UI_SESSIONS_DIR` sandboxing as the record
describes), `walk/14` (per G).

Checkpoint 7.

## 10. Phase 8 — documentation

Exit: `npm run gen:docs` clean; `npm test` green (including `test/docs/parity.test.ts` and
`system-parity.test.ts`); `npm run verify:citations` exit 0; `npm run check:cited-items`
reports zero live citations of retired items; both jobs green.

**8.1 Retired items cited as live (B5, `rulings/115`)**: `npm run check:cited-items` names 13
sites (`docs/capabilities/03-creation-and-gates.md:401`, `14-search-over-the-archive.md:251`,
`docs/system/01-the-board.md:290`, `docs/capabilities/10-rule-store.md:331,350`,
`docs/system/07-focus.md:224`, and the Hebrew twins). Each becomes a citation of the successor
or is marked historical.

**8.2 README false claims (B14)**: §3 `mycontext help <command>` (it does not exist; `help`
takes seven topics; `<command> --help` is the per-command form); §5 `init` "creates … an
`items/` directory" (it does not until the first capture); the `status` example (regenerated in
1.3); the export/import sentences (3.5); `--version` (3.1); the pinned sentence (3.10); every
feature from phase 7. Every change lands in `docs/README.he.md` in the same commit, because
`test/docs/parity.test.ts` holds them in lockstep.

**8.3 Screenshots (`rulings/101`)**: every English capability chapter and system document
gets the screenshots its own placeholders name, shot against this repository's live session
through a server sandboxed with `MYCONTEXT_UI_SESSIONS_DIR` so the owner's record is never
touched, never on port 58888; then the Hebrew editions re-shoot the same slots. Chapter 15 is
the model.

**8.4 The rest**: `docsys/11` (both READMEs learn the composer and the help; needs
`library/6`), `library/6` (the help tested as a reader uses it, every subject), `rulings/67`
(the six corpus bodies citing the nickname), `rulings/79` (`app.js:2490` and the `security.ts`
header), `rulings/111` (re-pin the floors 68 → current, 40 → current), `walk/143`, chapter 10
line 453 (the maintenance tool exists; say so and stop recommending the hand edit),
`docs/capabilities/11-self-improvement-loop.md` (state the shipped defaults and this
repository's config; retire the 2026-09-16 subject map's "switched off" sentence with a note).

**8.5 The changelog**: under `## [Unreleased] — 2.0.0 when tagged`, add `### Fixed` entries
for B1, B6, B7, B8, B9, B12, the summary-gate back doors and every phase-4 disclosure, in the
voice `VERSIONING.md` asks for ("what changes in practice"); `### Added` for every phase-7
feature; `### Removed` for the three retired browser specs; correct the export/import sentence.
If the owner asked at checkpoint 8 for an editorial pass, do it here and only here.

Checkpoint 8.

## 11. Phase 9 — the owner's

You do not run this; you prepare it and wait.

1. Give the owner the runbook §8 commands for the stranger test.
2. `port/99` was closed in phase 2 on the owner's ruling; there is no screen walk. Do start a
   server on a port above 47000 with `MYCONTEXT_UI_SESSIONS_DIR` sandboxed and give the owner
   its URL and credential, so the stranger test can include one look at the UI.
3. Give the owner the nine hook events and the payload each expects (`swallow/16`), and record
   the owner's answer in the item; make `session-end.ts:48` and `session-start.ts` agree with
   what was observed.

When the owner reports all three, run `mycontext ready`. It must print no rows. If it does
not, list them and return to the phase each belongs to.

Checkpoint 9.

## 12. Phase 10 — the release cut (the owner does steps 4 and 5)

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

Report the last checkpoint and stop.

## 13. How you report at every checkpoint

One message, this shape, nothing else:

```
CHECKPOINT <n> — <phase title>
commit: <sha> pushed: yes
ran:  npm test → <pass/fail counts>   verify:citations → exit <n>   doctor → exit <n>   check:* → <all 0 | which failed>   test:e2e → <exit or "not this phase">
CI:   windows <green|red|pending>  ubuntu <green|red|pending>  <link>
board: <rows open before> → <rows open after>
closed: <task ids closed this phase>
filed for 2.0: <bug task ids filed this phase, one line each, or none>   (bugs; no ruling needed)
ideas awaiting the owner: <one line each, not filed, or none>   (the owner says join or drop before the next phase)
blocked on the owner: <what, or nothing>
next: <phase n+1 title>
```

If any line is red, the message ends at that line with what you tried and what you need.

## 14. What you must not do

- Do not tag anything for a later version. There is no later version until the board is empty.
- Do not touch `docs/design/web-ui-mockup.html` (frozen, `DEC-the-mockup-is-a-frozen-reference…`).
- Do not change the selector's spare band, budgets, tiers or categories beyond what a listed
  task asks: those are compatibility surfaces under `VERSIONING.md`.
- Do not skip, disable or quarantine a test to go green; retire a spec only with a decision item
  and the owner's B answer.
- Do not run `taskkill`, `pkill`, or restart the owner's UI server on port 58888.
- Do not start GSD, `.planning/`, or any second board.
- Do not file a task without reporting it in the checkpoint line, and do not carry on past a
  checkpoint the owner has not answered.
