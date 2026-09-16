# The mechanism map — the five least-documented subjects, traced in the code

Produced 2026-09-16 by the `feature-dev:code-explorer` specialist, the first of five reviewers the
owner approved to repair `docs/capabilities/` and write `docs/system/`. Its brief: map the
mechanisms so that documentation written from the map cannot be wrong.

**It could not write this file itself** — that agent's tool set carries no `Write`, only
`Read`/`Glob`/`Grep`/`Web`. The main session transcribed its findings here unaltered. That is a
fact about the roster worth carrying: three of the five approved specialists have not yet been
exercised, and their tool sets have not been confirmed.

Every line number and count below was read from the tree on 2026-09-16, never copied from a
document. All paths are under `D:\Users\UserC\source\repos\my-context`.

---

## 1. The board — how work is chosen

**Entry points.** `src/core/needs.ts` (867 lines, pure — no I/O), `src/core/questions.ts` (325
lines, pure), `src/cli/commands/ready.ts`, `src/cli/commands/path.ts`, `scripts/check-board.ts`
(573 lines).

**The core abstraction.** A `WorkItem` (`needs.ts:189-199`) is an `Item` branded with a phantom
`unique symbol` — erasable at runtime, so it costs nothing, but it makes
`asWorkItem`/`isWorkItem`/`workItems` (`needs.ts:209-298`) the *only* functions that can produce
something `taskState`/`taskKey` may be called on. `isWorkCategory(config, type)`
(`needs.ts:151-159`) is the actual test: a category plans work if and only if it is `enabled` **and**
its `extraFields` include `plan`, `seq` and `state` — read from config, never matched against the
literal name `task`, even though `task` is the one shipped category that qualifies today.

**The dependency field, `needs`.** `parseNeeds` (`needs.ts:113-128`) splits a comma list into
well-shaped `plan/seq` refs (`REF_SHAPE = /^[a-z][a-z0-9_-]*\/[a-z0-9][a-z0-9_-]*$/`, `needs.ts:88`)
and a `malformed` bucket that is **kept, never dropped**. `buildTaskIndex` (`needs.ts:310-320`) maps
`plan/seq → WorkItem[]` — a list, because keys collide; six live tasks shared one key when this was
measured. `refStatus` (`needs.ts:361-366`) resolves one ref to `satisfied | pending | unresolved`,
treating a `status: deprecated` target as **satisfied** (discharged, not pending — owner ruling
2026-09-06) so a dependent does not wait forever on cancelled work.

**`readyReport`** (`needs.ts:484-524`) is the whole of `mycontext ready`'s logic: for every open,
non-deprecated work item, resolve `needs`; if any ref is malformed, pending or unresolved it is
`held` with a reason; a `state: blocked` item with empty `needs` and nothing satisfied is *also*
held (`blocked_without_needs`) rather than silently listed as ready. **Nothing is stored** —
readiness is derived on every call, precisely to avoid a second copy of a fact that can drift.

**Open questions block the board too.** `questions.ts` adds a second, disjoint mechanism:
`open_question` items carry `blocks`, free text that may contain refs in two spellings — a
`readNeeds`-style comma list, and prose `plan:X seq:Y` (`PROSE_REF`, `questions.ts:164`).
`questionReport` (`questions.ts:312-324`) splits every non-retired, non-draft question into
`blocking` (names still-open work — shown) and `quiet` (landed, unresolved, unparsed or unstated —
counted, not shown), on the argument that a list showing every question every time trains the reader
to skip it — the fate the audit stream already met at 5,207 rows.

**`mycontext ready`** composes both into one disclosure that, at *every* detail level including
`--summary`, states how many were truncated, how many held and by which reason, how many questions
block, how many quiet questions exist, and — under `--plan` — how many questions were narrowed away
and cannot honestly be attributed to the narrower scope (`ready.ts:359-377`).

**The subject map, and it is the part with essentially zero prior documentation.**
`REF-the-d-numbers-what-each-one-means-and-which-are-only.md` carries a `[D-MAP]…[END D-MAP]`
delimited block (lines 347-426 today) that `parseDMap` (`needs.ts:664-723`) parses **as data, not as
prose scanned by regex** — because two rows of the old prose-regex approach were measured wrong on
2026-09-16 itself: one subject read CLOSED because its text quoted another's closure, and another
read 0/3 because it matched an unrelated item by name.

