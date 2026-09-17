# `docs/capabilities/` re-verified after the repair — 2026-09-17

`TASK-the-capability-repair-was-committed-unverified-and-last-time`

Commit `471b13b3` repaired eleven capability chapters against
`reports/2026-09-17-capability-diagrams-verified.md`'s list of 28 false diagram claims, and its own
message says the repair is not verified. This is that verification. It did not check the 28; it
checked the chapters.

Read-only throughout: no `git` command that writes, nothing under `src/rules/entries/` touched,
`npm test` never run, port 58888 never bound, no document changed. This report is the only write.

---

## 0. The one claim to settle first: `07-restore-and-handover.md:78` now parses

**It parses, it renders, and the bare `<key>` survives verbatim. The fence is genuinely fixed.**

Driven through this repository's own vendored **mermaid 11.17.2**
(`node_modules/mermaid/dist/mermaid.min.js`) in a real headless Chromium via the installed
Playwright, with the same `mermaid.initialize` configuration `scripts/gen-diagrams.ts` uses
(`theme: 'default'`, `securityLevel: 'strict'`), and with the fence extracted by the product's own
`mermaidBlocks` (`src/ui/public/lib/markdown.js:509`) rather than by a second scanner.

| fence | `mermaid.parse` | `mermaid.render` | re-serialised as XML | the label as drawn |
|---|---|---|---|---|
| `07:78` at `471b13b3~1` (`--approve &lt;key&gt;`) | **FAILS** | **FAILS** | — | nothing is drawn |
| `07:78` at HEAD (`--approve <key>`) | ok | ok | well-formed | `--approve <key> — owner only, no --agent flag` |

The pre-repair failure, reproduced rather than quoted:

```
Parse error on line 10:
...--approve &lt;key&gt; — owner only, no -
-----------------------^
Expecting '()', 'SOLID_OPEN_ARROW', 'DOTTED_OPEN_ARROW', …
```

Three things the grep could not tell you, and that this run did:

- **`<key>` is not stripped.** `securityLevel: 'strict'` is mermaid's own DOMPurify pass, and the
  rendered `<text>`/`<tspan>` content reads `--approve <key> — owner only, no --agent flag`
  character for character. The same holds for the `<reason>` in the branch the repair added:
  `"NOT SAFE TO CLEAR — <reason>"` draws intact.
- **The `alt` block the repair added parses as well as the line it replaced**, and both branch
  labels draw (`alt`, `[re-read matches what was written]`, `[re-read disagrees]`).
- **The drawing re-serialises to well-formed XML**, which is the check `gen-diagrams.ts` makes
  before it will write an SVG. So this fence would survive the generator if it were ever put under
  one.

**All sixteen capability fences were parsed the same way. All sixteen parse, render, and
re-serialise.** (`00:26`, `01:30`, `01:192`, `02:69`, `02:156`, `02:367`, `03:251`, `04:108`,
`05:356`, `06:40`, `07:69`, `07:290`, `09:14`, `14:48`, `15:31`, `16:64`.)

### One correction to the commit message's account of the defect

`471b13b3` says the fence "had been drawing an error box **on the page** for as long as it had
existed." On GitHub, which parses mermaid fences itself, that is right. **In this product's own
document screen it was never an error box — it was a `<pre>` of the raw mermaid source**, because
`diagramNode` falls back to the plain fence when the definition has no committed drawing
(`src/ui/public/lib/markdown.js:290-292`, reached from both renderer policies, `:441` and `:1151`),
and no capability fence but the README-shared ones has one. The defect was real on both surfaces;
the mechanism named is right for one of them. It matters because the product's own surface is the
one the root-cause recommendation in §7 is about.

---

## 1. The answer, in one paragraph

**The 28 are genuinely repaired — 25 at the point that was cited, one fixed into a new wrong value,
two left alone because their chapter was not touched. And the repair wrote 15 new false claims into
the text it added around them.** Every one of the 15 sits in a *new* node or a *new* paragraph
written to explain a corrected value; none is a surviving old error. That is the same shape
`0e0f9041` recorded when repairing 38 produced 21, and it is why this pass was worth running: the
prediction in `471b13b3`'s own commit message was correct about the mechanism and, if anything,
understated the count. Two further things the pass turned up that nobody was looking for: the
diagram the *previous* verifier scored **6 of 6 clean** carries a reversed edge (§5.5), and the
committed diagram map is **red at HEAD** in a way `471b13b3` caused (§7).

---

## 2. Verdict by chapter

| chapter | claims checked | fixed into a NEW wrong value | still wrong | verdict |
|---|---|---|---|---|
| `00-index.md` | 26 | **1** | 4 | **the spine's new label is a new absolute the code contradicts**; the provenance paragraph was not moved with the repair |
| `01-items-and-corpus.md` | 34 | **1** | 1 (+4 stale citations, +8 stale figures) | the lifecycle edges are right; `deleted` is drawn as a `status` the type does not have, and the chapter carries more stale figures than any other |
| `02-injection.md` | 78 | **4** | 5 (+14 stale citations) | most repaired chapter and **most new error**: three of the tiers diagram's three corrections each acquired a new fault |
| `03-creation-and-gates.md` | 50 | **2** | 2 (+7 stale citations) | the new branch reads the gate backwards — a `--supersedes` naming an un-raised item is normally **refused** |
| `04-conversation-archive.md` | 33 | **2** | 0 | the sibling redraw is right and the two edges into "not indexed" contradict the chapter's own §1 |
| `05-anchors.md` | 34 | **2** | **4** | Path 4 was added to the diagram and the section is **still titled "The three creation paths"** |
| `06-retrieval.md` | 40 | **1** | 1 | the best redraw in the set; one signature retyped short, one false absolute left standing |
| `07-restore-and-handover.md` | 24 | 0 | **1** | the repaired fence is correct — and the sibling diagram the prior pass scored **6 of 6 clean** has a reversed edge |
| `09-cli-and-mcp.md` | not repaired | — | 0 false | three moving counts, still undated, all three still correct today |
| `14-search-over-the-archive.md` | 14 | 0 | 0 | **clean** — including the causal sentence, which is the source's own |
| `15-document-and-lane-viewer.md` | 16 | **2** | 2 | the four corrected bullets over-reach twice |
| `16-the-board.md` | 18 | 0 | 2 | the redrawn priority chain is exact; the caption under it reaches for the wrong qualifier |
| `08`, `10`, `11`, `12`, `13` | swept, not diagram-verified | — | see §5, §6 | no diagrams; the repair touched none of them; they carry sixteen findings of their own. **`10-rule-store.md` is the model the rest should be held to** — every figure in it re-measured true and dated, and its two `rules verify` pastes are its only defect |

