# my_context — Design Specification

**Date:** 2026-08-12
**Status:** Approved for planning
**Origin:** `my_context_ORG.pdf` (Gemini transcript), refined through a brainstorming session

---

## 1. Purpose

my_context is a Claude Code plugin that captures the **normative knowledge** of a software
project — constraints, invariants, rules, requirements, decisions, and the rationale behind
them — as human-readable Markdown, indexes it in SQLite, and **injects the relevant parts back
into Claude's context automatically** at the moments they matter.

The problem it solves: important project knowledge is established during work (in brainstorms,
PRDs, specs, plans, post-mortems), written into files nobody re-reads, and then lost the moment
the context window compacts. Future sessions violate constraints nobody remembers stating.

The core distinction that justifies building it:

| | Descriptive | Normative |
|---|---|---|
| Answers | *What happened?* | *What must hold?* |
| Source | Auto-summarized from activity | Authored, reviewed |
| Example | "Refactored the pool config" | "Pool size must never exceed 20" |
| Covered by | claude-mem | **my_context** |

An auto-summarizer cannot produce an invariant you intend to enforce. That is the gap.

### 1.1 Non-goals

- **Not a replacement for claude-mem.** Session history, activity capture, and semantic search
  over past work stay there. my_context does not duplicate them.
- **Not a general knowledge base.** Only project-governing knowledge and its rationale.
- **Not a documentation site generator.** Markdown lives in the repo; rendering is out of scope.

---

## 2. Prior art evaluated

| Tool | Assessment | Decision |
|---|---|---|
| **claude-mem** (installed, v13.11.0) | Auto-captures activity via `PostToolUse` → LLM → `observations` table (14,999 rows locally) with FTS5 + vector index. No files, no relations, no lifecycle, no authored items, global-only. Descriptive by design. | **Complement, don't replace** |
| **Basic Memory** | Markdown source of truth + SQLite/FTS5 + MCP. Typed observations `- [category] text #tag (context)`, relations `- relation_type [[Entity]]`, per-entity checksum/mtime, bidirectional sync, Obsidian-native. Closest prior art. Retrieval is pull-only — nothing is ever injected; no scope, no pinning, no lifecycle, no normative/rationale split. | **Borrow the format, own the code** |
| **MADR / log4brains / adr-tools** | De facto ADR templates, docs-as-code in git. | **Adopt the MADR shape** for the `adr` category |
| **Zep / Graphiti** | Graph-native memory, time as a first-class dimension; outperforms alternatives on knowledge-update questions. | **Borrow bi-temporal validity** (`valid_from` / `valid_until`), not the service |
| **graphify** (local skill) | AST+LLM → graph, community detection, query/path/explain, Obsidian/Neo4j/HTML export. | **Optional analysis lens** over `.my_context/`, zero coupling |
| **Cognee** | ECL pipeline for *extracting* graphs from unstructured corpora. Our relations are authored. | **Declined** — heavy, wrong problem |
| **mem0** | Vector-first conversational memory. | **Declined** — claude-mem's territory |

---

## 3. Item model

### 3.1 Categories

Sixteen categories, split by whether an item **governs future work** or **explains past reasoning**.
The split determines injection eligibility and is the primary defense against context bloat.

**Normative — eligible for injection**

| Category | Definition | Default |
|---|---|---|
| `constraint` | Non-negotiable limit: budget, stack, regulation, SLA | enabled |
| `invariant` | Condition that must always hold during execution | enabled |
| `rule` | A do/don't directive | enabled |
| `requirement` | What must be built (primary output of PRD ingestion) | enabled |
| `standard` | Formatting, coding convention, architectural guideline | enabled |
| `pattern` | Reusable solution, or an anti-pattern to avoid | enabled |
| `glossary` | Ubiquitous language: the agreed term, and terms not to use | enabled |
| `policy` | Higher-level business/security guideline governing how rules apply | off |

**Rationale — index-only, individually promotable**

| Category | Definition | Default |
|---|---|---|
| `adr` | Formal decision record, MADR shape | enabled |
| `decision` | Lightweight decision not warranting a full ADR | enabled |
| `lesson` | What was learned; source material for generated rules | enabled |
| `tradeoff` | What was sacrificed for what | enabled |
| `assumption` | Unverified premise + validation deadline | enabled |
| `edge_case` | Boundary condition; frequently worth promoting | enabled |
| `postmortem` | Incident debrief | off |
| `taxonomy` | How domain concepts relate | off |

The `standard` profile enables **13** of the 16; `policy`, `postmortem`, and `taxonomy` are
available but off.

