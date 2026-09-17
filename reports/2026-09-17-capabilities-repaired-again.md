# `docs/capabilities/` repaired again — 2026-09-17

`TASK-the-repair-of-twenty-eight-false-claims-wrote-fifteen-new`

This repairs what `reports/2026-09-17-capabilities-verified-after-repair.md` found in commit
`471b13b3`: **15 new false claims the repair itself wrote, 1 fixed into a new wrong value, 2
untouched**, plus 13 stale-and-undated figures, 3 uncitable item ids, 10 silently abridged pasted
blocks and 5 doctored ones.

It also does the thing the brief exists for. **Every sentence below is marked `checked` or
`carried`** — checked means I read the code the sentence is about before writing it; carried means I
took it from the verifier's report or from the text already on the page without re-deriving it. The
distinction is the deliverable as much as the repair is, because three passes running have now
measured the same failure: repairing 38 produced 21 new findings, repairing 28 produced 15,
repairing 21 produced 15. **A repair pass is a writing pass.** The only defence is to read the code
for every sentence, including the ones you are only rephrasing.

No `git` command that writes was run. The tree is left dirty for the main session. Port 58888 was
never bound, no subagent was dispatched, and nothing under `src/ui/public/` was written — see §8,
which names the one thing I broke there and cannot fix from inside this scope.

---

## 1. The answer, in one paragraph

**All 15 are repaired, all 13 "still wrong" are repaired, and every sweep finding is closed.** Three
of the verifier's own findings were wrong and are corrected in §6 rather than acted on. Nine further
false claims that nobody had listed turned up while reading the code for the listed ones (§7) —
including one in the same fence as the worst finding, and one that I very nearly wrote into a
diagram myself before checking it. That near-miss is recorded in full in §7.2, because it is the
clearest evidence I have that the discipline is doing work rather than being described.

The gate `npm run check:diagrams` caught one real failure I introduced mid-repair (§9), which is
exactly what a gate is for and exactly what bracket-counting would have missed.

---

## 2. The checked-vs-carried ledger

Every block of prose or diagram text this pass wrote, and what it rests on.

| what I wrote | rests on |
|---|---|
| The `.index.db` node and edge, all three files (§3.1) | **checked** — `pre-tool-use.ts:275-320`, `inject.ts:372`, `:883-885`, `store.ts:532-539`, `session-start.ts:69`, `subagent-start.ts:290` read directly |
| The 00-index caption replacing it | **checked** — same reading; every line number re-confirmed by `sed -n` after writing |
| The `SEL` node's narrowed absolute | **checked** — `buildInjectionResult`'s only two callers found by grep, then read |
| The `01` lifecycle diagram + caption | **checked** — `types.ts:92`, `vocabulary.ts:375`, `decline.ts:149-164`, `edit.ts:753`, `:764-767`, `:96` |
| The `02` tiers diagram, all three files | **checked** — `select.ts:601-603`, `:1543`, `:1638`, `:1685-1687`, `:1692`, `:1749-1756`, `:924-937`, `:1142-1144`, `:1248-1252` |
| The `02` four-row correction table under it | **checked** — same readings, each cited at the line it was read from |
| The `02` spare-band and `GATHER` nodes | **checked** — `select.ts:1638`, `:853-855`, `:1311-1313`, `:1833` |
| The `03` gate branch redraw + caption | **checked** — `overlap.ts:471-474`, `:491-492`, `:497`, `:500-508`, `mutate.ts:462`, `:529-531`, `:1200`, `:1215` |
| The `04` indexing diagram + caption | **checked** — `conversation-index.ts:1658-1670`, `conversation-search.ts:88`, `:281-295`, `:362-385`, `:587-613` |
| The `05` AUTO node + caption | **checked** — `anchor-pass.ts:121-129`, `:391-392`, `:512-519`, `:565-577`, `:650-661`, `:695-698` |
| The `05` `kind`-is-accepted correction | **checked** — `anchors.ts:99-101`, `anchor-write.ts:115-128`, `:264`, `:320` |
| The `05` four-paths heading and sentence | **checked** — `grep -c "registerRoute('" src/ui/anchor-write.ts` → 4, lines read |
| The `06` `PF` and `RESULT` nodes + caption | **checked** — `read-model-retrieval.ts:360-365`, `:851`, `retrieval/result.ts:258-262`, `:290-295`, `:342-352`, `retrieval/mission.ts:345` |
| The `07` sequence edges + caption | **checked** — `post-compact.ts:144`, `:153`, `:354`, `:366`, `pre-compact.ts:113-116`, `handover-ask.ts:986-1090` |
| The `15` peek / find-bar / `held` bullets | **checked** — `read-model-conversation-document.ts:185`, `:405-421`, `:1793-1802`, `:1815-1822`, `:1830-1837`, `transcript-scroll.js:75-77`, `conversations.js:6979-6989`, `:7864-7874`, `:9540-9552` |
| The `16` `START` node and `--limit` caption | **checked** — `needs.ts:291-297`, `:485-519`, and the chapter's own §16.3 re-read |
| Every re-captured command block (§5.3) | **checked** — each command re-run and redirected to a file; the file's bytes pasted |
| Every re-measured figure (§5.1) | **checked** — each by the command named beside it in the document |
| The three uncitable ids (§5.2) | **checked** — `mycontext show` run on both the wrong id and the right one |
| The 00-index provenance rewrite (§5.5) | **mixed.** The mechanism, the five passes and the gate: **checked**. The historical counts inside it — 38/21, 28/15, 21/15, "282 claims", "574 checks" — **carried** from the reports named beside them, which exist on disk; I did not re-run any of those passes |
| `05`'s earlier anchor readings (1,342 / 1,345 / 1,348) | **carried** from the text already on the page; only the 2026-09-17 reading is mine |
| `13`'s 2026-09-12 and 2026-09-13 basis readings | **carried** from the text already on the page; only the 2026-09-17 run is mine |
| `09`'s "2,840 injection records of 44,844" | **carried** — quoted as the figure the previous capture held, never as current |
| `04`/`14`'s 474 transcripts / 1,269,256,560 bytes | **carried**, and now labelled in both chapters as the SAMPLE SIZE of a dated one-off measurement. I tried to re-derive it and could not (§8.1) |
| `11`'s commit hashes and times | **carried**, untouched |

