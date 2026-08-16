# mycontext — roadmap to production grade

**Updated:** 2026-08-16 · **Master:** `dd7786f` · **Tests:** 1956 (1955 pass, 1 POSIX-only skip)

*Phase 1A closed 2026-08-16 — B1.1–B1.4 ✅.*
*Phase 1B closed 2026-08-16 — B2.1–B2.9 ✅.*
*Phase 1C closed 2026-08-16 — B3.1–B3.7 ✅.*
*Phase 1D closed 2026-08-16 — B4.1–B4.5 ✅.*
*Phase 1E closed 2026-08-16 — B5.1 ✅.*
*Phase 1 REVIEW closed 2026-08-16 — the seams, B6.1–B6.4 ✅. Merge verdict: **ready with
follow-ups**, which are B7.*
*Phase 2 — C1, C2, C4, C5, C6 and C7 ✅ 2026-08-16. C3 stays blocked on D1.*
*Phase 2 REVIEW closed 2026-08-16 — C-R1–C-R4 ✅. Merge verdict: **ready with follow-ups**,
which are C8 and C9. C3, C8 and C9 are the Part C rows still open.*

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

**B1–B5 are closed. B6 is the phase review — what no single workstream owned — and it is
closed too. B7 is what that review found and deliberately did not fix; those rows are the
only Part B entries still open, and each says why it was deferred rather than closed.**

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

### B6 — the phase review: what no single workstream owned

Five workstreams were reviewed as they landed. These are the defects that lived in the
seams between them, found by sweeping the whole diff, driving the real MCP server over
stdio, and mutating every pin the phase added.

| # | Item | Status |
|---|---|---|
| B6.1 | **`extra` is content — and eight surfaces still said it applies directly.** `README.md:2106`'s §5 tool table said, in as many words, *"Extra fields apply directly"*, with a Hebrew mirror at `docs/README.he.md:2324`; six more places enumerated revisable content as *"title, body or tags"*. That is not stale phrasing — it is a description of the hole B1.1 closed, printed in the table a reader consults to learn what the tools do. **Closed:** all eight corrected, and banned tree-wide by `test/docs/staged-revision.test.ts` with a positive half so the ban cannot be satisfied by deleting the subject. Tree-wide for the same reason the compaction claim is: eight copies, each of which looked like a cross-reference to a copy someone else had checked. | ✅ |
| B6.2 | **The trust boundary's own sentence was pinned by a phrase its negation contains.** Rewriting *"the gate holds **if and only if** the Bash surface **excludes** the `mycontext` binary"* into *"the gate holds **even when** the Bash surface **does not exclude** it"* left the suite green on all three surfaces at once — 1E's negation hole, in the one sentence that is the entire mitigation for a boundary the product cannot enforce. **Closed:** the quantifier is pinned and the negated forms banned in `test/plugin-assets.test.ts`; the Hebrew mirror, which had no pin of any kind, is pinned too. Re-mutated after the fix: KILLED. | ✅ |
| B6.3 | **Four more false statements the phase left standing**, each verified against the code before it was touched. `src/help/topics/workflow.md` still said `edit` gives *"no confirmation on a draft"* — B1.2 made the gate `governs(before) \|\| governs(after)`, so `--status active` on a draft is confirmed. `README.md`'s flag rules said every value flag but `--scope`/`--tags` is refused when given twice, and `--extra` is repeatable, as its own row says twenty lines up (both executed). §8 said `add` *"has no flag that changes either"* of `always` and `scope`; `add --scope` exists. §6 said there are five per-category keys and named five; `CATEGORY_KEYS` has six. **Closed**, both languages. | ✅ |
| B6.4 | **Two deferred concerns fixed rather than recorded.** Half of every anchor link in both READMEs — the ~60 in-body ones per file — was resolved by nothing, and the one that broke in 1B was caught by hand; every in-document link now resolves or the suite fails, with a count assertion so a broken extractor cannot report a clean document. And the 8MB transcript workspace is removed by `t.after` rather than by the last statement of the test body, so a red run no longer leaves ~9.6MB behind on the run where someone is about to re-run the suite. | ✅ |

