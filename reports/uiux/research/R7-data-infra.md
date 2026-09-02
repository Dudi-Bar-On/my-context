# R7 — Data, storage, search and infrastructure, ruled against my_context

**Question asked (owner's words):** *"look for other tools — for example … databases like postgresql
and almost any other. I requested to make a deep research and answer if such an integration could be
beneficial."*

**Scope of this report:** storage engines, search engines, graph stores, analytics stores and sync
backends. The agent/memory *ecosystem* was ruled in `R2-memory-ecosystem.md`; where a candidate
appears in both, I cite R2 rather than re-deciding it. Export formats are R5's.

**Method.** Everything numeric below was produced on this machine against the real corpus and the
real engine, not reasoned from documentation. Claims are marked `[V]` verified against a primary
source, `[M]` measured here, `[R]` reasoned. Web search was used for four things and is cited where
it was: sqlite-vec's 2026 platform status, whether Anthropic ships an embeddings endpoint, whether
Node ships a Postgres client, and community guidance on context-file size. Nothing in `.my_context/`
was modified; every measurement ran against copies in a scratch directory.

**Environment.** Node v24.14.0, `node:sqlite` over SQLite **3.51.2**, Windows 11. `[M]`

---

## How big is a real corpus

This has to be settled first, because every "you need a bigger engine" argument is a claim about
this number, and almost every one of them is wrong by two to three orders of magnitude.

### The two corpora that exist

| | `my-context/.my_context` (the flagship, dogfooded) | outer `test_mycontext_plugin/.my_context` |
|---|---|---|
| items | **44** | **14** |
| bytes of Markdown | **65 KB** (213 KB on disk incl. slack) | 82 KB |
| status split | 40 active, 4 superseded | 13 active, 1 draft |
| relation edges | **27** total | — |
| age | 8 days, **524 commits** | 2 days |

`[M]` Counted from disk and from `git ls-tree` at HEAD.

### The growth rate, measured rather than guessed

Tracing `.my_context/items` through git history: **28 items on 2026-08-13 → 44 on 2026-08-16 →
44 at HEAD (2026-08-19)**. `[M]`

That is 44 items produced by 524 commits over 8 days — **0.084 items per commit** — in a project
whose *entire subject matter* is capturing normative knowledge, whose author is deliberately
maximising capture, and which has an explicit "dogfood this" practice recorded as a lesson. This is
an **upper bound** on capture rate, not a typical one.

Project that number forward honestly `[R]`:

- A normal project at 10 commits/day, at the flagship's own per-commit rate: **~0.8 items/day ≈ 300
  items/year.**
- The flagship's own rate sustained: 5.5 items/day ≈ **2,000 items/year** — a normative item every
  105 minutes, forever, which no project sustains.
- Supersession runs the other way. 4 of 44 items (**9%**) were already retired at 8 days old, and
  `STD-answered-questions-are-superseded` makes retirement the normal end of an item's life. The
  *active* set — the only set that is ever injected — grows more slowly than the file count.

**So: hundreds of items after a year, low thousands after a decade.** The only external anchor I
could find agrees directionally and weakly — "large projects may accumulate hundreds of decision
records over time"; no MSR study reports a median count. I am not going to dress that up as more
than it is.

### The ceiling that actually binds, and it is not the database

The scarce resource is the **context window**, and it saturates roughly two orders of magnitude
below anything a database cares about. Measured against the real corpus and the shipped default
budgets (`pinned: 6000, jit: 6000, restored: 8000, index: 1200` estimated tokens): `[M]`

| Quantity | Measured |
|---|---|
| 25 active **normative** items rendered in full | **7,584 tokens** — already **126%** of the 6,000-token JIT budget |
| mean full-block cost per normative item | **303 tokens** (min 99, median 176, max 1,203) |
| items that fit a 6,000-token tier at mean cost | **~19** |
| index lines for those 25 items | **627 tokens** of the 1,200 budget; mean **25.1 tokens/line** |
| index lines that fit the 1,200-token budget | **~47** |
| the whole 44-item corpus rendered in full | **12,340 tokens** |
| items marked `always` (pinned tier) | 7, costing **1,072 tokens** — 18% of the pinned budget |

Read that table again. **At 25 active normative items, the corpus already exceeds a full-text tier,
and the index tier runs out at about 47.** The product hit its real ceiling at forty-four items.

External anchor `[V]`: community guidance in 2026 puts a healthy `CLAUDE.md` under ~200 lines /
500–2,000 tokens, and describes a 340-line, 8,000-token file as bloat. my_context's *pinned tier
alone* is budgeted at 6,000. The product is already operating at the edge of what a session can
absorb.

### And the corpus-size ceiling the product already publishes

`doctor` warns from **5,000 items** that the never-miss guarantee becomes conditional, because the
Markdown fallback was measured at **9,903 ms at 10,000 items on a cold file cache** against a 10 s
hook kill. Warm-cache `loadLayer + select` is **28.1 ms p95 at 500 items, 245.5 ms at 2,000, 597.7 ms
at 5,000** — of which `select` itself is 1.4 / 4.1 / 8.8 ms; **parsing Markdown dominates, not
querying.** `[V]` — read from `docs/superpowers/specs/2026-08-16-never-miss-an-injection-design.md`
(M1, R5) and `src/doctor/checks.ts`.

That is the sentence every storage proposal has to answer to. **The bottleneck at 5,000 items is
`readFileSync` + frontmatter parsing over five thousand small files.** Swapping SQLite for Postgres,
or for a vector store, or for Neo4j, does not touch that path at all — because the Markdown *is* the
source of truth and it gets parsed either way.

**Conclusion of this section.** A real corpus is tens of items today, hundreds within a year, low
thousands at the outside. SQLite is not the constraint at that size; it is not within three orders of
magnitude of being the constraint. Any recommendation whose payoff begins above ~10⁵ rows is a
recommendation for a product that does not exist.

---

## PostgreSQL

The owner named this one, so it gets the full treatment rather than a table row.

### What Postgres actually solves

Postgres is worth its operational weight when you have at least one of: (a) datasets that exceed a
single machine's working set, (b) many concurrent writers needing MVCC rather than a file lock,
(c) multiple *processes on different machines* sharing one authoritative dataset, (d) role-based
access control over subsets of the data, (e) online schema evolution against data you cannot afford
to discard, (f) extensions like `pgvector`, PostGIS or TimescaleDB.

Take those one at a time against this product.

**(a) Size.** The corpus is 65 KB. The disposable index is 100 KB. The audit log is 60 KB. `[M]`
Nothing here is a size problem, and nothing projected in the section above becomes one: at 20,000
items — twice the published fallback ceiling — the whole SQLite index measures **46 MB**, which is a
rounding error. `[M]` **Not a problem my_context has.**

**(b) Concurrency.** This is the one place where the honest answer is *"a real problem, but already
solved."* my_context genuinely has had lock contention: `Store.open` carries two named `OpenProfile`s
because a contended open was **measured at 16.9 s** and `hooks.json` kills a hook at 10 s; there are
long comments about `BEGIN IMMEDIATE`, the WAL-transition window SQLite does not run the busy handler
for, and a busy-vs-corrupt discrimination that exists because getting it wrong deletes a live index.
`[V]` (`src/core/store.ts`).

But look at how that was fixed. It was fixed by **WAL mode** (readers do not block on the writer),
by **`openReadOnlyChecked`** on the hot path, by moving the write transaction **off** the hook's
critical path, and by a bounded `HOOK_OPEN_PROFILE` whose worst case is ~1.06 s so the hook survives
to fail open and say so. In 18,300 contended read-only trials the busy handler never fired. `[V]`
A server would solve a problem that has already been engineered away without one — and it would
solve it *conditionally*, because a Postgres that is not running is a hook that must fall back
anyway, so `INV-hooks-fail-open` keeps every existing code path alive regardless. Postgres removes
nothing; it only adds.

**(c) Sharing across machines.** This is the only genuinely attractive story: a team sharing one
corpus. And it is already solved, better, by the third constraint — **the corpus lives in the user's
repository and is versioned by git.** Git gives sharing *plus* review-in-diffs, *plus* branch
isolation, *plus* per-change attribution, *plus* offline work. A shared Postgres gives sharing and
takes review away — the corpus stops being something a human reads in a pull request, which is the
product's stated reason for Markdown at all (`ADR-markdown-plus-disposable-index`: "the knowledge
base needs both human review in pull requests and fast lookup inside a latency-budgeted hook").
**Postgres is a strictly worse sync mechanism than the one already shipped.**

**(d) RBAC, (e) online migration.** Both are meaningless against a projection that is *defined* as
disposable. The documented recovery for a schema mismatch is "delete the index, it rebuilds"; the
code implements exactly that (`DROP TABLE IF EXISTS items; CREATE …` on a version bump). Migration
tooling protects data you cannot regenerate. `[V]`

**(f) `pgvector`.** Ruled in the next section; it inherits every cost here plus an embedding
pipeline.

### What it would cost

1. **`pg` (or `postgres.js`) is a runtime dependency.** Saying it plainly, as asked:
   `package.json` has **no `dependencies` key at all**, and `CONST-zero-runtime-dependencies` is
   `severity: hard, always: true` — it is pinned in the corpus and injected into every session. It
   states the consequence the project already accepted: *"the MCP server in Plan 3 must speak
   JSON-RPC by hand rather than using the SDK"* and *"the frontmatter parser is hand-written rather
   than using a YAML library."* A project that hand-wrote a JSON-RPC implementation and a YAML parser
   to avoid two dependencies will not take one for a database it does not need. `[V]`
   Node ships no Postgres client — I checked; there is no `node:pg` and no proposal for one. `[V]`
   Vendoring the wire protocol instead of depending on it is technically available (it is
   ~2–3k lines of code you then own, including SCRAM-SHA-256), and it trades a dependency for a
   maintenance liability in a product whose whole differentiator is having neither. `[R]`
2. **A server the user must install, run, and keep running.** `CONST-zero-runtime-dependencies`
   gives the reason in one line: *"A plugin that installs cleanly without a package fetch is what
   makes hooks start in tens of milliseconds and what lets the plugin be dropped into any repo."*
   Postgres makes "drop it into any repo" false.
3. **It cannot be authoritative.** See the invariant section below.

### What it is *not* — the argument I expected to make and could not

I expected latency to be the killer. **It is not, and I am not going to pretend it is.** Measured
here: `[M]`

| | p50 | p95 |
|---|---|---|
| `node:sqlite` open + one indexed point query (500-item db) | **1.71 ms** | 4.02 ms |
| bare loopback TCP connect + one round trip (the floor for any server) | **0.42 ms** | 1.15 ms |

A loopback round trip is *cheaper* than opening the SQLite file. A real Postgres connection adds a
startup packet and a SCRAM handshake on top — call it single-digit milliseconds from a cold process —
which still fits inside the 50 ms JIT p95 ceiling. **The case against Postgres is not performance.
It is that it is a dependency and a daemon, bought to solve problems this product does not have,
against a corpus of 65 kilobytes.**

### Verdict

> ### PostgreSQL — **REJECT**
>
> It is a runtime dependency (`CONST-zero-runtime-dependencies`, hard, always-on) and a daemon, bought
> to solve concurrency that WAL plus a read-only hook path already solved, sharing that git already
> does better *with* review, and scale that a 65 KB corpus will never reach. It cannot be
> authoritative without contradicting `INV-markdown-is-the-source-of-truth`, and as a *disposable*
> projection it is strictly a heavier SQLite.

**The one honest caveat.** If my_context ever became a hosted, multi-tenant service for an
organisation — one corpus, many machines, server-side access control, no local repo — Postgres would
be the right engine and this verdict would flip. That is a different product: it breaks
loopback-only, it breaks zero-dependency, and it breaks review-in-diffs. It should be decided as a
product question, not arrived at as a storage decision.

---

## Search and ranking

Here the recorded decision is the thing under examination, so it goes first, verbatim, from
`src/core/search.ts`:

> *"Nothing here ranks: the result is in the order it was given, which for both callers is
> `store.all()`'s `ORDER BY id`. A relevance score would be a claim about which item answers the
> question best, and there is no signal in a corpus this size to support one."*

R2 already ruled FTS5+`bm25()` **ADOPTABLE** *"(but argue with the existing decision first)"*. This
is that argument, run as an experiment rather than an opinion.

### What is already available at zero cost

`node:sqlite` on this machine compiles with **`ENABLE_FTS5`**, and `bm25()` works. Confirmed by
execution, plus `fts5vocab` for term statistics and `porter` stemming. `[M]` So the question was
never capability. It is whether ranking is *right*.

### Experiment 1 — is there signal? Partly, and not where the decision assumed

Built an FTS5 index over all 44 real items and read the term statistics out of `fts5vocab`: `[M]`

- **1,311 distinct terms** across 44 items.
- **717 of them (54.7%) appear in exactly one document.**
- IDF for terms a user would actually type spans a narrow band: `hook` 2.55, `markdown` 2.30,
  `budget` 2.10, `sqlite` 2.10, `scope` 1.79, `path` 1.79, `test` 1.56, `injection` 1.36.
  Stopwords sit at 0.06–0.65.

**The decision's premise is correct about the signal it names.** With N=44, the IDF axis is nearly
flat: over half the vocabulary is a hapax at maximum IDF, and every real query term lands inside a
1.2-wide band. There is no meaningful "this term is rarer, therefore this document is more relevant"
gradient. A million-document corpus spans IDF 0–14; this one spans 1.4–2.6.

### Experiment 2 — the recall result, which nobody was arguing about

This is the finding that changes the shape of the recommendation. Substring match (what
`filterItems` does today: `` `${title}\n${body}`.toLowerCase().includes(text) ``) versus FTS5, hit
counts on the real corpus: `[M]`

| query | substring (today) | FTS5 default tokenizer | FTS5 prefix `q*` | FTS5 `porter` |
|---|---|---|---|---|
| `hook` | 7 | **3** | 7 | 7 |
| `test` | 15 | **9** | 13 | 11 |
| `inject` | 14 | **1** | 14 | 14 |
| `drop` | 4 | **0** | 4 | 4 |
| `budget` | 7 | **5** | 7 | 7 |
| `rule` | 7 | 7 | 7 | 7 |
| `dependency` | 0 | 0 | 0 | **4** |

Two things fall out, and they point in opposite directions:

1. **A naive FTS5 swap is a recall *regression*.** `inject` goes from 14 hits to **1**; `drop` from
   4 to **0**; the query `hook` stops finding `INV-hooks-fail-open`, whose title is literally *"Hooks
   fail open, always."* The default `unicode61` tokenizer indexes whole words, and substring matching
   silently gave users stemming for free. **Anyone who adopts FTS5 without `porter` or prefix
   queries makes search worse**, and would not find out from a green test suite.
2. **With `porter`, FTS5 is a strict improvement.** It matches substring recall everywhere and beats
   it where substring cannot reach: `dependency` finds four items about *dependencies* that
   substring finds zero of. It also removes false positives substring cannot avoid (`test` matching
   inside *latest*, *greatest*).

Substring's other failure is worse and simpler: **multi-word queries return nothing at all.**
`silently drop` → 0 hits. `markdown truth` → 0 hits. There is no item in this corpus containing
either literal string, and both name an item exactly.

### Experiment 3 — ranking, given its best shot

Ranked those same queries with `bm25(fts, 0.0, 10.0, 1.0)` — title weighted 10×, body 1×, over the
`porter` index. Rank-1 result: `[M]`

| query | BM25 rank 1 |
|---|---|
| `hook` | `INV-hooks-fail-open` ✓ |
| `budget` | `RULE-filter-seen-before-budgeting` ✓ |
| `sqlite` | `RULE-never-bind-a-boolean-to-sqlite` ✓ |
| `markdown truth` | `INV-markdown-is-the-source-of-truth` ✓ |
| `silently drop` | `INV-nothing-is-dropped-silently` ✓ |

Five for five. **And I want to be exact about what produced that**, because I got it wrong once
before I got it right: on my first pass I mis-positioned the `bm25` column weights (FTS5 weights are
positional across *all* columns, `UNINDEXED` ones included), so title weighting silently did nothing
and `INV-hooks-fail-open` came back at **rank 3** for the query `hook`. The result above is the
weighted one. **The lift comes from the title weight and from stemming — from structure — not from
the IDF gradient**, which Experiment 1 shows is nearly flat. The recorded decision is right about
*why* ranking is weak here and wrong to conclude that therefore the retrieval surface cannot be
improved.

### Cost, measured

FTS5 lives in `.index.db`, which `rebuild` already recreates. It costs one virtual table and one
insert per item inside the transaction that already exists: `[M]`

| corpus | items insert | +FTS5 insert | BM25 query | total db |
|---|---|---|---|---|
| 44 | 2 ms | **2 ms** | 0.02 ms | 0.15 MB |
| 500 | 4 ms | **7 ms** | 0.10 ms | 1.17 MB |
| 2,000 | 15 ms | **41 ms** | 0.25 ms | 4.55 MB |
| 5,000 | 50 ms | **90 ms** | 0.68 ms | 11.35 MB |
| 20,000 | 223 ms | **402 ms** | 2.64 ms | 46.38 MB |

At 500 items the added build cost is **7 ms** against a full rebuild measured at 28.1 ms p95 where
Markdown parsing dominates. Query cost is 0.68 ms at 5,000 items — two orders of magnitude inside
the 50 ms JIT ceiling. Zero dependencies. Nothing durable at risk, because the whole thing is
disposable by construction.

### The line that must not be crossed

**FTS5 belongs in `search` / `query_items`. It must never enter `select()`.**

`INV-select-is-pure` is `severity: hard`: *"No I/O, no filesystem, no clock, no `Store` import."*
BM25 requires the index, so a ranked selector is an invariant violation on its face. It is also
wrong on the merits: `select` is budget-driven and deterministic — `byPriority` sorts by severity,
then layer, then id precisely so that the same corpus and the same budget always produce the same
injection. A relevance score derived from a full-text index would make *what governs a session*
depend on the wording of neighbouring items.

The corpus has already recorded what happens when a weak signal is allowed to become the priority.
`LESSON-alphabetical-id-became-the-priority`: sixteen pinned items, all `severity: hard`, so severity
and layer tied and **alphabetical id decided what survived** — dropping the open question that
blocked all of Plan 2, because "O" sorts after "I". The lesson's own conclusion is the answer to the
ranking question for the injection path: *"Keep the pinned set genuinely small — the authoring error
here was pinning 16 things, not the sort."* Spill ordering is an **authoring** problem, and the
product already surfaces it (`INV-nothing-is-dropped-silently` makes every spill visible with its
reason). Ranking would paper over the disclosure that makes the authoring error findable.

### Verdicts

> ### SQLite FTS5 + `bm25()`, scoped to `search` / `query_items` — **ADOPT**
>
> Zero dependency, already compiled into `node:sqlite`, 7 ms of rebuild cost at 500 items, lives
> entirely inside the disposable index. Adopt it primarily as a **recall and precision** fix —
> stemming, multi-word queries, no substring false positives — with ranking as the by-product. Two
> non-negotiable conditions: use `porter` (or prefix queries), or search gets *worse*; and it never
> touches `select()`.

> ### Ranking inside the injection selector — **REJECT**
>
> Violates `INV-select-is-pure`, makes injection non-deterministic in the corpus's own wording, and
> substitutes a score for a disclosure that already works.

> ### Semantic / vector search over the corpus — **REJECT** (see the table for each engine)
>
> No signal argument even reaches the constraint argument: it needs an embedding model, and the
> product makes no network requests at all.

The semantic case, stated fully so the rejection is not glib: retrieval quality here is bounded by
**~47 index lines and ~19 full blocks**, not by matching. When the whole active normative corpus is
25 items, the model can be shown *all of it* for 7,584 tokens. Embeddings answer "which 10 of
100,000 documents"; this product's question is "which 19 of 25". Add to that: Anthropic ships **no
embeddings endpoint** and directs users to Voyage AI, a third-party API with a key and an egress
path `[V]`; a local model means weights plus a native runtime, i.e. both hard constraints at once;
and `NOGOAL-not-a-claude-mem-replacement` (`severity: hard`, `always: true`) says in as many words
*"Do not build session history, activity capture, or semantic search over past work."* That non-goal
is scoped to past *work* rather than to the normative corpus, so I will not overclaim it as
dispositive — but it is the same author answering an adjacent question the same way.

---

## Everything else, ruled

| # | Candidate | What it solves | Does my_context have that problem? | Cost against the three constraints | Verdict |
|---|---|---|---|---|---|
| 1 | **`pgvector`** (Postgres + vectors) | ANN over embeddings alongside relational data | No — 25 active normative items, retrieval bounded by a 1,200-token index budget | Everything Postgres costs, plus an embeddings provider, plus a key, plus egress | **REJECT** |
| 2 | **`sqlite-vec`** | Vector search inside SQLite, no server | No, same as #1 | A platform-specific native binary per OS — breaks `CONST-node-24-no-build-step` *and* zero-deps. Independently: 2026 reports have the Windows DLL loading without error yet registering no functions, and macOS builds blocked by `OMIT_LOAD_EXTENSION` `[V]`. I confirmed `{ allowExtension: true }` is accepted here and `vec0` is absent `[M]` | **REJECT** |
| 3 | **Chroma / Qdrant / Weaviate / Milvus / Pinecone** | Dedicated vector stores, hybrid search, filtering | No | A client dependency, a daemon or a hosted endpoint, an API key, and network egress from a product that makes none. Pinecone additionally sends the corpus off the machine | **REJECT** |
| 4 | **Voyage AI / OpenAI / local ONNX embeddings** | The vectors #1–#3 need | No | Network egress + key, or model weights + native runtime. Anthropic ships no embeddings endpoint `[V]` | **REJECT** |
| 5 | **Elasticsearch / OpenSearch** | Distributed full-text at scale, aggregations, analyzers | No — 65 KB of text; FTS5 answers in 0.02 ms | A JVM cluster next to a plugin that must start hooks in tens of ms | **REJECT** |
| 6 | **Meilisearch / Typesense** | Fast typo-tolerant search, tiny ops footprint | The typo-tolerance is mildly attractive; the rest is not | Still a daemon and a client. FTS5 + `porter` covers the recall gap at zero cost; typo tolerance for a 44-item corpus is solvable by `trigram` tokenizer in SQLite if it is ever wanted | **REJECT** |
| 7 | **MiniSearch / lunr / Fuse.js** (pure-JS, in-process) | Ranked search with no server | Partly — the recall gap is real | A runtime dependency for something the bundled engine already does better and faster. If a fuzzy-match were ever needed *without* FTS5, the honest form is a vendored ~100-line scorer, not a package | **REJECT** |
| 8 | **Neo4j / Memgraph** | Unbounded multi-hop traversal, Cypher, path algorithms | **No, and emphatically.** The corpus has **27 edges across 44 items** `[M]`, an 8-name closed relation vocabulary, and a shipped design that caps traversal at **radius 2, 60 nodes** by intent ("an ego graph, not a hairball") | A server, a driver, a query language, and a second source of truth for edges that live in item frontmatter. Measured: the shipped in-memory radius-2 ego BFS costs **0.015 ms/query at 5,000 items and 0.017 ms at 20,000**, at 10× the real edge density `[M]`. A graph database would be replacing a 15-microsecond operation | **REJECT** |
| 9 | **KùzuDB / DuckDB (embedded analytics)** | Columnar/graph analytics in-process | No — the largest analytical question is "top items by injection count", already answered by the audit projection | Native module → breaks no-build-step and zero-deps | **REJECT** |
| 10 | **Oxigraph / RDF triple store + SPARQL** | Open-world semantics, federation, ontologies | No — the vocabulary is **deliberately closed** (`vocabulary.ts`: *"an open vocabulary produces `derives_from`, `derivedFrom` and `derived-from` in one corpus, and then no query finds all three"*) | A dependency, and an open-world model that contradicts the design's central closure | **REJECT** |
| 11 | **ClickHouse / TimescaleDB / InfluxDB** | Time-series ingest at 10⁵–10⁹ rows/day, retention, rollups | No. Measured audit volume: **116 records over 3 days of heavy agent use ≈ 39/day at 523 bytes/record ≈ 20 KB/day ≈ 7 MB/year** `[M]`. Rotation already fires at 8 MiB (~20–40k records) and `doctor` reports at 32 MiB, so the first rotation is roughly a year away | A server, for a workload three to six orders of magnitude below the smallest reason to run one | **REJECT** |
| 12 | **Prometheus / Grafana / OTLP export for the audit log** | Dashboards and alerting over hook behaviour | Marginally interesting; genuinely out of scope | An egress path in a product with none. R2 already ruled the OTel side **ADOPTABLE-AS-FORMAT-ONLY (record-only)** — recording an inbound `traceparent` is free; *emitting* is the line | **REJECT** as storage; see R2 for the record-only form |
| 13 | **The existing `audit.db` projection** (jsonb + VIRTUAL generated columns + expression indexes) | Indexed queries over the audit log with no migration on field growth | Yes — and it is **already built**, deliberately as a *second* file under `.audit/` that `rebuild.ts` and `store.ts` cannot reach | Zero. It is the correct design and it is shipped | **already adopted — hold the line** |
| 14 | **Litestream / LiteFS / rqlite** | Replication and HA for SQLite | No. Replicating a **disposable projection** replicates nothing; `rebuild` regenerates it from Markdown in 28 ms | A daemon, to back up a file the product tells users to delete | **REJECT** |
| 15 | **Turso / libSQL embedded replicas** | Local-first SQLite with a sync'd remote | No — git is the sync layer, and it is the one that gives review | A dependency and a hosted account; and it would make a *projection* the shared artifact instead of the source | **REJECT** |
| 16 | **`node:sqlite` session extension** (`createSession` / `applyChangeset`) | Changeset capture and replay for sync — **zero dependency, and it works here** `[M]` | No. It syncs the *index*, which is disposable, so it syncs nothing durable. Syncing the *corpus* is git's job, and git also merges Markdown as text a human reviews | Zero to adopt, but the thing it would do is not worth doing | **REJECT** — noted because it is the one sync capability that is genuinely free, and it still is not wanted |
| 17 | **CRDTs (Yjs / Automerge) for collaborative editing** | Concurrent multi-writer merge without conflicts | No. Item edits go through a staged-revision gate and human review; automatic conflict-free merge is the *opposite* of the trust model | A dependency, plus a merge semantics that silently resolves exactly the disagreements the review gate exists to surface | **REJECT** |
| 18 | **Redis / any cache layer** | Cache hot reads | No. The hot read is a `SELECT … WHERE id = ?` over a 100 KB file at **1.71 ms p50 including opening the database** `[M]` | A daemon, to cache a memory-speed read | **REJECT** |
| 19 | **S3 / object storage for backup** | Durable off-machine copies | No — the corpus is in git; the audit log is deliberately gitignored and machine-local, and that limitation is already disclosed in both READMEs | Egress, credentials, and a policy decision about shipping session ids and local paths off the machine | **REJECT** |
| 20 | **Datasette / `sqlite3` CLI / Metabase / DuckDB `sqlite_scanner` pointed at the existing files** | Ad-hoc exploration and dashboards over `.index.db` and `.audit/audit.db` | Yes — and it needs **no code at all**; both are ordinary SQLite files, and `mycontext query` already exposes read-only SQL with a `SELECT`-only gate | Zero, *provided* the disposability is stated in the same sentence as the invitation | **ADOPT-AS-OPTIONAL-EXTERNAL** — document, do not build |
| 21 | **An `item_relations` table in the disposable index** | SQL-side graph traversal for the web UI's `/api/graph` | Not currently — the shipped design does the ego BFS in memory over `Item[]`. Measured, the SQL recursive CTE over `json_each` costs **110 ms at 5,000 items** versus **0.015 ms** in memory `[M]` | Small, but it buys nothing the in-memory path does not already do 7,000× faster | **REJECT** (revisit only if a read path ever needs edges *without* loading items) |

---

## The one or two worth doing

### 1. FTS5 with `porter`, behind `search` and `query_items` only — and sell it as recall, not ranking

The measurement in Experiment 2 is the reason, and it is a bug report more than a feature request:
**today, `mycontext search "silently drop"` returns nothing, and so does `"markdown truth"`, and
both name an item exactly.** Multi-word queries are structurally broken by substring matching, and
that is invisible because the surface returns a well-formed empty result.

Shape of the change: one `CREATE VIRTUAL TABLE … USING fts5(id UNINDEXED, title, body,
tokenize='porter unicode61')` in `store.ts`'s `SCHEMA`, one insert alongside the existing `upsert`
inside the transaction `rebuild` already runs, and a ranked path in `filterItems` used **only when
`text` is set**. Cost: 7 ms at 500 items, 0.68 ms/query at 5,000, zero dependencies, entirely inside
a file the product already tells users to delete when it misbehaves.

Three conditions, all of which are the difference between an improvement and a regression:

- **`porter` or prefix queries, or don't ship it.** The default tokenizer takes `inject` from 14
  hits to 1. This is the single most likely way to get this wrong.
- **`bm25` column weights are positional over *all* columns including `UNINDEXED` ones.** I made
  this mistake here and it cost the correct answer three rank positions with no error and no
  warning — exactly the shape of silent wrongness the project's own §10 is about.
- **`select()` never sees it.** `INV-select-is-pure`.

And it should be written up honestly against the existing note in `search.ts`. That comment is right
that the IDF signal is thin — I measured it and it is: 54.7% hapax, real query terms inside a
1.2-wide band. What it gets wrong is treating "ranking is weak" as "the retrieval surface is
finished." The correction is one clause, not a reversal.

### 2. Say out loud that the two SQLite files are open to any read-only tool — and build nothing

The owner's question was whether integrating other tools would be beneficial. **For the entire
analytics, BI and exploration category, the integration already exists and nobody has been told.**
`.my_context/.index.db` and `.my_context/.audit/audit.db` are plain SQLite; Datasette, the `sqlite3`
CLI, DuckDB's `sqlite_scanner`, Metabase and Grafana can all open them today with zero code in this
repository and zero dependencies added to it. `mycontext query` already ships a `SELECT`-only gate
over the first one.

The whole deliverable is a documentation paragraph, and it must carry its condition in the same
sentence (`STD-guarantee-claims-carry-their-condition-in-the-same-sentence`): **these files are
disposable projections whose schema is versioned and dropped on a version bump; point read-only
tools at them freely, and expect nothing to survive a `rebuild`.** Without that clause the paragraph
manufactures a compatibility obligation the product deliberately does not have — which would be a
worse outcome than saying nothing.

**That is the complete list.** Nineteen of the twenty-one candidates in the table are rejections, and
that is the correct result rather than a failure to find something: the product's storage was chosen
against constraints it has actually held to, and it is three orders of magnitude away from the
scale at which any of these engines start to pay.

---

## What would break a recorded invariant

Stated as the specific rule each class of proposal contradicts, with severity, so the cost is not
softened.

| Proposal | Rule it breaks | Severity |
|---|---|---|
| Any store that becomes **authoritative** for items — Postgres, a graph DB, a hosted service | `INV-markdown-is-the-source-of-truth` — *"`files → DB → files` must be byte-identical … 'Delete the index, it rebuilds' is the documented recovery"* | **hard, always: true** |
| Any **client library** in `package.json` — `pg`, `postgres`, `chromadb`, `@qdrant/js-client`, `neo4j-driver`, `minisearch` | `CONST-zero-runtime-dependencies` — *"Only `typescript` and `@types/node` are permitted, and only as devDependencies"* | **hard, always: true** |
| Any **native module or platform binary** — `sqlite-vec`, `duckdb`, `better-sqlite3`, local ONNX weights | `CONST-node-24-no-build-step` — *"Source is `.ts`, executed directly by Node 24's native type stripping. There is no compile step and no `dist/`"* | **hard, always: true** |
| **BM25 or any score inside the selector** | `INV-select-is-pure` — *"No I/O, no filesystem, no clock, no `Store` import … select imports only types and config"* | **hard** |
| **Embeddings / semantic retrieval** as a product direction | `NOGOAL-not-a-claude-mem-replacement` — *"Do not build session history, activity capture, or semantic search over past work"* (scoped to past work; adjacent, not dispositive, and cited as such) | **hard, always: true** |
| A **required server** on the hook path | `INV-hooks-fail-open` survives only if the Markdown fallback stays, so the server can never remove a path — it can only add one. Nothing *breaks*; the proposal simply cannot pay for itself | hard |
| Replacing git as the **sharing mechanism** | Not an item, but the third constraint and `ADR-markdown-plus-disposable-index`'s stated driver: *"the knowledge base needs both human review in pull requests and fast lookup inside a latency-budgeted hook"* | — |
| **Ranking to fix spill order** | Works against `INV-nothing-is-dropped-silently` in spirit: `LESSON-alphabetical-id-became-the-priority` concludes *"the authoring error here was pinning 16 things, not the sort"*, and spill disclosure is what made that visible at all | soft, but the lesson is explicit |

Two proposals do **not** break anything and are rejected on merit alone, which is worth separating
out: the `node:sqlite` **session/changeset API** (free, works, and would sync a projection that
regenerates itself) and an **`item_relations` table** (cheap, correct, and 7,000× slower than the
in-memory traversal it would replace). Neither costs an invariant. Neither is worth building.

---

## Headline

A real my_context corpus is **44 items and 65 KB today**, grows at roughly 0.084 items per commit
even in the project that dogfoods it hardest, and saturates its own **1,200-token index budget at
about 47 normative items** — so the binding resource is the context window, not the store, and
every engine here begins paying off two to three orders of magnitude above where this product will
ever operate. **PostgreSQL is a REJECT**: not on latency, which I measured and which favours a
loopback hop over opening SQLite, but because it is a runtime dependency and a daemon bought to
solve concurrency that WAL and a read-only hook path already solved, sharing that git already does
*with* review, and scale that 65 KB will never reach — and it cannot be authoritative without
contradicting `INV-markdown-is-the-source-of-truth`. **The one thing worth adopting is FTS5 with
`porter` stemming behind `search`/`query_items` only** — zero dependency, 7 ms of rebuild cost at
500 items, and justified by recall rather than ranking, because `mycontext search "silently drop"`
returns nothing today while a naive FTS5 swap would make that *worse* by taking `inject` from 14
hits to 1.
