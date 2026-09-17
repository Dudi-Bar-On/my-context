# 14. Search over the archive

`docs/capabilities/00-index.md` · previous: [`05-anchors.md`](./05-anchors.md) · next: [`15-document-and-lane-viewer.md`](./15-document-and-lane-viewer.md)

**This chapter did not exist before 2026-09-16.** Chapter 4 documents *what* the conversation
archive is and how it is indexed; this chapter documents the query grammar a reader — a person at
a terminal, or the automatic anchor pass — actually gets when they type words into it. Almost
everything below shipped in a single day, 2026-09-16, and the source for it is four same-day
reports (`reports/2026-09-16-the-search-grammar.md`, `-the-search-shipped.md`,
`-indexing-what-was-done.md`, `-search-adopt-or-build.md`) plus the code they produced, read
directly for this chapter rather than copied from any of them.

## 14.1 What was wrong, in the owner's own words

The archive's search existed before this date — `searchArchive`, one FTS5 query, reachable from
the web UI and the automatic anchor pass (chapter 4) — but it answered a **single** reading of a
query: every word, adjacent, as one substring. The owner's complaint, driving the work: two words
he knew were in the same sentence of a real turn returned nothing, because they were not touching.
`trigram hebrew` over this repository's own archive returned **one** block under the old search and
**63 passages under three headings** under the new one.

## 14.2 Three readings, in tiers, not a knob to turn

`searchArchiveTiered` (`src/core/conversation-search.ts`) reads one query three ways and returns
the union, each hit tagged with which reading found it, first reading to claim a span wins it —
so the three readings nest rather than triple-counting:

1. **`phrase`** — the words exactly as typed, adjacent. What the old search always meant.
2. **`near`** — `NEAR(…, 30)` (`NEAR_CHARS = 30`): the words within 30 characters of each other,
   roughly "the same sentence."
3. **`both`** — every word present, anywhere in the same turn — an `AND` across terms rather than
   a phrase or proximity match.

**Nothing new was added to any screen for this.** The three readings are computed and disclosed
with a heading over each block (`conv.arch.tier*` strings, both languages) — a reader does not
choose a mode; they get the most literal answer first and progressively looser ones after it,
which was the explicit design goal of the report this shipped from: *"the failure mode to avoid is
a Find dialog with nine checkboxes nobody ticks."*

Worked example, real output against this repository's own archive, **re-run and re-pasted
2026-09-17** (the previous version of this block was left undated after its own capture and, unlike
every other live paste in this reference, silently stopped reproducing — one of the seven rows had
been displaced by a newer hit and three totals had moved; this one carries its date for exactly
that reason, and is expected to look different again the next time anyone runs it):

