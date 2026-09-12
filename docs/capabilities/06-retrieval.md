# 6. Retrieval — reconstructing a subject without the noise

> Chapter 6 of the my_context capabilities reference. See [`00-index.md`](./00-index.md) for the
> full map. Related: [`04-conversation-archive.md`](./04-conversation-archive.md) (the store this
> reads from), [`05-anchors.md`](./05-anchors.md) (one of the ways in),
> [`13-testing-discipline.md`](./13-testing-discipline.md) (how the guarantees below are proved).

## The guarantee, stated precisely

my_context lets a person paste an arbitrary passage — a line copied out of the conversation
viewer, a fragment of a transcript, a stray sentence from a document — and get back a small,
chronological, **cited** account of the subject that passage is about, reconstructed from the
project's own conversation archive, its Markdown corpus, and the live state of the code and git
history. The passage can come from anywhere in months of history; what returns is not that
history.

The guarantee the design is built around, in the project's own words
(`TASK-reconstruct-a-subject-from-a-passage-you-copied-without-the`):

> RETRIEVAL NEVER WRITES INTO THE LIVE CONTEXT. It writes a MISSION for a subagent that reads in a
> fresh window, verifies against the CODEBASE AND GIT rather than the corpus... and returns
> something small, chronological and CITED... NOTHING reaches his context until he chooses it —
> then dated, marked a record, and a superseded ruling says so on arrival.

Two separate promises are bundled into that one sentence, and the code keeps them as two separate
mechanisms:

1. **The archive's own noise never has to reach a context window to be searched.** Machinery
   (tool calls, thinking, harness boilerplate) and duplicated text are filtered out of what a
   subagent is even pointed at, before anything is read.
2. **Nothing found is delivered automatically, ever.** A retrieval run produces a file on disk. A
   person reads it and chooses, claim by claim, what — if anything — comes back, and what comes
   back is unmistakably marked as a past record, checked against whether it still holds.

This is a genuinely different capability from item **search** (`mycontext search "<words>"`,
covered in [`09-cli-and-mcp.md`](./09-cli-and-mcp.md)): `search` finds *items in the corpus* by
words, tags, paths or relations, and its matches are safe to inject because items are already the
distilled, governed record. Retrieval works one layer down — over the raw **conversation
archive** (transcripts, not items) — which is exactly the layer that is *not* safe to put in front
of a model unfiltered, because it is mostly machinery and repetition. `conversation search`
(`mycontext conversation ...`, chapter 4) finds *turns* in the archive by FTS5 text match; this
retrieval pipeline is the layer above that turns a turn (or a copied passage) into a bounded,
verified, citable account of a *subject*, and refuses to let the raw material travel with it.

## Status: built, largely unwired

This matters enough to state before anything else. Five of the seven modules under
`src/core/retrieval/` are complete and tested; nothing in the CLI or MCP surface calls any of
them yet, and no hook can reach them (that second fact is itself asserted by a test, see below).
The web UI **does** now have routes registered for it (`GET /api/retrieval`,
`POST /api/retrieval/mission`, `GET /api/retrieval/:id`, `POST /api/retrieval/return`,
`POST /api/retrieval/stage`, `GET /api/retrieval/approve/confirm`, `POST /api/retrieval/approve`
— all in `src/ui/read-model-retrieval.ts` and `src/ui/retrieval-write.ts`, registered from
`src/ui/server.ts`), and `src/ui/public/screens/conversations.js` contains real client code for
composing a mission, reading a result, and staging a return. This is **more wired than the
governing task item currently says**: `TASK-reconstruct-a-subject-from-a-passage-you-copied-without-the`
still reads "NOTHING IS WIRED. No command, route or hook reaches retrieval," with `state: todo`,
while the UI route registration and the client screen code are already on disk. That gap between
an item's recorded state and what has since shipped is precisely the failure mode
`docs/superpowers/CLAUDE.md`'s own opening measurement is about — treat the item's prose as
slightly behind the code it describes, not as current truth, and see
[`01-items-and-corpus.md`](./01-items-and-corpus.md) for how an item's `state:` tag is meant to
track this.

