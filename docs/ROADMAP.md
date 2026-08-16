# mycontext — roadmap to production grade

**Updated:** 2026-08-16 · **Master:** `cd5a698` · **Tests:** 1937 (1936 pass, 1 POSIX-only skip)

*Phase 1A closed 2026-08-16 — B1.1–B1.4 ✅.*
*Phase 1B closed 2026-08-16 — B2.1–B2.9 ✅.*
*Phase 1C closed 2026-08-16 — B3.1–B3.7 ✅.*

This is the single tracking document. **Every row is updated the moment its status changes.**

Status: ✅ done · 🔵 in progress · ⏸ ready, not started · 🔒 blocked on a decision · 💤 deferred

---

## Part A — what is done

| # | Work | Merged | Tests |
|---|---|---|---|
| A1 | **Plan 1** — foundation: parser, renderer, store, selector, budgets | — | 577 |
| A2 | **Plan 2** — precision injection | — | — |
| A3 | **Plan 3** — agent surface: MCP server, tools, hooks, skill | `72a1159` | — |
| A4 | **Plan 4** — capture and curation: ingest, lessons, review, doctor, decay, query, 38 slash commands | `b764437` | 1401 |
| A5 | **Production-readiness audit** — 155 requirements censused, 6 waves planned | `b764437` | — |
| A6 | **Wave 1** — every audit blocker closed (7 tasks) | `49f7e33` | 1476 |
| A7 | **Documentation rewrite** — README for two audiences, Hebrew mirror, 4 drift tests | `49f7e33` | — |
| A8 | **Small defects** — 3 silent-drop classes, `--severity`, record views, marketplace | `b8974fc` | 1587 |
| A9 | **Licence, versioning, changelog** + flags/terms/categories documented | `c9c32c0` | 1606 |
| A10 | **Title column + `review list --full`** corrections | `06eb49f` | 1607 |
| A11 | **Scope semantics** — unscoped means unrestricted | `5c4da7b` | 1617 |
| A12 | **`doctor` width** — 513 → 100 columns | `4c3add9` | 1620 |
| A13 | **Phase 1** — editing surface, per-category policy, staged revisions (9 tasks) | `96ff33b` | 1820 |
| A14 | **Buried capabilities** — 6 capabilities surfaced, capabilities map, presentation (9 tasks) | `cd5a698` | 1835 |
| A15 | **Deeper review** — waves reconciled, §8 audited, categories and capabilities assessed | — | — |

---

## Part B — blocking production grade

**Nothing here is optional. The product is not production grade until Part B is empty.**

### B1 — the two gate holes (one bug, two faces)

The gate was computed from what an item **is**, rather than from what the edit **makes it**.
Both faces are closed, and the classification that made the first one possible is now
checked by the compiler rather than by whoever remembers to add a field to two lists.

| # | Item | Status | Reach | Source |
|---|---|---|---|---|
| B1.1 | `extra` bypassed both `agentEdits` and `guardedChange`, so an agent with **only MCP tools, no shell** could flip `extra.directive` and invert a rule from prohibition to prescription while it stayed `active`, `hard`, unchanged in every report. **Closed:** `extra` is content and stages like title, body and tags. The policy is no longer keyed to whichever fields `RevisionChanges` carries — `UPDATE_FIELD_POLICY` classifies every writable field, an unclassified one does not compile, and four type assertions pin the staged and guarded sets to it. Reproduced and re-verified over the real MCP server on stdio. | ✅ | **agent, no shell** | Review · #95 |
| B1.2 | `edit --status active` crossed the draft gate with no confirmation: `gateFor` read the item's current status, so a draft was ungated in the very field that ends the draft. **Closed:** the gate is now `governs(before) \|\| governs(after)`, so the edit that starts the governing is previewed and confirmed like the one that ends it, and a draft edit that leaves it a draft stays ungated. | ✅ | human, needs shell | Review · #96 |
| B1.3 | `edit --extra` did not exist, so closing B1.1 by staging would have left humans no route. **Closed:** `mycontext edit <id> --extra key=value`, repeatable, merging, behind the same tier-scaled gate as every other field. `observations` are **deliberately not** added — see B1.3n. | ✅ | — | §8 · #95 |
| B1.4 | `update_item`'s tool description advertised `extra` alongside seven fields that behave three different ways, and the model reads it at `tools/list`. **Closed:** the description names what applies, what is staged and what is refused; `scope`/`always`/`severity`/`extra` carry per-field schema descriptions too. Pinned by a test that reads the live `tools/list` over stdio. | ✅ | — | Review |

