# The sixteen capability diagrams, verified — 2026-09-17

`TASK-the-documents-explain-the-mechanisms-in-prose-and-draw`

The prose of these chapters has been verified twice (`reports/2026-09-16-capabilities-verified.md`,
38 false of 214; `reports/2026-09-17-capabilities-verified-again.md`, 21 false of 282). **The
sixteen Mermaid diagrams added at `b6949abc` had never been checked by anyone.** This is that pass.

**171 diagram claims checked against the working tree. 28 are false.**
(155 content claims — every node label, every edge label, every arrow direction — plus one
parse check per fence.)

Read-only throughout: no `git` command that writes, nothing under `src/rules/entries/` touched,
`npm test` never run, port 58888 never bound. A scratch directory `.tmp-verify/` held the parse
harness and was deleted; the tree is as it was found.

---

## Verdict by diagram

| # | diagram | checked | false | verdict |
|---|---|---|---|---|
| 1 | `00-index.md:25` — the three-step pipeline (README) | 9 | **2** | the spine is drawn through a store selection does not read |
| 2 | `01:29` — the forgetting loop (README) | 5 | 0 | **clean** |
| 3 | `01:191` — the item lifecycle (README) | 9 | **1** | one of `review discard`'s two acts is missing |
| 4 | `02:68` — the tiers (README) | 9 | **3** | predates the JIT banding and the continuity tier |
| 5 | `02:149` — the doors as a lifecycle | 13 | **2** | a subagent's tier list is wrong; `fork` dropped |
| 6 | `02:355` — budget packing | 10 | **3** | sort order inverted; the spare-band path is unreachable |
| 7 | `03:250` — the creation gates | 14 | **1** | strongest of the twelve new ones; one precondition invented |
| 8 | `04:107` — the archive pipeline | 10 | **1** | a branch attributed to a function that cannot emit it |
| 9 | `05:355` — the anchor ownership boundary | 11 | **1** | **the correction it made to its brief is right**; one route mis-spelled |
| 10 | `06:39` — the retrieval guarantee | 12 | **3** | two modes spliced into one spine |
| 11 | `07:68` — restore as a sequence | 11 | **1** | **DOES NOT PARSE** |
| 12 | `07:285` — handover as a sequence | 6 | 0 | **clean — the best diagram in the set** |
| 13 | `09:13` — the two surfaces (README) | 7 | 0 | **clean**, but carries three moving counts |
| 14 | `14:37` — the three-tier fan-out | 7 | **2** | off by two characters, and a collapse branch missing |
| 15 | `15:30` — the viewer's memory window | 11 | **4** | the one that needed new prose, and the prose is wrong three ways |
| 16 | `16:63` — needs resolution | 11 | **4** | a dead-end branch that is not a dead end |

---

## 1. Does every fence parse? No. Fifteen of sixteen.

The author claimed all sixteen parse. Checked rather than assumed — driven through this
repository's own vendored **mermaid 11.17.2** (`node_modules/mermaid/dist/mermaid.min.js`) in a
real Chromium page via the installed Playwright, calling `mermaid.parse()` on each fence:

```
15 of 16 PARSE
FAILS   docs/capabilities/07-restore-and-handover.md:68
        Parse error on line 10:
        ...--approve &lt;key&gt; — owner only, no -
        -----------------------^
```

**The offending line is `07-restore-and-handover.md:78`:**

```
  P->>CLI: --approve &lt;key&gt; — owner only, no --agent flag
```

**The cause, isolated by bisection:** Mermaid's `sequenceDiagram` lexer rejects a bare `&` in
message text. HTML entities are required in `flowchart` node labels and are a **parse error** in a
sequence diagram — where the raw characters are fine. Confirmed both ways against 11.17.2:

| message text | result |
|---|---|
| `a &lt;key&gt; done` | FAILS |
| `a &lt;key done` | FAILS |
| `a key&gt; done` | FAILS |
| `a &amp; done` | FAILS |
| `a <key> done` | **PARSES** |
| `--approve <key> — owner only, no --agent flag` (full line, fixed) | **PARSES** |

`--`, `&&` and an em dash in message text are all fine — they were tested and are not the cause.
The sibling diagram at `07:285`, which uses no entities, parses.

**True value — the one-character-class fix:**

```
  P->>CLI: --approve <key> — owner only, no --agent flag
```

As shipped, this diagram renders as an error box. Nothing in it reaches a reader.

