# EXECUTION BOARD — the unified list, in execution order

**Opened 2026-09-03.** One row per unit of work, carrying its origin id (A/B/C/ruling),
its surface (the files it owns — this is what keeps lanes disjoint), and its progress.
This file is updated as each row moves. It is the single answer to "where are we".

Sources merged into this board: `reports/CONTINUE-HERE.md`,
`reports/merge/2026-09-03-A-and-B-reconstructed.md` (A/B/C verbatim),
`reports/V2-HANDOVER.md` §"EVERYTHING STILL OWED".

**Progress vocabulary:** `todo` · `doing` · `done` · `blocked` · `already-done` (found
already landed when reached) · `owner` (waiting on a ruling).

---

## Wave 1 — the rest of A

| # | id | what | surface (owned files) | progress |
|---|---|---|---|---|
| E1 | A5 | Retire the `ready` excuse from `CLI_WITHOUT_SLASH` — both clauses false, and the honesty argument dead too (`ready.ts:244` fires only when `task` is switched off). **Atomic across 4 files** | `src/plugin/parity.ts`, `src/plugin/commands.ts`, `commands/`, `README.md`, `docs/README.he.md` | doing (2nd dispatch) |
| E2 | A7 | `audit_log.actor` — derived from `ORIGINS`. All four copies gone: `tools.ts:981` (schema enum), `tools.ts:1006` (`optEnum`, `as Origin` cast dropped), `ask-model.ts` (local `const ORIGINS` deleted), `focus.ts:428` (acceptance-set narrowing). `history.ts` stale comment corrected | `src/mcp/tools.ts`, `src/ui/ask-model.ts`, `src/core/focus.ts`, `src/pack/history.ts` | landed (ungated) |
| E3 | A8 | Descriptions added, matching `create_item`'s convention. **Brief was wrong on one half:** `focus_context.categories` DID carry `'Keep items of these categories'` — the defect was the missing help pointer, not an absent description. Evidence `mcp/handshake-and-list` | `src/mcp/tools.ts` *(same lane as E2)* | landed (ungated) |
| E4 | A9 | `--idle-ms`. **MEASURED: 8h is correct** (`IDLE_MS=28800000`, `idle.ts:36`), ceiling 24h. The README was never wrong — the stale 15min lives in source comments and the flag help | `src/ui/idle.ts`, `test/ui/idle.test.ts`, `src/core/command-flags.ts` | landed (ungated); remainder folded into E1 lane |

| E36 | A7' | **The same defect, two more vocabularies** — found by the A7 lane, not in the original audit. `src/mcp/tools.ts:42-43` keeps private copies of `STATUSES` and `SEVERITIES` (both exported from `validate.ts`), feeding 4 schema enums and 4 `optEnum` calls; `src/ui/ask-model.ts:67` keeps a third `STATUSES`. Identical hand-kept-list shape as A7 | `src/mcp/tools.ts`, `src/ui/ask-model.ts` | todo |
| E37 | A7'' | **`ORIGINS` loses exhaustiveness when imported.** It is `Origin[]`, not `as const`, so `(typeof ORIGINS)[number]` collapses to `Origin` and no closure survives. That is why `src/pack/history.ts:251` legitimately keeps a `Record<Origin, true>` — it fails to compile when a 4th member joins the union, where the array keeps compiling and silently starts rejecting a member. Fix upstream: `export const ORIGINS = [...] as const satisfies readonly Origin[]`, then `history.ts` can drop its table | `src/core/validate.ts`, `src/pack/history.ts` | todo |

## Wave 2 — gates

| # | id | what | surface | progress |
|---|---|---|---|---|
| E5 | GATE | Servers stopped first. **`tsc` clean · unit 5934 tests / 5932 pass / 0 fail / 2 skipped, exit 0 · `check:test-glob` 0 · `check:retired` 0 · `check:text-files` 0 · `check:needs-cycles` 0 (new tonight) · `verify:citations` exit 1 — RED AT `HEAD` TOO**, measured in an isolated worktree, so pre-existing; tonight moved broken source citations 22 → 20. e2e running | — | 6 of 7 green, 1 pre-existing red |