The "still wrong" column counts **substantive claims only**. Stale line citations are counted
separately in §5.13 (25 of them) and volatile figures in §6.1 (13 wrong, 10 undated) — folding
either into this column would let a chapter's real standing hide behind arithmetic.

**Denominator — 574 checks in all**, with some overlap between the figure sweep and the chapter
lanes: 367 content claims resolved against `src/`; 67 volatile figures re-measured; 45 pasted output
blocks found, 36 of them run and diffed whole; 61 distinct cited item ids; 16 fence
parse/render/serialise runs; 10 README fences checked against the committed diagram map; 8 colour
facts; and 10 corrected facts grepped across all seventeen chapters.

---

## 3. The 28, by outcome — and the outcome this sequencing exists to catch

**25 of the 28 are genuinely repaired at the point that was cited. One was fixed into a new wrong
value at the same point. Two were not addressed because their chapter was not touched. And the
repair introduced 15 new false claims in the text it wrote around them.**

That last number is the finding. It is not a tally of sloppiness — every one of the 15 sits in
*new* prose or a *new* node written to explain a corrected value, which is the same shape
`0e0f9041` recorded when fixing 38 produced 21.

| prior finding | point cited | outcome |
|---|---|---|
| §2.1 `00:25` `DB --> SEL` | repaired — `MD --> SEL` | **repaired, new wrong value in the same node** (§4.1) |
| §2.2 `00:25` "before a compaction" into context | repaired | repaired (imprecise: `Agent` is a `PreToolUse` matcher, not a file) |
| §2.3 `02:355` "severity first" | repaired — `governs()` then severity | repaired, verified at `select.ts:825-833` |
| §2.4 `02:355` spare band unreachable | redrawn | **repaired, new wrong value in the new gate node** (§4.5) |
| §2.5 `06:39` two modes spliced | repaired — siblings | repaired |
| §2.6 `04:107` `classifyTurn` emits `'ran'` | repaired — sibling `toolProseOf` | **repaired, two new wrong edges** (§4.9, §4.10) |
| §3.1 `05:355` `POST /anchors/mark` | repaired — `/api/conversations/anchors/mark` | repaired |
| §3.2 `06:39` "only writer on this whole path" | repaired — rescoped to the return half | repaired |
| §3.3 `03:250` `--supersedes` precondition | rewritten | **FIXED INTO A NEW WRONG VALUE** (§4.7) |
| §3.4 `15:30` "No body text in it" | repaired — peek named | **repaired, over-reached twice** (§4.14, §4.15) |
| §3.5 `15:30` "fetched once, at mount" | repaired — `REFILL` added | repaired |
| §3.6 `15:30` "left the window → removed" | repaired — `held` and `SWAP` branches | repaired, and the prose explaining `held` is wrong (§5.6) |
| §4.1 `02:149` subagent tier list | repaired in diagram **and** in the `02:43` table | repaired (citation range is wrong, §5.14) |
| §4.2 `02:149` `fork` missing | repaired | repaired |
| §4.3 `02:68` JIT bands / continuity / dedupe scope | all three addressed | **all three acquired a new fault** (§4.3, §4.4, §5.1) |
| §4.4 `01:191` `review discard` has two acts | repaired — `draft → deleted` drawn | **repaired, new state-count inconsistency** (§4.2) |
| §4.5 `16:63` `needs_malformed` dead end, two exits missing | repaired — full priority chain | repaired, verified at `needs.ts:491-517` |
| §4.6 `16:78` caption disowns the node | repaired | repaired, and the new caption's own clause is wrong (§5.8) |
| §4.7 `14:37` one tier on a one-word query | repaired | repaired |
| §4.8 `07:68` refusal branch missing | repaired — `alt` block | repaired, verified at `restore-stage.ts:459-487` |
| §4.9 `05:355` UI sweep is a fourth entry point | repaired — `P4` added | **repaired, new wrong attribution on the AUTO node** (§4.11, §4.12), **and the section is still headed "The three creation paths"** (§6.5 F1) |
| §5.1 `14:37` `NEAR(…, 30)` is 28 | repaired in the diagram **and** the numbered list | repaired |
| §5.2 `09:13` three moving counts | **not addressed** — chapter 09 untouched | still undated; all three still correct today (§6.1) |

---

## 4. Fixed into a NEW wrong value — 15

One row per claim, with the true value and how it was established. Every code reading is the symbol
itself, not the prose beside it.

**4.1 · `00-index.md:32` — `.index.db` "never by injection". FALSE, and it is the spine.**
The JIT injection site opens the database first. `src/hooks/pre-tool-use.ts:287-288`:
`store = Store.openReadOnlyChecked(ws.dbPath); candidates = store.activeInjectable(injectableTypes(ws.config));`
— Markdown is the `catch` fallback, disclosed as `fallbackReason`. Chapter 2's own table (`02:44`)
lists that hook as a corpus injection site. **True value:** `buildInjectionResult` — session start,
subagent start, compaction — never reads the index, which is what `inject.ts:372` supports; the
`PreToolUse` JIT path is database-first with a Markdown fallback. *How established:* read
`pre-tool-use.ts:275-320` directly.
**And this label exists in three places.** The five README-derived diagrams are byte-identical
across `README.md`, `docs/README.he.md` and the chapters — the shared-source discipline the prior
pass asked for is working — so the new error propagated with it: `README.md:468`,
`docs/README.he.md:500`, `docs/capabilities/00-index.md:32`. Repairing one repairs none.

**4.2 · `01-items-and-corpus.md:198`, `:201`, `:220` — `deleted` drawn as a lifecycle state.**
`src/core/types.ts:92` declares exactly five: `active | draft | superseded | deprecated | validated`.
`deleted` is not one; `declineDraft` (`src/review/decline.ts:113`) writes a decline ledger and
unlinks the file — no `status` is ever written. The diagram now shows five boxes while its own
caption twelve lines below tells the reader `validated` is "a fifth legal value of `status` this
diagram still omits." A reader counting states is told five and shown a different five.
**True value:** the transition is real and belongs in the drawing; it is a file removal, not a
status, and the diagram does not say so.