No `mycontext` CLI command and no MCP tool currently exposes retrieval. Everything below is
demonstrated from the TypeScript modules and their tests directly, because that is the only way
to exercise the capability today.

## The mechanism, module by module

### 1. A selection becomes a query — `src/core/retrieval/from-selection.ts`

The entry point is a passage the person selected, not a guess at what they might want — "a
passage he selected is not a guess — it IS the subject." `queryFromPassage(text, vocabulary)`
extracts every **name** the passage carries, by shape, ranked by how reliably that shape resolves
against the archive (measured, as FTS5 queries, against the real conversation history):

| kind | example | measured hit rate |
|---|---|---|
| `item` id slug | `RULE-a-citation-names-an-item-by-id-never-a-report-by-line-number` | **68%** |
| `plan:`/`seq:` reference | `plan:recall seq:2` | — |
| file path | `src/core/retrieval/from-selection.ts` | — |
| backticked name | `` `classifyTurn` `` | — |
| bare camelCase / snake_case | `classifyTurn`, `remove_missing` | weakest of these |
| commit hash | a 7–40 char hex run with both a digit and a letter | — |
| heading text | — | **4%** |
| ordinary word-bag | any thirty words | **32%**, and refused anyway |

A **word-bag fallback is deliberately not built**, even though it is cheap and would raise the
match rate on paper: "a guess that resolves is worse than silence." If nothing shape-based is
found, `queryFromPassage` returns `matchable: false` with an explanatory `note`, never a
best-effort guess.

A second mechanism, `terms`, catches names written in plain prose with no distinguishing shape —
*"the byte offset"* is a real identifier in this project's own vocabulary and is written without
backticks nearly everywhere. Those are found against a **vocabulary** (see next section) using a
hand-rolled Aho–Corasick automaton (`buildAutomaton` / `findTerms`, same file), which matches an
arbitrarily large dictionary against the text in one pass rather than one `indexOf` per term. The
automaton is exported and reused, unmodified, by `subjects.ts`, so "does this text contain this
name" cannot come to mean two different things in two places.

The automaton also carries an explicit Hebrew rule (`PARTICLES = /^[והבכלמש]{1,2}$/`): Hebrew
glues one- or two-letter particles onto the *front* of a word, so a dictionary term can be matched
through its prefixed form — the same phenomenon that makes the conversation archive's FTS5 index
`trigram` rather than `unicode61` (chapter 4).

Worked example, from the module's own doc comment:

```
- Anchors are a table.  [names: "Anchors" not found — heading, not a name]
- `queryFromPassage` extracts every name in the passage.
    → names: ["queryFromPassage"]   (backticked)
- See plan:recall seq:2 for the design.
    → names: ["plan:recall seq:2"]
- thirty ordinary words with nothing distinguishing
    → matchable: false, note: "...no item id, no file path, no backticked name,
      no commit hash, and no term from the vocabulary it was given..."
```

**Use case:** a person is reading the conversation viewer, sees a line mentioning
`TASK-reconstruct-a-subject-from-a-passage-you-copied-without-the` and no other context, and
selects it. `queryFromPassage` alone — with no vocabulary at all — already extracts that id as a
`names` entry, which is enough of a query to start a retrieval mission from.

### 2. Subjects come from the documents, not from clustering — `src/core/retrieval/subjects.ts`

A **vocabulary** is the dictionary the `terms` half of the query above is matched against, and it
is built by reading this project's own Markdown (specs, plans, designs, roadmaps) with the
project's already-vendored `markdown-it` tokeniser (pinned per
`DEC-markdown-it-is-vendored-as-the-tokeniser-and-the-drawings`) and collecting:

