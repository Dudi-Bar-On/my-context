# R6 — The Claude Code tooling ecosystem on this machine, ruled against my_context

**The question:** would integrating my_context with the other tools already installed here be
beneficial? This is an assessment, not an implementation plan. GSD and Graphify are named by
the owner and get their own sections; everything else is ruled in a table.

**Method.** Every candidate was read from its own files on this machine, not from its name or
its README's marketing. Claims are marked `[V]` when verified from a file I opened and `[R]`
when reasoned from what I read. Nothing was modified; `.my_context/` was read only.

**The bar every candidate has to clear.** my_context carries three `hard`, `always: true`
items that decide most of this report before any candidate is considered `[V]`:

- `CONST-zero-runtime-dependencies` — "Only `typescript` and `@types/node` are permitted, and
  only as devDependencies." Its own recorded consequences: the MCP server speaks JSON-RPC by
  hand, and the frontmatter parser is hand-written. `[V]`
- `CONST-node-24-no-build-step` — source is `.ts`, run directly by Node 24 type stripping, no
  `dist/`. `[V]`
- `NOGOAL-not-a-claude-mem-replacement` — "claude-mem is descriptive… my_context is normative…
  Do not build session history, activity capture, or semantic search over past work." `[V]`

So "integrate" here can only mean: a shared file format, a shared convention, MCP, or one tool
reading another's output on disk. Any candidate that needs a client library, a daemon, or a
Python runtime inside the shipped plugin is a different kind of decision, and I say so where it
applies.

---

## What is installed

**my_context itself** `[V]` — 44 items across 10 categories (`adr` 3, `constraint` 2,
`decision` 5, `invariant` 6, `lesson` 7, `non_goal` 3, `open_question` 3, `requirement` 6,
`rule` 5, `standard` 4), carrying **27 relation edges over 12 distinct relation names**. Hooks:
`SessionStart` (`startup|clear|resume|compact`), `PreToolUse`
(`Read|Edit|MultiEdit|Write|NotebookEdit`), `PreCompact`, `PostToolUse` (`Write|Edit|MultiEdit`),
all with 5–10s timeouts. 14 MCP tools. Installed as `mycontext@mycontext` v1.0.0 and enabled.

**GSD (get-shit-done) v1.50.0-canary.1** `[V]` — **not a plugin.** Installed directly into
`~/.claude`: `get-shit-done/{bin,contexts,references,templates,workflows}`, plus **33
`gsd-*.md` agent definitions** in `~/.claude/agents/`, 10 `gsd-*` skills, and ~14 `gsd-*` hook
scripts in `~/.claude/hooks/`. 96 workflow files, 44 templates, 48 reference documents, 32
CommonJS library modules under `bin/lib/`.

**Graphify** `[V]` — a skill at `~/.claude/skills/graphify/SKILL.md` (37 KB) plus 8 reference
files. It is a **driver for a Python package**, `graphifyy`, installed via `uv tool install` or
`pip`. Not a plugin, not a Node program.

**Plugins** `[V]` — 32 installed, from `installed_plugins.json`; enabled/disabled state read
from `settings.json`. Enabled and relevant: `compound-engineering@every-marketplace` 3.22.1,
`claude-md-management@claude-plugins-official`, `task-orchestrator` 3.6.0, `taskmaster`,
`superpowers` 6.3.0, `context7`, `code-review`, `pr-review-toolkit`, `feature-dev`. **Disabled:**
`claude-mem@thedotmack` 13.15.2, `context-management`, `agent-orchestration`,
`agentic-awesome-skills`. The rest are UI/frontend/k8s/document/browser tooling with no
knowledge store.

**One structural fact worth stating up front** `[V]`: `~/.claude/settings.json` has **no
`hooks` key at all**. Every hook running on this machine comes from a plugin's own
`hooks.json`. GSD's fourteen hook scripts exist on disk but are not globally wired. So the only
tools currently competing for the same hook events as my_context are other *enabled plugins* —
and the one that would collide hardest, claude-mem (`SessionStart` + `UserPromptSubmit` +
async `PostToolUse` on `*`), is switched off.