**Deliberately excluded:** `trigger` / "Triggers & Workflows" from the source document. Its
meaning — the conditions that activate a rule — is exactly what the `scope` field provides,
deterministically, in the hook. A second activation mechanism could disagree with the first.

**Documented boundary:** `adr` vs `decision` overlap. An ADR is heavyweight (drivers, considered
options, consequences); a decision is a sentence. `help("categories")` must state this
explicitly or the choice will be made at random.

### 3.2 File format

One Markdown file per item. Format borrowed from Basic Memory so files remain Obsidian-readable
and git-mergeable.

```markdown
---
id: CONST-pg-pool-cap
type: constraint
title: Postgres connection pool capped at 20
status: active          # active | draft | superseded | deprecated | validated
severity: hard          # hard | soft   (hard = future enforcement candidate)
always: false           # true → pinned tier, injected every session
scope:
  - "src/db/**"
  - "src/api/handlers/**"
tags: [database, performance]
origin: human           # human | agent | ingest
source_file: null       # provenance, when ingested
source_anchor: null
source_checksum: null
valid_from: 2026-08-12
valid_until: null
checksum: 8f3a…         # tamper detection
---

# Postgres connection pool capped at 20

RDS permits 25 connections; 5 are reserved for migrations and the admin console.
Exceeding 20 in application code produces
`FATAL: remaining connection slots are reserved`.

## Observations
- [limit] Pool size must never exceed 20 across all workers #database
- [symptom] Breach surfaces as connection-refused under load, not at startup

## Relations
- derived_from [[ADR-sqlite-jsonb]]
- constrains [[DEC-worker-count]]
- supersedes [[CONST-old-pool-cap]]
```

**Relations live in the file, not only the DB.** `- supersedes [[X]]` is git-mergeable text; a
relations table in a binary index is not, and would not survive `rebuild`. The DB indexes them;
the file owns them. Unresolved links (target not yet created) are permitted and auto-resolve on
the next sync.

**IDs are slugs** — category prefix + kebab-case slug derived from the title
(`CONST-pg-pool-cap`). Never collide on branch merge, self-describing when cited in prose,
readable as filenames. A retitled item keeps its slug; an alias may be added.

Each category declares a short uppercase prefix, fixed in the category definition and therefore
also available for custom categories: `CONST`, `INV`, `RULE`, `REQ`, `STD`, `PAT`, `GLOSS`,
`POL`, `ADR`, `DEC`, `LESSON`, `TRADE`, `ASSUME`, `EDGE`, `PM`, `TAX`.

**`scope` defaults to inert.** An item with no `scope` is indexed and searchable but never
JIT-injected. Defaulting to global would refill the context window as the corpus grows —
the precise failure this design exists to prevent.

---

## 4. Configuration

`.my_context/config.json`, per project:

```jsonc
{
  "profile": "standard",
  "categories": {
    "constraint": { "enabled": true },
    "edge_case":  { "enabled": true, "tier": "normative" },   // project tier override
    "postmortem": { "enabled": false },
    "sla":        { "enabled": true, "tier": "normative",     // custom category
                    "description": "Committed latency/availability target" }
  },
  "budgets": { "pinned": 1500, "jit": 500, "restored": 2000, "index": 150 },
  "watchedDocs": ["docs/superpowers/specs/**", "docs/prd/**", "docs/plans/**"]
}
```

Required properties:

1. **Disabling is non-destructive.** A disabled category stops accepting new items and drops to
   index-only. It never deletes existing items.
2. **Tier is overridable per project.** A safety-critical project may declare `edge_case`
   normative without a code change.
3. **Custom categories are permitted** when they declare a `tier` and `description`. Help
   documentation is generated from the config, so custom categories are documented automatically.

Profiles: `minimal` (8) · `standard` (13, default) · `full` (16).

---

## 5. Architecture

### 5.1 Layout

```
.my_context/                      # per-project layer, committed to git
  items/
    constraint/CONST-pg-pool-cap.md
    adr/ADR-sqlite-jsonb.md
    lesson/LESSON-migration-lock.md
  config.json
  .index.db                       # gitignored — rebuildable

~/.my-context/                    # global layer, same shape
```

**Layer merge:** global and project items load together. On conflicting `id`, project wins. The
pinned budget is shared, and project items sort first, so a large global set can never crowd out
repo-specific constraints.

### 5.2 Modules