## Wave 3 — B, the approved capabilities

| # | id | what | surface (owned files) | progress |
|---|---|---|---|---|
| E6 | B13 | **Reverse parity declaration** — assert every CLI command has a tool, or is excused by name. *Do this before E7/E8 so they close by mechanism, not by hand* | `src/plugin/parity.ts`, parity tests | todo |
| E7 | B11 | `ready` as an MCP tool | `src/mcp/tools.ts`, `src/mcp/` | todo |
| E8 | B12 | `doctor` as an MCP tool | `src/mcp/tools.ts`, `src/mcp/` | todo |
| E9 | B10 | **Backlink query** — `direction: in\|out\|both`, one `Map` over `store.all()`; `query_items` + `mycontext search` inherit together. *Highest value, cheapest* | `src/core/select.ts` or graph module, `src/mcp/tools.ts`, `src/cli/commands/search.ts` | todo |
| E10 | B14 | `create_item` gains `extra` for PROJECT-DEFINED fields (~10 lines) | `src/mcp/tools.ts` | todo |
| E11 | B15 | `{{FLAG_REFERENCE}}` in `cli.md` from `FLAG_DECLARATIONS` (~40 lines, mirrors `toolReference`) | `src/plugin/`, `commands/cli.md` | todo |

## Wave 4 — the four rulings the owner made

| # | id | what | surface | progress |
|---|---|---|---|---|
| E12 | R1a | `task.verified_on` **with its doctor check** — the check is the whole point | `src/core/categories.ts`, `src/doctor/` | todo |
| E13 | R1b | Retire `task.progress` and `task.last_change` | `src/core/categories.ts`, migration | todo |
| E14 | R2 | `--yes` on `mycontext focus` so the dialog renders Execute; boundary stays derived | `src/cli/commands/focus.ts`, `src/core/command-flags.ts` | todo |
| E15 | R3 | Consumers for **all three** dead fields — `open_question.blocks`, `assumption.validate_by`/`validated_on` (overdue doctor check), `reference.source_file`. *Owner chose wider than recommended* | `src/doctor/` | todo |

## Wave 5 — `rulings/20`, the config writer

| # | id | what | surface | progress |
|---|---|---|---|---|
| E16 | R4 | Widen `rulings/20`: DELETE (custom only), DISABLE (shipped), `--yes` for Execute, backup-before-write, item-count warning. Must answer the absent `enabled` toggle at `config.js:171`. **Settled by conduct — confirm before building** | corpus item `plan:rulings seq:20` | owner |

## Wave 6 — also ruled, also owed

| # | id | what | surface | progress |
|---|---|---|---|---|
| E17 | — | Focus **tag-picker with counts** — `ItemSummary` does not carry `tags` today, so this is a real feature. Multiple tags are OR (`select.ts:456`) | `src/core/select.ts`, `src/ui/` | todo |
| E18 | — | **Hover-help pass** — `TASK-no-screen-has-hover-or-click-help-and-most-buttons-carry`. ~35 buttons, ~6 with hover text; no `?` affordance anywhere. **Named instance:** the `high · think · 200k+` mode flags — `title.modelModes` exists in both string tables and is NOT wired to the element | `src/ui/public/`, `strings/{en,he}.js` | todo |
| E19 | — | **All 19 relation types.** Owner ruled "all 19". **The pairs framing was never put to the owner**: `enforces`/`enforced_by` and `produced`/`discovered_by` are inverses, and this project ruled inverses are DERIVED not stored. `superseded_by`'s exclusion IS the forge gate. **Symptom to close with it:** `superseded_by` exists in the corpus but is absent from `RELATION_TYPES`, which the handover calls "a latent lie on the Relations filter" | `src/core/relations`, `RELATION_TYPES` | owner |

## Wave 7 — C, and the merge