**What the review checked and found clean.** The trust boundary was driven over the real
MCP server on stdio and every route-around was refused with the item's bytes unmoved: a
forged `origin: "human"`, an explicit `id` on `create_item`, `supersede_item` on a governing
rule, `link_items` forging `superseded_by`, `__proto__` and reserved-name keys in `extra`,
and an empty-string `directive`. `UPDATE_FIELD_POLICY`'s `satisfies` clause makes an
unclassified writable field a compile error, and its four type assertions hold the staged and
guarded sets to it in both directions. `pendingRevisionCounts` is genuinely single-sourced —
the human wording and the agent wording destructure the same object and cannot disagree
about the number; the one hand-written copy of the count template (the empty-queue sentence
in `review revisions`) was folded into `pendingRevisionLine`, which is what makes that
function's own contract true. Every pin the phase added was mutated and every one FAILED on
its mechanism's removal.

### B7 — found by the review, deferred with a reason

**These are the only open Part B rows.** Each is a real defect; none is a trust hole, and
each is either larger than a phase-review fix or belongs to a phase that already owns it.

| # | Item | Status | Why deferred |
|---|---|---|---|
| B7.1 | **Three of this repository's own corpus items assert requirements the product does not satisfy, and are injected as binding.** `REQ-items-carry-a-domain`, `REQ-session-focus-controls-what-loads` and `REQ-changes-are-timestamped-and-audited`, all under `.my_context/items/requirement/`, are each `status: active, severity: hard` and scoped to `src/cli/**`, so they activate on ordinary work. `REQ-session-focus-controls-what-loads:35` additionally declares `depends_on [[REQ-items-carry-a-domain]]`, so retiring the first without the second leaves a dangling dependency. | 🔒 | D4.4 already names this as the one unacceptable state, and the disposition is Q1–Q3's to make. Annotating the corpus ahead of the decision would be a fresh claim about work nobody has scoped. |
| B7.2 | **`mycontext add` has no `--extra`**, so a category-specific field cannot be set at capture from the CLI. `src/cli/index.ts:187` (`ADD_VALUE_FLAGS`) against `src/cli/commands/edit.ts:58`; `create_item` does take them, so the route that exists is asking the model. | ⏸ | A capability, not a repair: nothing claims it exists — `README.md:3178` and `docs/README.he.md:3528` state the gap correctly — and no gate is routed around by its absence. Belongs with D3's surface work. |
| B7.3 | **`changedFields` (`src/cli/commands/revision-view.ts:33`) is a byte-for-byte copy of the private `fieldsOf` (`src/core/revision.ts:377`)** — two copies of "which fields does this revision touch", used by two renderers of the same object. | ⏸ | Structural consolidation, which is E3's subject; folding it in there keeps one pass over `revision.ts` rather than two. |
| B7.4 | **`docs/superpowers/ledgers/2026-08-15-user-surface-phase-1-ledger.md:156,359` place `pendingRevisionCounts` in `review.ts` and put the count spelling "on all thirteen surfaces"**, where it now lives in `core/revision.ts` and six surfaces share it. | 💤 | A ledger records what was true when it was written. The two LIVE comments saying the same thing — `src/cli/commands/status.ts` and `test/core/revision.test.ts` — were corrected instead. |

---

## Part C — the documentation you asked for