**Nothing in this repair was composed to sound plausible.** Where the true value was not knowable
from the code in front of me, the document now says so in those words — `13`'s coverage claim
(§7.5) and `04`/`14`'s archive figures (§8.1) are both written as the weaker fact they are.

---

## 3. The 15 new false claims — one row each

| # | where | what it said | what is true | how established |
|---|---|---|---|---|
| 3.1 | `00:32` + `README.md:468` + `docs/README.he.md:500` | `.index.db` is "read by search, list, query; **never by injection**" | **The exact inverse on one of the four paths.** `PreToolUse` opens the index read-only and takes its JIT candidates from it — `store = Store.openReadOnlyChecked(ws.dbPath); candidates = store.activeInjectable(...)` (`pre-tool-use.ts:287-288`) — reaching `activeInjectableFromItems(loadCorpusItems(...))` only from the `catch`. Database first, Markdown as the disclosed fallback. The two hooks that call `buildInjectionResult` (`session-start.ts:69`, `subagent-start.ts:290`) do select from Markdown, and the index is refreshed afterward, best-effort, skipped for a subagent (`inject.ts:883-885`) | read `pre-tool-use.ts:275-320` and `store.activeInjectable` (`store.ts:532-539`) directly; found `buildInjectionResult`'s callers by grep and read both |
| 3.2 | `01:198`, `:201`, `:220` + both READMEs | `deleted` drawn as a sixth lifecycle state, while the caption twelve lines below called `validated` "a fifth legal value this diagram still omits" | `Status` is exactly five: `active \| draft \| superseded \| deprecated \| validated` (`types.ts:92`, `vocabulary.ts:375`). `deleted` is not one. `declineDraft` writes a decline ledger entry and only then `rmSync`s the file and `deleteById`s the row (`decline.ts:149-164`); no `status` is ever assigned. Redrawn as a terminal edge | read both type declarations and `declineDraft` end to end |
| 3.3 | `02:76` + both READMEs | an unscoped item is "unrestricted, offered only after every scoped item already fit" | Wrong twice. Under `scopePolicy: 'inert'` an unscoped item is **excluded**, not deferred: `matchesScope` returns `scopePolicyFor(config, item.type) !== 'inert'` for an empty scope (`select.ts:601-603`) and the candidate set is `fresh.filter((i) => matchesScope(...))` (`:1749`). And "already fit" is the **pinned** tier's gate (`:1638`): the JIT call passes no `spareFrom` (`:1750-1756`) and `fitToBudget` `continue`s past a miss rather than breaking (`:924-937`), so a scoped item can spill and a smaller unscoped one still be admitted after it | read `matchesScope`, the JIT call site and `fitToBudget`'s loop |
| 3.4 | `02:73` + both READMEs | "every `continuity: true` item, in full" | Three exclusions the word "every" denies: `eligible.filter((i) => i.continuity && !delivered.has(i.id) && !alreadyChosen.has(i.id))` (`:1685-1687`), then `fitToBudget([candidates], config.budgets.continuity, 'continuity')` (`:1692`) whose overflow is `continuitySpill` | read the tier block |
| 3.5 | `02:368` | the spare-band gate is "does the WHOLE set fit `budget.pinned`?" | It has two conjuncts: `candidates.length > 0 && pinnedCost <= config.budgets.pinned` (`:1638`). With no `always` items `pinnedCost` is 0, so the drawn gate answers "yes" where the code builds no band. The narrow form was the owner's choice over the unconditional one | read `:1594-1640`, including the comment that argues for the narrow form |
| 3.6 | `02:363-364` | "every other full-text tier (`jit`, `restored`, `continuity`) runs `fitToBudget` over one band, plain" | False for `jit`. `fitToBudget`'s own doc names exactly two multi-band callers (`:853-855`); the four call sites are `:1641` (pinned, 2 bands), `:1692` (continuity, 1), `:1701` (restored, 1), `:1750` (jit, **2**) | read the doc comment and all four call sites |
| 3.7 | `03:264` | `--supersedes <id>` → "the gate is answered — write lands" | **It normally refuses.** `--supersedes` only adds an id to `disposed` (`overlap.ts:491-492`); a raised candidate leaves the open set only if it is in `disposed` (`:497`) or carries a verdict that still holds (`:500-502`); and `contradictionGate` returns `allowed: false` while any candidate is open (`:507`). `contradictionCheck` then throws `contradictionRefusal` (`mutate.ts:531`) | read `contradictionGate` and `contradictionCheck` in full |
| 3.8 | `03` node `S` | "verdict recorded" drawn inside `supersedeItem`'s yes-branch | `recordVerdicts` runs at `mutate.ts:1200`, **before** the retirement test and independently of it (`:1215`). The `no` branch records the same verdicts | read `createItem`'s tail, `:1190-1220` |
| 3.9 | `04` edge `TP → UN` | "no — most records carry none" routed to "not indexed, at any scope" | A record with no `tool_use` gets no `'ran'` span, but if `classifyTurn` called it `prompt` or `answer` it **is** indexed. `proseFrom` calls `put` twice per record (`conversation-search.ts:605`, `:613`) | read `proseFrom` and `put` |
| 3.10 | `04` edge `CL → UN` | `machinery` → "not indexed, at any scope" | `classifyTurn` returns `machinery` for an assistant record with no `text` block (`conversation-index.ts:1668`) — a pure tool call — and that record **is** indexed as `'ran'`. The source says so at `conversation-search.ts:606-612`. The redraw had made the diagram self-contradictory: one record travelled both `CL → UN` and `TP → RAN` | read `classifyTurn` and the `put('ran', …)` comment |
| 3.11 | `05:362` | "table (structural)", beside "report (structural, not text-matched)" | Backwards. `table` is the one grammar that reads the turn's own characters: `anchorsInTurn` calls `tableIn(text)` (`anchor-pass.ts:567`) and `firstTableSite` (`:121-129`) wants a delimiter row whose cell count matches the header above it. `report` reads no text content: `laneReportAt` (`:650-661`) asks the archive's columns and only the text's *length* | read `anchorsInTurn`, `firstTableSite`, `laneReportAt` |
| 3.12 | `05:362` | "ruling (word list)" | Names the weaker half. `ownerTyped(facts.record)` gates it **first** (`:570`; `ownerTyped` at `:512-519`, true only for `origin.kind === 'human'` on a non-sidechain, non-meta record); `RULING_WORDS` (`:391-392`) runs only inside that gate | read both |
| 3.13 | `06` node `PF` | `pointersFor(index, query.names + query.terms, scope)` | Four parameters, not three: `pointersFor(index, files: TranscriptFiles, names, scope)` (`read-model-retrieval.ts:360-365`), called as `pointersFor(index, files, [...query.names, ...query.terms], scope)` (`:851`) | read the signature and the call |
| 3.14 | `15:52-53` | "the find bar searches exactly that field", and the peek is what buys whole-session matching | The predicate reads four fields — `node.p`, `node.x`, `node.y`, `node.w` (`transcript-scroll.js:75-77`) — and whole-session reach is an **OR** with the server's answer: `matchesNode(...) || foundAt.has(i)` (`conversations.js:7874`), over a comment reading *"`foundAt` is an OR and never a replacement … each finds rows the other cannot"* (`:7868-7873`) | read the predicate and the `reView` line, and quoted the comment from the file |
| 3.15 | `15:32`, `:49-50` | "every node ships a `p` field" | `p?: string` is optional (`read-model-conversation-document.ts:421`) and is set only on `said` nodes when the peek is non-empty (`:1797-1798`) and on `deed` nodes (`:1820`). A folded `work` run is built without it (`:1830-1837`) and carries `x` instead — and on a long transcript those runs are the bulk of the node count | read the interface and all three node constructions |