- `title` — a document's own `h1`
- `heading` — any other heading
- `code` — every inline-code span, at `depth: 'deep'` (skipped at `depth: 'shallow'`, which reads
  only titles and headings — "how deep to go... may be a selectable option the user could choose
  from")

An earlier approach — clustering conversation spans by similarity — was tried and abandoned: on a
prior campaign (D33) "88% of its candidate pairs involved a single item, because `containment ×
0.8` was measuring length rather than subject." Reading the vocabulary out of documents a person
already wrote does not have that failure mode.

Depth is not cosmetic: measured against a regex-based extractor, `markdown-it` "found 4,348
headings and 59,600 inline-code spans over 7.53 MB in 536 ms," while a regex "misses 44% of the
inline code" — and inline code, not headings, is where the actual name matches happen. If the
vendored tokeniser fails to load (moved, corrupted), `subjectsIn` returns nothing and says so
(`markdownIsDerived() === false`) rather than silently falling back to the weaker regex — a
vocabulary that is wrong by 44% would look merely small, which is worse than admitting it
couldn't be built.

`matchSubjects(vocabulary, spans)` then runs the same automaton over a set of conversation spans
and reports two things, never dropping either: which subjects matched which spans
(`SubjectMatch`), and which spans matched **nothing** (`UnnamedThread`, capped to a 140-character
peek via `PEEK_CHARS`) — "the leftovers are the design's own signal: work happening that no item
covers," per `INV-nothing-is-dropped-silently`.

**Use case:** building a "what have we been working on" view (the `list-subjects` mode below)
starts by reading every design/plan/spec document the session touched into one vocabulary, then
matching the session's own spans against it — subjects a person can recognize by name, not
clusters a person has to interpret.

### 3. Noise removal — `src/core/retrieval/noise.ts`

This is explicitly **not** a relevance filter — "nothing below reads a passage to decide whether
it is interesting; everything below decides whether a passage is MACHINERY or a COPY," in the
owner's own framing: *"my say about summary is not because of its content but it is more about
filtering huge amount of noise and irrelevant data like scripts, output and alike."*

Every transcript record is sorted into one of three stances, reusing (not re-deriving)
`classifyTurn` from `conversation-index.ts`, so the retrieval pipeline's notion of noise cannot
drift from the conversation-list screen's:

| stance | meaning | kept? |
|---|---|---|
| `said` | a real prompt or answer | always |
| `deed` | a tool call/result whose tool is **prose-bearing** | only if the tool is prose-bearing |
| `work` | any other machinery | never |

`PROSE_BEARING_TOOLS` is a short, deliberately hand-maintained allowlist: `Read`, `Grep`, `Glob`,
`WebFetch`, `WebSearch`, `Task`, `Agent`, `NotebookRead`. Routing by **tool name** rather than by
inspecting the content was a measured decision, not a preference: a lexical classifier trying to
tell prose from machinery scored **AUC 0.499** on punctuation density alone — a coin flip — and
even the best two-rule classifier still admitted 47% of the noise, because "much `tool_result`
content IS prose." Tool name is exact and free: `Bash` output alone is 65.5% of all `tool_result`
bytes in the measured corpus; the whole prose-bearing set together is 8.8%.

On top of the stance filter, an **exact repeat filter** drops any surviving turn whose every
8-word gram has already been seen elsewhere in the window — the owner's rule, "if a group of
sentences or other text repeats more than once in the session it could be considered noise,"
confirmed by measurement (the corpus's single most-repeated 8-gram is an injected harness note
appearing 195 times). The implementation is an exact 8-gram inverted index, chosen over
similarity-based alternatives after a head-to-head measurement on identical data:

| approach | pairs found | time |
|---|---|---|
| exact 8-gram index (chosen) | 60 | 629 ms |
| SimHash | 64 | 677 ms |
| MinHash K=128 + LSH | 62 | 4,065 ms |
| SimHash brute force (3,136,260 pairs) | — | 20 ms |

There is **no similarity threshold** — a passage is dropped only when *every* gram it contains has
already been seen, "which is the question *is this text wholly something we already have*." A
share-based threshold was explicitly rejected as "a number with no derivation behind it."

`removeNoise(candidates)` returns every surviving turn (`kept`) plus an exact accounting of every
dropped one, bucketed `work` / `tool` / `repeat` / `empty` — the counts always sum to the input
count, per `INV-nothing-is-dropped-silently`.

### 4. The mission, never the material — `src/core/retrieval/mission.ts`

This is the architectural center of the whole guarantee. `writeMission(request)` does not answer
anything; it renders a Markdown instruction sheet — a **mission** — for a subagent to carry out in
its own fresh context window, and writes it to exactly one gitignored file under
`.my_context/.retrieval/<id>.mission.md`, returning only its path.

Four modes are supported (`RetrievalMode`), all shipped in the first build by owner ruling:

- `from-selection` — a passage was pasted; go find what it's about.
- `free-text` — a plain question.
- `list-subjects` — "I am lost, give me a map" — returns subjects, not an account.
- `list-anchors` — list the fixed points (anchors) in scope.

The mission carries **pointers, never passages**: `MaterialPointer` has a `text?` field that
exists, in the code's own words, "precisely so that this file can refuse to print it" — the
pointer type could carry the matched text (and does, internally, coming straight out of
`removeNoise`), but `missionText()` never reads that field when rendering. Every point instead
becomes one row of a Markdown table: session id, lane (subagent) id, record index, and a **byte
offset** (never a character offset — the archive is Hebrew from record 5, exactly as in chapter
4's conversation index), plus stance and tool. The subagent is told to open the transcript itself
and read at that offset.

What the mission *does* carry directly is the **query** — the handful of `names`/`terms` strings
the passage or vocabulary produced — because "a subagent that is not told what it is looking for
cannot look," and a handful of identifiers is not conversation material.

The mission's instructions to the subagent are explicit about the three-part job that makes this
more than a lookup:

1. Read the material at the given points and keep only what was said/decided — filter, don't
   summarize.
2. **Verify every surviving claim against the codebase and git, not the corpus** — "a ruling can
   stand in the corpus while the code that implemented it was reverted weeks ago... `git log`,
   `git show` and the source files know that, and the conversation does not."
3. Pull in complementary detail from code/documents the conversation never mentioned.
4. Return something small, chronological, and **cited** — every claim must point at a turn (session
   + byte offset), a commit hash, or a file+line; an uncited claim is a claim to drop. The mission
   text explicitly reuses `RULE-a-citation-names-an-item-by-id-never-a-report-by-line-number`:
   never cite a line in a hand-written `reports/*.md` file, because those are prepended to and
   their line numbers move.

`missionText()` is pure (opens/writes nothing); only `writeMission()` touches disk, and it writes
exactly one file.

### 5. Results are files, and they cite — `src/core/retrieval/result.ts`

A subagent's answer is a Markdown file — `<id>.result.md`, same gitignored directory — not JSON,
deliberately: "the subagent writing it is a model, the owner reads it in the viewer," so the
format both ends can already read is one claim per line with citations in brackets:

```
- Anchors are a table. [turn sess-a@918273] [file src/core/anchors.ts:95]
```

There are exactly three citation shapes — `[turn <session>[/<lane>]@<byteOffset>]`,
`[commit <hash>]`, `[file <path>:<line>]` — and a claim line with **no** bracket parses as a claim
with **zero** citations rather than being silently dropped, which is what lets `validateResult()`
flag it (`INV-nothing-is-dropped-silently` again). `validateResult` also flags any citation
pointing into `reports/`, for the line-number-drift reason above.

`checkCitations(root, result, resolvers)` re-verifies a saved result later, returning
`resolved` / `unresolved` / `unchecked` counts — never collapsing `unchecked` into either of the
others, because a caller with no way to check a turn or commit citation (no resolver supplied)
must not have that silently read as "still true." `aged` is driven by `unresolved` alone. This is
what lets a result "say it has aged" instead of rotting silently, and it is the mechanism behind
the design's privacy boundary too: results live under the **gitignored**
`.my_context/.retrieval/` directory — never `reports/` — specifically "so no sensitive data would
be saved in git," and `ignoresRetrievalDir()` checks a `.gitignore` actually covers that exact
path (not a loose substring match).

### 6. What returns, and when — `src/core/retrieval/return.ts`

This module is the second half of the "nothing reaches context automatically" guarantee, and its
own header states the design intent about as plainly as code comments in this project get:
*"Task 11 Step 2 is the safety boundary. Everything else can be imperfect; this one cannot."*

`markReturn(result, chosen, lookup, now)` is the whole of it: given a result and a list of
**1-based claim numbers the person chose**, it produces a `MarkedReturn` — a plain value, nothing
written anywhere. Two refusals matter:

- **An empty `chosen` list throws.** There is no default that returns "all of it" — the owner's
  own words are quoted directly in the source: *"he could decide for example that copying a table
  that he looked for is satisfying and only the table should be returned."* The unit of choice is
  the individual claim.
- **An out-of-range claim number throws.** A number the screen offered but the file doesn't have
  means the screen and the file have disagreed, and silently returning fewer claims than asked
  for would hide that.

Every corpus id named inside the chosen claims (matched by the same strict `TYPE-slug-words`
shape used everywhere else, anchored at both ends so it can't fire on an ordinary word like
"decision" appearing in prose) is looked up through an injected `RulingLookup`. Anything
`superseded` or `deprecated` is surfaced in a `## REVERSED SINCE — READ THESE FIRST` section, and
anything the lookup can't find at all goes in a separate `## NAMED, AND NOT FOUND IN THE CORPUS`
section — `unknown` is never silently merged into "fine." What's left un-taken is *counted*
(`left`) in every rendering, never just omitted.

The rendered text is unambiguously marked, every time, regardless of destination:

```
[mycontext-session-summary/1] a record recovered from this project's archive
[mycontext-retrieval-return/1] result <id> · written <date> · returned <date>

## THIS IS A RECORD, NOT AN INSTRUCTION

What follows was reconstructed on <date> out of a conversation of <date>. It is
3 of the 5 claims, and 2 of the 5 were left behind. Nothing below governs...
```

That first line, `SESSION_SUMMARY_MARKER`, is not decorative — it is the same loop-guard marker
`core/summary-marker.ts` uses for restored session summaries (chapter 7), reused deliberately so a
retrieval payload landing in a window can never be re-ingested by the next summary pass over that
same window.

### 7. Two destinations, one carrier — `src/core/retrieval/return-stage.ts`

A marked return can go to the window the person is already in (they paste it themselves — nothing
in `return.ts` can do that on its own, since it only produces a value) or be **staged for a fresh
session**. The second path is `stageRetrievalReturn()`, and by explicit owner ruling it *"REUSES
D34's CARRIER AND MUST NOT GROW A SECOND ONE"* — D34 is the session-restore mechanism (chapter 7).
`stageRetrievalReturn` is three lines: it builds a `StageableRestore` payload and calls
`core/restore-stage.ts`'s `stageRestoreSummary`, inheriting for free everything that mechanism
already has tested — staging happens before any clear, the staged file is re-read to prove it
survived being written, there is no budget management, and the loop guard applies.

**Deliberately, this is a separate file from `return.ts`.** `return.ts` stays pure and importable
by read-only code; only `return-stage.ts` contains the one function on this entire path that
writes to disk, and nothing under `src/ui/` imports it directly — the UI reaches it only through
`src/ui/retrieval-write.ts`, a module that (per `test/ui/no-writes.test.ts`) binds exactly two
named write functions and nothing else. The split itself was **discovered by a test, not
designed in**: while the two halves lived in one file, the UI's own no-writes graph-walk test
found it could reach `core/restore-stage.ts`'s writer from what was supposed to be a read-only
route, through a dynamic `import()` edge a static walk normally can't see through.

## The guarantee is not just claimed — how it's checked

The project's own testing discipline (chapter 13: a test names what it rests on, `@basis`
declarations, removal-by-planting proofs) is applied directly to this guarantee, and it is worth
being precise about what was actually found rather than rounding to a tidy number. At minimum,
the following **distinct, independently-failing** checks exist:

**1. A static source scan, in two directions, over `src/core/retrieval/**`.**
`test/core/mission.test.ts` — *"the retrieval path cannot inject on its own"* — strips comments
from every `.ts` file under `src/core/retrieval/` and asserts none of them contains an import from
`inject.ts`, an import from `src/hooks/`, or the literal string `additionalContext` (the field a
hook answers a session-start request with). A second test in the same file, *"no hook reaches the
retrieval path,"* runs the scan the other way: every file under `src/hooks/` is checked for the
literal string `retrieval/`.

**2. The same scan, repeated on `return.ts` specifically, each with a planted positive control.**
`test/core/retrieval-return.test.ts` re-runs both the inject/hooks/`additionalContext` scan *and*
a second scan (`node:fs` import, `writeFileSync`, import of `restore-stage.ts`) against
`return.ts` alone — and then, in the same test, builds a small **fake source string that plants
each forbidden pattern** and asserts the *scanner* flags it. This is what makes the negative
assertion trustworthy rather than vacuous: a scan that always passes because its regex is subtly
wrong would pass the real files for the wrong reason, and the planted-importer control is what
would catch that.

**3. A runtime check against the actual gate the injector reads.** `test/core/retrieval-return.test.ts`
— *"staging a return for a fresh window delivers nothing, and the injection still sees nothing"*
— stages a real return via `stageRetrievalReturn`, then calls `approvedRestore(root)`, which is
**the exact function `core/inject.ts` calls at every session start** to decide whether anything
should be delivered — and asserts it still returns `null` after staging. This is not a proxy
check; it is the live decision point itself.

**4. A whole-server reachability graph walk.** `test/ui/no-writes.test.ts` statically walks every
module reachable from `src/ui/server.ts` and asserts a hand-maintained allowlist of exactly which
functions are allowed to write, and from where — `src/core/retrieval/return-stage.ts` is allowed
to bind `stageRetrievalReturn` and nothing else in the retrieval path may bind a writer at all.
The same test file spells out **four checkable properties** specifically for the retrieval-staging
route: staging is not delivery (checked via `approvedRestore`, same as #3 above); what moves on
disk is exactly one gitignored JSON file under `.staging/restore/`, proven by a byte-identical
snapshot across a full stage/confirm/approve round trip; the approving actor is the literal
`'human'` baked into the one call site, unreachable from any request body; and approval itself
requires a one-time confirmation nonce minted only by `GET /api/retrieval/approve/confirm`, bound
to both the staging key and a digest of the staged bytes recomputed from disk at both ends, and
spent on first use.

Honestly stated: that is four *mechanisms* (source-scan, planted-control, runtime-gate-check,
whole-graph-walk) guarding the no-auto-delivery half of the guarantee, plus the separate,
also-tested noise-removal half (`test/core/noise.test.ts`, `test/core/from-selection.test.ts`,
`test/core/subjects.test.ts`, `test/core/retrieval-result.test.ts`) which is checked by ordinary
removal-proof unit tests rather than by this scan/graph-walk apparatus. If "the four ways" was
meant to name a single flat list, the closest literal match in the code is the four bulleted
properties `test/ui/no-writes.test.ts` itself enumerates for the staged-return route (bullet 3,
above) — that is the one place in the source that says "four" about this guarantee in so many
words.

## Worked example: end to end, from source

There is no CLI command to run, so this walks the real functions as the tests exercise them.

```ts
import { queryFromPassage } from './src/core/retrieval/from-selection.ts';
import { writeMission } from './src/core/retrieval/mission.ts';
import { markReturn } from './src/core/retrieval/return.ts';

// 1. A passage the person copied out of the conversation viewer.
const passage = 'Fixed by TASK-reconstruct-a-subject-from-a-passage-you-copied-without-the, ' +
  'see plan:recall seq:2 and `queryFromPassage`.';

const query = queryFromPassage(passage);
// → { names: ["TASK-reconstruct-a-subject-from-a-passage-you-copied-without-the",
//             "plan:recall seq:2", "queryFromPassage"],
//     terms: [], matchable: true, note: null }

// 2. A mission is written — one gitignored file, nothing else touched.
const mission = writeMission({
  id: 'demo-1', mode: 'from-selection', repoRoot: process.cwd(),
  resultPath: '.my_context/.retrieval/demo-1.result.md',
  query: { names: query.names, terms: query.terms },
  pointers: [/* MaterialPointer[] from a noise-filtered archive scan */],
});
// mission.path === '.my_context/.retrieval/demo-1.mission.md'