| # | Item | Status | Notes |
|---|---|---|---|
| C1 | **Un-collapse the 13 category comparisons.** They exist and are good — buried inside a `<details>` 2,250 lines down. Largest single cause of "I can't see the categories". | ✅ 2026-08-16 | The `<details>` around the generated `help categories` block is gone in both documents. Pinned structurally by `test/docs/categories.test.ts` — the block must sit outside every collapsed element, so a later presentation pass cannot fold it away again quietly. |
| C2 | **`mycontext examples <category> --short`** — title, body, distinctive fields only. Makes all 20 generatable at ~120 lines per document instead of ~500 of near-identical YAML. | ✅ 2026-08-16 | 4–6 lines each (79 content lines for the 17 enabled), ~199 lines per document once markers, fences and labels are counted. Unknown-flag refusal added with it: `examples` read `args[0]` and ignored the rest. |
| C3 | **Fill the three placeholder seeds.** `policy`/`postmortem`/`taxonomy` print *"Replace this body with the real content"* — the only place the tool ships filler. **Moot if C6 removes them.** | 🔒 | Depends on D1 (the catalogue swap), which removes all three. Still out of scope: the READMEs now say plainly that these three have no specimen and why. |
| C4 | **`glossary` has no neighbour comparison** — the only category without one. | ✅ 2026-08-16 | `glossary` vs `rule`: both can be phrased as a prohibition, and the phrasing is not the test. Every enabled category naming a real, different neighbour is now derived from the catalogue in `test/help/help.test.ts`, so the next category added cannot repeat this. |
| C5 | **Per-category treatment**: what it is for (2 sentences), the nearest neighbour and the test that separates them, one short generated specimen. 20 categories, both languages. | ✅ 2026-08-16 | 17 of 20: the purpose and neighbour entries live in `src/help/topics/categories.md`, so they reach the help topic, `mycontext_help` and both READMEs from one source; the specimens are generated `--short` blocks. `policy`/`postmortem`/`taxonomy` keep the existing overlaps/enable-when table pending C3. |
| C6 | **Capabilities section rebuilt** — `### In one screen` (a real injected block, lifted from `README.md:1104` — 1095 was inside a quoted item FILE, a different artefact), `### Why not just CLAUDE.md`, `### The unusual parts`, then the existing map verbatim. Keep the disclaimers at the bottom; they are why anyone believes the rest. | ✅ 2026-08-16 | Four `###` subsections in both documents: `In one screen` (the §4 just-in-time block verbatim — the same text `test/docs/injection.test.ts` re-derives from the running hook, so the demonstration is verified output rather than composed), `Why not just CLAUDE.md`, `The unusual parts` (five mechanisms, each verified in the code: the path-triggered hook, the per-session ledger `decay` is computed from, the quote check, `draft` in no injection tier, the derived index), and `Everything, one line each` — the existing twelve bullets, the §8 pointer and the Bash-permissions caveat, all unmoved at the bottom. `capabilities.test.ts` and `parity.test.ts` both green with the new subheadings. |
| C7 | **The honesty line, written down**: mechanism claims may be as loud as you like; guarantee claims carry their condition in the same sentence. | ✅ 2026-08-16 | Recorded in this repository's own corpus as `STD-guarantee-claims-carry-their-condition-in-the-same-sentence` — `hard`, scoped to `README.md` and `docs/README.he.md`, so it is selected by the just-in-time tier at the moment somebody opens a README to write the next marketing sentence. It names the forbidden compression ("nothing an agent writes can govern your project without your approval") and the three other refusals: "perfect memory", "learns from your mistakes automatically", "your rules can never drift". One limit, measured: at the default `jit` budget of 500 this repository's corpus spills, so the item is named in the omission note rather than delivered in full on a README edit. |

### C-REVIEW — the phase review, closed 2026-08-16

Judged against the two complaints that opened the phase, by reading both documents rendered
through GitHub's own markdown API in a browser rather than by reading the source. **The
categories are visible and the section now sells** — see the verdict at the end of this
block. Four defects were found and fixed; two follow-ups are C8 and C9.