---

## 4. The 13 the repair passed over

| # | where | what it said | what is true | how established |
|---|---|---|---|---|
| 4.1 | `02:75` | JIT is "injected in full, once per session" | The seen gate does not promise once: `fresh` keeps an item whose entry is not **both** whole and current — `return !(entry.whole && entry.checksum === i.checksum)` (`select.ts:1543`). An item edited mid-session is re-offered | read the `fresh` filter |
| 4.2 | `02:72` | every non-`always` item gets "one line: id · type · title" | Normative items only. `buildIndex` enumerates `eligible.filter((i) => isNormative(i, config) && !chosenIds.has(i.id))` (`:1142-1144`) and reduces everything else to `counts[item.type]` (`:1248-1252`) | read `buildIndex` |
| 4.3 | `02:186` | SessionStart-after-compact injects "pinned · restored · continuity · index" | `tiersRun` pushes pinned, continuity, restored, index (`select.ts:1486-1503`), and its own header says *"the order is a disclosure, not a layout"* | read `tiersRun` |
| 4.4 | `02:378` | `GATHER`: "any governing item, from any tier" | `buildGoverningSpill` filters `isNormative(i, config) && governs(i) && !chosenIds.has(i.id)` over the whole eligible corpus (`:1311-1313`), and is skipped entirely on a `'tool'` event (`:1833`, `governingSpill: null`) | read the function and the tool-event return |
| 4.5 | `07:296-299` | `PreCompact` "resolves freshness, records staleness" | Reversed. **PostCompact** reads the document: `resolveHandover` (`post-compact.ts:144`) → `readHandover` (`:153`), called at `:354`, result onto the audit row at `:366`. **PreCompact never opens it** — `checkHandoverAsk` (`handover-ask.ts:986-1090`) reads the ask latch and `statSync`s the path for its mtime; `pre-compact.ts:113-114` states the cost as *"one latch read and one `stat` — no file contents"* | read both hooks and `checkHandoverAsk` |
| 4.6 | `15:42`, `:64-65` | `held` is "a row the reader marked" | `held` is cleared and refilled from `boundaryRows()` inside the `selectionchange` handler (`conversations.js:9551-9552`) — the two rows a **text selection** begins and ends in, under a declaration that explicitly refuses to pin every marked row (`:6979-6987`). An anchor mark holds no row | read the handler and the declaration |
| 4.7 | `16:65` | the diagram begins "before `needs` is read at all" | It begins after one filter: the loop is `for (const item of workItems(items, config))` (`needs.ts:489`), and `workItems` already drops `superseded` (`:291-297`) | read both |
| 4.8 | `16:93-94` | "the `--limit 3` note beside that example already says the table is not what a fresh run would show" | The note beside that example is a **dated-reading** note, and §16.3 states twice that `--limit` bounds the ready list and never the held table | read the example's own comment and both §16.3 statements |
| 4.9 | `05:111` | `apiAnchorMark` "does not accept a `kind` or `origin` … unconditionally `kind: 'note'`" | Only `origin` is unaccepted. The body is `{ sessionId, agentId, byteOffset, label, kind?, note? }` (`anchor-write.ts:264`), validated against `OWNER_ANCHOR_KINDS` — six values (`anchors.ts:99-101`) — by `ownerKind` (`:115-128`), defaulting to `'note'` when absent | read the route, the validator and the vocabulary |
| 4.10 | `06` node `RESULT` | "an uncited line is never written at all" | An instruction, not a mechanism. `missionText` tells the subagent *"A claim you cannot cite is a claim you drop"* (`retrieval/mission.ts:345`); `writeResult` (`retrieval/result.ts:290-295`) writes what it is handed; `parseResult` keeps an uncited line *"with an empty `citations`, never as nothing"* (`:258-262`); `validateResult` flags it `kind: 'uncited'` (`:342-352`) | read all four |
| 4.11 | `03:260` | `carryVerdicts` is what carries a live verdict across an edit that does not change meaning, in the gate | Two different mechanisms. The gate drops an already-ruled candidate via `verdictHolds` (`overlap.ts:500-502`); `carryVerdicts` (`mutate.ts:577-595`) is the separate edit-time re-stamp, called at `:2117` and only when the basis moved | read both |
| 4.12 | `01:274` | `launderedEnums` at `item.ts:527`; the finding at `doctor/checks.ts:4289` | `launderedEnums` is `item.ts:576`; the `laundered_enum` finding is emitted at `doctor/body-integrity.ts:565-569`. `doctor/checks.ts` is 2,596 lines and never emits this code | `grep -n` for both symbols; `wc -l` on `checks.ts` |
| 4.13 | 25 stale line citations across `01`, `02`, `03`, `05` | — | All corrected. See §5.4 for the mechanical sweep that found nine more the verifier had not listed | a checker that resolves every `` `file:line` `` citation, confirms it is in range, and reports when the symbol named beside it is not within ±3 lines |