**B1.3n — why `observations` were not added.** Every other field in B1 is a field an agent
can move, so a gate around it either exists or is a hole. `observations` are the opposite:
no surface of any kind edits them after capture, by any caller of any origin, so there is no
policy to route around and nothing this phase makes worse. Adding them is a larger change
than it looks — `UpdateInput`, the MCP schema, the CLI, `RevisionChanges`, the promote apply
and the diff renderer, plus a decision about whether an edit replaces the list or addresses
one entry — and it is a capability, not a repair. It belongs to a later phase, with the
`observations` gap stated where it is a gap: in what can be edited, not in the gate.

### B2 — §8 has inverted

The section built to quarantine false claims was making four of them. **Closed 2026-08-16.**

**Seventeen false statements were found in the English section, each with a Hebrew mirror.
Nine of the seventeen postdate the audit that found the rest: six came from Phase 1A
(everything the section said about `extra`) and three from Phase 1C (everything it said about
`prefix`). Phase 1E introduced none, and none was added for it — §8 carried no compaction
claim, and §4 now states the three restore conditions, where a second copy would be a second
thing to keep true.**

| # | Item | Status |
|---|---|---|
| B2.1 | Four entries described capabilities that **are** available — editing, smaller gaps, long-id reports, the Wave-2 defect. **Closed:** *Editing an item* split down to its one residue (`observations` — 1A left it one field, not two), *Smaller gaps* and *Reports on a corpus of long ids* deleted whole (§5 already carries the long-id property, stated better), *Choosing a value* retitled and compressed. 233 lines out, 244 in: the section is the same size, and each of its twelve entries now names something that does not exist. | ✅ |
| B2.2 | Every tense violation removed, including *"described above, in the present tense, **because they ship**"* — the section conceding the violation in writing. The narratives of how the shipped work got done went with them; each residual entry is one paragraph naming a gap. | ✅ |
| B2.3 | **"No test checks this section" was false.** **Closed:** the paragraph now names what the ten `test/docs/` files check, says which two reach into §8 and how, and states its limits one at a time — including that a pin which works by requiring a phrase is satisfied by a negation placed in front of it, and that only the whole-block example diffs are immune. The file count is **computed** by a new `counts.test.ts` case, in both languages, rather than typed — this number has now been wrong twice. | ✅ |
| B2.4 | Wave numbers dropped, with the reason recorded in the section itself: unresolvable, stale, and in one case pointing at a wave that contains no such row (verified — Wave 5 has the registry migration, not the command generator). The intro links `docs/superpowers/plans/2026-08-16-production-grade.md` as where sequencing is maintained. `README.md:899`'s deep link to `#one-surface-for-every-operation-wave-5` was re-pointed by hand; **no test covers in-body anchors**, only the contents and capabilities-summary links. | ✅ |
| B2.5 | **Added:** the `reference` design as the lead entry — why a live read is refused (it would let an agent change what governs by editing the file, reopening the hole §7 closed), the snapshot with `source_drift`, the three companion categories, the proposed removal of `policy`/`postmortem`/`taxonomy`, and that whether `runbook` survives `reference` is itself undecided. The spec is linked. | ✅ |
| B2.6 | **Added:** `severity: hard` orders budget admission and nothing else. Verified by execution — no hook, tool or command reads severity to decide whether an action may proceed, and the only deny this plugin issues is on writes into `.my_context/`. | ✅ |
| B2.7 | **Added, with this row's own premise corrected.** `add instruction` does give `always: false, scope: []`, but *"the directive never reaches a session"* is **false**: an unscoped item is unrestricted under the default `scopePolicy`, so the body is injected by the JIT hook on the first tool call that touches a file — reproduced against the real hook, and against SessionStart, which emits only the index line. The true gap, and what §8 says: the item is not in the **pinned** tier, so a session that touches no file never sees it, against a design that calls process directives inherently `always: true`. | ✅ |
| B2.8 | **Rewritten, not retitled.** The `extraFields` half is gone (1C refuses it by name) and the `prefix`-on-a-built-in half is gone (1C honours it — verified: `{"rule":{"prefix":"POLICY"}}` mints `POLICY-…`). What stands, and what §8 now carries: an explicit `prefix` shared by two categories collides in silence — `rule` and `invariant` both at `POLICY` produce `POLICY-…-2`, no error, no warning, no `doctor` finding — and a declared category still gets no slash command, because `gen-commands` passes `resolveConfig({})`. | ✅ |
| B2.9 | **Added:** `mycontext help` takes four topics and refuses `query` and `config` by name. Both subjects are documented in the README; neither is reachable through `mycontext_help`, which is the surface an agent has mid-task. | ✅ |