**4.3 · `02-injection.md:76` — "no — unrestricted, offered only after every scoped item already
fit". Wrong twice.**
(i) Under `scopePolicy: 'inert'` an unscoped item is not deferred, it is **excluded**:
`matchesScope` (`select.ts:601-603`) returns `scopePolicyFor(config, item.type) !== 'inert'` for an
empty scope, and the JIT candidate set is `fresh.filter((i) => matchesScope(i, target, config))`
(`select.ts:1749`) — so it never reaches either band. The three policies are
`['global','required','inert']` (`config.ts:155`), default `global` (`:185`).
(ii) "already fit" is the wrong gate even under the default: the JIT call is
`fitToBudget([scoped, unscoped], config.budgets.jit, 'jit')` (`select.ts:1750-1756`) with **no
`spareFrom` argument and no precondition** — `fitToBudget` `continue`s past a miss rather than
breaking, so a scoped item can spill and an unscoped one still be admitted after it. The
"everything already fit" condition belongs to the **pinned** tier (`select.ts:1638`) and has been
transplanted onto a tier that does not have it.

**4.4 · `02-injection.md:73` — "every continuity: true item, in full".**
`select.ts:1685-1687`: `eligible.filter((i) => i.continuity && !delivered.has(i.id) && !alreadyChosen.has(i.id))`,
then `fitToBudget([candidates], config.budgets.continuity, 'continuity')`. Three exclusions the
word "every" denies: already delivered into this window, already admitted by the pinned tier, and
anything over `budgets.continuity` — whose overflow is `continuitySpill` and whose budget this same
chapter lists at `02:186`. The edges `S --> CONT` and `C --> CONT` are correct (`tiersRun`,
`select.ts:1488-1497`); the quantifier is not.

**4.5 · `02-injection.md:368` — the `WHOLE` gate drops half its condition.**
Drawn: "does the WHOLE set fit `budget.pinned`?". Code (`select.ts:1638`):
`const spare = candidates.length > 0 && pinnedCost <= config.budgets.pinned ? … : [];`
With zero `always` items, `pinnedCost` is 0, the diagram answers "yes" and routes the reader to
`BAND1`; the code builds no band. The dropped conjunct is not incidental — it is the narrow form
the owner chose over the unconditional one in
`OPENQ-does-the-pinned-tier-spend-its-spare-room-on-governing-items`.

**4.6 · `02-injection.md:363-364` — "every other full-text tier (`jit`, `restored`, `continuity`)
runs `fitToBudget` over one band, plain."**
False for `jit`, and contradicted twice in the same chapter (`02:44` "offered in two bands";
`02:88` cites `select.ts:1749-1752` for the banding). `fitToBudget`'s own doc comment
(`select.ts:853-855`) names exactly two multi-band callers: the JIT tier and the pinned spare band.
The four call sites are `:1641` (pinned, 2 bands), `:1692` (continuity, 1), `:1701` (restored, 1),
`:1750` (jit, **2**).

**4.7 · `03-creation-and-gates.md:264` — "`--supersedes <id>` … the gate is answered — write
lands". The gate is normally NOT answered.**
Naming any real item only clears `unknownDispositionRefusal` (`overlap.ts:606-624`, `eligible` is
every project item at `:472`). The gate is answered only when `open.length === 0`
(`overlap.ts:504-506`); a `--supersedes` naming an item that was **not** raised leaves the raised
candidate open, `contradictionGate` returns `allowed: false`, and `contradictionCheck` throws
`contradictionRefusal` (`mutate.ts:524`) — whose message is written for this exact case ("N
dispositions were accepted on this call and M candidates are still open"). The repair took a true
statement about one refusal and drew it as an unconditional "write lands".
*The second half of the redraw is right:* `settled` at `mutate.ts:1215` is `contradictionCheck`'s
`candidates`, i.e. `closed` (`overlap.ts:506`) — the candidates raised **on this call**. So the
`RAISED` decision node and the order it asserts (gate → write → retirement test) are correct.

**4.8 · `03-creation-and-gates.md` node `S` — "verdict recorded" inside `supersedeItem`.**
The contradiction verdict is written by `recordVerdicts` (`mutate.ts:1199-1200`), **before** the
retirement test and independently of it; `supersedeItem` (`mutate.ts:2376`) writes edges and the
stand-down. Drawing the verdict inside the yes-branch tells a reader the `SILENT` branch records
nothing, when it records the same verdicts.

**4.9 · `04-conversation-archive.md` — `TP -->|"no — most records carry none"| UN`.**
`UN` reads "not indexed, at any scope". A record with no `tool_use` block gets no `'ran'` span, but
if `classifyTurn` called it `prompt` or `answer` it **is** indexed, at `said` scope — the branch
drawn immediately above. An absolute true only of `tool_result`/`thinking` must not be the sink of
this edge.

**4.10 · `04-conversation-archive.md` — `CL -->|"machinery — tool_result · thinking"| UN`.**
`classifyTurn` returns `machinery` for an assistant record carrying no `text` block
(`conversation-index.ts:1668`) — a pure tool call — and that record **is** indexed, as `'ran'`.
`conversation-search.ts:606-612` says so in words: *"the record `classifyTurn` calls `machinery` is
precisely the one this index used to drop on the floor."* The redraw made the diagram
self-contradictory: one record now travels both `CL → UN` and `TP → RAN`. **The chapter's own prose
at `04:47-52` states the truth correctly**, and dates the change to 2026-09-16 — so the new diagram
reproduces the pre-2026-09-16 wording the paragraph sixty lines above it retired.

**4.11 · `05-anchors.md:362` — "table (structural)".** Backwards. `table` is matched out of the
turn's **text**: `anchorsInTurn` calls `tableIn(text)` (`anchor-pass.ts:567`) over literal probes
`ANCHOR_PROBES = [{probe:'|---'},{probe:'| ---'}]` (`:695`). Placed beside "report (structural, not
text-matched)", the word tells a reader `table` is also not text-matched — the exact opposite of the
distinction §5.4a exists to draw.