---

## 5. The sweeps

### 5.1 Volatile figures — all 13 corrected and dated, plus 10 more dated

Every one re-measured by the command now printed beside it in the document.

| where | said | is (2026-09-17) |
|---|---|---|
| `01:47` | `categories.ts` 554 lines | **556** |
| `02:10` | `inject.ts` 1,231 | **1,243** |
| `02:11` | `select.ts` 1,833 | **1,851** |
| `01` bullets ×5 | `constraint` 7, `invariant` 6, `open_question` 29, `known_issue` 32, `measurement` 1 | **8, 7, 31, 35, 3** |
| `01:168` | median title 70 chars; 202 of 730 past 80 | median **78**; **586 of 1,320** past 80; longest 566 (unchanged) |
| `01:185` | median body 1,693 characters | **1,985 bytes** |
| `01:295` | "518 items already carrying them … all 133 disagree" | **161** carry either key, **143** carry `last_change` — and see below |
| `13:558` | `test/rules/*` 16 files | **18** |
| `09:365` | "Real output (this repo, today)" | dated 2026-09-17; its `cold (1)` row is now `cold: none` |
| `00:209` | 17 files, 7,376 lines, 508,660 bytes | 17 / **8,130** / **568,622** |
| `01:84` | corpus totals 1,235 items | **1,320** |
| `01:360`, `:421` | `rule` 56, `task` 866 | **58**, **940** |
| `11:31` | `src/review/` thirteen modules | **16** today; thirteen at `870e57c5`, verified by `git ls-tree` |
| `05:80` | 1,355 anchor rows | **1,405**, with all three readings re-taken at one instant so they agree |
| `04:53`, `14:192` | 474 transcripts, 1,269,256,560 bytes | relabelled as the dated sample size of a one-off measurement — see §8.1 |
| `08:278` | "grown past 11,000 lines" | still true as a floor; **12,728** now stated beside it |
| `12:289`, `16:10`, `03:16`/`:656`, `09:14`, `10:22` | undated but correct | all re-measured, all still correct, all now dated |