Each row is `D<n> | status | members`, where `status` is one of five words
(`open | closed | deferred | held-by-owner | not-filed`, `needs.ts:582`) and `members` is a comma
list of `plan/*`, `plan/seq`, or a bare item id. `dBoard` (`needs.ts:780-866`) resolves every row
against the corpus in one pass, distributing the **single** `readyReport` call's rows into subjects
— never re-deriving readiness per subject, which would be two readings of "what is ready" that could
disagree.

Three finding classes come out: `unresolved` (a member naming nothing — **gates**), `doubleClaimed`
(one item under two subjects — **gates**, and the subtle one: both rows count it and the totals
silently stop adding up), and `orphans` (open work no subject claims — **reported, never gated**,
because filing before a number is minted is normal).

Today's map: **78 rows** — 5 `not-filed`, 2 `closed`, 1 `deferred`, 1 `held-by-owner`, the rest
`open`.

**`mycontext path`** (`path.ts`, 432 lines) is the newest and least-documented of the three
commands, filed 2026-09-16 in answer to the owner's request for a reliable path to finishing the
open subjects. Per subject it shows done/total, ready, held — and **a fourth column no other command
computes: YOURS**, work waiting on the owner specifically, derived from two existing facts rather
than a new field: a subject at `held-by-owner`, or an item an open question's `blocks` names
(`path.ts:56-66`). "100% closable" is explicitly **not** promised: the closing sentence on every run
says 100% means every remaining step is either dispatchable or named as the owner's, never that
every subject closes (`path.ts:405-407`).

**`scripts/check-board.ts`** is the gate, in two tiers. Tier 1 (the map parses, resolves, no double
claims) **fails the run**. Tier 2 (a commit named an open item and nobody closed it — found via
`git log --name-only -m` and a regex over subjects and bodies, `LANE_IN_COMMIT`,
`check-board.ts:149`) is **reported, never gated**, and the header explains at length why: 23 of 153
open items were already named by a commit on the day measured, but 22 of 26 raw findings were
bookkeeping — filing commits, handovers, reconciliations — so a naive gate would be red on a healthy
tree within a day. An item can self-silence one drift finding with `NAMED-BUT-OPEN <sha> — <reason>`
in its body, which expires the moment a *later* commit names the item again.

**None of this** — the map format, `dBoard`, `mycontext path`, or the two-tier gate — exists in any
capabilities chapter, spec or tutorial. The only prior documentation is the header comment in
`needs.ts` and two corpus reference items.

> **Correction, same day.** The mapper called that header "200-line"; it is **48 lines**
> (`needs.ts:1-48`), verified independently after the verification pass caught the same figure
> repeated in chapter 16. Left visible rather than silently edited: this is the third time in one
> day a count travelled from one document into another without being read from the tree, and the
> map is not exempt from the thing it documents.

---

## 2. The document and lane viewer

**Larger than the inventory written the same morning claims.**
`src/ui/public/screens/conversations.js` is **11,261 lines** — a number cited nowhere. `app.js` is
**8,592 lines**, not the "≈5,200" stated in `reports/2026-09-16-the-subjects-of-this-system.md`
row 7. A fresh instance, hours old, of the exact phenomenon that report is itself about: *a
distillate freezes a count that keeps moving.*

**Two entry pages, one shared renderer.**

`doc.js` (420 lines) renders repository, tutorial and corpus-item Markdown through GitHub-parity
rendering. Three address kinds by query string — `?doc=`, `?tut=`, `?corpus=` (`doc.js:137-156`) —
each with its own rooting rule for relative links (`baseDirFor`, `doc.js:89-117`), deliberately three
different roots because a doc id is repo-relative, a tutorial id is a manifest key and a corpus-file
id is workspace-relative; conflating any two silently opens the wrong file.

`lane.js` (324 lines) is the **bare lane window** — one subagent transcript in a chromeless tab
(owner ruling 2026-09-09: *"only see the viewer… without all the app around it"*). It imports
`mountDocument` whole from `screens/conversations.js` rather than reimplementing anything, and its
header is explicit that this is deliberate: a second implementation of the virtualised scroll is
exactly the trap `/doc.html` already sets by using a *different* renderer for structurally similar
content.