---

## 2. Order — the shape itself is the claim

### 2.1 `00-index.md:25` — selection does not read `.index.db`

The index diagram is the spine of the whole reference ("Every chapter in this reference is a deeper
reading of one stage of the same pipeline"). It draws:

```
MD -->|"rebuild"| DB[(".index.db" derived cache)]
DB --> SEL["selection"]
```

`src/core/inject.ts:372` says the opposite, in capitals, at the top of the injection path:

> `// 1. THE CORPUS, FROM MARKDOWN, PARSED ONCE. No database on the injection-critical path:`
> `// select is pure over Item[] (select.ts, INV-select-is-pure) and loadLayer needs no database.`

`buildInjectionResult` calls `loadLayer(root, layer, errors, config)` (`:390`, `:395`), builds
`Item[]` (`:397`), and hands that to `select` (`:705`). The index is never read. The `rebuild` into
`.index.db` happens **afterwards** (`:893`), as a best-effort side task wrapped in `try`, and is
**skipped entirely on a subagent** (`:883`, `if (!subagent)`).

**True value:** `.my_context/items/` → `loadLayer` → `Item[]` → `select` → hooks → context, with
`.index.db` refreshed off to one side and read by nothing on this path. The arrow `DB --> SEL` is
the wrong dependency and the wrong order.

### 2.2 `00-index.md:25` — "before a compaction" does not reach Claude's context

The same diagram names three hooks — `session start · before a file · before a compaction` — and
draws all three into `CX["Claude's context"]`. `PreCompact` cannot deliver text to the model at
all. `src/hooks/io.ts:766`:

```ts
export type HookEventName = 'PreToolUse' | 'PostToolUse' | 'SubagentStart' | 'Stop';
```

`PreCompact` has no `hookSpecificOutput` variant, and `pre-compact.ts:307` says it itself: *"A
PreCompact snapshot injects nothing"*. **Two other diagrams in this same set say so** — `02:149`
("NOT a corpus injection site") and `07:285` ("cannot deliver text to the model at all"). This one
inherited the README's age.

**True value:** the corpus reaches a context window at `SessionStart`, `SubagentStart` and
`PreToolUse`. `PreCompact` writes a snapshot that the *next* `SessionStart(source: compact)`
delivers.

### 2.3 `02:355` — the sort is by governance, not by severity

The candidate node reads *"sorted by priority — **severity first**"*. `byPriority`
(`select.ts:825`) sorts `governs` first:

```ts
const governsDiff = Number(governs(b)) - Number(governs(a));
if (governsDiff !== 0) return governsDiff;
const severityDiff = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
```

and its header says so in bold: *"**Governance ranks ABOVE severity, not below it.** Every
governing item the corpus's own measurement found spilling was `severity: soft` — ranking
governance below severity would have left each of them losing to a `hard` `pattern` or
`known_issue` exactly as before."*

**True value:** governing/open-work first, then `hard` severity, then layer, then id.
The diagram inverts the two keys that were deliberately ordered.

### 2.4 `02:355` — the spare-band path is unreachable, and the node says so

The diagram routes an over-budget candidate into the spare band:

```
FIT -->|"over budget — skipped, not a hard stop"| GOV{"governs(item)?"}
GOV -->|"yes"| SPARE{"pinned tier only, and only when every always:true item already fit"}
SPARE -->|"yes"| FULL
```

Both halves of that path are impossible.

- The pinned tier's candidates are `fresh.filter((i) => i.always)` (`select.ts:1563`); the spare
  band is `fresh.filter((i) => !i.always && governs(i))` (`select.ts:1638`). **The two sets are
  disjoint by construction** — an over-budget pinned candidate is `always: true` and can never
  enter a band defined as `!always`.
- The band is not built at all unless `pinnedCost <= config.budgets.pinned` — i.e. unless *nothing*
  spilled. The source: *"the band is not built at all unless the WHOLE `always` candidate set
  fits… when it cannot be honoured in full, nothing else is offered its tier."*

So the only way to reach `SPARE` in the diagram is a spill, and `SPARE`'s own text says it happens
only when there was no spill. **The diagram contradicts itself along its own edge.**

**True value:** two bands are handed to one `fitToBudget` call
(`fitToBudget([candidates, spare], budgets.pinned, 'pinned', 1)`). Band 0 is every `always` item;
band 1 exists only when band 0 priced in full fits, and holds governing items that were never
pinned candidates. A spilled pin is not rescued; it falls to the index tier.

### 2.5 `06:39` — two retrieval modes spliced into one spine

The diagram draws `queryFromPassage → matchSubjects → removeNoise → MISSION`. There are **four
modes** (`RetrievalMode = 'from-selection' | 'free-text' | 'list-subjects' | 'list-anchors'`,
`retrieval/mission.ts:50`) and those two functions belong to different ones:

- `from-selection` / `free-text` (`read-model-retrieval.ts:832-852`):
  `readVocabulary` → `queryFromPassage(passage, vocabulary.terms)` → **`pointersFor`** →
  `withoutNoise` → `missionText`. `matchSubjects` is not called.
- `list-subjects` (`subjectsFor`, `:675-690`): `readVocabulary` → **`matchSubjects(vocabulary,
  spans)`** → `pointersFor` → `withoutNoise`. `queryFromPassage` is not called.

The vocabulary is an **input** to `queryFromPassage`, read before it, not a stage after it.

**True value:** the passage path's matcher is `pointersFor(index, files, [...query.names,
...query.terms], scope)`. `matchSubjects` is a sibling entry point for *"I am lost"*, never
downstream of the passage query.

### 2.6 `04:107` — `classifyTurn` cannot emit `'ran'`

The diagram draws three edges out of `CL{"classifyTurn per record"}`, one of them
`tool_use = 'ran' (since 2026-09-16)`.

```ts
// conversation-index.ts:1658
export function classifyTurn(type, content): 'prompt' | 'answer' | 'machinery'
```

`'ran'` is produced by `toolProseOf` in `conversation-search.ts`. `conversation-index.ts:717` is
explicit: *"**WHAT WAS SAID** — the two kinds `classifyTurn` produces"* (`SAID_KINDS = ['prompt',
'answer']`), with `'ran'` added beside them as a third value, *"a THIRD VALUE rather than a
widening of the other two"*.

**True value:** `classifyTurn` sorts records into `prompt | answer | machinery`; a separate pass
(`toolProseOf`) renders a `tool_use` block as a `'ran'` span. The same source also records
*"**ONE RECORD CAN PRODUCE TWO SPANS**"* — an assistant record that both speaks and calls a tool —
which a single-branch decision node cannot express at all.

---

## 3. Existence — nodes that name something that is not there

### 3.1 `05:355` — `POST /anchors/mark` is not a route

The diagram's Path 3 reads *"web UI POST /anchors/mark"*. There is no such route.
`ui/anchor-write.ts:511`:

```ts
registerRoute('POST', '/api/conversations/anchors/mark', …)
```

The chapter's own prose, **eighteen lines above the diagram** (`05-anchors.md:341`), spells it
correctly: `POST /api/conversations/anchors/mark`.

**True value:** `POST /api/conversations/anchors/mark` — with `/relabel`, `/drop` and `/sweep`
beside it.

### 3.2 `06:39` — `STAGE` is not the only writer on this path

The node reads *"the one function on this whole path that writes to disk"*. On the path this
diagram draws, at least two functions upstream of it write to disk:

- `retrieval/mission.ts:383` `writeMission` → `mkdirSync` + `writeFileSync` — this is the very
  `MISSION` node two boxes earlier, which the diagram itself labels *"a MISSION file"*.
- `retrieval/result.ts:294` `writeResult` → `writeFileSync` — the `RESULT` node.

The chapter's prose scopes the claim correctly (`06-retrieval.md:392`): *"only `return-stage.ts`
contains the one function on this entire path that writes to disk"* — where "this path" is the
**return** path, `return.ts` versus `return-stage.ts`. The diagram lifted a scoped sentence onto a
node in a wider pipeline and turned it into a false absolute.

**True value:** `return-stage.ts` holds the only writer on the *return* half. The mission and the
result are both files on disk, written earlier by design.

### 3.3 `03:250` — the `--supersedes` precondition was invented

The edge label reads *"--supersedes, in contradiction scope and governing, and **the id was raised
as a candidate**"*. The narrow test was tried and deliberately rejected.
`core/overlap.ts:606`, in bold in the source:

> **The test is "does this id name an item at all", not the narrower "was it raised on THIS call",
> and the difference was measured rather than chosen.** The narrow test refuses three legitimate
> things…

`contradictionGate` builds `eligible` as *"Every id that EXISTS"* (`:468`) and `stray` as
`[...disposed].filter((id) => !eligible.has(id))` (`:506`). A `--supersedes` naming a real item
that was not raised is accepted.

**True value:** at the gate, `--supersedes <id>` requires only that the id names an item in this
corpus; `unknownDispositionRefusal` catches a typo and nothing else. The retirement is gated
*separately and later* — `mutate.ts:1215`, `draft.supersedes !== null && settled.some((c) => c.id
=== draft.supersedes)` — so a `--supersedes` naming a real but un-raised item lands the write and
retires nothing.

### 3.4 `15:30` — the outline does carry body text

The outline node reads *"one lightweight entry per node — kind, byte offset, char count. **No body
text in it.**"* Every outline node carries a 140-character peek of the text:

```ts
// ui/read-model-conversation-document.ts:185, :1797
export const PEEK_CHARS = 140;
const peek = oneLine(shape.read.said, PEEK_CHARS);
if (peek !== '') node.p = peek;
```

and it is load-bearing, not incidental: `lib/transcript-scroll.js` `matchesNode` searches exactly
that field, which is what lets the reader's filter *"search the WHOLE SESSION"* with no page.
`node.p` is also carried for a `deed` (what the call asked, `:1820`).

**True value:** an outline node is `{n, k, w, t, c, f, s, o}` plus an optional **`p` — the first
140 characters of what was said, or what a command asked** — plus `x` (tools), `h`, `y`.

### 3.5 `15:30` — the outline is not fetched once

The edge into the outline reads *"fetched once, at mount"*. A live document polls `/tip` once a
second and, when the transcript has grown, fetches a **resumed** outline and appends to the same
array: `screens/conversations.js:11518` and `:11623`, `for (const node of fresh) nodes.push(node)`.
The cost of that is itself a measured row in the source: *"the resumed outline a real append
costs 2.722 ms, 512 bytes"* (`:4159`).

The chapter's prose bullet is precise where the diagram is not — it says *"built once, at mount,
and never rebuilt **on scroll**"*. The diagram dropped the qualifier that made it true.

**True value:** the outline is fetched once at mount and **extended** by the follow poll; it is
never rebuilt, and never re-fetched whole.

### 3.6 `15:30` — a row that leaves the window is not always removed

`ROWS -->|"left the window"| DROP["removed from the DOM"]`. `conversations.js:7543`:

```js
// A row the reader has MARKED is not evicted for scrolling past it — see `held`.
if (gone && held.has(nodeIndex)) continue;
```

The sibling branch is not absolute either: a row still *inside* the window **is** torn down and
rebuilt when it was a placeholder whose body has since arrived —
`if (!gone && !(waiting.has(nodeIndex) && bodies.has(nodeIndex))) continue;` (`:7540`) falls
through to `node.remove()`.

**True value:** a row leaves the DOM when it leaves the window **unless it is held**; a row inside
the window is left alone **unless it is a placeholder whose text has arrived**.

---

## 4. Completeness — branches that matter, silently absent

### 4.1 `02:149` — a subagent gets the continuity tier

The diagram: `SubagentStart … injects: pinned · index **only**`. The subagent branch selects as a
session start (`inject.ts:708`, `subagent ? 'session-start'`), and `tiersRun`
(`select.ts:1486-1494`) pushes `pinned`, **`continuity`** and `index` for that event. The carry
resolves for a subagent too — `sessionCarried = !manual && (subagent || !compacting)`
(`inject.ts:694`).

**Proved on this run, not only read.** The `SubagentStart` block delivered to this verifying lane
contains, in full:

```
### REF-v2-handover-read-before-discussing-the-web-ui · reference · v2.0 handover — …
```

`REF-…` is the corpus's only `continuity: true` item and is a `reference` — a rationale-tier
category that **cannot** reach the pinned tier (the continuity tier *"draws from `eligible`, not
from `injectable`"*, `select.ts:1657`). The same block carries the cross-session carry:
*"120 index line(s) carried from session `595db3b1`"*.

**True value:** `SubagentStart` injects **pinned · continuity · index**, plus the cross-session
carry resolved from the parent by name (`resolveSubagentCarry`), behind a `SUBAGENT_PREAMBLE`.
The chapter's prose table at `02-injection.md:41` makes the same error and should move with it.

### 4.2 `02:149` — `fork` is missing

The node reads `SessionStart / startup · resume · clear`, plus a separate `source: compact` node —
four of five. `hooks/hooks.json` registers the matcher `startup|clear|resume|compact|**fork**`, and
the chapter's **own table 27 lines above the diagram** (`02-injection.md:122`) lists all five.
`session-start.ts:188` reads `fork` as a real source.

### 4.3 `02:68` — the two JIT branches are not equal, and continuity is absent

The tiers diagram (reused from README §7) routes *"no — unrestricted"* and *"yes, and it matches"*
into the same `JIT` box. Distinguishing exactly those two is what
`DEC-the-jit-tier-offers-path-scoped-items-first-in-two-bands` exists for
(`select.ts:1749-1752`): band 1 is `candidates.filter((i) => i.scope.length > 0)`, band 2 is the
rest, and band 1 gets first refusal. The source records the failure that forced it:

> Measured on the real corpus (619 of 621 items unscoped): the one item scoped to that path
> SPILLED while 27 items about nothing in particular were delivered.

The same diagram's compaction branch draws `restored · pinned · index` and omits **continuity**,
which `02:149` eighty lines later lists for both session start and compact. And an unscoped item
does not reach JIT at all under `scopePolicy: 'inert'` (`select.ts:1740`).

Finally, *"injected in full, once per context window"*: the dedupe is the **per-session** seen file
(`core/seen-file.ts:11`, *"The per-session seen file"*; `select.ts:1670`, `seen` answers *"has this
SESSION ever been shown this item"*), keyed on `sessionId` and **not reset by a compaction** — the
restore tier is what puts the item back.

### 4.4 `01:191` — `review discard` has two acts, and one deletes

`draft --> deprecated: mycontext review discard` is half the command.
`cli/commands/review.ts:1106` branches on `declineRefusal(item)`:

- `origin: 'review'` draft, project layer, inside the draft region → **the file is DELETED**.
  The surface says so: *"This draft was written by the review pass and has never governed
  anything, so it is DELETED rather than deprecated"* (`:1115`), and `declineDraft` records the
  claim in a decline ledger.
- anything else → `updateItem(ctx, { id, status: 'deprecated', origin: 'human' })` (`:1153`).

The chapter itself names `review/decline.ts` 64 lines below the diagram (`01:255`).

**True value:** the lifecycle has a terminal transition the diagram has no node for —
`draft → deleted`, for the review pass's own proposals. `active → deprecated` is also reachable
and undrawn (`mycontext edit --status deprecated`, `mutate.ts:1952`).

### 4.5 `16:63` — `needs_malformed` is not a dead end, and two exits are missing

The diagram's `MALFORMED` node has no outgoing edge, which reads as *"a doctor finding, and
dispatchability is unaffected."* In `readyReport` (`needs.ts:513`) it is the **first** held reason:

```ts
if (reading.malformed.length > 0) held.push({ ...row, reason: 'malformed' });
else if (reading.pending.length > 0) held.push({ ...row, reason: 'pending' });
else if (reading.unresolved.length > 0) held.push({ ...row, reason: 'unresolved' });
else if (state === BLOCKED_STATE && reading.satisfied.length === 0) {
  held.push({ ...row, reason: 'blocked_without_needs' });
} else ready.push(row);
```

Three things the diagram has no node for:

1. **`malformed` → `WAITING`.** An unreadable `needs` entry holds the task, checked before
   anything else.
2. **`blocked_without_needs`** — `state: blocked` naming nothing satisfied is held with no `needs`
   reference involved at all. `HELD_REASON` (`cli/commands/ready.ts:80`) has four entries, not three.
3. **The two exclusions that run before `needs` is read**: `state === DONE_STATE` and
   `item.status === 'deprecated'` (`needs.ts:492`, `:509`). The second was a measured defect —
   *"six deprecated tasks were being offered as ready work on this corpus"*, fixed 2026-09-06.

### 4.6 `16:63` — the caption disowns the node the diagram draws

Immediately below the diagram (`16-the-board.md:78`):

> **`held`** (`ready --held`) is a separate, sibling classification this diagram does not draw: it
> names a task blocked by something other than an unresolved `needs` reference

Both halves are false. `readyReport` returns one `held` array, and three of its four reasons
(`malformed`, `pending`, `unresolved`) **are** `needs`-reference reasons. The diagram's `WAITING`
node *is* the held table. And the chapter's own pasted live output settles it — all four held rows
read `held by: a blocker has not landed`, which is `HELD_REASON.pending`, i.e. *"a `needs`
reference resolves to a task that is not done"* — exactly the diagram's `PEND → AGG → WAITING`
path it claims not to draw.

### 4.7 `14:37` — one tier, not three, on a one-word query

The fan-out is drawn unconditionally. `conversation-search.ts:1224`:

```ts
.slice(0, parsed.terms.length < 2 ? 1 : SEARCH_TIERS.length);
```

*"Fewer than two matchable terms and the three collapse into one."*

### 4.8 `07:68` — the refusal branch is missing

The sequence draws the re-read (*"then re-reads it off disk to prove it survived"*) and then only
its success (*"SAFE TO CLEAR"*). The whole point of the re-read is that it can answer the other
way: `cli/commands/restore.ts:411`, `NOT SAFE TO CLEAR — ${result.reason}`, with its own string in
both tables (`strings/en.js:509`, `:517`).

### 4.9 `05:355` — the UI sweep is a fourth entry point

Path 2 names only `conversation rebuild`. `ui/anchor-write.ts:491` starts the same pass from
`POST /api/conversations/anchors/sweep`. The chapter's prose is equally silent, so this is a
chapter-wide gap rather than a diagram-introduced one.

---

## 5. A count that moves, and one that is off by two

### 5.1 `14:37` — `NEAR(…, 30)` is not "within 30 chars"

The node reads *"NEAR(…, 30) — within 30 chars"*. `conversation-search.ts:874`, in bold:

> **LAW: `NEAR(a b, N)` matches when at most `N-2` characters separate the two substrings** — held
> on every N tried and pinned at both boundaries in `test/core/search-grammar.test.ts`.

**True value: within 28 characters.** The constant is 30; the distance it admits is 28. The
chapter's prose repeats the error at `14:29`, and both prose passes missed it.

### 5.2 `09:13` — three volatile counts in one diagram

The brief was explicit that no diagram should carry a count that moves. This one, reused verbatim
from README §5, carries three. All three are correct **today**:

| claim | checked against | reading |
|---|---|---|
| 91 slash commands | `ls commands/*.md` | **91** ✓ |
| 49 CLI commands | `docs/cli-ui-coverage.md:7` | **49** ✓ |
| twenty-eight MCP tools | `grep -c "^    name: '" src/mcp/tools.ts` | **28** ✓ |

Not counted false — the chapter's caption under it names where each figure comes from and flags
the slash count as belonging to chapter 12 — but they are three figures that will be wrong without
warning, inside the one drawing a reader trusts fastest.

---

## 6. The two claims the brief singled out

### 6.1 Chapter 5's anchors — **the lane was right, and the brief it corrected was wrong**

The dispatching brief called it *"a grammar proposes, a person disposes"*. It is not. Verified in
all three files:

- **Direct write, both lanes.** `anchor-pass.ts:1027` and `:1299` write `origin: 'automatic'`
  rows through `markAnchor` with no queue and no proposal. `ui/anchor-write.ts:338` and `:405`
  write `origin: 'owner'` rows the same way.
- **Asymmetric protection, in four places.** `anchor-pass.ts:940` `if (row.origin !== 'automatic')
  continue;`; `:1250` `if (standing?.origin === 'owner') return;`; `:1278` `if (held?.origin ===
  'owner') continue;`; `:1384` `if (row.origin !== 'automatic' || row.kind !== 'report') continue;`.
  The header at `:917` states it: *"an anchor whose row says `origin: 'owner'` is not read, not
  re-labelled and not [dropped]"*.
- **The only legal route.** `markAnchor`/`unmarkAnchor` (`core/anchors.ts:207`, `:286`) both go
  through `withAnchorWrite` (`anchor-file.ts:352`), which **throws** on a transaction it does not
  recognise, so `index.putAnchor` cannot be reached past it.
- **One transaction.** `anchorTransaction` (`anchor-file.ts:325`) reconciles, runs the writes, and
  renames `.anchors.jsonl` (`ANCHOR_FILE_NAME`, `:108`) into place **before** the COMMIT.
- **Kinds.** `AUTOMATIC_ANCHOR_KINDS = ['table', 'ruling', 'report']` (`anchors.ts:65`);
  `OWNER_ANCHOR_KINDS` is a disjoint six.

One soft note: *"both, or neither"* is the transactional intent, and the source discloses a
narrower truth — *"a kill between the two leaves the file AHEAD of the table — the direction that
costs nothing, because the table is rebuilt from the file"*. Not counted false; the direction is
safe and deliberate. A second: *"written directly on a grammar match"* is loose for `report`, which
is found **structurally** from `subagents` and the prose index — *"Nothing about it can fire on a
turn that merely names one, because no text is consulted to decide it"* (`anchors.ts:60`).

### 6.2 Chapter 15's constants — they exist, and the chapter does not cite them

Both are real and both values are right:

```js
// src/ui/public/screens/conversations.js:4094, :4097
const OVERSCAN = 6;
/** Node bodies one fetch asks for. The endpoint caps at 80. */
const FETCH_PAGE = 24;
```

`OVERSCAN` is used at `:7513-7514`; `FETCH_PAGE` at `:6935` and `:10938`.

**But chapter 15 never cites either figure.** Grepped: neither `OVERSCAN` nor `FETCH_PAGE` nor
`6` nor `24` appears in that role anywhere in the file. The diagram says *"a few rows of buffer on
each side"* and *"one page of body text"*. That is the **right** call under the no-moving-figures
instruction — but it is not what the commit message reported about itself, and the three real
errors in that same diagram (§3.4, §3.5, §3.6) are what the new prose actually needed checking for.

---

## 7. What is clean

- **`07:285`, the handover sequence — 6 of 6, the strongest diagram in the set.** Every claim
  lands: `PreCompact` *"cannot deliver text to the model at all (no `hookSpecificOutput` for this
  event)"* is exactly `io.ts:766`'s union; `PostCompact` bookkeeping-only is `post-compact.ts:72`;
  *"reads the marked section (or the head), capped to `budgetTokens`"* is `handover.ts:117` and
  `:226`, where `read.source === 'marker' ? 'the marked section' : 'the head'` is written in those
  words.
- **`01:29`, the forgetting loop — 5 of 5**, including `linkStyle 3,4`, which indexes exactly the
  two dotted edges.
- **`09:13`, the two surfaces — 7 of 7** on structure. `add-*`/`search`/`link`/`LoadMyContext`
  route to MCP tools and `list-*`/`review`/`status`/`edit`/`query` shell out to
  `src/cli/index.ts`, checked file by file.
- **`03:250`, the creation gates — 13 of 14**, and it is the most detailed drawing in the set. The
  five authored surfaces are `summary-gate.ts:80`'s own list; the depth-is-order claim is right
  (the summary gate is imported only by the five surfaces and *"is deliberately NOT called from
  `updateItem` or from `createItem`"*); `carryVerdicts`, `summaryAtCreateRefusal`,
  `--summary-omitted`, `--summary-unchanged`, `--distinct`, `--supersedes`, and *"always/hard
  cleared"* (`standDownFields`, `select.ts:985`) all resolve exactly.
- **The `validated` disclosure is present and true.** `types.ts:92` declares five statuses; the
  chapter says so at `01:210` and says why — *"nothing in this chapter or chapter 3 traces a
  command that produces it, so drawing a transition into it here would be inventing one."* That is
  the honest answer.

---

## 8. The five README diagrams, on the question they were reused under

The commit's argument for reuse — *"two drawings of one mechanism is this project's defect wearing
a picture"* — is right. But four of the five carry the README's age, and the two that matter most
carry it in the spine:

| README diagram | still describes the code? |
|---|---|
| `00:25` the pipeline | **no** — §2.1 and §2.2, two false claims in six edges |
| `01:29` the forgetting loop | yes |
| `01:191` the lifecycle | **partly** — §4.4 |
| `02:68` the tiers | **no** — §4.3, three counts of age (JIT banding, continuity, dedupe scope) |
| `09:13` the two surfaces | yes, with three moving counts (§5.2) |

**Reuse carried the drift with the drawing.** Correcting these five means correcting `README.md`
in the same act, or the second copy is back.

---

## Method

- Every claim resolved by reading the symbol out of `src/`, never out of the prose beside it.
- Fence parsing driven through the repository's own `mermaid@11.17.2` in headless Chromium via the
  installed Playwright; the failure bisected to a single character class and the fix re-parsed.
- §4.1 additionally settled **empirically**, against the `SubagentStart` block delivered to this
  lane at dispatch.
- Read-only: no writing `git` command, nothing under `src/rules/entries/` touched, `npm test` never
  run, port 58888 never bound. `.tmp-verify/` was created for the parse harness and deleted.
