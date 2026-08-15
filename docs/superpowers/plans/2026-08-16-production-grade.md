# Production Grade — Master Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan phase by phase. `docs/ROADMAP.md` is the tracking table and is updated the moment any row changes.

**Goal:** Take mycontext from "works, mostly documented, one trust hole" to a tagged 1.0.0 that a stranger can install, trust and use.

**Architecture:** Six phases. Phase 1 closes everything that makes the product or its documentation untrue — nothing else ships until it is empty. Phases 2–5 build out. Phase 6 tags.

**Roadmap:** `docs/ROADMAP.md` · **Reviews:** the three read-only reports of 2026-08-16 · **Audit:** `docs/audit/2026-08-14-executive-plan.md`

## Decisions taken 2026-08-16

| # | Decision |
|---|---|
| Q1 | **Domains are dropped.** `REQ-items-carry-a-domain` is retired by supersede, with the reasoning recorded: scope globs, tags, categories and SQL already slice the corpus four ways, and a fifth axis is surface nobody asked for twice. |
| Q2 | **Focus discloses and allows.** It hides what you asked it to hide and reports the cost — "N items hidden, M load-bearing relations dangling". It never silently produces a corpus that contradicts itself, and it never refuses to do what you asked. |
| Q3 | **The audit log records mutations and hook actions, including injections — the injection's scope, not its content.** Small enough to keep, complete enough to answer "what did this session actually see". |
| Q4 | **No tag until everything is in.** Nothing is released, so removing a category costs nobody anything today; the MAJOR rule only bites once someone depends on it. One release: **1.0.0**, at the end. |
| Q5 | **Whether `runbook` survives `reference` is decided after `reference` ships**, not before. Its outcome is the input. |
| Q6 | **Categories before the surface.** The slash-command generator builds one command per enabled category; settling the vocabulary first means generating the surface once instead of regenerating every command file. |

## Global Constraints

- **Zero runtime dependencies.** Node 24 native type-stripping, no build step, `erasableSyntaxOnly`, explicit `.ts` extensions.
- **Never write a comment, message, doc or corpus item asserting a property the code does not have.** Nineteen false statements have been found in this project's own documentation. Verify by executing.
- **Nothing is ever dropped silently.** A field accepted and ignored is the one unacceptable failure.
- **Markdown is the source of truth**; `files → DB → files` byte-identical.
- **Every change needs a test that fails without it.** Mutate each guard. **Commit before mutating** — seven escapes by the project's own count, three of them destroying an agent's work.
- **Both documents, always.** `docs/README.he.md` is a structural mirror; professional Hebrew term where one exists, otherwise the English.
- **Four documentation tests pin the READMEs.** `npm run gen:docs` regenerates example blocks; never hand-edit one.
- **Reports hold to a 100-column budget** at hostile id length (67 chars).
- `npm test`, `npx tsc --noEmit`, `npm run test:perf` clean. `git status --porcelain` clean.
- **`docs/ROADMAP.md` is updated as part of the task that changes a row**, not afterwards.

---

## Phase 1 — nothing is true until this is empty

The product has a trust hole an agent can reach with no shell, and the documentation section built to prevent false claims is making four of them.

### 1A — the two gate holes

One bug: **the gate is computed from what an item is, rather than from what the edit makes it.**

- `extra` falls through both `agentEdits` and `guardedChange`. Stage it like other content. `extra.directive` decides whether a rule prescribes or prohibits.
- `gateFor` reads the item's current status, so a draft is ungated in the field that ends the draft. **Gate on the resulting state.**
- Add `edit --extra`, or humans have no route once `extra` stages. Decide `observations`, which no surface can edit at all.
- Correct `update_item`'s tool description, which advertises `extra` beside seven fields that behave differently.

### 1B — §8, repaired

- Delete the entries that describe shipped capabilities; split the one with a real residue.
- Remove every tense violation, including the sentence conceding it.
- **Correct "No test checks this section"** — two do, and there are nine test files, not two. This is the paragraph telling readers how to verify the document.
- Drop the wave numbers or link the plan; they are unresolvable, stale and in one case misattributed.
- **Add what is missing:** the `reference`/`known_issue`/`runbook`/`environment` design; that enforcement does not exist; that `instruction` is not inherently pinned; the custom-category gaps; the two missing help topics.

### 1C — silent answers and false messages

`review revisions <typo>`; pending revisions invisible to all 11 MCP tools and SessionStart; `init` accepting and ignoring every argument; `lesson <id>` claiming it recorded; `valid_until` left stamped and read by nothing; config overrides dropping `extraFields` and `prefix`; `doctor`'s dead-scope advice untrue for rationale items.