**4.12 · `05-anchors.md:362` — "ruling (word list)" names the weaker half.**
`anchorsInTurn` gates on `ownerTyped(facts.record)` **first** (`anchor-pass.ts:570`; `ownerTyped` at
`:512`, true only when `origin.kind === 'human'`) and only then runs `RULING_WORDS` (`:391`). §5.4
of the same chapter argues the human-origin gate is the load-bearing half — the detector it replaced
"marked zero turns he actually typed".

**4.13 · `06-retrieval.md` `PF` node — `pointersFor(index, query.names + query.terms, scope)`.**
The real signature takes four parameters — `pointersFor(index, files: TranscriptFiles, names, scope)`
(`read-model-retrieval.ts:360-365`) — and the real call is
`pointersFor(index, files, [...query.names, ...query.terms], scope)` (`:851`). The `files` argument
is dropped. The prior verifier had already recorded the correct form; the repair wrote the shorter,
wrong one into a brand-new node.

**4.14 · `15-document-and-lane-viewer.md:52-53` — "the find bar searches exactly that field".**
Two errors. The outline predicate reads four fields, not one:
`const hay = \`${node.p ?? ''} ${(node.x ?? []).join(' ')} ${node.y ?? ''} ${node.w ?? ''}\``
(`lib/transcript-scroll.js:77`). And whole-session matching is not what the peek buys: `reView` ORs
the peek predicate with the server's full-text answer (`screens/conversations.js:7875`,
`matchesNode(...) || foundAt.has(i)`, over a source comment saying *"`foundAt` is an OR and never a
replacement … each finds rows the other cannot"*). The field's own doc comment calls it *"the
reader's filter"* (`read-model-conversation-document.ts:414-415`), not the find bar. The repair
correctly killed "No body text in it" and then over-reached.

**4.15 · `15-document-and-lane-viewer.md:32`, `:49-50` — "every node ships a `p` field".**
`p?: string` is optional (`read-model-conversation-document.ts:410`) and is set only on `said` nodes
(`:1797-1798`, and only `if (peek !== '')`) and on `deed` nodes (`:1820`). Folded `work` run
nodes — the bulk of a large transcript's node count — carry no `p` at all; they carry `x`. So
"kind, byte offset, char count, **and** a 140-char peek" is untrue of a whole node kind.

---

## 5. Still wrong — claims the repair passed over

**5.1 · `02:75` "injected in full, once per session".** The seen gate does not promise once. An
entry excuses re-offering only when `checksum` still matches and `whole` is true — this chapter's
own §"The `seen` gate" (`02:493-499`) states it. An item edited mid-session is re-offered. (The
substantive correction — the file is per-session and survives a compaction — is right.)

**5.2 · `02:72` `Q -->|no| IDX["index — one line: id · type · title"]`.** True of normative items
only. A rationale item gets no index line; `buildIndex` reduces the whole tier to a bare count,
which chapter 1 states correctly at `01:117-118`.

**5.3 · `02:164` doors diagram, `SSC` tier order.** Drawn "pinned · restored · continuity · index".
`tiersRun` pushes `pinned`, `continuity`, `restored`, `index` (`select.ts:1486-1503`), and its
header says the order is a claim: *"the order the budgets are spent in… the order is a disclosure,
not a layout."*

**5.4 · `02:378` `GATHER` — "any governing item, from any tier".** `buildGoverningSpill`
(`select.ts:1311-1313`) filters `isNormative(i, config) && governs(i) && !chosenIds.has(i.id)`. The
`isNormative` conjunct is missing and it matters *because of this diagram's own companion prose*,
which defines `governs()` as including `isOpenWork` — so read literally the node promises
`GoverningSpill` coverage of every open task. The source is also `eligible`, the whole eligible
corpus, not "any tier"; and the gather is skipped entirely on a `'tool'` event (`select.ts:1833`).

**5.5 · `07:296-299` — PreCompact and PostCompact are swapped, in the diagram the prior pass scored
6 of 6 clean.** Drawn: `PC->>Doc: resolves freshness, records staleness`. **PostCompact** is the
hook that reads the document — `resolveHandover` → `readHandover` at `src/hooks/post-compact.ts:144`,
`:153`, called at `:354`. **PreCompact never reads the handover file**; it checks the per-session
ask latch only (`pre-compact.ts:116`, `checkHandoverAsk`). The chapter's own prose at `07:278-283`
gets it right. *This is the clearest demonstration in the set of the mechanism this pass exists to
catch: a verifier certified the diagram clean, the repair did not touch it, and it carries a
reversed edge.*

**5.6 · `15:42`, `15:64-65` — `held` is not "a row the reader marked".** `held` is populated only
from the two rows a **text selection** begins and ends in (`conversations.js:9513-9514`, under a
declaration at `:6979-6988` that explicitly refuses to pin every marked row). An anchor mark — this
chapter's own §15.3 sense of "marked" — holds no row. A reader concludes both the wrong mechanism
and the wrong scope.

**5.7 · `16:65` — a third exclusion runs before the diagram's `START`.** The loop is
`for (const item of workItems(items, config))` (`needs.ts:490`), and `workItems` already filters
`superseded`. The node claims to begin "before `needs` is read at all"; it begins after one filter.

**5.8 · `16:93-94` — the new caption leans on the wrong qualifier.** It says "the `--limit 3` note
beside that example already says the table is not what a fresh run would show." The note beside that
example (`16:115`) is a dated-reading note, and §16.3 states **twice** (`16:109-111`, `16:153-154`)
that `--limit` bounds the ready list and **never** the held table. The diagram above it was
rewritten correctly and the sentence interpreting it reached for the one qualifier that does not
apply.

**5.9 · `05:111` — `apiAnchorMark` does accept a `kind`.** The chapter says it "does not accept a
`kind` or `origin` in the request body at all". The body is
`{ sessionId, agentId, byteOffset, label, kind?, note? }` (`ui/anchor-write.ts:264`), validated
against `OWNER_ANCHOR_KINDS` by `ownerKind(body)` (`:320`); `'note'` is the default, not the only
value. Only `origin` is unaccepted. §5.4b, forty lines later, states this correctly — a reader gets
both answers.

**5.10 · `06` `RESULT` node — "an uncited line is never written at all".** The repair edited this
node (prefixing `writeResult() writes`) and left the false half standing. `parseResult` deliberately
keeps an uncited line *"with an empty `citations`, never as nothing"* (`result.ts:259`), and
`validateResult` flags it `kind: 'uncited'` (`:342-348`). "Do not write one" is an instruction to
the subagent in the mission text (`mission.ts:163`), not a mechanism. §5 of the same chapter
(`06:334`) states the true behaviour.