**`01:295` deserves its own sentence, because the verifier recorded it as unresolved.** It is not a
stale count — it is a **quotation**. `categories.ts:453` records *"the 518 items already carrying
these two keys"* and `:458` quotes the note about 133, both as measured on 2026-09-03 when the
ruling was made. The chapter had restated them in the present tense. They are now attributed to the
ruling, with today's read-only count (161 / 143) printed beside them and the discrepancy named
rather than reconciled. *checked — read `categories.ts:445-460` and re-ran the grep.*

**The `01` bullet list is repaired structurally, not numerically.** Five bullets restated counts the
dated table 300 lines above already carried. The bare counts are gone; the table is re-taken and
says in its caption that it is the only place in the chapter carrying a non-zero count. Twelve
`0 items here` bullets remain — measured zeroes, re-taken today, kept for
`STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is`.

### 5.2 Three uncitable item ids — fixed, and the whole set re-swept

`DEC-the-meaning-hue-budget-is-five` → `DEC-the-meaning-hue-budget-is-five-gold-ok-carry-crit-and-warn` (`05:268`,
`15:316`); `KNOWN-…-restart-that-locks-out-the-next-one` → `KNOWN-a-locked-out-tab-can-only-be-recovered-by-the-restart-that`
(`08:55`). *checked — `mycontext show` run on each wrong id (both answered `no item with id`) and on
each replacement (both printed the item).* Then every `PREFIX-slug` token in all seventeen chapters
was diffed against the 1,320 item files: the 23 that remain unmatched are the deliberate
illustrative corpus in `01`/`12`, the explicitly abbreviated (`REF-the-wave-map-…`), and English
words the pattern catches (`NFKD-normalised`, `CI-gating`). No real uncitable id remains.

### 5.3 The pasted blocks — 10 abridged, 5 doctored, all re-captured by running the command

Everything below was produced by running the command and **redirecting stdout to a file**, then
pasting the file's bytes. Not one character was retyped.