| Module | Responsibility | Depends on |
|---|---|---|
| `core/item` | Parse/render the Markdown format — frontmatter, observations, relations, checksum | — |
| `core/store` | SQLite index: schema, upsert, query, `rebuild` from files | `core/item` |
| `core/select` | **The selector.** items + event + path + ledger + budgets → injection payload | — |
| `core/ledger` | Session ledger, snapshot read/write | `node:sqlite` |
| `hooks/*` | Five thin entry points, each ≲50 lines | core |
| `mcp/server` | Tool surface | core |
| `cli/*` | Commands and reports | core |
| `ingest/*` | LLM extraction from documents → drafts | core |

**`core/select` is the critical module.** It is a pure function — no I/O, no SQLite, no hooks.
Every behavioral rule lives there: eligibility, scope matching, the four tiers, budget ordering
and spill, once-per-session dedupe, index bounding, layer precedence. The entire system's
behavior is therefore testable as data-in / data-out, with hooks reduced to plumbing.

**The DB is disposable.** Items, observations, relations, sources, ledger, spill log, and an
FTS5 index — all derivable from Markdown via `rebuild`. It is gitignored; corrupting it costs a
rebuild and nothing else. This is what makes "Markdown is the source of truth" a real guarantee.

### 5.3 Runtime

Node 24 / TypeScript, `node:sqlite` (stable in Node 24, ships SQLite with `jsonb()` support).
Zero runtime dependencies. Hooks execute compiled JS.

---

## 6. Injection engine

### 6.1 Tiers

| Tier | When | Content | Selected by |
|---|---|---|---|
| **Pinned** | every `SessionStart` | full text | `always: true`, within budget — independent of `scope` |
| **Active (JIT)** | `PreToolUse` on file tools | full text, once per session | file path matches item `scope` glob |
| **Restored** | `SessionStart(compact)` | full text | ledger ∪ transcript scan, captured at `PreCompact` |
| **Index** | every session | bounded summary | see 6.3 |

**Eligibility gates**, applied before tier selection:

1. `status = active` only. `draft`, `superseded`, `deprecated`, `validated` are index-only.
   Supersession is the pruning mechanism; without it the corpus grows monotonically forever.
2. Category tier (`normative` vs `rationale`), subject to per-project override.
3. Category `enabled`.

### 6.2 Hook wiring

| Event | Matcher | Action |
|---|---|---|
| `SessionStart` | `startup\|clear` | Pinned (full) + index header |
| `SessionStart` | `compact` | Pinned + restored (full) + index header |
| `PreCompact` | — | Write restore snapshot: ledger ∪ item IDs scanned from `transcript_path` |
| `PreToolUse` | `Read\|Edit\|Write` | JIT scope-match and inject; **deny** writes under `.my_context/` |
| `PostToolUse` | `Write\|Edit` | Capture nudge when path matches `watchedDocs` |
| `/LoadMyContext` | — | Manual full injection on demand |

**Note:** there is no `PostCompact` hook. The source document specified one; it does not exist
in Claude Code's event list. Post-compaction injection is achieved via `SessionStart` with
matcher `compact`, which fires once the context is rebuilt.

### 6.3 Bounded index

A flat listing is viable at 50 items and ruinous at 2,000. The index therefore enumerates only
normative items and **counts** the rest:

```
my_context: 12 active constraints/invariants/rules (listed above) ·
  47 ADRs · 130 lessons · 18 open assumptions · 340 drafts pending review
  → mycontext.query_items to search
```

Fixed cost regardless of corpus size. This is what allows unbounded capture without unbounded
context cost.

### 6.4 Budgets and spill

Defaults: pinned 1500 · JIT 500/activation · restored 2000 · index 150 tokens.

On overflow: order by `(severity, last_used desc)`, inject what fits, demote the remainder to a
`+N more` line, and **log every spilled item**. Silent truncation in a rules system is the single
unacceptable failure mode.

### 6.5 Failure posture

Hooks **fail silently and open**: exit 0, empty output, 200 ms self-timeout, catch everything.
A corrupt index means "no items today", never a blocked edit. The sole exception is the
deliberate `.my_context/` write-deny.

Hard performance requirement: single local SQLite read, no LLM, no network. p95 under 50 ms.

### 6.6 Ledger

`(session_id, item_id, injected_at, tier)`. Powers once-per-session dedupe, the `PreCompact`
snapshot, `use_count` / `last_used` for decay reporting, and the spill log.

---

## 7. Capture

### 7.1 Trust model

Capture is open to agents; **governance is not**. Trust is per-tier, not per-caller:

| Caller | Rationale items | Normative items |
|---|---|---|
| User, via command | created `active` | created `active` |
| Claude / agent, via tool | created `active` | created **`draft`** — indexed, never injected |