**5.11 · `03:260` — `carryVerdicts` conflated with the gate's own memory.** An already-ruled
candidate is dropped by `verdictHolds` (`overlap.ts:497-502`); `carryVerdicts` is the separate
edit-time re-stamp.

**5.12 · `01:274` — two citations, one to a line that does not exist.** `launderedEnums` is
`item.ts:576`, not `:527`; the `laundered_enum` finding is emitted at `doctor/body-integrity.ts:569`,
not `doctor/checks.ts:4289` — that file is 2,596 lines long. The claims *about* the finding are
correct.

**5.13 · Stale line citations, verified by reading the symbol — 25 across three chapters.**
`01`: `mergeLayers` `:1309-1318`→`1328-1337`; `WRITABLE_SECTIONS` `:194`→`243`; `categories.ts:125`
cited for `continuity` when `:125` is the `always` row and `continuity` is `:126` (and chapter 2
cites the same number correctly for `always`).
`02`: fourteen, including `inject.ts:699-700`→`709-710`, `pre-tool-use.ts:308`→`313`,
`:703`→`708`, `session-start.ts:131`→`134`, `subagent-start.ts:318`→`319`,
`pre-compact.ts:219`→`225`, `io.ts:426`→`681`, `config.ts:805`→`840`,
`post-tool-use.ts:89`→`101`, `doctor/checks.ts:1002`→`613`; and the new subagent row's own
`select.ts:1486-1494`, which encloses `pinned` and a comment but **not** the `continuity` (`:1497`)
or `index` (`:1502`) pushes the sentence claims.
`03`: seven, including `mutate.ts:1026`→`1028`, `:1213`→`1215`, `item.ts:802`→`851`.
`05`: the "verified directly against source" quote of `ANCHOR_PROBES` is not the source line — the
real `anchor-pass.ts:695` carries a type annotation the chapter drops.

---

## 6. The sweeps

### 6.1 Volatile figures — 67 re-measured, **13 wrong AND undated**

**The index's own absolute is false.** `00:63`: *"Every figure in these chapters now carries the
date it was taken."* Thirteen figures are both wrong and undated, ten more are undated and
currently correct, and five pasted blocks carry no date either.

**Wrong and undated — the hard findings:**

| where | claim | true value today | how established |
|---|---|---|---|
| `01:47` | `categories.ts` (**554** lines) | **556** | `wc -l src/core/categories.ts` |
| `02:10` | `inject.ts` (**1,231** lines) | **1,243** | `wc -l` |
| `02:11` | `select.ts` (**1,833** lines) | **1,851** | `wc -l` |
| `01:348` | `constraint` — **7** items here | **8** | `find .my_context/items/constraint -name '*.md' \| wc -l` |
| `01:349` | `invariant` — **6** | **7** | same |
| `01:376` | `open_question` — **29** | **31** | same |
| `01:385` | `known_issue` — **32** | **35** | same |
| `01:410` | `measurement` — **1** | **3** | same |
| `01:168` | median title **70** chars; **202 of 730** past 80 | median **78**; **598 of 1,317** past 80 (the 566 max is right) | title lengths over all 1,317 item files, sorted |
| `01:185` | median body **1,693** characters | **1,983** | post-frontmatter byte count over all 1,317 |
| `01:295` | **518** items carry `progress`/`last_change`; "all **133** disagree with the audit log" | **161** carry either, **143** carry `last_change` | `grep -rlE '^(progress\|last_change):' .my_context/items` — and 518 → 161 is not drift in the growing direction; the figure could not be reconstructed from any read-only count of the item files |
| `13:558` | `test/rules/*` (**16** files) | **18** | `ls -p test/rules/ \| grep -v '/$' \| wc -l` |
| `09:365` | decay block, "Real output (**this repo, today**)" | "today" names no date; its `unrestricted (124)` matches the **2026-09-12** capture 190 lines above, so "today" is almost certainly five days ago | read in place |

The `01` bullet list at `:348-426` is the sharpest case: the **table** at `01:65-86` carries the same
counts, is dated 2026-09-13 and is explicitly caveated — correct shape — and the bullets below
restate five of them bare.

**Undated but currently correct (findings under this project's own rule, not errors):** the three
counts in the `09:14` diagram (91 · 49 · 28 — all verified true today); "29 shipped categories"
(`01:44`, `:47`); `src/pack/` "twelve files" (`12:119`); the tutorial manifest's "24 entries…
confirmed by listing it live" (`12:289` — "live" is not a date); `needs.ts` "866 lines" (`16:10`);
`edit.ts` "1,320 lines" (`03:16`, `:656`); `drift.ts` "18.5 KB" (`11:569`); `conversations.js`
"grown past 11,000 lines" (`08:278` — true as a floor, and the floor is 1,600 lines behind).

**Wrong but dated or caveated (softer):** `00:202`'s "17 files, 7,376 lines, 508,660 bytes **as of
this correction**" (actually 7,957 / 552,237 — and "this correction" now names one 581 lines ago,
because `471b13b3` added ~200 lines and did not move it); `01:84`'s 1,235-item total (1,317);
`01:360`/`:421`'s `rule` 56 and `task` 866 (58, 937); `11:31`'s "thirteen modules" (16, though
pinned to a commit); `05:80`'s 1,355 anchor rows (1,383 — exemplary handling: dated, stated once,
flagged volatile-within-the-session, and every other mention in the chapter defers to it);
`04:53`/`14:173`'s "474 transcripts, 1,269,256,560 bytes" (508 / 1,383,185,039); `07:449`'s
handover figures (caveated in terms).

**Correct and properly dated — 25**, and `10-rule-store.md` is clean end to end: 16 entries, 41,955
bytes, 15 developer + 1 product, and every `src/rules/*.ts` line count re-measured true, all dated
2026-09-16. Also exact: `09:36`'s 34-files-but-33-register, `09:410`'s 2,627 lines, `08:401`'s 77
routes, `08:28-40`'s twelve ruled write bindings across five files, `04:154`'s 16 `node:sqlite`
files, `15:94`/`:203`'s `fold.js` and `panel.js` line counts, `12:368`'s 91-file arithmetic, and
`16:112-115`'s `ready --held` block, re-run and re-dated **2026-09-17**.