| block | what was wrong | now |
|---|---|---|
| `14:77` `conversation search` | **Doctored.** The `when` column's second line — the `GMT+3` suffix `zonedStamp` always appends (`cli/commands/format.ts:397`) — removed from all seven rows, and the `match` column's wraps folded flat. The table's width is the constant `OUTPUT_WIDTH = 100` (`:83`), chosen so piped and watched output are the same bytes, so the printed shape was one **no run of the command can produce** | re-captured whole, wraps included, with the doctoring named |
| `09:258` `query` schema | **Doctored.** A boxed table retyped as three lines of comma-separated prose, `16 row(s)` footer dropped | re-captured whole |
| `09:265` `query --json` | **Doctored.** Pretty-printed JSON welded onto single lines | re-captured whole |
| `09:283` `ready --limit 3` | **Doctored.** Every wrapped title folded onto one line with a typed `…` | re-captured; the cut of the trailing notes is marked |
| `16:115` `ready --held --limit 3` | **Doctored.** Same fold, plus a straightened curly apostrophe, misaligned borders, and a tail cut mid-sentence with `...` inside the fence | re-captured; both tables and every count whole; the one cut marked |
| `09:344` `audit --limit 5` | **Doctored.** A boxed table retyped as free-form indented rows with a typed `...` | re-captured whole |
| `10:105` `rules list` | **Abridged.** Showed the two-line count and dropped the store-version header, its changelog note **and the entire sixteen-row table** — while a later section pointed a reader back to *"the `rules list` table above"* | re-captured whole, table at its real width |
| `10:121` `rules verify` | **Abridged.** Dropped the store version and the five-line changelog note — the two things this chapter's own prose says the command prints | re-captured whole |
| `09:305` `path --d 72` | **Abridged** in four places, none marked | re-captured whole |
| `16:202` `path --summary` | **Abridged** in four places: the totals line dropped, two sentences cut with `...`, the 21-subject list truncated after three names, the item id under D46 removed | re-captured whole |
| `09:329` `todo --limit 3` | **Abridged** — four closing paragraphs dropped silently | re-captured whole |
| `09:355` `contribution --short` | **Abridged** — cut mid-paragraph, losing the closing sentence chapter 11 quotes | re-captured; cut marked |
| `09:368` `decay` | **Abridged**, and labelled *"this repo, today"*, which names no date | re-captured; cut marked; dated |
| `13:231` `check-basis` | **Abridged** — last line cut mid-list with `...` | re-captured; cut marked |
| `13:243` `RETIRED` record | **Abridged** — second line truncated with `...`, four closing lines dropped | re-captured whole |
| `11:176` `config.json` | **Abridged, and it mattered.** Dropped `"model": "claude-opus-5"` — the third dial, the one this chapter's own opening says turned *"two of three"* into *"all three"*. The paste supported the reading the chapter had just retired | quoted whole, with the omission named |
| `09:169` `status`, `09:217` `search` | faithful at capture, five days stale | re-captured |
| `13:391` four `check:*` scripts | two reproduce exactly, two count the tree and had moved | all four re-run, each with its own date on the command line |

**Every remaining cut uses one shape**, the one `04:344` already used correctly:
`[… N further line(s) … are not shown: <what>. Nothing above this marker is cut, reflowed or
retyped. …]`.

*All of §5.3: **checked** — each command run in this working tree, output redirected, bytes pasted.*

### 5.4 Stale citations — the 25 listed, plus nine more found mechanically

A checker was written for this rather than a reading: it extracts every `` `path:line` `` in the
documents, resolves the path, confirms the line is in range, and — where a symbol is backticked
beside the citation — confirms that symbol appears within ±3 lines of it. Beyond the verifier's
list it found and I fixed: `03:85` (`cli/index.ts:509`→`:556`/`:951`), `03:329`
(`content-hash.ts:110-111`→`:112-113`), `03:331` (`:539`→`:544`), `03:419`
(`rebuild.ts:226`→`:269-276`), `03:445` (`mutate.ts:1026`→`:1028`), `03:449` (`:2100`→`:2102`),
`03:636` (`mutate.ts:1033, 1898`→`:713`/`:690`, called at `:1036`/`:1901`), `12:102`
(`pack/reader.ts` refusal now names `readArtefact` at `:262` as well), and `02:254` — which is §6.1.

### 5.5 The provenance paragraph — rewritten

`00:202-243` told a reader the reference had been verified three times through and said nothing
about the diagram verification at all. It now names **five passes and three repairs**, states the
15-per-repair rate and that it has not fallen, names `check:diagrams` as the one gate that exists
and says plainly that nothing gates a sentence. Its own false absolute — *"no sentence in this
reference asserts what is or is not in a commit, a branch, or 'HEAD'"* — is replaced by the practice
it was trying to state, with the four sentences that break it named. *checked — each of the four
located by grep and read.*

### 5.6 F1, F2, F3

**F1** — the anchors chapter was still headed *"The three creation paths"* after Path 4 was drawn,
in the heading, in a sentence sixteen lines below the diagram, and in the index three chapters away.
All three now read four; the requirement item whose summary names three is quoted as naming three
and the fourth route named beside it. *checked — `grep -c "registerRoute('"` → 4, and
`mycontext show` on the requirement.*

**F2** — `02:40` labelled the SessionStart row "(new/resumed/cleared)" three lines above a table
listing all five sources. The row now reads `startup · clear · resume · fork`, with `compact`
pointed at its own row below. *checked — `session-start.ts:17`.*