| # | id | what | surface | progress |
|---|---|---|---|---|
| E20 | C/merge | Migrate the **42** from `.my_context.nested-44/` through `mycontext add` — never file copy. Carry id, type, title, severity, `always`, scope, tags, `valid_from`, body, observations verbatim | corpus | todo |
| E21 | C/merge | Create the **27 relations**, both ends present. 12 writable today; 7 are the retirement pair only `supersede` writes; 8 use the six orphan names → depends on E19 | corpus | blocked (E19, E20) |
| E22 | C/merge | Supersede `DEC-focus-discloses-and-allows` by `DEC-a-focus-may-not-hide-a-pinned-item` — needs both in ONE corpus (`requireWritableItem`) | corpus | blocked (E20) |
| E23 | C/merge | Rule on the **five evidenced stale lines** in the summaries report | corpus | owner |
| E24 | C/merge | `INV-hooks-fail-open` carries a stale `[exception]` line — `denyReason` now has four arms plus a documented Bash hole | corpus | owner |
| E25 | C | **Research parts 3 and 4** — the category-by-relation MAPPING, and help for every category with worked examples | docs/help | todo |
| E26 | C | `walk/102`, `walk/105`, `walk/121`, `walk/106` — corpus task items; `pane/5` needs the owner's eyes | corpus tasks | todo |
| E27 | C | **Two decided-but-unbuilt gates** — two-phase e2e, workflow fields out of the summary basis. **Half RECOVERED 2026-09-03** by a reconciliation lane, from the corpus rather than the transcript. *"Workflow fields out of the summary basis"* = `TASK-closing-any-task-trips-the-summary-gate-even-though-only-the`: `state` lives in `extra`, `extra` is `summarised` in `SUMMARY_BASIS` (`src/core/content-hash.ts` · `extra: 'summarised',` ~261), so every `--extra state=done` moves the basis and demands a fresh summary. **Ruling carries a migration** — reclassifying one field last time invalidated all 717 bases and needed `scripts/restamp-summary-basis.ts`. **Two-phase e2e ALSO RECOVERED**: `TASK-decide-whether-e2e-goes-green-on-a-two-phase-default-workers`, ruled 2026-09-02 by `DEC-the-browser-suite-goes-green-on-a-two-phase-gate-default`, whose own text reads *"THE DECISION IS MADE AND THE IMPLEMENTATION IS NOT."* Both gates the handover called unrecoverable were in the corpus. | `src/core/content-hash.ts`, `src/core/summary-gate.ts` | owner |

## Wave 8 — housekeeping the relocation created

| # | id | what | surface | progress |
|---|---|---|---|---|
| E28 | H1 | Wire `scripts/check-needs-cycles.ts` as `npm run check:*` — now correct, since package dir and corpus root are the same path | `package.json`, `scripts/` | **landed (ungated)** — proven green (exit 0), proven RED via a real `budget/2→3→4→2` cycle in a COPY, and proven non-vacuous (empty corpus exits 1). Restore verified by hashing 974 files. **Loose end: `.github/workflows/` does not run it** |
| E29 | H2 | **Re-capture two standards** cited from source but absent from the corpus: `STD-guarantee-claims-carry-their-condition-in-the-same-sentence`, `STD-error-message-conventions`. Cited at `src/mcp/provenance.ts:38`, `src/core/context-occupancy.ts:202`, `src/cli/commands/ack.ts:29`; content survives at `docs/ROADMAP.md:200` | corpus | **BLOCKED — see E38** | 
| E30 | H3 | Delete the stale 761-item corpus at `test_mycontext_plugin/` — **deliberately, once this workspace has been worked in**. Restore points: `pre-merge-nested-corpus-20260902` on both remotes | filesystem | owner |
| E31 | H4 | **`npm install` of this package cannot run** — Node refuses type-stripping under `node_modules`. Either publish a build, or state plainly that this installs as a plugin, not a package | `package.json`, README | owner |


## Wave 9 — from the handover's second list (`STILL OPEN, UNSTARTED`, V2-HANDOVER.md:435)

Merged into this board 2026-09-03 after the owner asked whether Doctor's missing action
buttons were tracked. They were not: the board had been built from "EVERYTHING STILL OWED"
and this is a separate list in the same file.