| # | Item | Status |
|---|---|---|
| C-R1 | **The demonstration was not pinned to anything, and the sentence introducing it said it was.** `### In one screen` says the block is *"the real output of the hook, quoted verbatim and re-derived from the running code by `test/docs/injection.test.ts` on every test run"*. `injection.test.ts` asserts `document.includes(hookOutput)` — a substring test — and the phase added a **second** copy of that block 1,000 lines above §4's. One true copy satisfies the substring for the whole file, so the new copy was unchecked prose claiming to be tool output. **Reproduced:** a rule the hook never emitted (`RULE-never-log-ANYTHING`) put into the `In one screen` copy of both documents left all **1,953** tests passing. **Closed:** `test/docs/capabilities.test.ts` now requires every quoted just-in-time block in a document to be byte-identical, in both languages, so `injection.test.ts` keeps pinning one copy and this keeps the rest equal to it. Mutated three ways after the fix — falsify one copy, dissolve the block into prose, collapse a subsection — each KILLED by the intended assertion and by no other. | ✅ |
| C-R2 | **`README.md:181` was false, and self-refuting on the same screen.** *"The other three items declare no scope at all, so nothing restricts them and they arrive on the first file the session touches"* — but `RULE-never-log-customer-email` is scoped `src/**` (`test/fixtures/docs-workspace/.my_context/items/rule/RULE-never-log-customer-email.md:8`) and the quoted block prints `_scope: src/**_` under it ten lines above the sentence; and `CONST-postgres-pool-capped-at-20` is `always: true`, so in a session with a SessionStart it is **pinned** at the start rather than arriving on a file. **Closed** in both languages: two are unscoped, the third is scoped `src/**` which the target is under, and the block is named as the output for a session whose first event is the edit. | ✅ |
| C-R3 | **`README.md:226` compressed a guarantee past its condition — the exact failure C7's own standard was written to forbid.** *"A normative item Claude captures lands as a `draft`"* is true of the MCP tools and false of the shell fallback **this plugin's own generated slash commands instruct Claude to use**: `src/plugin/commands.ts:142-148` emits, into every `add-<normative>.md`, an invocation of `mycontext add … --yes`, and says in the same breath that it *"lands **active** rather than as a draft and governs this project the moment it is written"*. **Closed:** the condition is now in the same sentence, with the fallback named. | ✅ |
| C-R4 | **`README.md:232` — *"the database is disposable"*, two bullets after the one saying `decay` is computed from the ledger.** The ledger lives in the same `.index.db` (`src/core/workspace.ts:46`, `src/core/ledger.ts:28`) and is derived from nothing; `rebuild` only re-derives `items` (`src/core/rebuild.ts:454`), and deleting the file — the documented recovery, and `Store.open`'s own corruption self-heal — zeroes the injection history permanently. §8 states this at `README.md:3647`; the marketing bullet did not. **Closed:** "the index is disposable", with the ledger exception in the bullet. Eight Hebrew terminology defects were fixed with it — `span`/`chunk` inverted against the document's own vocabulary, `hardest` as `הקשים` (difficult) rather than `הקשיחים`, `prompt` as `הנחיה` (which is this document's word for `instruction`), `drops` as `מפיל`, three of the four `CLAUDE.md` limits not echoing the §1 wording they claim to answer, and `שני פרקים` for a `###` subsection. | ✅ |

**What the review checked and found clean.** Every claim in `### The unusual parts` and
`### Why not just CLAUDE.md` was verified by execution, not by reading: the four delivery
events against `src/core/select.ts:338-365` and the live hooks; the ledger key tuple
(`PRIMARY KEY (session_id, item_id, tier)`); once-per-session dedupe reproduced across two
files in one session; `decay`'s window and its self-printed caveat, before and after a
session; the quote check driven through `validateCandidates` with six quote variants, where
a paraphrase, a case change and a dropped word are each rejected and a re-wrapped exact
match is accepted; zero runtime dependencies and no `fetch`, no HTTP import, no API-key
symbol anywhere in `src/`; `draft` admitted to no tier at four events with budgets of 1e9
and zero spill records, proving no budget was consulted; the checksum re-stamped across
`add`, `edit`, `promote`, `supersede` and `promote-revision`, verified by `rebuild` and
`doctor`. The Hebrew mirror was checked claim-by-claim against the English: no claim is
missing or contradicted, all 17 new RTL wrappers are balanced with no fenced block inside
one, and every new anchor resolves.

**Does it sell, and can he see the categories?** Yes to both, with one reservation recorded
as C8. `### In one screen` opens on a real injected block with three sentences of frame and
is the strongest thing in either document; the twelve bullets that were the whole section
are now the fourth subsection, where they belong. The categories are out of the `<details>`,
each with a purpose, a nearest neighbour, the test that separates them, and a generated
specimen. The reservation is that the catalogue **table** — the artefact the complaint was
most directly about — renders as raw `|` pipes inside a monospace block, three inches above
a three-row table that renders properly.

| # | Item | Status | Notes |
|---|---|---|---|
| C8 | **The generated `help categories` block renders as unformatted terminal output.** It is inside a ```` ```text ```` fence (`README.md:2409`, mirrored in `docs/README.he.md`), so GitHub renders its 17-row Markdown table as literal `|` pipes and its `#`/`##`/`###` headings as literal hashes — `README.md:2433-2452` is the table. The contrast is visible on one screen: `### The three categories only \`full\` enables` sits ~550 lines later with a **rendered** three-row table, so the three categories the profile does *not* enable are the better-presented half of the section. | ⏸ | **Deferred, not disputed.** Fixing it means a new marker form in `scripts/gen-doc-examples.ts` that emits the block as document-native Markdown under a deterministic heading-level shift, the same transform applied in `test/docs/examples.test.ts` so the block stays verified output, and ~19 new headings per document that `parity.test.ts` and `capabilities.test.ts` both key on. It also weakens the framing sentence — *"The block below is that command's real output"* — which is a deliberate honesty choice, so the trade is a decision and not a repair. A phase-review fix would have had to change the generator, two tests and both documents on the last day of the phase. |
| C9 | **This repository's own `jit` budget is too small for the item C7 recorded.** Confirmed by running the real PreToolUse hook against `README.md` in this repo: at the default `jit: 500` (`.my_context/config.json` sets `"budgets": {}`; `src/core/config.ts:12`) `STD-guarantee-claims-carry-their-condition-in-the-same-sentence` spills and reaches the model only as a name in `_6 item(s) omitted from full text for budget: …_`. Its body — the forbidden compression and the three other refusals — is never delivered on a README edit. | ⏸ | **Deferred, and it belongs to the dogfooding row rather than to Part C.** The placement is right: `scope: [README.md, docs/README.he.md]`, `severity: hard`, just-in-time, is exactly where a standard about README sentences should sit, and the item is well written. What is wrong is this repository's budget, and raising it is a change to the corpus this project governs itself with — the same subject as B7.1, which is also blocked on Q1–Q3. Doing it here would have been one line of config with no test that could fail. Recommended disposition: raise `jit` when B7.1's corpus decisions are made, or pin the item (`always: true`) if the pinned tier is judged the right home for a documentation standard. |

**The three concerns the phase raised, judged.**

- **`--short` is not worth renaming.** On the six reporting commands it selects a detail
  level; on `examples` it selects a smaller rendering of the same item. Both are "show me
  less", both are built from one item (`exampleItemShort` and `exampleItem` in
  `src/help/index.ts`), and `examples` now refuses an unrecognised option instead of
  silently printing the full form. The flag table covers it. A rename would cost a flag
  spelling in both READMEs, the help topic and the plan, to separate two senses a reader
  does not have to distinguish.