### 6.2 Contrast ratios and hex values — **nothing to find, and that is a result, not a gap**

The `docs/system/03` defect — shipped hexes paired with retired colours' ratios — **cannot exist
here, because no chapter states a contrast ratio at all.** Eight colour facts in the whole
reference:

- **Contrast ratios stated: 0.** Every `contrast` hit is the phrase "by contrast"; the one `1:1` is
  a bijection between route ids and screen names (`08:118`). There was no ratio to recompute, so no
  luminance script was written — nothing to do, as distinct from could not look.
- **Hex colours stated: 1.** `01:36`'s `linkStyle 3,4 stroke:#2e7d32`, a mermaid edge stroke, not a
  design token. It matches `README.md:174`, `docs/README.he.md:204` and the generated
  `src/ui/public/diagrams/d-536e93924e5db96e.svg`. Not stale.
- **CSS custom properties named: 7**, all at `15:317-318` — `--gold` `#eab308`, `--ok` `#22c55e`,
  `--carry` `#8b9ce6`, `--crit` `#ef4444`, `--warn` `#f97316` (`styles.css:147`), `--ink` `#f0eef6`
  (`:89`), `--paper` `#0f0f12` (`:187`). All seven resolve; none renamed or removed. The "five fixed
  meaning-colours, no sixth minted" claim at `15:317` and `05:267` holds, and the anchor-kind
  bindings at `styles.css:4144-4152` use exactly three of the five, consistent with `05:255-267`.
- The one colour *claim* checked byte-for-byte, `ANCHOR_KIND_HUE` in `05`, matches
  `screens/conversations.js:1228-1238`.

### 6.3 Cited item ids — 61 distinct ids checked, **3 uncitable**

| where | cited as | the real id |
|---|---|---|
| `08-web-ui.md:55` | `KNOWN-a-locked-out-tab-can-only-be-recovered-by-the-restart-that-locks-out-the-next-one` | `KNOWN-a-locked-out-tab-can-only-be-recovered-by-the-restart-that` |
| `05-anchors.md:268` | `DEC-the-meaning-hue-budget-is-five` | `DEC-the-meaning-hue-budget-is-five-gold-ok-carry-crit-and-warn` |
| `15-document-and-lane-viewer.md:316` | `DEC-the-meaning-hue-budget-is-five` | same |

*How established:* every `[A-Z]+-[a-z0-9-]+` token in the seventeen chapters diffed against
`find .my_context/items -name '*.md'`, then confirmed by running the product:
`node src/cli/index.ts show DEC-the-meaning-hue-budget-is-five` →
`my_context: no item with id "…"`. The other ten non-matching tokens are the deliberate illustrative
corpus in `01` and `12` (`RULE-money-is-an-integer-…`, `CONST-card-numbers-…`) or are marked as
abbreviations with an ellipsis (`REF-the-wave-map-…`, `RULE-1-1-…`) and are not findings.

### 6.4 Pasted "real output" blocks — 45 found, 36 run and diffed whole

| verdict | count | where |
|---|---|---|
| faithful and complete | 6 | `07:130` (`restore --show`), `10:22`, `10:160`, `12:40`, `12:269`, two of four commands in `13:391` |
| abridged **with the cut marked** — the acceptable shape | 4 | `01:303`, `10:~278`, `11:499`, `16:229` |
| **silently abridged — lines dropped, no elision** | **10** | `09:283`, `09:305`, `09:329`, `09:355`, `09:368`, `10:105`, `10:121`, `10:260`, `13:231`, `13:~243`, `16:202` |
| **doctored — shape or values retyped** | **5** | `09:258` (a boxed table retyped as prose, footer dropped), `09:265` (pretty-printed JSON welded onto single lines), `09:344` (boxed table retyped as free-form rows), `14:77` (the `GMT+3` suffix stripped from all seven rows and the wraps collapsed — `zonedStamp`, `format.ts:395`, always appends it), `16:115` (wrapped title cells hand-truncated with `…`, borders left misaligned) |
| figures moved since capture | 11 | of which **5 carry no capture date at all** and are findings in their own right: `09:283`, `09:368` ("today" is not a date), `11:499`, `14:130`, `16:202`/`16:229` |

Three of these deserve naming:

- **`10:121` (`rules verify`) is the `docs/system` defect exactly.** The dropped lines are the store
  version and the five-line changelog note — and *this chapter's own prose 140 lines later* says the
  command "also prints the store version and the latest changelog note."
- **`11:176-181` is a silently abridged paste of a config file, not a command.** It says
  "`.my_context/config.json` at HEAD carries:" and shows `enabled` and `maxProposalsPerPass` — and
  omits `"model": "claude-opus-5"`, which is present in the live file and which *this chapter's own
  opening* (`11:19-22`) names as the correction that made "two of three" into "all three". The paste
  supports the reading the chapter had just retired.
- **`09:355` and `11:86` are two pastes of one command, both dated 2026-09-12, three figures apart**
  (`2840`/`44844`/`1383 jit` against `2841`/`44858`/`1384 jit`). Neither says it is a second run.
  And `11:86` carries the closing sentence — *"So a high count is mostly a count of subagent
  dispatches…"* — that `09:355` cuts mid-paragraph with no mark.

### 6.5 Cross-chapter restatements of the ten corrected facts — 3 stale, and the worst one is the count

All ten facts grepped across all seventeen chapters, ~95 hits read in full.

**F1 · The anchor creation paths are still called "three", in three places, one of them the index.**
The repair added **Path 4 — UI sweep** to the diagram at `05:359` and left the prose around it and
the index summary untouched:

| where | stale text | true value |
|---|---|---|
| `05-anchors.md:285` | `## 5.6 The three creation paths` — the section heading | the section now documents **four** |
| `05-anchors.md:346` | "**All three paths** converge on the same two doors — `markAnchor` / `unmarkAnchor`" | all **four**; the diagram twelve lines below draws P1, P2, P3 **and P4** into `MARK` |
| `00-index.md:73` | "…`origin: automatic` vs `origin: owner`, **the three creation paths**, and every anchor capability reachable from the web UI." | four |

*How established:* read `05:285-361`; `grep -c "registerRoute('" src/ui/anchor-write.ts` → 4, and
`08:75` names all four routes correctly. **This is the predicted failure exactly** — the diagram and
its immediate caption were corrected, and the heading above it, the sentence sixteen lines below it,
and the one-line summary in the index three chapters away were not. Two of the three are inside a
chapter the repair *did* touch.