Agents write freely; nothing they author governs future work until promoted via
`/mycontext review`. This satisfies capture-everything and no-unvetted-governance simultaneously.

### 7.2 Batch ingestion

`/mycontext ingest <path>` — explicit, user-triggered. Source document → LLM extracts candidate
items, each typed, scoped, and anchored → all land as `draft` → user promotes.

Re-ingesting the same source dedupes by content hash; a materially changed item gets `supersedes`
wired to its predecessor rather than silently duplicating.

### 7.3 Live capture

During interactive authoring (brainstorms, PRD sessions), Claude captures each requirement,
decision, or constraint **as it is established**, keeping document and knowledge base in step.

Three mechanisms make this reliable rather than aspirational:

1. **A nudge hook.** `PostToolUse` on `Write|Edit` to `watchedDocs` returns ~30 tokens of
   `additionalContext`: *"You modified `docs/prd/auth.md`. Capture any new requirements or
   decisions via `mycontext.create_item`."* Fires exactly when the content exists; costs nothing
   otherwise. Optional tools are otherwise ignored — the model is busy with the user's task.
2. **Idempotency in the tool, not the model.** `create_item` is an upsert keyed on
   `(source_file, source_anchor)` + content hash. A duplicate returns *"already captured as
   REQ-…"*. The model may call it as often as it likes.
3. **Drift detection.** `source_checksum` catches a requirement reworded later in the source
   document; the item is flagged `source_drift`, surfaced in reports, and the nudge directs
   Claude to update rather than duplicate.

### 7.4 Lessons → rules

A lesson is descriptive; a rule is normative. Derivation requires an LLM, executed at **command
time**, never in a hook.

`/mycontext lesson "…"` drafts one or more candidate rules in `directive: do | dont` form →
staging → the user accepts, edits, or discards → accepted rules are created with a
`derived_from → LESSON-…` relation. The lesson remains index-only; the rule it produced is what
gets injected.

**The approval gate is mandatory.** An LLM-invented invariant that is subtly wrong would be
injected in full text indefinitely and would silently steer every future session.

---

## 8. Tool surface

Eight core tools plus two documentation tools. Kept small deliberately — MCP tool definitions
occupy context in every session.

| Tool | Notes |
|---|---|
| `create_item` | Upsert by source anchor + hash. Agent-authored normative items land as `draft` |
| `update_item` | Revises content; bumps checksum |
| `supersede_item` | Retires an item, wires `supersedes`, preserves history |
| `link_items` | Adds a typed relation |
| `get_item` | Full Markdown by id |
| `query_items` | Search/filter by type, status, scope, tag, relation |
| `ingest_document` | Batch extraction from a path |
| `list_drafts` | The review queue |
| `mycontext_help` | Topic-scoped guidance |
| `mycontext_examples` | A complete correct item of a given category |

**No `delete_item` for the LLM.** Deletion is user-only. Agents may supersede or deprecate —
both reversible, both leave a trail. An agent able to hard-delete a constraint could silently
remove the thing preventing a bug.

---

## 9. Help and discoverability

Four channels, compiled from **one source** of topic files — parallel hand-maintained docs drift,
and stale guidance is worse than none.

| Channel | Audience | Cost | Content |
|---|---|---|---|
| Tool descriptions | LLM | always loaded | Terse; each states when to use **and when not to** |
| `mycontext_help(topic)` | LLM | on demand | `categories`, `scope`, `capture`, `workflow` |
| `mycontext_examples(type)` | LLM | on demand | A complete, correct item to copy |
| Skill (`SKILL.md`) | LLM | on demand | Auto-loads on relevant triggers; workflow narrative |
| CLI `--help` / `/mycontext help` | User | free | Same topics, terminal-rendered |

**Error messages are the highest-leverage channel.** A malformed call returns a correcting
message — *"`type` must be one of … You passed 'requirement'; the closest match is 'constraint'.
See help('categories')."* It arrives at the exact moment the model is wrong and converts a failed
call into a corrected one.

**Self-verifying:** the tool list is generated from the registry, the category list from the
config. Documentation cannot describe a tool that does not exist.

**`help("scope")` requires worked examples**, not prose. Scope globs carry the whole precision
design and are the field an LLM will most often get wrong — too broad (`**`, defeating
inert-by-default) or too narrow (a single file, orphaned by the next refactor).

---

## 10. Reliability

Projects will depend on this. The failure that matters is not a crash but **silent wrongness**:
an item that quietly stops being injected, a rebuild that drops a relation, a half-written file
after a crash. These do not announce themselves.