**A load-bearing bug, fixed this week and worth citing as a pattern.** `lane.js`'s header used to
claim it handed the viewer exactly four `ctx` functions and that this was "everything `mountDocument`
reaches for, measured". The measurement was wrong: `mountDocument` draws four anchor write controls
that all call `ctx.post`, which did not exist — so **every anchor write in a lane window threw for
about a week**, and 704 of 1,310 marks in the archive carry a lane id. Over half the bookmarks in the
archive were reachable-but-broken in the one window that could reach them. The fix added `postJson`
and measured, live, that a cookie-only POST is accepted by the running server (`lane.js:156-169`).
**The file now documents its own correction in place rather than silently repairing it** — unusually
good practice, and the shape the documentation-repair specialists should copy.

**The read model.** `read-model-conversation-document.ts` turns a transcript into exactly two node
kinds: `said` (one record with words, drawn open) and `work` (a run of consecutive machinery records,
folded to one summarised line). The ratio driving the design, off a real 63,871,429-byte /
27,752-record transcript: **62.6% of records carry no `message` object at all**, and only 2,444 of
27,752 carry words a person said. `buildOutline` walks the file once and remembers each node's
**byte** offset — never character, because the corpus is half Hebrew from record 5 onward and a
character offset silently lands mid-record. 157 ms for the whole-outline walk on a 61 MB file, then
windowed reads.

**`lib/fold.js`** (1,329 lines) is the reading grammar for both search surfaces and the densest,
best-argued file in the UI:

- NFKD and case folding, hand-written rather than vendoring CodeMirror's `SearchCursor` — the owner
  chose to write it after being shown the vendoring option. The *intent* was still checked by running
  both algorithms side by side over the real archive: **1,775,487 hits, zero differences**. That
  comparison run, not the upstream source, is what `test/ui/fold.test.ts` pins.
- Four exclusive reading modes (`MODES = ['normal','wildcard','logical','regex']`, `fold.js:731`) —
  a Notepad++-style radio group. `logical` implements AND/OR/NOT/NEAR **in the JavaScript scan**,
  explicitly not by reaching FTS5, even though the syntax reads as SQL — because this surface never
  touches SQLite at all.
- `nestedQuantifier` (`fold.js:653-691`) statically refuses regex shaped `(X+)+` before compiling,
  because a real pattern took **108,785 ms** on a 139 MB session and a runtime canary was tried and
  found unsound: patterns that explode are shorter than any canary that could learn from them.

**`lib/transcript-scroll.js`** (147 lines) is pure arithmetic — a `Float64Array` prefix-sum over row
heights, binary-searched, choosing a plain re-sum over a Fenwick tree because a session tops out
around 4,916 nodes and a re-sum is "4,916 additions" run only when a measured height changed.

**`lib/panel.js`** (407 lines) is the first of three planned floating-dialog subjects (Search
shipped; Navigation and Copy still to come): a non-modal `<dialog>` using `show()` and never
`showModal()`, so the document stays live behind it; hand-wired Escape, because non-modal dialogs get
no auto-close; drag via pointer capture rather than a document listener, so a pointer leaving the
window cannot strand the drag; and a documented focus bug that **passed in English and reddened in
Hebrew on the same build**.

**The CSS Custom Highlight API** (`conversations.js:3980-4045, 7252-7321`). `CAN_HIGHLIGHT` gates on
`CSS.highlights` and `Highlight` existing, and it is the *only* highlighter usable here rather than a
preference: every wrapper-based highlighter mutates the DOM inside a scroll whose rows are absolutely
positioned from a measured model, and a wrapper re-measuring its row leaves the paint arithmetic
holding a stale position. Two registries — `mycontextfind` (every match) and `mycontextfindnow`
(priority 1, the one the reader stands on) — **rebuilt from scratch on every paint**, because this
scroll recycles rows and a `Range` held across a recycle points at a detached node and paints
nothing, silently, forever.

---

## 3. Search over the archive

**Two genuinely separate mechanisms sharing one matcher module.** This is the fact most likely to
mislead a documenter who assumes "search" is one thing.