### B3 — silent-answer and message defects

| # | Item | Status | Source |
|---|---|---|---|
| B3.1 | `review revisions <typo>` exits 0 and asserts *"nothing is waiting for a human here"* without checking the item exists. Wave 1's fixed defect class, reintroduced — and worse, because it states a falsehood rather than staying silent. **Closed 2026-08-16:** refused with `unknownIdError`'s closest-match wording, on the text and `--json` paths alike. The existence test is item-OR-revision-history, not item alone — a revision outlives its item (`decorate`'s `itemMissing` branch), and that case is answerable. | ✅ | #97 |
| B3.2 | Pending revisions are invisible through **all 11 MCP tools and the SessionStart hook**. An agent cannot discover its own staged proposal is waiting. **Closed 2026-08-16:** `get_item`, `query_items`, `list_drafts` and the injection (`load_context` + SessionStart, one implementation) all disclose the queue; the other seven tools are argued out in the commit message. The count spelling moved to `core/revision.ts` so six surfaces share one number, pinned by test. The proposed TEXT is still never injected. | ✅ | #97 |
| B3.3 | `mycontext init` accepts and silently ignores every argument. `init --global` prints "initialized `.my_context`" and creates a **project** layer. **Closed 2026-08-16:** `runCli` passes argv, and `init` refuses any argument, echoing the tokens. `--global` additionally names the global root and the documented route to one. | ✅ | §8 audit |
| B3.4 | `mycontext lesson <id>` prints "recorded" on the re-derive path, where nothing was recorded. **Closed 2026-08-16:** the verb branches on whether this call wrote anything — which covers the title-dedupe path too — and the tier clause stays on both. The README example block regenerated with it. | ✅ | #94 |
| B3.5 | `valid_until` is left stamped when `edit --status` moves an item out of a retired status — and **nothing anywhere reads it**. Writers and renderers only. README:952 is falsified by a re-activated file. **Closed 2026-08-16:** decided as a **record, not a control** — `status` decides currency in one place, and a date-based gate would let an item stop governing with no queue entry, no count and no spill line. So it is cleared when the status leaves a retired state, and both READMEs now say which of the two it is. | ✅ | #97 |
| B3.6 | Config overrides silently drop `extraFields` and `prefix` on built-ins. A mutant clearing `extraFields` passes the entire suite. **Closed 2026-08-16:** `prefix` is read and validated on both branches (it was unvalidated on the custom one). `extraFields` was latent in the TESTS, not the code — the override branch is exercised now — and the key itself is refused by name, as is every other unknown category key. | ✅ | #81 |
| B3.7 | `doctor`'s `dead_scope` advice is untrue for rationale items — tells you an unscoped item "injects on every file", false for a `decision`. **Closed 2026-08-16:** tier-first, then `scopePolicy`, mirroring `select`'s own order, and reusing `RATIONALE_NOT_INJECTED` rather than writing an eighth wording. It still says why re-scoping is worth doing on that tier (`query_items({path})`). | ✅ | P1-T3 |

### B4 — mechanisms with no test that can fail (Wave 3)

| # | Item | Status |
|---|---|---|
| B4.1 | **Pinned structurally, 2026-08-16.** `Store.isReadOnly` asks the engine (a rolled-back `CREATE TABLE`; `BEGIN IMMEDIATE` was measured to succeed on a read-only connection and is unusable), and `test/cli/query-readonly-pin.test.ts` spies `Store.openReadOnly` through `cmdQuery`. The behavioural dead end was reproduced first, and the claim in `query.ts` was not strengthened. | ✅ |
| B4.2 | **Done, 2026-08-16.** `test/hooks/hook-binaries-e2e.test.ts` runs all four hooks as real processes: exit 0 with empty stdout and stderr on garbage and on empty stdin, the real envelope on a real payload. Stdin-held-open is asserted for **PostToolUse only**, with the reason recorded in the file. | ✅ |
| B4.3 | **Done, 2026-08-16.** The clock starts after a readiness ping. Harness extracted to `test/helpers/stdio.ts`, pinned by `test/helpers/stdio-clock.test.ts` against a child whose cold start deliberately outlasts the response budget. | ✅ |
| B4.4 | **Done, 2026-08-16.** Deterministic: the parent waits for the writer to report 6 appends before killing it, and a writer that never got going fails on its own assertion naming that, before any durability assertion runs. | ✅ |
| B4.5 | **Done, 2026-08-16.** `scripts/mutate.ts` (`npm run mutate`) refuses a dirty tree, refuses `.my_context/` and `.git/`, refuses an untracked target, restores from bytes captured before the mutation and verifies with `git status`, and journals an in-flight mutation so a hard kill blocks the next run instead of hiding. `docs/mutation-testing.md` is the how-to. | ✅ |

### B5 — the compaction claim (Wave 2's one live item)

| # | Item | Status |
|---|---|---|
| B5.1 | **Done, 2026-08-16.** Established by execution — a manual `load_context`, then `PreCompact`, then `SessionStart(compact)`, re-injects the loaded item in full, because the snapshot unions the ledger with a transcript scan and a manual load puts its ids in the transcript. All eight surfaces now carry one conditional claim: restored after a compaction **only if** the snapshot still sees the id, with the three cases where it does not (rationale items never restore; an id beyond the final 8MB of the transcript is missed; the restore budget can spill it to an index line). The two pinning tests were repointed, not deleted, and `test/hooks/manual-load-restore.test.ts` adds the behavioural half — four tests driving the real hooks, one per clause. `SKILL.md`'s ceiling rose 5170 → 5255, recorded on the test: the honest sentence carries a condition and the false one did not. | ✅ |

---

## Part C — the documentation you asked for

| # | Item | Status | Notes |
|---|---|---|---|
| C1 | **Un-collapse the 13 category comparisons.** They exist and are good — buried inside a `<details>` 2,250 lines down. Largest single cause of "I can't see the categories". | ⏸ | Half a day for C1–C4 together |
| C2 | **`mycontext examples <category> --short`** — title, body, distinctive fields only. Makes all 20 generatable at ~120 lines per document instead of ~500 of near-identical YAML. | ⏸ | Small code change |
| C3 | **Fill the three placeholder seeds.** `policy`/`postmortem`/`taxonomy` print *"Replace this body with the real content"* — the only place the tool ships filler. **Moot if C6 removes them.** | 🔒 | Depends on C6 |
| C4 | **`glossary` has no neighbour comparison** — the only category without one. | ⏸ | |
| C5 | **Per-category treatment**: what it is for (2 sentences), the nearest neighbour and the test that separates them, one short generated specimen. 20 categories, both languages. | ⏸ | 1.5–2 days |
| C6 | **Capabilities section rebuilt** — `### In one screen` (a real injected block, lifted from line 1095), `### Why not just CLAUDE.md`, `### The unusual parts`, then the existing map verbatim. Keep the disclaimers at the bottom; they are why anyone believes the rest. | ⏸ | ~50 lines each language |
| C7 | **The honesty line, written down**: mechanism claims may be as loud as you like; guarantee claims carry their condition in the same sentence. | ⏸ | |

---

## Part D — product completeness

### D1 — the catalogue swap (MAJOR bump)

| # | Item | Status |
|---|---|---|
| D1.1 | Remove `policy`, `postmortem`, `taxonomy` — each duplicates a clearer sibling, and type is fixed at creation so two overlapping types means the same fact filed twice. | 🔒 needs D1.4 |
| D1.2 | Add `known_issue` (present fact that should stop effort — distinct from `lesson` and `risk`), `runbook` (conditional and procedural — distinct from `instruction`), `environment` (conditional on where code runs). | ⏸ |
| D1.3 | Migration: `loadLayer` deliberately indexes items of unknown types, so removal must not become a silent drop. There is **no retype** — the only path is `supersede`. `doctor` must name any item of a removed category with that route. | ⏸ |
| D1.4 | It is a MAJOR version bump by the project's own rule. Nothing is tagged yet. | 🔒 decision |

### D2 — the `reference` category

| # | Item | Status |
|---|---|---|
| D2.1 | Body is a **snapshot** of a file; `source_file`/`source_checksum` record origin; `doctor`'s existing `source_drift` reports divergence. Reading live at injection time is ruled out — it breaks the review gate, byte-identity, and budget predictability. | ⏸ |
| D2.2 | **Rationale tier by default**, so the trust problem is closed by construction. Retiering is the user's call and the consequence is stated bluntly, not softened. | ⏸ |
| D2.3 | Capture reads the file (`add reference "Roadmap" --file docs/roadmap.md`); refresh is a supported command, not a hand-edit; a size limit is decided rather than silent. | ⏸ |
| D2.4 | **If `reference` ships, re-examine whether `runbook` still earns a catalogue entry** — you would point at `RUNBOOK.md` instead. | 🔒 after D2 |

### D3 — Phase 2: the surface

| # | Item | Status |
|---|---|---|
| D3.1 | Read commands as slash: `show`, `doctor`, `decay` (plus existing `search`, `status`). | ⏸ |
| D3.2 | Write commands as slash: `edit`, `supersede`, `promote`, `discard` — each previewing and confirming as the CLI does. | ⏸ |
| D3.3 | Ingest and lessons as slash: `ingest`, `lesson`, `lesson-stage`. Multi-step and stateful; hand back control rather than guessing. | ⏸ |
| D3.4 | `query` as slash, with SQL help — read activities only, SQLite syntax, and no implied guarantee stronger than the code provides. | ⏸ |
| D3.5 | **Parity enforced by test**: anything the model can do through a tool has a command; remaining asymmetries listed deliberately. `/mycontext:search` currently calls an MCP tool with no CLI counterpart. | ⏸ |
| D3.6 | Named commands for common cases (`pin`/`harden` exist) **plus** an asking flow with numbered options for the rest. One implementation, one enumerating test. | ⏸ |

### D4 — the three hard requirements the corpus asserts and the product does not satisfy

**All three are `status: active, severity: hard` in this repository's own corpus, injected as binding.**

| # | Item | Status |
|---|---|---|
| D4.1 | **Domain grouping** — closed set in config, one indexed column, default domain absorbs existing items, filters on commands and reports, no per-domain budgets. Needs the domain names from you. | 🔒 decision |
| D4.2 | **Session focus** — blocked by your own `OPENQ-how-do-filters-respect-dependencies`. Needs the relation classification ratified, and a decision on whether focus may hide an item a visible item `blocks`. | 🔒 decision |
| D4.3 | **Run-time audit log** — the current ledger dies with the disposable index, so any retention needs a new log. Needs scope (mutations only, or injections too) and whether agents can read it. | 🔒 decision |
| D4.4 | Whatever is decided, each needs an explicit disposition — implemented, or deferred **and the corpus item annotated**. "Unimplemented and injected as binding" is the one unacceptable state. | 🔒 decision |

---

## Part E — quality and infrastructure

| # | Item | Status |
|---|---|---|
| E1 | **Linux/Ubuntu certification.** CI runs the matrix, but several tests skip on non-Windows, the symlink tests ran as junctions, and the POSIX case-sensitivity test written during the 8.3 fix **has never once executed**. | ⏸ |
| E2 | **Establish whether subagents get injected.** Three possible outcomes; the worst is that a subagent shares the parent's `session_id` and therefore gets **nothing** while the ledger claims delivery. Cheap to establish. | ⏸ |
| E3 | **Wave 5 — structural consolidation.** Six copies of open-rebuild with caller-class retry policy; migrate the seven switch builtins into the registry; split `mutate.ts`. **Phase 1 grew `mutate.ts` substantially**, so this got more expensive, not less. | ⏸ |
| E4 | **SessionStart contention stall** — hooks inherit the MCP retry policy; 8 attempts × 3s turns a ~3s fail-open into a potential ~24s stall. | ⏸ |
| E5 | Missing `lesson-discard` deny rule; `help <topic> --flag` falsehood; `revisionFor` is a dead API with no caller; two ledger `--help` measurements now false (`edit` 139, `review` 153, three rows over budget). | ⏸ |
| E6 | The revision log is unconditionally gitignored — a staged proposal is local to one machine, and the "never deletes a proposal" log is not in version control. Undisclosed in §8. | ⏸ |
| E7 | **Cut a release.** Nothing is tagged; `status` reports `0.1.0`. `VERSIONING.md` exists and defines the bump rules. | 🔒 after Part B |

---

## Part F — deferred by decision

| # | Item | Status | Why |
|---|---|---|---|
| F1 | **Mintlify** as a presentation layer | 💤 | Your call: after there is a product. It would break the four drift tests, which are the only reason this documentation is not already lying. |
| F2 | `antipattern` category | 💤 | Rejected — `non_goal` + `rule` cover it; it would be the fourth category meaning "do not do this". |
| F3 | Deletion, at any surface | 💤 | `NOGOAL-no-agent-hard-delete` is active. Retirement is `supersede`. |
| F4 | `deny` as a third `agentEdits` value | 💤 | The implementation did not make the case; `stageRevision`'s refusals already tell an agent immediately in the two cases that matter. |

---

## Decisions waiting on you

| # | Decision | Blocks |
|---|---|---|
| Q1 | Domain names, and whether a disabled domain's items stay listed | D4.1 |
| Q2 | May focus hide an item that a visible item `blocks`? Disclose-and-allow, or refuse-to-hide? | D4.2 |
| Q3 | Audit log scope — mutations only, or injections too? Readable by agents? | D4.3 |
| Q4 | Is the catalogue swap worth a MAJOR bump now, or bundled with a later one? | D1 |
| Q5 | Does `runbook` survive if `reference` ships? | D2.4 |
| Q6 | Ordering: Part D3 (surface) before or after Part D1/D2 (categories)? | sequencing |

---

## Suggested order

1. **Part B** — nothing ships as production grade with a trust hole and an inverted §8. B1 and B2 first; B3–B5 close behind.
2. **Part C** — the documentation you asked for. Cheap, and C1 alone fixes most of the categories complaint.
3. **Part D1 + D2** — the catalogue and `reference`. Shares one MAJOR bump.
4. **Part D3** — Phase 2's surface.
5. **Part E** — quality, then cut the release.
6. **Part D4** — the three hard requirements, once Q1–Q3 are answered.