**`~/.claude/commands/` is empty** `[V]`. There is no user-authored command layer to
reconcile with.

---

## GSD

### 1. What it does

GSD is a **phase-structured planning and execution harness**. A project gets a `.planning/`
directory holding `ROADMAP.md`, `STATE.md`, `config.json`, and one directory per phase
containing `CONTEXT.md`, `RESEARCH.md`, `PLAN.md`, `SUMMARY.md`, `VERIFICATION.md`, `UAT.md`,
`LEARNINGS.md`. Work moves through named workflows — `/gsd-new-project`, `/gsd-discuss-phase`,
`/gsd-plan-phase`, `/gsd-execute-phase`, `/gsd-verify-phase`, `/gsd-code-review` — and almost
none of that work happens in the main context: each workflow dispatches specialised subagents
(`gsd-planner`, `gsd-executor`, `gsd-phase-researcher`, `gsd-code-reviewer`, `gsd-verifier`,
`gsd-security-auditor`, …) that read the phase artifacts, write new ones, and return a compact
summary `[V]`. It also keeps a **cross-project learnings store at `~/.gsd/knowledge/`** — one
JSON file per learning, `{id, source_project, date, context, learning, tags, content_hash}`,
deduplicated by SHA-256 of the learning text plus the source project, with
`gsd-tools learnings list|query --tag|copy|prune|delete` `[V]`. GSD is imperative and
time-ordered: it is about *what to do next and in what order*.

### 2. Where it overlaps my_context

Three places, and only one of them is a real collision.

**`~/.gsd/knowledge/` versus the global layer — a real collision `[V]`.** my_context reads a
second corpus from `~/.my-context` (hyphen) as the global layer, for exactly the knowledge
that follows a person between projects. GSD stores exactly the same class of thing at
`~/.gsd/knowledge/`, one JSON per learning, cross-project by construction, with a
`copy-from-project` command that promotes a project `LEARNINGS.md` entry into it. Two
home-directory stores of "what I learned that applies everywhere," in two formats, with two
promotion paths. This is the "two spellings of one rule" case in its purest form.

**`LEARNINGS.md` versus `lesson` and `decision` `[V]`.** `workflows/extract_learnings.md`
reads a phase's `PLAN.md`, `SUMMARY.md`, `VERIFICATION.md`, `UAT.md` and `STATE.md` and emits
four categories — **decisions, lessons, patterns, surprises** — each with a *what*, a *why/context*,
and a `Source:` attribution back to the artifact it came from. Two of those four category names
are my_context category names, and source attribution is my_context's `source_file` /
`source_anchor` / `source_checksum` triple by another name. The overlap is not accidental; both
tools independently converged on "a learning without provenance is not reviewable."

**`<decisions>` in `CONTEXT.md` versus `decision` `[V]`.** `bin/lib/decisions.cjs` is 48 lines
that parse `- **D-01:** text` out of a `<decisions>` block. That is a decision store: id, text,
per-phase. It is deliberately thin — no rationale field, no status, no relations, no lifecycle —
and it is scoped to one phase, which is the difference that matters (below).

Everything else in GSD — roadmaps, plans, verification reports, UAT — is orthogonal. It is
schedule, not law.

### 3. Where it composes

This is where GSD becomes the strongest candidate in the report, for two concrete reasons.

**(a) GSD's `<canonical_refs>` is a documented, mandatory, per-phase slot for exactly what
my_context holds `[V].`** From `templates/context.md`:

> ## Canonical References
> **Downstream agents MUST read these before planning or implementing.**
> [List every spec, ADR, feature doc, or design doc that defines requirements or constraints
> for this phase. Use full relative paths so agents can read them directly.]
>
> **CRITICAL — Canonical references:** The `<canonical_refs>` section is MANDATORY. Every
> CONTEXT.md must have one… Inline mentions like "see ADR-019" scattered in decisions are
> useless to downstream agents — they need full paths and section references in a dedicated
> section they can find.