**(a) `searchArchiveTiered`** (`conversation-search.ts:1174`+) — the box on the Conversations list
screen, and now also `mycontext conversation search` (`conversation.ts:1537-1637`).

**This overturns chapter 4's claim** (`04-conversation-archive.md:139-141,341`: *"there is no CLI
path to FTS5 archive search… this is the largest missing surface"*). The command calls
`searchArchiveTiered`, which reads FTS5 directly. The claim was true when the chapter was verified on
2026-09-12 and is false today.

- FTS5 table `conversation_prose` (`conversation-index.ts:473-483`), tokenizer **`trigram`**, chosen
  over `unicode61` because Hebrew glues one-letter particles onto word fronts, so what a reader types
  is a *substring* of what the transcript holds. Measured: `שורה` finds **3** hits under `unicode61`
  and **11** under `trigram` on the identical corpus. Cost: 42 MB against 17.8 MB, 1,870 ms against
  264 ms to build.
- **The trigram floor**: queries under three characters match nothing, ever (`MIN_QUERY_CHARS = 3`),
  reported explicitly rather than returned as an indistinguishable empty result.
- **Three tiers of one query** (`tiersOf`, `conversation-search.ts:911-920`): `phrase`, `near`
  (`NEAR(a b, 30)`), `both` (boolean AND) — strictly nested for terms of three characters or more,
  checked on 178 real pairs, phrase ⊆ near ⊆ and in 178/178 both ways. So showing all three in order
  cannot lose a hit the old single-tier search returned.
- **`NEAR`'s distance unit is characters, not tokens** — undocumented upstream, true only because the
  trigram tokenizer emits one token per character position. This project measured it rather than
  trusting the documentation.
- **The `sources` axis — `said | ran | both`**, shipped hours before this map. `said` remains the
  default for every caller written before 2026-09-16. `tool_result` and `thinking` remain
  **permanently unindexed** — 67.0% and 16.4% of the archive's characters, **83.4% together** — and
  every result carries that disclosure.

**(b) `findQuery` / `findInDocument`** (`lib/fold.js`) — the in-document find panel, a pure
JavaScript scan over the rendered document's prose spans, which **never touches SQLite**. It shares
the folding matcher with (a) and is otherwise an unrelated pipeline. A documenter must not describe
the two as one search with two front ends.

---

## 4. The hooks

`hooks/hooks.json` declares **18 event types**, counted directly — confirming the inventory's figure:
SessionStart, SubagentStart, PreToolUse, SessionEnd, PreCompact, PostCompact, PostToolUse,
PostToolUseFailure, FileChanged, InstructionsLoaded, ConfigChange, PermissionDenied, SubagentStop,
Stop, Setup, TaskCreated, TaskCompleted, UserPromptExpansion.

`src/hooks/` holds **23 `.ts` files** by two independent globs. The inventory says 24. **Flagged, not
asserted** — either a miscount there or a file removed since; a nested subdirectory was not
exhaustively checked.

**`INV-hooks-fail-open` is enforced structurally, not by convention.** Every hook is a standalone
process guarded by `isMainEntry`, wrapped so a thrown error becomes empty output and exit 0.
`turn-refresh-worker.ts` is the cleanest illustration: spawned detached, `stdio: 'ignore'`,
`unref()`'d from `post-tool-use.ts:405-410`, and its header states plainly that its failure mode is
silence — because the hook that spawned it exited long ago, and `Stop` runs the identical sequence as
a backstop regardless.

**The turn-refresh mechanism**, new since chapter 2 froze: `PostToolUse` calls `refreshSoonCheck`
(`src/core/turn-refresh-soon.ts`) on every tool call — one `statSync`, about 0.007 ms on a 133 MB
transcript, against a recorded `(bytes, mtime)` pair — and when due spawns the worker, which runs the
**same three-step sequence** `Stop` runs (scan, then mirror, then the anchor pass, in that order,
because the pass reads the index and the index is current only after the scan). The owner's words
motivating the widening are quoted in the source: *"you should flush in general not only because of a
mark was added."* Measured firing rate: **85 times in one real turn**.

---

## 5. The palette and the drawn language