| # | id | what | surface | progress |
|---|---|---|---|---|
| E32 | U1 | **Doctor settlement remedies** — designed, not built. A `Finding` in `src/doctor/` must declare its OWN remedies, never a UI-side table. This is why findings that compose no command render no action button: measured at `V2-HANDOVER.md:1386`, "only `dead_scope` findings, which compose no command → Doctor's remedy block had nothing to draw" | `src/doctor/checks.ts`, `src/ui/read-model.ts`, `src/ui/public/screens/doctor.js`, `lib/viewmodel.js`, `strings/{en,he}.js`, PALETTE | **landed (ungated)** — `Finding.remedy` is a required 4-route union; UI-side table deleted; `ack` catalogued so it renders Execute; 71 of 72 findings now carry a control |
| E33 | U2 | **Thirteen screens of text shortening** — Preview, Simulate, Work, Capture, Watch, Coverage, Gaps, Decay, Relations, Status, Composer, Procedures, Export/import. Follows the Doctor screen precedent, which came out 70% shorter because 81% of its text was one paragraph reprinted per row | `src/ui/public/strings/{en,he}.js`, screens | todo |
| E35 | U4 | **The summary-gate hole** — `V2-HANDOVER.md:365` records the code fix as "in flight". **VERIFIED LANDED 2026-09-03**, all three parts: creation is gated (`summaryRequiredAtCreate`, `src/core/summary-gate.ts:272`), the self-feeding null exemption is gone from `summaryRequired` (`:244-248` no longer opens with `if (item.summary === null) return false`), and a doctor check reaches "the one state no other summary check reaches" (`src/doctor/`, ~line 857). The 17 affected items were backfilled at `96c097c` | — | already-done |
| E34 | U3 | **Strip enumeration test — DEFERRED by owner instruction**, not forgotten: "the test should be done after everything is developed", because the field set is still moving. When the shape settles, assert per field: is a pill · has a non-empty title · border == text · standard height. The argument FOR it is that the owner found ~12 defects by eye that every gate passed | `test/ui/` | deferred (owner) |


---

## Wave 10 — opened by the night run, 2026-09-03

| # | id | what | surface | progress |
|---|---|---|---|---|
| E38 | — | **`mycontext add` cannot preserve an item id, and that blocks the merge.** `add` derives the id from the title and has no `--id` (tested: refused). **32 of the 44 nested items have ids that do NOT derive from their titles** (`ADR-build-rather-than-adopt`, `CONST-zero-runtime-dependencies`, `STD-error-message-conventions`…). So `CONTINUE-HERE`'s "carry id … verbatim" is impossible through `add` for 32 of 42, and every citation and relation pointing at an old id breaks. **Owner ruling needed:** give `add` an `--id`/migration flag, or repoint the citations. Proof: `STD-error-message-conventions` was re-captured tonight and landed as `STD-error-messages-are-prefixed-once-and-name-the-file-once`, so its six source citations still resolve to nothing | `src/cli/`, corpus | **owner** |
| E39 | — | **Execute's outcome renders ~3,974px off-screen — GENERAL, every command site.** `attachExecuteOutcome` does `section.prepend(…)` (`src/ui/public/app.js` ~2562) into a ~4,000px pane whose scroller is an inner container (`window.scrollY` never moves). Measured in real Chrome: `.execresult hidden:false text:"exit 0" top:-3974px inView:false`. This is what the owner reported as "the run does nothing" | `src/ui/public/app.js`, `lib/command-actions.js` | doing |
| E40 | — | **`acknowledged` is never drawn.** Zero occurrences in `screens/doctor.js` and `lib/viewmodel.js`, though `read-model.ts` carries the field verbatim and its docstring says "drawing it is the screen's business". Since setting `acknowledged` is `ack`'s ENTIRE effect, running it changes nothing visible on the row | `src/ui/public/screens/doctor.js` | doing |
| E45 | — | **A route race in `app.js` loses the screen-refresh slot — found while fixing a spec, reported not papered over.** `route()` (`src/ui/public/app.js` ~6304) opens with `teardownLiveScreen()` and ends with `setupLiveScreen(...)`, which writes `currentScreenRefresh` — the closure `noteExecuteSettled` calls to redraw the screen a run was made on. **There is no generation guard between them.** A hash change starting a second route while the first is still rendering means whichever finishes LAST owns the slot. Doctor is one fetch; the landing preview is five sequential ones, so preview always finishes second and owns the refresh — an Execute on the VISIBLE screen then redraws a HIDDEN one. Measured: after `POST /api/execute` the page fetched preview's endpoint set and not one `/api/doctor`. **Costs any reader who clicks a rail button while the landing screen is still loading.** Wants its own fix and its own test | `src/ui/public/app.js` | todo |
| E41 | — | **`check:needs-cycles` is not in CI.** `.github/workflows/{ci,release}.yml` list the checks as explicit steps; the new gate is local-only until two lines are added | `.github/workflows/` | todo |
| E42 | — | **`ui1/17e` says `done`; `coverage.js` ~68 says it "stays OPEN".** A corpus/code disagreement found by a reconciliation lane. One of the two is wrong | corpus / `src/ui/public/screens/coverage.js` | todo |
| E43 | — | **`review/4` says "audit all 39 skills"; this repo ships ONE** (`skills/mycontext/SKILL.md`). The 39 comes from a stale comment in `test/plugin-assets.test.ts` that the task itself flags. Subject needs pinning before the audit can mean anything | corpus | owner |
| E44 | — | **`strings-parity` no longer checks the invented direction** (dropped 2026-08-26), yet five open tasks rest on the belief that it does — their stated blocker "the mockup must declare it first" is enforced by no gate. Either the "one mockup session" is smaller than counted, or the direction should be restored | `test/ui/strings-parity.test.ts` | owner |