my_context items *are* files with full relative paths: `.my_context/items/constraint/CONST-*.md`.
A `<canonical_refs>` block that lists the constraints, invariants and rules governing a phase's
scope is not an integration anyone has to build — it is a line of documentation and a habit.
And it lands the corpus in the one place GSD's own template says downstream agents are
*required* to read. This is the shape the brief asked for: **GSD writes plans; my_context holds
the constraints those plans must respect, and GSD already reserved the slot to name them in.**

**(b) The subagent gap is GSD-shaped `[V].`** `README.md` §8, as corrected on 2026-08-19 against
Claude Code 2.1.234, states that `SessionStart` does not fire for a subagent, so a subagent
never receives the pinned tier, the index, or a compaction restore; it gets only the
just-in-time tier, and only if it touches a file. GSD is the largest subagent consumer on this
machine by an order of magnitude — 33 agent definitions, and its whole design philosophy is
"do the work in a subagent to keep the orchestrator's context small." The practical consequence
is precise and bad: **`gsd-planner` writes the plan and `gsd-executor` writes the code without
ever seeing `CONST-zero-runtime-dependencies` or `RULE-erasable-syntax-only`, unless they happen
to touch a file whose scope globs match and the item fits the `jit` budget.** The items most
likely to be missed are exactly the `always: true` process directives, because those are the
ones that live in the pinned tier and have no scope.

Same probe run also established that **`SubagentStart` fires**, carrying `agent_id` that joins
to the subagent's own `PreToolUse` payload `[V]`. So the gap now has a known shape rather than
being a platform property.

**(c) Two smaller, cheap compositions.** GSD's phase artifacts are precisely the documents
`mycontext ingest` was built for — heading-split, model-extracted, human-promoted `[V]`. And
`watchedDocs` (the config key that nudges "you edited this, capture what it decided") takes
globs; `.planning/**/*-CONTEXT.md` and `.planning/**/LEARNINGS.md` are the natural values on a
GSD project. Note that **`watchedDocs` replaces rather than extends the defaults** `[V]`, so this
is a per-project config choice with a cost, not a free add.

**(d) GSD is the working precedent for how to integrate a third-party tool without breaking
anything.** `bin/lib/graphify.cjs` (523 lines) is worth reading as a template regardless of
what my_context decides about graphify itself, because it is a careful piece of engineering:
config-gated behind `.planning/config.json` `graphify.enabled` defaulting to **false**; returns
a structured `{disabled: true, message}` rather than erroring; detects a missing binary as exit
127 with a message rather than a crash; a `SIGTERM` timeout maps to exit 124; version
compatibility checked against a tested range with a *warning*, not a refusal; and
`gsd-graphify-update.sh` is an eight-gate, fast-fail, always-`exit 0` PostToolUse hook that
detaches the rebuild and "never blocks the user-facing tool call" `[V]`. That is the same
fail-open discipline `INV-hooks-fail-open` names.

### 4. Verdict — **COMPOSE-BY-CONVENTION**, and it is the highest-value item in this report

Not INTEGRATE, for one decisive reason: **GSD is not installed as a plugin and is not
distributed with my_context.** Shipping code inside my_context that knows about `.planning/`
would make a general-purpose plugin carry a hard dependency on one person's workflow harness.
The composition that matters needs no code at all — it needs `<canonical_refs>` populated with
item paths, `watchedDocs` pointed at `.planning/`, and `mycontext ingest` run on `LEARNINGS.md`.

The one thing that *is* worth building is not GSD-specific: the `SubagentStart` injection.
Building it because "GSD needs it" is the wrong framing; building it because *any* subagent-heavy
workflow leaves the pinned tier at the door is the right one, and GSD is the evidence that such
workflows are the normal case, not the exotic one.

**`~/.gsd/knowledge/` versus `~/.my-context` is the exception and should be named as a real
overlap.** It is not resolvable by convention alone: two home-directory stores will drift. The
honest answer is to pick one and note the other in `NOGOAL` — and my_context has the better
model (categories, tiers, severity, lifecycle, relations, human promotion) while GSD's has the
better ergonomics for capture-during-work.