**F3** — `15:177` said the UI's `NEAR_CHARS` happens "to match chapter 14's archive-side `near` tier
at the same value", in the doc set that had just repaired a 30-versus-28 claim. Both constants are
30 (`fold.js:1041`, `conversation-search.ts:891`) and the behaviours differ: `nearPairs` walks a
true 30-codepoint gap (`fold.js:1160-1171`) while FTS5's `NEAR(…, 30)` admits 28, its own source
stating the law as `N-2` (`conversation-search.ts:880-882`). The sentence now says they agree on the
number and not on the answer. *checked — read both constants and both implementations.*

---

## 6. Three of the verifier's findings are wrong

Two lanes corrected their briefs today and both were right. These are mine.

**6.1 · §5.13 has `categories.ts:125` backwards, and it points at the wrong chapter.** The report
says chapter 1 cites `:125` for `continuity` when *"`:125` is the `always` row and `continuity` is
`:126`"*. Read directly: `categories.ts:124` is `always: { … values: ['false'] … }` and `:125` is
`continuity: { … }`, both in the `TIER_UPDATES.rationale` block. **Chapter 1's citation was
correct.** The stale one is `02:254`, which cites `:125` for the `always` row with
`values: ['false']` — off by one, in the chapter the report said had it right. Fixed in `02`, left
alone in `01`. *checked — `grep -n "continuity:\|always:" src/core/categories.ts`.*

**6.2 · §4.11's finding is right and its supporting mechanism is not.** The report says `table` is
matched *"out of the turn's text: `anchorsInTurn` calls `tableIn(text)` (`:567`) over literal probes
`ANCHOR_PROBES` (`:695`)"*. `tableIn` does not read `ANCHOR_PROBES`. They are two different things:
`tableIn` → `firstTableSite` (`:121-129`) parses the turn's characters for a delimiter row matching
its header; `ANCHOR_PROBES` (`:695-698`) is the sweep's FTS probe that decides which turns are
**read**, and the source states the split in those words — *"The probe decides what is READ; the
grammar decides what is MARKED"* (`:674-678`). The label was still backwards and is fixed; the
chapter's caption now names the mechanism correctly rather than reproducing the report's version.

**6.3 · §5.13's `03` bullet names `:1213`→`:1215` and misses its twin.** The same claim cites
`:2100` for the edit path, which is `:2102`. Both fixed.

---

## 7. Nine false claims nobody had listed

Found while reading the code for the listed ones. This is the same mechanism the whole campaign is
about: a verified claim makes its neighbours look verified, and the neighbours here were in the same
paragraph.

**7.1 · The spine diagram's `SEL` node carried a second false absolute, in the same fence as §4.1.**
*"pure over the parsed items — no database on this path"* is true of session start and subagent
start and false of the before-a-file path the same diagram's `HK` node lists. Narrowed to "no
database when a session or subagent starts", in all three files. *checked.*