---

## The night run — owner instruction 2026-09-03

> "continue to execute tasks without resting all the way, use subagents, only you git commit
> merge push, in the morning show me the night work, diff and where we stand"

**Order of operations, so a compaction cannot lose it:**

1. **Reconciliation** — 120 not-done tasks, six READ-ONLY verdict lanes. Lanes never write:
   `RULE-delegate-to-subagents` puts corpus writes in the main thread, and the SQLite index is
   shared mutable state (`RULE-parallel-agents-share-no-mutable-resource`). The assistant applies
   every `state` change itself, serialized.
2. **E32** doctor remedies lands → verify files → gates.
3. **Gates**: stop the UI server FIRST (a running server fails one random unit test per run,
   and it moves, which is the signature). `tsc` · `npm test` · the four `check:*` ·
   `verify:citations` · e2e ISOLATED, reading the SUMMARY LINE not the exit code.
4. **Commit + push** — assistant only. Then Wave 3 (B), Wave 4 (rulings), and on down the board.
5. **Morning report**: the diff, what landed, what each verdict changed, and where we stand.

**Standing hazards to respect all night:** never a bare `cd`; no lane runs `npm test` or e2e;
58888 is the owner's server and 58890 is ours; no hook probes against the live corpus; verify
the FILE, never the lane's report; kill a lane that stops making progress.

---

## Running log