- **`help categories` at 241 lines is earned.** It is on demand, it is the topic whose only
  job is teaching a model which of twenty types a fact belongs to, and 2.5× its former size
  is what buys an entry per type instead of a bullet list of pairs. The alternative — making
  the model ask twice — costs a round trip at the moment it is deciding. Recorded here so
  the number is deliberate rather than unnoticed.
- **The ordering concern was real and is fixed**, along with a worse one it was standing next
  to. See C-R1: `test/docs/capabilities.test.ts` now pins the four subsections and their
  order, that the demonstration is inside the first one, and that every quoted just-in-time
  block is the same text.

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
| E5 | Missing `lesson-discard` deny rule; `help <topic> --flag` falsehood; `revisionFor` (`src/core/revision.ts:795`) is a dead API with no `src/` caller, whose doc comment reads as though it were a live surface API; **the two ledger `--help` width measurements could not be reproduced by the phase review and their premise has moved** — `mycontext edit --help` is now an unknown-option refusal followed by a 4-line banner at 85 columns, and `review --help` is 8 lines at 100, zero rows over budget. Re-measure before acting on the row. | ⏸ |
| E6 | The revision log is unconditionally gitignored — a staged proposal is local to one machine, and the "never deletes a proposal" log is not in version control. **Now disclosed** in §8 (`README.md:3187`, `docs/README.he.md:3538`), so what is left is the gap itself rather than the silence about it. | ⏸ |
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

1. **Part B** — B1–B6 are closed; the trust hole and the inverted §8 are both gone. What is left under Part B is B7, the review's own deferrals.
2. **Part C** — the documentation you asked for. C1, C2, C4, C5, C6 and C7 are closed; only C3 is left, and it waits on D1.
3. **Part D1 + D2** — the catalogue and `reference`. Shares one MAJOR bump.
4. **Part D3** — Phase 2's surface.
5. **Part E** — quality, then cut the release.
6. **Part D4** — the three hard requirements, once Q1–Q3 are answered.