**F2 · `02:40` labels the SessionStart row "(new/resumed/cleared)".** The hook-matcher table at
`02:129` is correct — `startup|clear|resume|compact|fork` — and `src/hooks/session-start.ts:17`
carries the same union. `compact` gets its own row below; `fork` appears in neither. A partial list
that reads as exhaustive, three lines above a table that lists all five.

**F3 · `15:177` equates two constants whose behaviours differ by the amount chapter 14 just
repaired.** It says a bare `NEAR` "defaults to `NEAR_CHARS = 30` characters … happening to match
chapter 14's archive-side `near` tier at the same value." Both *constants* are 30
(`src/ui/public/lib/fold.js:1041`, `src/core/conversation-search.ts:891`), but `fold.js`'s
`nearPairs` walks a true 30-codepoint gap (`:1160-1164`) while FTS5's `NEAR(…, 30)` admits 28 —
which chapter 14 now stresses twice. True of the constant, false of the behaviour, in the one doc
set that just repaired a 30-versus-28 claim.

**Clean on the other seven axes.** No chapter still says "severity first", "pinned · index only",
"per context window", "within 30 chars", or `POST /anchors/mark` without the `/api/conversations`
prefix; none attributes `'ran'` to `classifyTurn`; `held`'s four reasons are stated consistently.
So the repair's sweep *within* each corrected sentence worked — the failures are in the **new text**
it wrote (§4) and in the **counts and headings around** the new text (F1).

One pointer outside this scope: `README.md:2001` still reads "once per item per context window …
since the per-session dedupe record never delivers the same item twice to the same window," which
conflates the two spans the same commit set out to separate. It is README prose, not a fence, so it
is out of `docs/capabilities/**` — flagging it for whoever takes the repair.

### 6.6 The provenance paragraph was not moved with the repair

`00:202-243` is the index's account of how verified this reference is. It names three passes
(2026-09-13, 2026-09-16, 2026-09-17 prose) with their denominators, and **says nothing about the
diagram verification at all** — not that the sixteen diagrams had never been checked until
2026-09-17, not that 28 claims were false, not that one fence had never parsed, and not that the
repair of all of it is unverified. A reader finishes that paragraph believing the reference has been
verified three times through.

It also asserts, at `00:230`, that *"no sentence in this reference asserts what is or is not in a
commit, a branch, or 'HEAD'."* Four sentences do: `11:38`, `11:49` ("as committed at HEAD"),
`11:174` ("`.my_context/config.json` at HEAD carries"), `13:539`. `11:34-35` names the problem and
then does it fifteen lines later.

---

## 7. The root cause — recommendation only

`DIAGRAM_SOURCES = ['README.md', 'docs/README.he.md']` (`scripts/gen-diagrams.ts:61`). Nothing under
`docs/` is generated, drawn, committed or gated. That is why a fence that no renderer could parse
shipped, and why nobody noticed for as long as it existed.

**And the gate is red at HEAD right now, in a way `471b13b3` caused.** Measured, not inferred:

- 6 of 10 entries in the committed `src/ui/public/lib/diagrams.js` point at SVG files that **do not
  exist** — `471b13b3` deleted them and added six replacements.
- 6 of 10 README fences (3 English, 3 Hebrew) have **no map entry**, so `diagramNode` falls back to
  `<pre>` and they draw as raw mermaid source.
- Those three English fences are the pipeline, the tiers and the lifecycle — **exactly the three
  diagrams the capabilities repair corrected.** The corrected drawings are on disk; nothing points
  at them.
- The divergence began at `b1aa247a` (README fences repaired, module not regenerated) and was
  compounded by `471b13b3` (SVGs regenerated and committed, module still not). *A lane is repairing
  `diagrams.js` in the working tree as this is written* — the working-tree copy maps 5 capability
  fences and all 10 digests verify; this finding is about HEAD, not about that lane's work.

**The cost of bringing `docs/capabilities/**` and `docs/system/**` under the generator, measured:**