| when | row | what happened |
|---|---|---|
| 2026-09-03 | E5 | **e2e first run: 471 passed / 6 failed / 1 skipped.** Isolated at `--workers=1`: `strip-fields.spec.ts` PASSES alone (worker contention — 12th measurement of that trap on that spec); `execute.spec.ts:521` and `doctor-outcome.spec.ts:337` fail in BOTH browsers — real. Cause: stale locators, not a product defect. The doctor migration put ~72 `div.confirm` on the screen, all hidden; a descendant selector + `.first()` picked a ROW's hidden confirm instead of the one the click opened. Fixed by anchoring on the Execute button's own `.cmdactions` parent. **No assertion weakened** — verified byte-identical. Regression proven: reverting the `app.js` placement fix turns `doctor-outcome` red (`top:-169843 in a 720px window`), and `app.js` restored SHA-256 identical. |
| 2026-09-03 | E39/E40 | **Fixed and verified on disk.** `data-cmdkey` on every command control (`command-actions.js:320,418`) gives the outcome an address to return to after the redraw; `executeOutcomeHome` + `revealExecuteOutcome` with `scrollIntoView({block:'nearest'})` — which walks the SCROLL CHAIN, so it reaches the inner `#screen` scroller where `window.scrollY` never moves. `acknowledged` now drawn as `span.chip.index` with `doc.acked`/`title.acked` in both tables, plus a fourth tally figure. **Fix is GENERAL: repairs palette, doctor, work, capture, coverage, packs, port, proc.** Lane proved it by running old and new algorithms A/B against the real DOM at 166,929px: old `top:-146,513 inView:false`, new `top:465 inView:true`. |
| 2026-09-03 | E5 | **Gates: 6 of 7 green.** `verify:citations` measured RED AT HEAD in an isolated worktree — pre-existing, not tonight's. I first captured its exit code through a `tail` pipe, which is the trap `RULE-run-a-gate-the-way-the-project-runs-it` names; re-measured without the pipe. |
| 2026-09-03 | RECON | **All 6 lanes in. 120 tasks judged: 22 DONE, 1 SUPERSEDED, 92 STANDS, 4 UNCERTAIN, 1 BLOCKED-ON-OWNER.** 21 state writes applied by the assistant, serialized, each verified on disk in BOTH the field and the tag. Progress **77% → 81%**; open 117 → 95; p1 open 20 → 15. `budget` 50% → 88% (3 of its 4 p1 tasks were already built and browser-tested). The standard's warning was exactly right: staleness ran in the flattering-to-do direction. |
| 2026-09-03 | E32 | **Landed.** Verified on disk: `remedy: Remedy` required at `checks.ts:56`, `repairFor(finding)` at `doctor.js:198`, `ack` in `palette-defs.js`, `doc.noaction`/`title.noAction` in BOTH string tables, `e2e/doctor-repairless.spec.ts` written (not run). ~800 unit tests green. |
| 2026-09-03 | E39/E40 | **Owner's "the run does nothing" DIAGNOSED in real headed Chrome, not reasoned.** The run WORKS — 200, `exitCode: 0`, real stdout, two refetches. It is invisible: outcome at `top:-3974px`, and `acknowledged` is never drawn. Console clean but for a 404 favicon. Screenshots in `scratchpad/playwright-doctor/`; `probe-C` vs `probe-E` is the whole bug in two frames. |
| 2026-09-03 | RECON L3 | rulings/port, 17 rows: **2 DONE, 15 STANDS.** Wrote `port/6` and `port/94b` to `state: done`, verified field AND tag on disk. **The summary gate refused the first write** — live proof of the E27 defect: `--extra state=done` moves the summary basis, so closing a task demands a fresh summary. Used `--summary-unchanged`, which is its intended hatch and is audited. |
| 2026-09-03 | E27 | **FULLY RECOVERED.** Both "decided-but-unbuilt gates" the handover called unrecoverable from the transcript were corpus items all along. |
| 2026-09-03 | RECON L6 | hooks/review/handover/(none), 10 rows: **0 DONE, 9 STANDS, 1 BLOCKED-ON-OWNER.** No state writes needed — every one genuinely open. Recovered E27's first gate (above). Found `review/4` cites "39 skills" while this repo ships exactly one `skills/mycontext/SKILL.md` — its subject needs pinning before it runs. |
| 2026-09-03 | ⚠ | Lanes were given a SHARED scratchpad path, against `RULE-parallel-agents-share-no-mutable-resource` ("Nine agents were handed the SAME path. Two overwrote each other's scripts mid-run"). Observed E32 writing `doc.py`, `vm.py`, `corpus-*.sha256` there. No collision seen; read-only lanes write nothing. **Future dispatches get a per-lane subdirectory.** |
| 2026-09-03 | E1 | **Landed, verified on disk.** `ready` gone from `CLI_WITHOUT_SLASH`, `commands/ready.md` generated, README 88 slash commands / 14 of 40, Hebrew mirrored. Lane found TWO figures the brief missed (§5 breakdown 28→29 and 86→87, where `counts.test.ts` compares the enumeration as a SET) and a full Hebrew mirror of the retired excuse at `docs/README.he.md:6590` that nothing had flagged. 66 tests across 6 files, 66 pass. |
| 2026-09-03 | RECON | Progress table drawn: **515 tracked, 395 done (77%), 117 open, 3 blocked, 20 p1 open**. `walk` holds 55 of 117 open and 12 of 20 p1. Owner then asked for reconciliation — 120 not-done tasks dispatched to 6 read-only verdict lanes. |
| 2026-09-03 | ⚠ | **MCP server is serving stale code** — its own footer says it loaded at 2026-09-02T23:17:40Z and ≥1 of 70 source files has changed since. Same trap as `V2-HANDOVER.md:328`, where a stale MCP server invented a 719-of-736 checksum corruption. Only the owner can restart it. Do not trust `mycontext_*` tool answers until they do. |
| 2026-09-03 | E32 | **Owner promoted it out of Wave 9:** "currently doctor contains many items i do not have any way to handle, solve it". Measured before dispatch: `repairFor` (`screens/doctor.js:159`) is a UI-side table covering 4 codes — `index_stale`, `audit_log_size`, `corpus_size_fallback_ceiling`, `source_drift`. The live corpus emits 74 findings across 5 DIFFERENT codes (`dead_scope`, `body_disagrees_with_meta` 36, `body_ends_unfinished`, `body_review_limits`, `citation_form` 35), none of which the table covers. **And `mycontext ack <id> <code>` — the owner's own 2026-08-27 acknowledge ruling — exists in the CLI and is absent from the UI entirely.** The route to handle these shipped and was never surfaced. |
| 2026-09-03 | E2, E3 | **Landed ungated**, verified on disk rather than from the lane's report: zero hardcoded actor triples remain in `src/`. Lane's verdict on `focus.ts:420` accepted — it is a copy, and the worst-behaved, because the other three fail LOUDLY on divergence (an `enumError` naming the legal set) while this one silently rewrites an unknown origin to `'human'`. Two new rows opened from its findings: E36, E37. |
| 2026-09-03 | — | UI server on 58888 was REPLACED by the product's own stale-code mechanism (`d4bca7b`) after lanes edited source; it returned on the correct corpus, unlike the occasion the handover records where it inherited a hook's cwd. Fresh nonce minted. |
| 2026-09-03 | E32-E34 | **Board gap found by the owner**, not by me. Asked whether Doctor's missing action buttons were tracked — they were not. The board had been merged from `CONTINUE-HERE.md` + the A/B/C reconstruction + the handover's "EVERYTHING STILL OWED"; the handover's SECOND list, "STILL OPEN, UNSTARTED" (line 435), was never merged. Four of its entries were absent. E19 and E18 amended with the two that overlapped; E32-E34 added for the rest. |
| 2026-09-03 | E4 | **Landed ungated.** Runtime measurement, not a reading: `IDLE_MS`=28,800,000ms=8h, `MAX_IDLE_MS`=24h. Audit premise was backwards — all 6 README/Hebrew statements already said 8h. Fixed `idle.ts:224` poll comment, `idle.test.ts:421` message, and `command-flags.ts:765` flag help (which reaches the UI Flags screen and contradicted its own `example: 28800000`). 4 present-tense claims remain in non-owned files, 2 user-facing. |
| 2026-09-03 | E1 | **First dispatch stopped correctly, changed nothing.** Ruling confirmed sound; landing is atomic across `parity.ts` + `commands.ts` + both READMEs, because `test/plugin/parity.test.ts:124` computes the set from the running program. Re-dispatched with the ownership it needs, carrying E4's user-facing remainder (`commands.ts:565`, `commands/ui.md:14`). |
| 2026-09-03 | — | Board opened. Workspace verified: 763 items, no `cli_path_mismatch`. UI server moved off the old `test_mycontext_plugin/my-context` checkout onto this one (58888). Orphan `npm test` from 2026-09-02 17:06 killed. |