---

## Graphify

### 1. What it does

Graphify turns a folder of files into a persistent knowledge graph and three outputs: an
interactive `graph.html`, a GraphRAG-ready `graph.json`, and a plain-language
`GRAPH_REPORT.md`, all under `graphify-out/` `[V]`. Extraction is two-track: **code is extracted
structurally by AST with no LLM and no API key at all**; docs, papers and images are extracted
*semantically* by dispatching parallel `general-purpose` subagents (or Gemini, if
`GEMINI_API_KEY` is set) that return a fixed JSON schema. It then builds a NetworkX graph, runs
community detection with per-community cohesion scores, identifies "god nodes" and "surprising
connections", and offers `query` (seed-then-BFS/DFS with a `--budget` token cap), `path` between
two concepts, and `explain` for one node. Exports: Obsidian vault, GraphML, SVG, an
agent-crawlable wiki, Neo4j and FalkorDB cypher (with direct push), and an MCP stdio server. It
keeps a cumulative token-cost ledger in `cost.json` and refuses to overwrite `graph.json` with a
smaller graph. Its "Honesty Rules" are explicit: *never invent an edge; if unsure, use
AMBIGUOUS.* `[V]`

**Its edge vocabulary** `[V]`: `calls`, `implements`, `references`, `cites`,
`conceptually_related_to`, `shares_data_with`, `semantically_similar_to`, `rationale_for`, plus
hyperedge relations `participate_in`, `implement`, `form`. Every edge carries a confidence tier
(`EXTRACTED` = 1.0, `INFERRED`, `AMBIGUOUS`) and a numeric `confidence_score`.

### 2. Where it overlaps my_context

**Almost nowhere, and the near-miss is instructive.** Compare the two vocabularies:

| | my_context | graphify |
|---|---|---|
| Relations | `derived_from` `constrains` `supersedes` `blocks` `mitigates` `refines` `relates_to` `links_to` `[V]` | `calls` `implements` `references` `cites` `conceptually_related_to` `shares_data_with` `semantically_similar_to` `rationale_for` `[V]` |
| Overlap | — | **zero shared names** |
| Origin of an edge | authored by a human or an agent through `link_items`, gated by a closed enum | inferred by an LLM or derived from an AST, scored 0.6–1.0 |
| Trust model | `origin` (human/agent/ingest) + `status` (draft→active), human promotion required | `confidence` tier, no review step |
| Nodes | 44 authored normative items | every function, class, file and named concept in the corpus |

my_context's edges say **what governs what**. Graphify's edges say **what resembles or
references what**. `constrains` and `blocks` have no graphify equivalent because graphify has no
notion of a rule; `semantically_similar_to` has no my_context equivalent because a closed
normative vocabulary deliberately refuses to record "these two feel alike."

The one genuine overlap is **the ego-graph idea**, and both tools implement it independently.
my_context's `focus` reads relations for *disclosure* — how many load-bearing edges a hide
leaves dangling — and explicitly refuses to use relations for *selection*, because transitive
closure "silently overrides an explicit exclusion" `[V]`. GSD's `graphifyQuery` does the
opposite: seed-then-expand BFS to 2 hops with confidence-tier budget dropping `[V]`. These are
two answers to the same question, and my_context's is the correct one *for a normative corpus*
— a constraint you were told about because it was two hops from a file you touched is a
constraint you cannot audit.

### 3. Where it composes

**Graphify is a better renderer of something my_context already models — and a worse extractor
of it.** That is the whole answer, and the two halves point in opposite directions.

**The renderer half is real and cheap.** my_context already holds a typed, directed,
human-authored graph: 44 nodes, 27 edges, 12 edge types. What it does not have is any way to
*look* at that graph. Emitting `graph.json` in graphify's node/edge schema is pure string
formatting over data already in memory — no dependency, no build step, no Python — and it buys,
for free:

- `graph.html`, the interactive viewer, via `graphify export html`;
- an Obsidian vault, which matters because `ADR-build-rather-than-adopt` records that the
  storage format was borrowed from Basic Memory *for Obsidian and git compatibility* `[V]` —
  this closes a loop the project already opened;
- GraphML for Gephi/yEd, SVG for embedding in a README or PR;
- Neo4j/FalkorDB cypher for anyone who wants it, without my_context ever linking a driver;
- and `gsd-tools graphify query <term> --budget N`, which already knows how to read
  `graph.json` `[V]`.

There is also a diagnostic payoff. The corpus carries **12 relation names on disk but the enum
admits 8** `[V]` — `produced`, `discovered_by`, `unblocks`, `enforces`, `enforced_by`,
`depends_on`, `answers` exist in files and cannot be created through `link_items` today. That
divergence is documented in `core/focus.ts` in careful prose, and it is invisible. On a rendered
graph it is one glance.

**The extractor half is a hazard, and it should be said plainly.** Running `/graphify .` on a
repository containing `.my_context/` would send item bodies to `general-purpose` subagents for
semantic extraction and mint `INFERRED` `semantically_similar_to` edges *between authored
normative items* — a second, lower-trust rendering of the corpus's own relation graph, living in
`graphify-out/graph.json`, with no `origin`, no `status`, and no draft/active gate. Graphify's
skill description tells the host agent to treat *any* question about the codebase as a graph
query first when `graphify-out/` exists `[V]`, which means the low-trust copy would be consulted
in preference to the authored one. That is the exact "two spellings of one rule" failure the
brief names, and it arrives by accident rather than by decision. Whether graphify's detector
already skips dotted directories is **unverified** `[R]` — worth a five-minute probe, because
the answer decides whether this needs a documented convention or only a note.

### 4. Verdict — **COMPOSE-BY-CONVENTION**, one-directional, with a named exclusion

Concretely: **my_context emits, graphify renders. Graphify never extracts from `.my_context/`.**

- `mycontext export --graph` (or equivalent) writing graphify-schema `graph.json` is **inside
  the constraints**: no runtime dependency, no build step, pure formatting `[V]`. Every edge it
  emits is `EXTRACTED` / `confidence_score: 1.0`, which is true — these edges were authored, not
  inferred — and honest under graphify's own Honesty Rules.
- Running graphify's **extractor** over the corpus is **OVERLAPS-BADLY** and should be excluded
  by convention and documented.
- Nothing about graphify should ever be *required*. GSD's `graphify.enabled: false` default is
  the right posture to copy `[V]`.

Is a knowledge-graph tool a duplicate of my_context's relation model? **No — it is a viewer for
it, and only if my_context stays the author.** The moment graphify becomes a *source* of edges
about normative items, it is a duplicate with worse provenance.

---

## Everything else, ruled