**A naming collision the task brief itself fell into, and the other specialists must not.**
`src/ui/public/lib/palette-defs.js` is **not** a colour or hue file. It is the **command catalogue**
for the Composer screen — every CLI command offerable as a form, with `runnable`, `boundary` and
`flagsNotOffered` metadata, gated by `test/ui/palette-lib.test.ts` against the real CLI parser. The
screen's own label is **Composer** in both languages. Grouping it with hue and icon subject matter is
an artefact of the shared English word, not a code relationship.

**The actual meaning-hue budget** is a `styles.css` custom-property block — `--gold`, `--ok`,
`--carry`, `--crit`, `--warn`, around line 89 — governed by
`DEC-the-meaning-hue-budget-is-five-gold-ok-carry-crit-and-warn` (owner ruling 2026-08-25, correcting
an earlier "four hues" belief after a reconciliation found `--warn` already live in eight places).
`styles.css` carries **hundreds** of comment references to this budget, arguing case by case why a
surface may or may not spend a sixth hue — two role hues (`--role-nav 177°`, `--role-content 270°`)
are kept 33° clear of every budgeted hue precisely *because* they are not meaning-hues and must not be
mistaken for one. Enforced by browser gates, not by any type system: a documenter must render it, not
describe it.

**Mermaid diagrams are generated, not hand-drawn.** `scripts/gen-diagrams.ts` asks the *same*
vendored `markdown-it` parser the browser uses which fences in `README.md` and `docs/README.he.md` are
Mermaid, renders each through real Chromium (Mermaid has no Node renderer), and writes
content-addressed SVGs to `src/ui/public/diagrams/` — **10 files today** — plus a generated lookup
module. `mermaid` itself is a devDependency that never ships: costed at 3.57 MB and 96% of the change
if vendored for in-browser rendering, and rejected to protect the zero-runtime-dependency constraint.

---

## The four flagged claims, confirmed or overturned

1. **Chapter 4, "no CLI command reaches the archive" — OVERTURNED.** `mycontext conversation search`
   (`conversation.ts:1537`) calls `searchArchiveTiered`, which is FTS5-backed. True on 2026-09-12;
   false today.
2. **Chapter 10, "fifteen rule entries" — OVERTURNED.** A direct glob of `src/rules/entries/*.md`
   returns **16**.
3. **`app.js` "twenty-one screens" against a twenty-entry array — CONFIRMED EXACTLY.** The comment at
   `app.js:289` says "ALL TWENTY-ONE SCREENS" and a second at line 283 says "TWENTY-ONE OF
   TWENTY-ONE". The `NAV` array at `app.js:303-308` holds 4 + 6 + 7 + 3 = **20**. Which screen the
   comment believes exists could not be determined; it looks like a stale comment rather than a
   missing screen.
4. **`watchedDocs` — CONFIRMED.** Declared at `config.ts:792`; `src/doctor/checks.ts:613-649` is
   `checkWatchedDocsServable`, emitting `watched_doc_unserved` (line 624, `warn`) and
   `watched_doc_coverage` (line 639, `info`, only when the bounded repo walk truncates). A third
   finding `watched_docs_no_match` is referenced in a comment at line 598 but **does not exist in
   code** — planned, not shipped. And the key has a **second consumer** beside the doc-serving route:
   the capture nudge in `post-tool-use.ts:80-139`. Any chapter on this key must cover both or it will
   under-describe the blast radius.

---

## What surprised the mapper

- The inventory written the same morning already carries a stale count: `app.js` is 8,592 lines, not
  ≈5,200. The project's own named failure mode recurring inside the artefact meant to guard against
  it, within hours.
- `lane.js`'s header contained a wrong claim about its own dependency surface that was acted on for a
  week, and the file now documents its own correction in place.
- The "palette" collision above — the dispatching brief itself made the mistake.

## What it could not resolve

- Whether a 24th file exists under `src/hooks/` (23 found by two globs; the inventory says 24).
- Which screen the `app.js` "twenty-one" comment believes exists beyond the 20 in `NAV`.
- `harness/`, `.superpowers/`, and whether `.my_context/.rules/delivered.jsonl` or `migration.json`
  are covered anywhere — out of scope for the five priority areas and not reached.