| | |
|---|---|
| fences under `docs/` today | 37 (16 capabilities, 12 system, 5 Hebrew README, 4 the-store.he) |
| new drawings if capabilities + system come under | **23** (5 of the 16 capability fences are already drawn, being byte-identical to README's) |
| measured bytes, the 16 capability drawings | **1,228,963 B (1.17 MiB)** — rendered in the real generator's configuration; the two redrawn `02` diagrams alone are 279 KB and 156 KB |
| net new bytes, capabilities | ~888 KB; `docs/system` estimated similar → **≈1.5–1.8 MiB added** |
| `src/ui/public` today | 5.04 MB (686 KB of it diagrams) → **≈6.6–6.8 MB** |

**What breaks, honestly:**

1. **The byte argument that killed vendoring cuts this way too.** `DEC-markdown-it-is-vendored-as-the-tokeniser-and-the-drawings` rejected vendoring mermaid because it took `src/ui/public` from 2.5 MB to 6.2 MB. This lands past that number by a different road. The owner should decide knowing that, not discover it.
2. **Every doc author needs Chromium.** `gen-diagrams.ts` renders through Playwright. A contributor who edits one sentence inside a fence and cannot run `npm run gen:docs` cannot go green, because `diagramFile` is content-addressed: change a character and the file it should name does not exist.
3. **Churn.** Each edited fence rewrites a ~70 KB committed artefact.
4. **A visible product change.** Fourteen of sixteen capability fences currently render as `<pre>`; bringing them under makes them images. That is better, and it is a change to what readers see.

**What I would put to the owner as the cheaper first move, if he wants the defect closed without
the bytes:** separate *"does it parse"* from *"is it drawn"*. A parse-only gate needs no committed
SVG, no map entry and no bytes — it extracts every fence under `docs/` with the same `mermaidBlocks`
and calls `mermaid.parse` on each. It cannot live in `test/` (this repository keeps every Playwright
spec out of `test/`, enforced by `check:test-glob`), so its home is a single `e2e/*.spec.ts`; there
is precedent for e2e specs that read repository files rather than drive the UI (`e2e/tree-parity.spec.ts`,
`e2e/strip.spec.ts`, and six others). The whole run took **under ten seconds for sixteen fences**
in one Chromium here. That closes the failure that actually reached a reader — an unparseable
fence — and leaves the drawing question open for a separate decision.

The second, independent question the owner may want to settle first: **`diagrams.js` at HEAD.**
That one is a straight repair, not a policy change.

---

## 8. What is clean, and what I could not establish

**Clean:**

- **All sixteen fences parse, render and serialise.** No error box remains anywhere in the set.
- **`14-search-over-the-archive.md` — 14 of 14.** Including the claim I most expected to be
  invented: *"FTS5 counts `NEAR` in tokens and a trigram tokenizer emits one token per character
  position, so the token window is the character window"* is **the source's own sentence**,
  `conversation-search.ts:877-879`, repeated in `test/core/search-grammar.test.ts:52-54`. The
  apparent tension with `N-2` exists in the source, which states the law as measured over 41
  synthetic gaps rather than derived. The repair reproduced it faithfully.
- **`16`'s redrawn priority chain** matches `needs.ts:491-517` step for step, and three of the four
  held strings are verbatim.
- **`07`'s repaired `alt` block** matches `restore-stage.ts:459-487` and `restore.ts:410-421`.
- **The five README-derived diagrams are byte-identical across `README.md`, `docs/README.he.md` and
  the chapters**, and the Hebrew mirror carries every correction. The second-copy discipline the
  prior pass asked for is working — which is also why §4.1's new error exists in three places.
- **The diagram digests and the on-disk set agree in the working tree** (10 of 10).

**Could not establish, either way:**

- **`04`'s "most records carry none".** Counting `tool_use`-bearing records means walking ~1.2 GB of
  transcripts; no read-only command in this repository yields it.
- **What a reader sees for `&lt;id&gt;` in `03`'s flowchart labels — I settled this one by
  rendering:** it draws as `<id>`. An HTML entity is correct in a flowchart label under mermaid's
  default `htmlLabels: true`, and is *not* the `07:78` failure, which was a `sequenceDiagram`. Worth
  recording that the repository now spells the same thing two ways in two fences.
- **The 2026-09-07 spare-band measurements** (`02:254-293`): verified as faithfully quoted from
  `select.ts:1629-1636`, not verified as currently true — that needs a live `select` run.
- **`15:282`'s pixel table**, measured by hand on a live 139 MB session at 1280×1000: reproducing it
  needs Playwright and the server on 58888, both out of bounds for this lane. It carries no date.
- **Two mutating commands in `05`** (`conversation anchor <sid> <off> --label`, `--drop`) were not
  run, by constraint.
- **`13:550`'s "nineteen files in `scripts/` have no coverage anywhere".** Proving "no coverage
  anywhere" needs an import-graph analysis over `test/`, which was not run. Unverified, not disputed.
- **`01:295`'s "518 items already carrying them".** Today's read-only count of the item files is
  161. The figure could not be reconstructed from any read-only count — it may have been taken
  against a different population (the index, including retired rows) or it may simply be wrong. It
  is recorded as unresolved rather than as a false value.
- **The historical measurements quoted in `02:290`, `03:300`, `03:623`, `04:182-183`, `06:213`,
  `11:226-238`, `15:125-345`.** These quote recorded one-off benchmarks and source comments rather
  than restating a current count; they are dated or attributed in place and are not re-derivable
  read-only. Not counted as findings either way.
- **Chapters 08, 10, 11, 12, 13 were swept, not diagram-verified.** They have no diagrams and
  `471b13b3` did not touch them. They were checked for cited ids, pasted output blocks, volatile
  figures and stale restatements of the ten corrected facts — four findings came out of that
  (`08:55`, `10:105`, `10:121`, `10:260`, `11:176`, `13:231`, `13:~243`) — but no claim-by-claim
  prose verification was attempted on them here, and none should be read as having had one.

**A caveat on the working tree.** `docs/capabilities/` is clean and equals HEAD, so every document
claim above is a claim about HEAD. But `src/ui/public/styles.css`, `lib/diagrams.js`,
`screens/conversations.js` and `strings/*.js` are modified by other live lanes, and `docs/system/*`
likewise. Code readings under `src/ui/public/` — the `15` findings especially — are against that
working tree, and their line numbers may not match HEAD.

---

## Method

- Fence extraction by the product's own `mermaidBlocks` (`src/ui/public/lib/markdown.js:509`), never
  a second scanner — the same function `gen-diagrams.ts` and `test/ui/diagram-gate.test.ts` ask.
- Parsing and rendering in **mermaid 11.17.2** from `node_modules`, in headless Chromium via the
  installed Playwright, with `gen-diagrams.ts`'s own `initialize` config, plus its
  HTML-in/XML-out re-serialisation check. Three short Chromium runs in total, no browser suite, no
  port bound.
- Every content claim resolved by reading the symbol out of `src/`, never out of the prose beside
  it. Directions and quantifiers checked as first-class claims: "every", "never", "only", "at any
  scope", and the direction of every arrow.
- Cited ids diffed against `.my_context/items/` and then confirmed by running `show`.
- Pasted blocks re-run and diffed whole, not spot-checked; mutating commands declined and named.
- Four chapter-group lanes did the claim-by-claim reading; their key findings — the
  `pre-tool-use.ts` index read, the `PreCompact`/`PostCompact` swap, the `machinery`-is-indexed
  contradiction, the `spare` gate's dropped conjunct, the two-band JIT call, the continuity
  exclusions — were re-established directly in this lane before being written down.
- Read-only: no `git` command that writes, `npm test` never run, port 58888 never bound, nothing
  under `src/rules/entries/` touched, no document changed, no mutating command run.
- **One disclosure, because a verification report that hides its own side effects is the thing this
  campaign is about.** Diffing the pasted blocks meant running `status`, `search`, `ready`, `todo`,
  `audit`, `contribution`, `decay`, `path`, `query`, `rules list`, `rules verify`, `pack list`,
  `procedure list`, `restore --show`, `conversation search` and five `check:*` scripts. `openStore`
  is `openRebuiltStore` (`src/cli/index.ts:170-172`), so several of those **refresh
  `.my_context/.index.db`** — a gitignored (`.my_context/.gitignore:1`), derived cache this corpus
  defines as disposable. No corpus file, no git state and no committed artefact was touched. The
  figure sweep avoided `status` for that reason and counted with `find`/`ls` instead; the
  pasted-block sweep could not, because the pasted block *is* `status`'s output.