// 3. (a subagent reads the mission in its own fresh window, verifies
//    against git/the code, and writes demo-1.result.md with cited claims)

// 4. The person reads the result and chooses claims 1 and 3 of 4 to keep.
const marked = markReturn(result, [1, 3], (id) => lookupInCorpus(id));
// marked.text opens with the SESSION_SUMMARY_MARKER + retrieval-return
// protocol line, states "2 of the 4 claims... 2 were left behind", and lists
// any named ids that have since been superseded, BEFORE the claims themselves.
```

**Use case:** debugging a regression, an agent pastes an error message that happens to include a
file path (`src/core/anchors.ts`) and a function name it saw in a stack trace. `queryFromPassage`
turns that into a query with no vocabulary needed at all (the path and function name are found by
shape); a mission built from it points at every archive turn mentioning either; noise removal has
already dropped the machinery; the subagent's result comes back citing the commit that last
touched that function and the conversation turn that decided its current behavior — and the
person chooses to bring back just the one claim that explains the regression, not the transcript
that surrounds it.

## What's NOT built / built but off

- **No CLI command, MCP tool, or hook triggers retrieval.** It can only be exercised by importing
  the modules directly (as in this chapter, and as the tests do). This is asserted as intentional,
  not merely incomplete — the whole point of the isolation tests above is that nothing *can*
  reach it unasked while it's in this state.
- **Task 11 ("the UI — read the result, choose what returns") is only partly landed** against
  what the governing task item describes. The routes and the client screen code
  (`src/ui/public/screens/conversations.js`) exist and are tested at the route level
  (`test/ui/retrieval-write-route.test.ts`), which is *more* than the item's own text currently
  claims — but the item's `state:` still reads `todo` and this document could not verify from the
  item alone whether every affordance the item's Task 11 describes is actually reachable end to
  end from the running screen; that would need driving the UI itself; see
  [`08-web-ui.md`](./08-web-ui.md) for what could be verified there.
- **Task 12 ("rounds compose")** — a second retrieval round that goes deeper into one subject a
  first `list-subjects` round returned — has the `MissionRequest.round` field and the
  mission-text branch that renders it (`missionText` handles `round.n > 1` explicitly, and
  `test/core/mission.test.ts` covers a second-round mission's text), but whether an actual second
  round can currently be *dispatched* end to end is, again, gated on the same unfinished UI wiring
  above.
- **One deliberate design seam is left open on purpose:** `MissionRequest` has no field naming the
  exact shape a result file must take; `resultShape` exists but is optional, and a caller either
  supplies `result.ts`'s `resultContract()` output or doesn't. This was a conscious choice
  ("left alone rather than guessed") recorded directly in `mission.ts`'s own comments, not an
  oversight this document is surfacing.
- **No similarity/relevance scoring exists anywhere in this pipeline**, by design — see the
  noise-removal section above. A passage either names something (by shape or by vocabulary) or it
  doesn't; there is no fuzzy "probably about X."