**Guarantees to uphold and test explicitly:**

- **`rebuild` is lossless.** files → DB → files is byte-identical, property-tested over generated
  corpora. This is also the ultimate recovery path from any migration bug.
- **`supersede` never drops content.**
- **A partially failed ingest keeps every success and names every failure.**
- **Atomic writes throughout.** Temp file + rename for Markdown; transactions + WAL for the DB.
  A crash mid-write leaves the previous file intact, never a truncated one.
- **Concurrency is real.** Two Claude sessions in one project will write simultaneously.
  `busy_timeout` + retry, single-writer discipline, tested with genuinely concurrent writers.
- **Checksum mismatch never auto-resolves.** Flag `source_drift` and wait for the user; silently
  overwriting either side loses authored knowledge.
- **Schema versioning with migrations.**

**A `doctor` command** self-checks an installation: index freshness, orphan relations, checksum
drift, dead scope globs (globs matching zero files — the clearest rot signal after a refactor),
permission problems.

---

## 11. Testing strategy

Weighted toward where the risk actually is.

| Target | Approach |
|---|---|
| `core/select` | **The bulk of the suite, ~100% coverage.** Pure fixtures: every tier, eligibility rule, budget overflow and spill ordering, dedupe, layer precedence, index bounding at 50 and at 5,000 items |
| `core/item` | Property test: parse → render → parse is identity, for every category |
| `core/store` | `rebuild` determinism — byte-identical round trip |
| Hooks | Contract tests on stdin/stdout JSON shape, **plus an asserted latency ceiling** so a regression fails CI rather than annoying the user into disabling it |
| Chaos | Corrupt DB, locked DB, files deleted mid-run, malformed frontmatter, 10 MB item, unicode paths, 40-deep supersession chain. Every hook still exits 0 within budget |
| Windows | Path separators, CRLF, long paths, file locking — materially different from POSIX and the primary platform |
| Ingestion | Test staging, dedupe, and drift logic. **Not** LLM extraction quality — nondeterministic, must not gate a build |
| Performance | p95 < 50 ms against a 5,000-item corpus, enforced in CI |

**Dogfooding from day one.** my_context's own constraints and decisions live in my_context. It
gets used hard before anything else depends on it.

---

## 12. Deferred

Explicitly out of scope for the first implementation, and noted so the schema does not foreclose
them:

- **Enforcement.** `PreToolUse` can return `permissionDecision: 'deny'`, so a `severity: hard`
  constraint could hard-block a violating edit. Powerful and dangerous — a bad glob blocks
  legitimate work. Build only after the corpus has proven itself. `severity` exists now to keep
  this open.
- **A `Stop`-hook proposer** that writes candidate items to staging at session end, addressing
  "I meant to record that and forgot."
- **graphify integration** as an analysis lens over `.my_context/` — visualization, and detecting
  items that should be linked but are not.
- **Bi-temporal queries** over `valid_from` / `valid_until` ("what governed this decision in
  March?"). Fields exist now; query support deferred.
- **Automatic ingestion on watched paths.** Deliberately manual at first: the draft queue
  becoming a backlog nobody reads is equivalent to not capturing at all.

---

## 13. Decision log

| Decision | Rationale |
|---|---|
| Build rather than adopt | claude-mem is descriptive and cannot produce authored invariants; Basic Memory never injects |
| Borrow Basic Memory's format, own the code | Obsidian/git compatibility with no Python dependency and no schema constraints |
| Markdown source of truth, DB disposable | Human-readable, git-versioned, reviewable in PRs; index corruption costs a rebuild |
| Normative vs rationale split | The primary defense against context bloat; ADRs and lessons will be the bulk and none need injecting |
| `scope` defaults to inert | Global default would refill the window as the corpus grows |
| Slug IDs | Sequential IDs collide on branch merge — recurring pain vs cosmetic tidiness |
| Drop `trigger` category | `scope` is already the activation mechanism; two could disagree |
| Bounded index (counts, not listings) | Fixed context cost regardless of corpus size — what makes capture-everything viable |
| Agent normative items → `draft` | Reconciles open capture with no unvetted governance |
| No agent `delete_item` | An agent silently deleting a constraint is undetectable; supersede is honest and reversible |
| Idempotency in the tool | Model discipline is not a reliability mechanism |
| Approval gate on lesson → rule | A wrong generated invariant would govern every future session |
| Hooks fail open | A knowledge base that blocks edits is worse than none |
| Node 24 / `node:sqlite` | Zero dependencies, stable, `jsonb()` available |