**7.2 · `01`'s lifecycle caption said `validated` is produced by no command — and I nearly drew it
that way.** The caption read: *"nothing in this chapter or chapter 3 traces a command that produces
it, so drawing a transition into it here would still be inventing one."* I wrote an
`active --> validated` edge labelled *"no command in this product produces it — reachable only by
hand"*, and then checked it before moving on. **It is false.** `mycontext edit <id> --status
validated` produces it: `edit` validates `--status` against `STATUSES` (`cli/commands/edit.ts:753`)
and refuses exactly one member, `superseded` (`:764-767`); the usage line at `:96` lists
`active|draft|deprecated|validated`. The edge now names the real command, and the caption says the
old claim was false. **This is the single clearest thing this pass produced**: the sentence was
plausible, it was consistent with the paragraph beside it, it was inherited from text that had
survived four verification passes, and it took one `grep` to disprove.

**7.3 · `13:550`'s "nineteen files in `scripts/` have no coverage anywhere" names files that do have
tests.** `e2e-gate.ts` has `test/scripts/e2e-gate.test.ts`; `gen-diagrams.ts` has
`test/scripts/diagrams-parse-gate.test.ts` and `test/ui/diagram-gate.test.ts`; `check-faint-usage.ts`
has `test/ui/faint-usage.test.ts`. Proving the stronger claim needs an import-graph nobody has run.
Replaced with the weaker fact I could measure — **nine of the 43 scripts are not named anywhere
under `test/` or `e2e/`**, listed by name — and the document now says in those words that this
measures mention and not coverage. *checked — `grep -rl <basename> test/ e2e/` per script.*

**7.4 · `10`'s `rules list` paste dropped the table a later section pointed back to.** §"The sixteen
entries" says the three 2026-09-13 additions *"are listed in the `rules list` table above"*. There
was no table above. Now there is.

**7.5 · `13:231`'s check-basis paste was stale in both directions.** 162→**238** declaring,
622→**691** files, 157→**241** distinct, 10→**11** retired declarations. The "ten RETIRED findings"
sentence beside it now reads eleven.

**7.6–7.9 · Four more stale citations** in `03` and `12`, listed in §5.4, none of them on any
verifier's list.

---

## 8. What I could not fix, and one thing I broke

**8.1 · `04`/`14`'s 474 transcripts / 1,269,256,560 bytes could not be re-derived.** Walking
`~/.claude/projects` today gives 1,126 `.jsonl` files and 2,412,761,820 bytes across every project
on this machine; `mycontext conversation list` reports 13 indexed conversations for this workspace.
Neither is the population the original figure counted, and nothing in the repository says which it
was. **The figure is not corrected — it is relabelled**, in both chapters, as the dated sample size
of a one-off 2026-09-16 measurement of a widening ratio, explicitly not a running count. That is the
honest answer and it is written into the documents rather than into this report alone.

**8.2 · `15:282`'s pixel table is still unverified.** Reproducing it needs Playwright against a live
139 MB session on port 58888. Out of bounds. It carries no date and still does not; I would rather
leave it visibly unverified than date it from a measurement I did not take.

**8.3 · THE ONE THING SOMEONE ELSE MUST FINISH: `src/ui/public/lib/diagrams.js` is now behind by six
entries, and I caused it.** Measured, not inferred: at HEAD, **10 of 10** README fences matched the
working-tree map; after this repair, **4 of 10** do. The three fences I edited — the pipeline spine,
the tiers, the lifecycle — are each in two languages, so six map keys no longer resolve. The map is
content-addressed, so the drawings those keys point at are drawings of the *old, false* fences.
**Until `npm run gen:docs` is re-run, those three diagrams render in the product's own document
screen as a `<pre>` of raw mermaid** (`markdown.js:290-292`'s fallback). I did not run it and did
not touch `src/ui/public/`: the brief puts that directory out of bounds and two lanes are live in
it. **This is a required follow-up, not a nice-to-have** — and it is the same class of defect the
verifier's §7 recorded at HEAD, now caused deliberately and disclosed rather than discovered later.
*checked — the 10-of-10 baseline taken by hashing HEAD's own README fences against the working-tree
map via `git show`; the 4-of-10 after, the same way.*

---

## 9. What was run, and the one failure the gate caught

- **`npm run check:diagrams` after every diagram edit** — about 1.5 s per run, and it proves its own
  red path (the pre-repair `07:78` fence) before reporting any number. **38 of 38 fences parse.**
- **It caught a real failure I introduced.** Rewriting `07`'s sequence diagram I wrote a `;` into a
  message label; mermaid reads that as a statement separator and the fence stopped parsing. Bracket
  balance would have passed it. The gate named the fence, the line and the token in under two
  seconds. Fixed, re-run, green.
- **`node --test test/docs/*.test.ts` with the suite preload** — **112 of 112 pass**, twice: once
  mid-repair and once at the end. This is what proves the README edits did not break
  English/Hebrew structural parity, the example blocks, or the capabilities fixtures.
- `check:text-files`, `check:retired`, `check:cited-items` — all green.
- **Two purpose-built checkers**, both in the scratchpad rather than committed: the citation
  resolver (§5.4) and the shared-fence identity check, which confirms the five README-derived fences
  are still byte-identical across `README.md` and their chapters, and that the Hebrew mirror carries
  the same states and edges in the same order.
- **Disclosure of side effects.** Re-capturing the pasted blocks meant running `status`, `search`,
  `query`, `ready`, `path`, `todo`, `audit`, `contribution`, `decay`, `rules list`, `rules verify`,
  `conversation search`, `conversation list` and four `check:*` scripts. `openStore` is
  `openRebuiltStore` (`cli/index.ts:170-172`), so several of those **refresh `.my_context/.index.db`**
  — a gitignored, derived cache this corpus defines as disposable. No corpus file was written, no
  git state changed, no committed artefact touched. The `.my_context/items/task/*.md` files showing
  as modified in the working tree are another session's `state:todo → state:done` edits, not mine.

---

## 10. And this pass needs verifying too

It wrote roughly 90 new sentences. I checked the code for every one of them except the carried rows
named in §2, and §7.2 is what that discipline bought — one false claim caught in my own draft, in a
sentence that had already survived four passes as prose. **That is not evidence the rate is zero.**
It is evidence that the rate is lower when the writer reads the symbol instead of the paragraph.

The structural fix this pass can point at, as opposed to recommend, is the deletion of duplicated
counts: `01`'s bullet list no longer restates figures the dated table carries, and `05` already
states its count exactly once. A number that exists in one place cannot go stale in five.

What still has no gate is a sentence. `check:diagrams` proves a fence parses; nothing proves a clause
is true. The cheapest next move remains the one the previous report named — and this pass adds one
datum for it: of the fourteen things §7 and §6 turned up, **every single one was found by reading a
symbol, and not one was found by reading the prose beside it.**