| Tool | State | What it actually does (from its files) | Overlap | Verdict |
|---|---|---|---|---|
| **compound-engineering** 3.22.1 (`ce-compound`, `ce-compound-refresh`) | **enabled** | Documents a solved problem as a durable repo learning under `<root>/solutions/` with YAML frontmatter and a `references/schema.yaml`; seeds project vocabulary into `CONCEPTS.md`; `ce-compound-refresh` audits learnings for stale/overlapping/**superseded**/drifted `[V]` | **Severe.** A second store of `lesson`, with frontmatter, categories, a controlled vocabulary, and its own supersession/decay audit. Two homes for the same artifact, both enabled | **OVERLAPS-BADLY** — the sharpest collision on this machine. Pick one home for lessons |
| **claude-md-management** (`revise-claude-md`) | **enabled** | "Update CLAUDE.md with learnings from this session" `[V]` | Writes session learnings into `CLAUDE.md` — the file my_context's §1 exists to argue is not enough (no lifecycle, no scope, no budget, all-or-nothing) | **OVERLAPS-BADLY** (mild). Running it after a session that also captured items produces the rule in two places, one of which cannot be superseded |
| **claude-mem** 13.15.2 | **disabled** | SQLite-backed session compression; `SessionStart`+`UserPromptSubmit`+async `PostToolUse(*)` hooks; `mcp-search` MCP server `[V]` | Descriptive vs normative — the boundary is already written | **LEAVE-SEPARATE.** Already settled by `NOGOAL-not-a-claude-mem-replacement` (hard, always) and `ADR-build-rather-than-adopt` `[V]`. No action; the boundary is doing its job |
| **task-orchestrator** 3.6.0 | enabled | MCP-backed task DB under `.taskorchestrator/`, schema-aware, project-scoped; hooks `SessionStart`, `FileChanged`, **`PreToolUse` on `EnterPlanMode`** `[V]` | Tasks are imperative and complete; items are normative and persist. No storage overlap | **LEAVE-SEPARATE** — but note it proves `EnterPlanMode` is a hookable injection point my_context does not use |
| **taskmaster** | enabled | Task decomposition and execution agents | Same as above | **LEAVE-SEPARATE** |
| **superpowers** 6.3.0 | enabled | 14 process skills — TDD, brainstorming, `writing-plans`, `executing-plans`, subagent-driven development; writes specs and plans to `docs/superpowers/` | **Already composed, and nobody wrote it down:** two of my_context's three default `watchedDocs` globs are `docs/superpowers/specs/**` and `docs/superpowers/plans/**` `[V]`, and this very repo has a `.superpowers/` directory | **COMPOSE-BY-CONVENTION** — a shipped, working integration that is currently invisible in the docs |
| **code-review**, **pr-review-toolkit**, **feature-dev** | enabled | Review agents (`silent-failure-hunter`, `type-design-analyzer`, `comment-analyzer`, …) and a `code-architect` that "analyzes existing codebase patterns and conventions" | A reviewer that read `severity: hard` items would be an enforcement surface for the gap §8 names as *"Nothing enforces a hard item"* `[V]` | **COMPOSE-BY-CONVENTION** — real, but soft enforcement by prompt; CI is the stronger answer (R3's territory) |
| **context7** | enabled | Fetches current third-party library documentation via MCP | External world knowledge, not project knowledge. Strictly complementary | **LEAVE-SEPARATE** |
| **github** | enabled | PR/issue operations | None | **LEAVE-SEPARATE** |
| **context-management**, **agent-orchestration** | **disabled** | `context-save` / `context-restore` commands and a `context-manager` agent `[V]` | Would overlap the `PreCompact` restore path if enabled | **LEAVE-SEPARATE** while disabled; re-check if ever enabled |
| chrome-devtools-mcp, ui-ux-pro-max, frontend-design, frontend-excellence, ui-designer, storybook-assistant, visual-documentation-skills, document-skills, example-skills, kubernetes-operations, code-refactoring, code-documentation, 10x-fullstack-engineer, rust-analyzer-lsp, webapp-testing, agentic-awesome-skills | mixed | Domain tooling: browsers, design systems, k8s, documents, refactoring | None — no persistent project-knowledge store between them | **LEAVE-SEPARATE**, all |
| **PostgreSQL** (named by the owner) | not installed | — | Would replace `.my_context/.index.db` | **LEAVE-SEPARATE, decisively.** `ADR-markdown-plus-disposable-index` makes the index derived and disposable; Node has `node:sqlite` built in but no built-in Postgres client, so this needs a runtime driver and **breaks `CONST-zero-runtime-dependencies`** `[V]`. It would also add a server that must be running for hooks that are required to fail open in under 10 seconds `[R]` |
| **Neo4j / FalkorDB** | not installed | Reachable *via* graphify's cypher export | Same class of question | **LEAVE-SEPARATE** as a dependency; reachable for free as a graphify export target if `graph.json` is emitted |

---

## The three worth pursuing

### 1. The `SubagentStart` injection — the only one that requires code, and the only one that closes a measured hole

**The argument, grounded in this machine rather than in principle.** GSD alone defines 33
subagents `[V]`, and its entire architecture routes planning, implementation, review,
verification and security auditing through them precisely so the orchestrator's context stays
small. `superpowers` ships `subagent-driven-development` and `dispatching-parallel-agents` as
first-class skills. Graphify's own extraction step is *mandatory* subagent dispatch — its skill
says so in bold `[V]`. Subagent-heavy work is not an edge case on this machine; it is the
dominant mode.

And `README.md` §8 states the consequence precisely `[V]`: a subagent never sees the pinned
tier, never sees the index, never sees a compaction restore. It gets the just-in-time tier and
only if it touches a matching file. So the items most reliably lost are the `always: true`,
unscoped process directives — which on this project are `CONST-zero-runtime-dependencies`,
`CONST-node-24-no-build-step` and `NOGOAL-not-a-claude-mem-replacement`, all three `hard`,
all three exactly what an executor agent must not violate `[V]`.

`SubagentStart` was measured to fire on Claude Code 2.1.234, carrying an `agent_id` that joins
to the subagent's own `PreToolUse` payload `[V]`. The dedupe record already keys on
`session_id` + `agent_id` `[V]`, so the scoping machinery this needs is built.

R2 reached the same conclusion from the memory-ecosystem side. **That two independent domains
converge on it is the point.** From this domain the added evidence is *whose* subagents these
are and *what* they are doing: they are writing the code the constraints govern.

The counter-argument to hold onto: `SubagentStart` is one Claude Code version's behaviour, and
this project's own standard for an external claim is measurement, not documentation `[V]`. It
should be built the way `INV-hooks-fail-open` requires — absent the event, nothing changes.

### 2. `<canonical_refs>` ↔ `watchedDocs` — a bidirectional compose that costs zero code

**Outbound (items → GSD).** `templates/context.md` makes `<canonical_refs>` mandatory in every
phase `CONTEXT.md`, requires full relative paths, and says in bold that **downstream agents MUST
read these before planning or implementing** `[V]`. my_context items are files with full
relative paths. Listing the constraints/invariants/rules governing a phase's scope there puts
the corpus in front of `gsd-planner` and `gsd-executor` through a channel GSD itself declares
mandatory — and it does so *today*, without `SubagentStart`, which makes it the partial mitigation
that ships while item 1 is still a question.

**Inbound (GSD → items).** GSD's `<decisions>` blocks and `LEARNINGS.md` are heading-structured
Markdown with source attribution — the exact input shape `mycontext ingest` splits, hands to the
model as an extraction request, and gates behind `review promote` `[V]`. And `watchedDocs`
pointed at `.planning/**/*-CONTEXT.md` turns "you just recorded D-07" into a capture nudge in the
same session.

**Why this is worth writing down rather than leaving implicit.** The `superpowers` case proves
the failure mode: my_context *already* watches `docs/superpowers/specs/**` and
`docs/superpowers/plans/**` by default `[V]`, which is a deliberate integration with a specific
installed tool — and it appears nowhere as an integration, only as a default value in a config
table. An integration nobody knows exists produces none of its benefit. The deliverable here is
a short "composing with a planning harness" section, not code.

One honest cost: **`watchedDocs` replaces the defaults rather than extending them** `[V]`. A
project that adds `.planning/**` loses the superpowers globs unless it re-lists them. That is a
sharp edge worth naming in the same section — and possibly the more interesting finding, since
it means the two composes are currently *mutually exclusive* by default.

### 3. `graph.json` emission — the cheapest capability-per-line in the report, with one hard exclusion

Emit the corpus as graphify-schema `graph.json`: nodes = items (id, title, type, status,
severity), edges = relations, every edge `EXTRACTED` with `confidence_score: 1.0` because every
edge was authored. Pure formatting over data already loaded; no dependency, no build step, no
Python, fully inside `CONST-zero-runtime-dependencies` and `CONST-node-24-no-build-step` `[V]`.

What it buys, none of which my_context has to build: the interactive HTML viewer; an **Obsidian
vault**, closing the loop `ADR-build-rather-than-adopt` opened when it borrowed Basic Memory's
storage format "for Obsidian and git compatibility" `[V]`; GraphML and SVG; Neo4j/FalkorDB
cypher without linking a driver; and `gsd-tools graphify query` for free `[V]`. It also renders
the enum-versus-disk divergence — 12 relation names on disk, 8 in `RELATION_TYPES` `[V]` — as a
picture instead of a paragraph in a source comment.

**The exclusion is not optional.** Graphify must never extract *from* `.my_context/`. Its
subagent extractor would mint `INFERRED` `semantically_similar_to` edges between authored
normative items and park them in `graphify-out/graph.json`, where its own skill instructs the
host agent to consult them first `[V]`. Authored edges and inferred edges about the same items,
in two files, with the inferred copy consulted preferentially, is the failure the brief warns
about arriving through the front door. Whether graphify's detector already skips dotted
directories is unverified `[R]` and is a five-minute probe worth running before this is written
down as a convention.

**Ranked below the other two on purpose.** This is capability, not correctness. It makes the
corpus legible; it does not make it reach anyone new. If only one thing ships, it should be item
1 or 2.

---

## Overlaps to watch

1. **`ce-compound` versus `lesson`, and `ce-compound-refresh` versus `supersede`/`decay`.** The
   sharpest live collision on this machine. compound-engineering is enabled, writes durable
   repo learnings to `<root>/solutions/` with YAML frontmatter and a schema, seeds a
   `CONCEPTS.md` vocabulary, and runs a refresh cycle that audits learnings for
   stale/overlapping/**superseded**/drifted `[V]`. That is my_context's `lesson` category plus
   its supersession lifecycle plus `mycontext decay`, in a second format, with no shared ids and
   no cross-reference. Nothing warns anyone. Both tools are correct in isolation; run both and a
   lesson exists twice and is retired once.

2. **`~/.gsd/knowledge/` versus `~/.my-context`.** Two home-directory, cross-project knowledge
   stores, each with its own promotion path from a project-local artifact `[V]`. Home-directory
   stores drift the most and are audited the least.

3. **`revise-claude-md` versus the corpus.** `CLAUDE.md` is the file my_context's own §1 argues
   is insufficient. A skill whose job is to write session learnings into it will, on any session
   that also captured items, produce the rule in two places — one of which has no status, no
   scope, no budget and no supersession `[V]`.

4. **`graphify-out/graph.json` if graphify is ever run at the repo root.** See §3 above. Low
   likelihood, high blast radius, and the skill's own trigger — "*any* question about a
   codebase… should be treated as a graphify query first" `[V]` — makes the low-trust copy the
   preferred answer once it exists.

5. **`EnterPlanMode` as an unclaimed injection point.** task-orchestrator hooks
   `PreToolUse` on `EnterPlanMode` `[V]`; my_context does not. Not an overlap today — a claim
   someone else has already staked, worth knowing before designing plan-time injection.

6. **Hook-event contention, currently dormant.** claude-mem registers `SessionStart`,
   `UserPromptSubmit` and an async `PostToolUse` on `*` `[V]`. It is disabled on this machine.
   The my_context/claude-mem *conceptual* boundary is written and hard; the *operational* one —
   two plugins writing into the same session-start block — has never been exercised.

---

## Headline

**GSD: COMPOSE-BY-CONVENTION, and the highest-value finding in this report — its `CONTEXT.md`
template already mandates a `<canonical_refs>` section listing "every spec, ADR, or doc that
defines requirements or constraints," which downstream agents "MUST read before planning or
implementing," so my_context items reach GSD's 33 subagents through a channel GSD itself
declares mandatory, at a cost of zero lines of code.** **Graphify: COMPOSE-BY-CONVENTION,
one-directional — it is not a duplicate of my_context's relation model and not a complement to
it, it is a *renderer* for a graph my_context already authors, and it becomes a duplicate the
instant it is allowed to extract *from* `.my_context/` and mint inferred edges that its own
skill instructs agents to consult in preference to the authored ones.** The single thing worth
building rather than merely documenting is the `SubagentStart` injection, because this machine's
dominant working mode is subagent dispatch and the items a subagent reliably never sees are the
unscoped `always: true` constraints — the three `hard` ones this very project runs on.