### 1D — mechanisms with no test that can fail

The `query` read-only pin (structural, not behavioural — the behavioural route is proven a dead end); spawn-based hook contract tests (**PostToolUse only** for stdin-held-open); the e2e cold-cache clock; the load-sensitive revision-concurrency test; and **a mutation harness that commits or refuses**, because seven escapes is not a discipline problem.

### 1E — the compaction claim

False on **eight** surfaces with **two tests pinning the false text**. All move together; a partial fix leaves lying surfaces, and an unhedged "is restored" is a new false claim.

---

## Phase 2 — the documentation the owner asked for

- Un-collapse the thirteen category comparisons that already exist and are invisible.
- `mycontext examples <category> --short`, so all twenty are generated rather than 500 lines of near-identical YAML per document.
- The missing `glossary` neighbour comparison.
- A per-category treatment: what it is for, the nearest neighbour and the test that separates them, one short generated specimen.
- The capabilities section rebuilt around a **worked moment** — a real injected block — plus "why not just `CLAUDE.md`" and "the unusual parts". Keep the disclaimers at the bottom; they are why anyone believes the rest.
- **The honesty line written down:** mechanism claims may be as loud as you like; guarantee claims carry their condition in the same sentence.

*The three placeholder seeds are dropped from scope — Phase 3 removes those categories.*

---

## Phase 3 — the vocabulary

- **Out:** `policy`, `postmortem`, `taxonomy` — each duplicates a clearer sibling, and type is fixed at creation.
- **In:** `known_issue`, `runbook`, `environment`.
- **Migration:** `loadLayer` deliberately indexes unknown types, so removal must not become a silent drop. There is **no retype**; the only path is `supersede`, and `doctor` must name any affected item with that route.
- **`reference`:** body is a snapshot, `source_file`/`source_checksum` record origin, `doctor`'s existing `source_drift` reports divergence. **Rationale tier by default**, so the trust problem is closed by construction; the consequence of retiering is stated bluntly. Capture reads the file; refresh is a command; a size limit is decided rather than silent.
- **Then decide whether `runbook` still earns its entry.**

---

## Phase 4 — the surface

Read commands, write commands, ingest and lessons, and `query` with SQL help — all as slash commands, generated from the settled vocabulary. **Parity enforced by test**: anything the model can do through a tool has a command, and remaining asymmetries are listed deliberately. Named commands for common cases plus an asking flow with numbered options, one implementation and one enumerating test.

---

## Phase 5 — quality, and the two remaining requirements

- **Linux certification** — several tests skip on non-Windows and the POSIX case-sensitivity test has never once executed.
- **Establish whether subagents get injected.** The worst case is that a subagent shares the parent's `session_id` and gets nothing while the ledger claims delivery.
- **Wave 5 consolidation** — six open-rebuild copies with caller-class retry policy, the registry migration, splitting `mutate.ts`. Phase 1 grew that file, so this got more expensive.
- **Session focus**, per Q2: discloses and allows.
- **The audit log**, per Q3: mutations and hook actions, injections by scope not content. Append-only, excluded from the checksum, never defaulted during rebuild or repair.
- **Retire `REQ-items-carry-a-domain`** by supersede, per Q1, with the reasoning recorded.
- The remaining smaller items: `lesson-discard` deny rule, `help <topic> --flag`, the dead `revisionFor` API, the drifted `--help` measurements, the undisclosed gitignored revision log, the SessionStart contention stall.

---

## Phase 6 — release

Every hard requirement in the corpus has an explicit disposition — implemented, or deferred **with its corpus item annotated**. "Unimplemented and injected as binding" is the one unacceptable state. Then tag **1.0.0**.

---

## Self-Review

**Coverage.** Every row of `docs/ROADMAP.md` Parts B–E appears in exactly one phase. Part F is deferred by decision and appears nowhere. The six decisions above discharge Q1–Q6.

**Sequencing.** Phase 1 is unordered internally — 1A through 1E can run in any order, and 1A is the only one with a security shape. Phase 3 precedes Phase 4 per Q6. Phase 5's focus and audit-log work depends on nothing in Phases 2–4 and could move earlier if wanted.

**One risk worth naming:** Phase 1 is 26 items and mostly small. The temptation will be to batch aggressively. 1A and 1E are the two that must not be batched with anything — 1A because it is a trust boundary, 1E because a partial fix is worse than none.