```
$ mycontext conversation search "index report" --limit 3     # 2026-09-17
┌────────┬────────┬──────────────────┬──────────┬──────────┬───────────┬───────────────────────┐
│ tier   │ kind   │ when             │ session  │ lane     │ byte      │ match                 │
├────────┼────────┼──────────────────┼──────────┼──────────┼───────────┼───────────────────────┤
│ phrase │ answer │ 2026-09-10 11:24 │ 595db3b1 │ agent-a2 │ 4271865   │ …ng [index report]s I…│
│ phrase │ prompt │ 2026-09-11 03:48 │ 595db3b1 │ agent-a1 │ 0         │ …er [index report] `I…│
│ phrase │ prompt │ 2026-09-10 12:17 │ 595db3b1 │ agent-ac │ 0         │ …ng [index report]s I…│
│ near   │ answer │ 2026-09-09 16:26 │ 595db3b1 │ —        │ 81858157  │ … lane [report]ed 66/…│
│ near   │ answer │ 2026-09-08 23:23 │ 595db3b1 │ —        │ 73206567  │ …ng to [report] a hal…│
│ near   │ answer │ 2026-09-16 20:05 │ 595db3b1 │ —        │ 141684342 │ …The subjects [repor]…│
│ both   │ answer │ 2026-09-11 05:00 │ 595db3b1 │ —        │ 93156686  │ Now the owed [index]… │
└────────┴────────┴──────────────────┴──────────┴──────────┴───────────┴───────────────────────┘
my_context: 7 hit(s) in what was said, over prompt and answer spans.
my_context:   phrase: 3 shown of 3 matched — the bound cut this reading.
my_context:   near: 3 shown of 51 matched — the bound cut this reading.
my_context:   both: 1 shown of 1029 matched — the bound cut this reading.
my_context: and 1177 more in what was RUN — add `--sources ran` to see them, or `--sources both`.
my_context: tool_result and thinking blocks are NOT indexed at all, so what a command PRINTED and
what the model thought cannot be found by any search here.
```

Every line at the bottom is required disclosure, not decoration — see §14.5.

**Why `searchArchive` itself was left untouched rather than rewritten.** `anchor-pass.ts`'s probes
page through `searchArchive`'s results with `offset` over a stable total order — 25 pages of 200,
the repair for a 2026-09-15 incident where automatic marking stopped for over half an hour. A
union of three ranked readings has no stable global offset: page 2 of a tiered answer is not "the
rows after page 1 of it." So the reader gets the new tiered function, `searchArchiveTiered`, and
the automatic pass keeps using the old one, on purpose — `SearchScope` minus `offset` is the tiered
function's parameter type, so "offset is meaningless here" is a compiler error rather than a
comment somebody could miss.

## 14.3 The three-character floor moved from the whole query to each term

Chapter 4 already states the floor: a trigram index cannot match fewer than three characters, by
construction. Until 2026-09-16 a query holding *any* short word could empty silently. Now
`parseSearchQuery` splits `{ phrase, terms, short, excluded }`: words under `MIN_QUERY_CHARS` (3)
stay inside the phrase reading — which can still match them as part of a longer literal string —
but are named and dropped from the two boolean readings (`near`, `both`) rather than either
crashing the query or being silently ignored. A reader typing `הם שורה תוך` (Hebrew, `הם` being two
characters) is told directly: *"too short to search for alone: הם. This index reads runs of 3
characters…"* — where before this shipped, the whole query would have answered zero with no
explanation.

## 14.4 `-word` excludes, and nothing else looks like syntax

A leading `-` on a word of three or more characters removes it from every reading. A `-` glued
inside a word, a lone `-`, or a `-` in front of a word under the three-character floor are all read
as literal characters — nothing throws on an unrecognised pattern, which was a deliberate choice
against Elasticsearch's own query-syntax failure mode ("a grammar that can live behind a keystroke
and one that cannot"). Worked example:

```
$ mycontext conversation search "index report -lane" --sources both --limit 2
┌────────┬──────┬────────────────────────┬──────────┬──────────┬─────────┬─────────────────────────┐
│ tier   │ kind │ when                   │ session  │ lane     │ byte    │ match                   │
├────────┼──────┼────────────────────────┼──────────┼──────────┼─────────┼─────────────────────────┤
│ phrase │ ran  │ 2026-09-16 20:07 GMT+3 │ 595db3b1 │ agent-a3 │ 342366  │ …h "[index report]" -…  │
│ phrase │ ran  │ 2026-09-16 19:57 GMT+3 │ 595db3b1 │ agent-a0 │ 2437002 │ …h "[index report]" -…  │
│ near   │ ran  │ 2026-09-11 04:29 GMT+3 │ 595db3b1 │ agent-a1 │ 1834449 │ …se [report].[index]ed  │
│        │      │                        │          │          │         │ …                       │
│ near   │ ran  │ 2026-09-16 19:43 GMT+3 │ 595db3b1 │ agent-a0 │ 641184  │ … [index]ing [report]   │
│        │      │                        │          │          │         │ t…                      │
└────────┴──────┴────────────────────────┴──────────┴──────────┴─────────┴─────────────────────────┘
my_context: 4 hit(s) in what was said and what was run, over prompt and answer and ran spans.
my_context:   phrase: 2 shown of 3 matched — the bound cut this reading.
my_context:   near: 2 shown of 103 matched — the bound cut this reading.
my_context:   both: 0 shown of 961 matched — the bound cut this reading.
my_context: tool_result and thinking blocks are NOT indexed at all, so what a command PRINTED and
what the model thought cannot be found by any search here.
```

`-lane` removed every turn holding the word "lane" from every reading, over both the `said` and
`ran` scopes at once (§14.5). **This is the whole, unabridged output, including the four trailer
lines §14.2 calls required disclosure** — an earlier version of this example pasted two rows and a
truncated `3 hit(s)` line that its own table contradicted, which is exactly the kind of abridged
paste this reference's own discipline exists to refuse. Re-running the identical command a few
hours later returned a *different* real answer (4 hits, not 3) for an honest reason worth stating
rather than hiding: this exact command was run repeatedly against this workspace's own live
archive while writing and re-verifying this chapter, and each run is itself a new `ran` span the
next run can find — the same self-referential growth `reports/2026-09-16-claude-p-measured.md`
documents for a different mechanism. The number will keep moving for that reason; the shape of the
answer (two tiers hit, `both` bounded, both disclosure lines present) is what this example is
actually demonstrating.

## 14.5 The sources axis — `said`, `ran`, or `both`

This is the widest single change to what the archive can answer, and it is separate from the
tiering work above (a different lane, same day). Until 2026-09-16 exactly two span kinds were
indexed: `prompt` and `answer` — what a person and the model *said*. Chapter 4 already describes
that as the searchable 0.98%–3.3% slice of a transcript's characters. **A third kind, `'ran'`, now
indexes `tool_use` blocks** — a tool's name and its arguments, rendered as `key: value` lines (not
raw JSON, so a path spelled with escaped backslashes in a record is still found by the forward-slash
form a reader would type), capped at **`TOOL_VALUE_CAP = 2,000` characters per argument** (not per
block — a `Write` call's `content` cannot crowd out its own `file_path`).

Measured on this workspace's real archive (474 transcripts, 1,269,256,560 bytes) the day it
shipped:

```
kind      spans     characters
prompt    1,671      6,050,609
answer    9,920      7,538,303
ran      58,361     30,277,871      <- new
total    69,952     43,866,783      against 11,554 spans / 13,575,116 before
```

**13.58 M searchable characters widened to 43.87 M — a 3.2x widening** — for 2.0x the FTS5 index
size and 2.5x a full rebuild, and **nothing measurable on the per-turn incremental refresh** (the
Stop hook's cadence), which is the number that actually governs whether this was affordable: +13 ms
on the largest real tail measured, against a hook budget of 1,600 ms.

**The reader chooses the scope, and the default did not move.** `said` (`prompt` + `answer`) is
still the default on every surface — CLI, web UI, and every existing caller (`anchor-pass.ts`,
`retrieval/from-selection.ts`, the document find bar) — so nothing written before this date widened
silently. What changed is that **every answer now names what the kind it did not read holds**:

```
my_context: nothing in what was said holds "measure-tool-indexing".
my_context: and 11 more in what was RUN — add --sources ran to see them, or --sources both.
```

A `said` search that returns zero can never again be mistaken for "the archive does not contain
this" — the `elsewhere` disclosure (one extra `countProse` over the complementary scope, charged
only when a reading actually filled its bound) makes the distinction between *absent* and
*unindexed-here* visible on every answer, including empty ones. This is the same discipline chapter
4's byte-vs-character rule and this project's `INV-nothing-is-dropped-silently` both come from.

**CLI**: `mycontext conversation search <query> [--sources said|ran|both] [--session <id>]
[--agent <id>] [--limit <n>] [--json]`. **Web API**: `GET /api/conversations/search?sources=…`.
Sending both `sources` *and* a `kind` filter that names things outside that scope is refused rather
than silently resolved — they are two different filters over the same column and picking a winner
would draw a heading untrue of its own rows.

**What is still, deliberately, in no index at any scope: `tool_result` (67.0% of the archive's
characters, per `conversation-search.ts`'s own cited measurement — see
[chapter 4](./04-conversation-archive.md)'s note on a second, uncited `78.9%` figure elsewhere in
the same product's source that this reference does not treat as authoritative) and `thinking`
(16.4%).** Every search answer says so, in the same sentence, whether or
not it found anything. `tool_result` was measured and costed (a cap of 512 characters would add
~80 MB / ~18 s to a rebuild and catch the first screen of nearly every command's output; 2,048 —
the cap named when this was scoped — costs more than the entire rest of the index combined, mostly
in file dumps and test output) but **nothing about it is shipped**; the decision is recorded as the
owner's to make, in `reports/2026-09-16-indexing-what-was-done.md` §7, and a test pins its absence
so that a later change cannot widen it quietly.

## 14.6 Ranking within a tier

Ranking the *archive* and ranking the *item corpus* are two different mechanisms, both shipped
2026-09-16, and worth keeping apart:

- **The archive** already had `bm25()` available (`node:sqlite`'s FTS5 ships it) and it was simply
  never *used* to order results before the owner's ruling that day
  (`RULE-search-may-rank-its-results-and-the-model-it-asks-is-the`) lifted an earlier refusal.
  `matchProse` already returns `ORDER BY bm25() ASC`, so once tiering existed, giving each reading
  its own best-first order cost nothing beyond *not re-sorting across tiers* — the tier itself is
  kept as the primary ordering because it says **why** a result is where it is, which a bare score
  cannot, and a tier is "better than a score and not a substitute for one."
- **The item corpus** (`mycontext search`, `list_items`) went from an *unranked* substring
  predicate to a real BM25 ranker the same day, by a different mechanism — see
  [Chapter 9](./09-cli-and-mcp.md)'s `search` entry and `src/core/rank.ts`. The two rankings do not
  share code and should not be assumed to behave alike; both are BM25 over SQLite FTS5 machinery,
  independently wired.

## 14.7 What's NOT built / built but off

- **`tool_result` is in no index, at any cap.** §14.5. A person's ruling is required before it
  ships; the cost table for four candidate caps is in the source report.
- **The document find bar and the floating find panel (chapter 15) do not go through this
  mechanism at all.** They scan one already-open transcript's prose spans directly in
  JavaScript/TypeScript, with no FTS5 index involved — a fundamentally different tool for a
  fundamentally different question ("where in *this* document," not "which turns in the whole
  archive"). Chapter 15 covers why regex, whole-word and case-sensitivity are refused *here* on
  §6's own measurement but shipped *there*.
- **Semantic / embedding-based search was investigated and explicitly not adopted.**
  `reports/2026-09-16-search-adopt-or-build.md` and `-claude-p-measured.md` measured `claude -p` as
  a candidate mechanism and found it recursive by construction — a child invocation loads this
  plugin, gets indexed by its own `Stop` hook, and search results start returning the reader's own
  prior searches as hits. **Nothing here shipped**; the item stays open, and this chapter documents
  no semantic-search capability because none exists.
- **`conversation anchor --find` remains a separate, narrower tool** — it searches anchor *labels*
  (text a person wrote), not archive prose, and it exists to place or locate a bookmark rather than
  to return a ranked result set. See [chapter 5, §5.8](./05-anchors.md#58-worked-examples).
- **A `said`/`ran`/`both` query still cannot search `tool_result`, so "what did that command
  print" remains unanswerable from any search surface** — only "what command was that" (`ran`) and
  "what did we say about it" (`said`) are.
- Every count in this chapter is a **dated reading** from 2026-09-16, taken against a live,
  growing archive; re-run the commands shown to get today's numbers.

## See also

- [00 — Index](./00-index.md)
- [04 — The conversation archive](./04-conversation-archive.md) — indexing, classification, byte
  offsets, and the trigram tokenizer this chapter's grammar is built on
- [05 — Anchors](./05-anchors.md) — the automatic pass's probes, which use `searchArchive`
  (untouched) rather than the tiered function this chapter describes
- [09 — CLI and MCP](./09-cli-and-mcp.md) — `conversation search` in the full command reference,
  and the item-corpus ranking change this chapter distinguishes itself from
- [15 — The document and lane viewer](./15-document-and-lane-viewer.md) — the find bar and find
  panel, which search one open document directly rather than querying this index
