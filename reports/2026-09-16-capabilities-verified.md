# The capabilities reference, re-verified against the tree — 2026-09-16 (second pass)

`TASK-the-capabilities-reference-froze-on-2026-09-13-and-nothing`

The first specialist audited and repaired eight chapters and wrote three new ones, and closed by
asking for exactly this: *"a second specialist should re-verify every number I cited against the
tree once more."* This is that pass. Every figure below was re-read out of the working tree,
every command was run, and nothing was taken from the repaired document's own word.

**214 checkable claims examined across eleven documents. 38 are false. 4 more are near-misses
worth correcting. 3 are dated readings that have legitimately moved. 2 are internal
contradictions the repair pass did not reconcile.**

Read-only throughout. No `git` command that writes, nothing under `src/rules/entries/` touched,
port 58888 untouched, `npm test` never run.

---

## Verdict by document

| doc | checked | false | verdict |
|---|---|---|---|
| `00-index.md` | 22 | 2 (+1 minor) | two stale roll-up bullets, one of them contradicted by its own chapter 10 |
| `04-conversation-archive.md` | 27 | 8 | **every line citation into `conversation-index.ts` is stale**; prose is sound |
| `05-anchors.md` | 30 | 6 | **the worst chapter** — the `ruling` grammar and the probe list it describes were deleted 2026-09-15 |
| `06-retrieval.md` | 5 | 0 | **clean** |
| `07-restore-and-handover.md` | 12 | 0 (+1 minor) | **clean** — the worked example reproduces byte for byte |
| `08-web-ui.md` | 31 | 8 (+1 minor) | facts right, **ten of ten `conversations.js` line citations wrong** |
| `09-cli-and-mcp.md` | 26 | 5 | two broken links; the MCP tool count and the "no `rules` tool" claim are both wrong |
| `10-rule-store.md` | 27 | 3 (+1 minor) | counts repaired correctly; three arithmetic/derived claims are not |
| `14-search-over-the-archive.md` | 24 | 1 | **near-clean** — §14.2's worked example reproduces exactly, digit for digit |
| `15-document-and-lane-viewer.md` | 22 | 3 | three misquoted source measurements |
| `16-the-board.md` | 22 | 2 | one spliced worked example, one invented header size |

---

## 00-index.md — 22 checked, 2 false

**FALSE — "This repository has turned two of the three (`enabled: true`,
`maxProposalsPerPass: 5`, as of 2026-09-13); `model` is unset, so no model is reached here."**
(line 95)
`.my_context/config.json` sets `review.model: "claude-opus-5"`. **All three dials are on in this
repository.** This is the single most consequential false claim in the reference: the whole
"built but off" framing of chapter 11 rests on the third dial being unset here, and it is not.

**FALSE — "`rules verify --restore` … is unreachable code: the branch it needs is guarded by a
condition that is always false."** (line 111)
Reachable since 2026-09-14. `src/cli/commands/rules.ts:316` guards on
`restore && path.resolve(packageStore) !== path.resolve(store)`, and the source comment at
`rules.ts:309` says so in as many words: *"Until 2026-09-14 both were `entriesDir()`, so
`restoreEntries` was unreachable code."* **Chapter 10 of this same reference has the bullet struck
through and marked closed.** The index contradicts its own chapter — the exact defect the index's
own preamble says it repaired two bullets above.

**Minor — "476 KB"** (line 172). The eleven-plus-six chapters are 486,840 bytes = **475.4 KiB**
(or 486.8 kB decimal). Neither convention rounds to 476.

Everything else passes, including the ones most likely to have moved: 17 files ✓, 7,134 lines ✓,
29 shipped categories ✓ (counted off `--help`), **61** doctor finding codes ✓ (counted `code: '`
across `src/doctor/`), sixteen rule-store entries ✓, fifteen developer-tier ✓, twelve ruled write
bindings across five files asserted by `assert.deepEqual` set equality ✓, `dispatchGate`
`src/core/config.ts:600` `{ enabled: false }` and on in this repo ✓, `DEFAULT_DRIFT` at
`src/review/drift.ts:122` with `test/review/drift.test.ts` its only importer ✓, `watchedDocs`
`["docs/**/*.md", "README.md"]` ✓ and eight top-level config keys ✓, `src/core/rank.ts` ✓,
`renderCorrection`/`correctionAtDoor` (`deliver.ts:706`, `:780`) wired to nothing but their own
test ✓. **All twelve appendix commands exist and run.**

---

## 04-conversation-archive.md — 27 checked, 8 false

The prose is sound. **Eight of the nine line citations into `src/core/conversation-index.ts` are
stale** — the file has grown and the 2026-09-13 numbers were carried forward unchanged through a
pass that edited the paragraphs around them.

| claim | true value |
|---|---|
| "Hebrew from record 5", `conversation-index.ts:317` | **:333**. `:317` is a comment saying `tool_result` is 78.9% of the archive |
| `classifyTurn` at `:1390` | **:1658**. `:1390` is inside `listSubagentFiles` |
| FTS5 `conversation_prose` DDL at `:459–468` | **:473–483**. `:459–468` is the `persisted` table |
| `iterateTranscript` at `:1506` | **:1774** |
| byte-offset assertions at `:369–377`, `:1417–1436` | neither block is about byte offsets; the argument is at `:386` and `:359` |
| `forgetConversations` at `:3096–3102` | **:3681**, with its four `DROP TABLE`s at `:3708–3714` |
| seven tables at `:384, 408, 444, 453, 459, 471, 483` | **:398, 422, 458, 467, 473, 485, 497** |
| `eachLine` used at `conversation-index.ts:110, 1552` | import at `:110` ✓, call at **:1820** |
| "`node:sqlite` was already imported in ~14 files" | **16** |

**Unreconciled contradiction inside the product, which the doc repeats without flagging.** The
chapter states `tool_result` is **67.0%** of the archive's characters, sourced from
`conversation-search.ts:78` (which cites `scripts/measure-tool-indexing.ts`). But
`conversation-index.ts:316` says **78.9%**. Two numbers, two source files, same subject. Chapters
14 and 00 both carry the 67.0% figure. The reference should either reconcile these or name the
disagreement; it does neither.

Everything else passes, and several of these are the kind that rot first: the four `DROP TABLE`
names ✓, seven tables in the conversation schema ✓, `line-walk.ts:70, 109, 172` for
`LINE_WALK_CHUNK_BYTES`/`eachLine`/`forEachLine` ✓ **exactly**, its four importers ✓,
`SecretCandidate` at `conversation-secrets.ts:611` with **fourteen** fields ✓ and the 7-shown /
7-omitted split ✓, `conversation.ts:58` listing **nine** subcommands ✓ with `search` among them ✓,
SQLite **3.51.2** ✓, the FTS5 DDL text ✓, `test/core/chunk-seam-utf8.test.ts` ✓, and all three
named `searchArchive` callers ✓ (`anchor-pass.ts:749`, `read-model-conversations.ts:2255`,
`read-model-retrieval.ts:371`).

---

## 05-anchors.md — 30 checked, 6 false

**The worst chapter in the set.** §5.4 describes an anchor pass that no longer exists. The lane
that rewrote it landed on 2026-09-15 (`c382b7a5`, *"a ruling is a turn he typed, not a turn that
quotes a rule"*) and again on 2026-09-16 (`82397eb2`, *"a turn wears two hats"*) — and §5.4a and
§5.6a of this same chapter describe both landings correctly. §5.4 was simply not re-read against
them.

**FALSE — "eight cheap substring 'probes' (`|---`, `DEC-`, `RULE-`, etc., each capped at
`ANCHOR_PROBE_LIMIT = 200` hits)."**
`ANCHOR_PROBES` (`src/core/anchor-pass.ts:695`) holds **two**:

```
const ANCHOR_PROBES = [ { probe: '|---' }, { probe: '| ---' } ];
```

The `DEC-`/`RULE-` probes went with the id grammar on 2026-09-15. The `ruling` grammar now reaches
*every prompt span of a session's own transcript, unranked and unbounded* (`anchor-pass.ts:1326`)
— no probe at all — and `report` comes structurally from the `subagents` table.

**FALSE — the `ruling` grammar is "text containing a normative corpus id matching
`\b(?:DEC|RULE|INSTR|STD|CONST|INV)-[a-z0-9]+(?:-[a-z0-9]+){3,}\b`."**
Deleted 2026-09-15. `anchor-pass.ts:348` carries it in the **past tense** — *"It **was** …, and it
is gone"* — with the measurement that killed it: the id grammar owned 377 of 1,164 marks and
marked **zero** turns the owner typed; 296 were this plugin's own SubagentStart injection block.
What ships now is `ownerTyped(record)` plus `RULING_WORDS` (`anchor-pass.ts:391`):

```
/\b(?:always|never|nevver|must|unacceptable|not allowed|forbidden|from now on|
     i approve|i decide|the rule|this rule|a rule|standardi[sz]e)\b/i
```

The chapter's own rationale sentence goes with it — the `TASK-`/`REQ-` exclusion it explains no
longer exists because no id is matched at all.

**FALSE — "this repository holds 728 `TASK-` items against 94 `DEC-`."**
**926** task items and **99** decision items (`ls .my_context/items/{task,decision}/*.md`).

**FALSE — "It runs three fixed, structural grammars over turn text, first match wins."**
`anchorsInTurn` (`anchor-pass.ts:567`) pushes **every** match and returns them all; the source
header says *"this list can hold at most two entries today."* §5.6a of this same chapter is built
entirely on a turn wearing two marks. "First match wins" is the pre-2026-09-16 behaviour.

**FALSE — §5.3's origin block: "confirmed on this workspace's own 636-line file … 635 automatic,
1 owner."**
The file is **1,342 lines**: **1,341 automatic, 1 owner**. §5.3 carries two measurements side by
side — the `kind` block was refreshed to 2026-09-16 and sums to 1,342; the `origin` block three
paragraphs above it was left at 2026-09-12. §5.2 meanwhile says the file was 715 on 2026-09-13.
Three different sizes for one file inside two sections.

**FALSE — "`decision` alone gets its own group; `defect`, `question` and `todo` share a second;
`table`, `report` and `evidence` share a third; `note` carries no hue at all."**
That accounts for **8 of the 9 kinds** and omits `ruling`. `ANCHOR_KIND_HUE`
(`screens/conversations.js:1228`) is:

```
ruling: kindsettled   decision: kindsettled
defect: kindowed      question: kindowed     todo: kindowed
table:  kindfound     report:   kindfound    evidence: kindfound
note:   null
```

`decision` does **not** have its own group. The sentence immediately before it — "each of the nine
possible kind strings … resolves to one of three hue groups plus an unhued fourth" — is correct;
the list under it is not.

The rest of the chapter is strong, including the numbers most likely to have moved: kind counts
1 `note` / 440 `report` / 40 `ruling` / 861 `table` ✓ **exactly**, 1,342 total ✓, "440 of 1,342" ✓,
eight fields plus the `protocol` tag = nine keys ✓, `AUTOMATIC_ANCHOR_KINDS` ✓,
`OWNER_ANCHOR_KINDS` six and in that order ✓, `ANCHOR_PROBE_LIMIT = 200` ✓,
`TURN_PROSE_BUDGET_MS = 250` ✓, `TURN_PROSE_SOURCE_BYTES = 16 MiB` ✓, `anchorIdBeside` ✓,
`IN_ANCHOR_TRANSACTION` as a `WeakSet` in `anchor-file.ts:266` ✓, `automaticAnchorsStanding` ✓,
AUC 0.499 / 47% ✓ verbatim, "+240 rows, 0 rewritten" ✓ (244 `#report` beside-rows standing today),
all three named test files ✓, `POST /api/conversations/anchors/mark` ✓,
`RetrievalMode` at `mission.ts:50` ✓, `read-model-retrieval.ts:105` ✓ **exactly**.

---

## 06-retrieval.md — 5 checked, 0 false

**Clean.** The repaired paragraph is precisely right, including its most checkable claim: this
module still calls the older untiered `searchArchive` — `read-model-retrieval.ts:68` imports it and
`:371` calls it, with no `searchArchiveTiered` anywhere in the file.

---

## 07-restore-and-handover.md — 12 checked, 0 false

**Clean, and the strongest evidence in the reference.** `node scripts/check-handover.ts`
reproduces the pasted block **byte for byte**: all seven `CARRIED` entries with their line numbers
(`:395`, `:395`, `:234`, `:310`, `:248`, `:248`, `:395`), their carry counts (10, 10, 8, 8, 4, 3,
3 of 49), the summary line `4882 line(s), 49 block(s) · 250 distinct pointer(s): 165 lane, 85 item
· 0 resolving to nothing, 4 naming retired work`, the "7 instruction(s) carried into 3+ blocks"
tier, and **exit code 0**. `head -c 200 reports/V2-HANDOVER.md` prints `## ⏭` ✓, and the file
holds 49 top-level `##` blocks ✓ — including the 45 `## ⏭` handover blocks and 4 others.

The decision to *stop* quoting line 1's content and to quote the command that proves the property
instead is the right repair, and it is the only place in the reference where a stale live excerpt
was fixed by removing the excerpt rather than by refreshing it.

**Minor** — `inject.ts:566–568` for `!manual && !subagent && !compacting` (cited at lines 58 and
467): the condition is at **`:571–573`**. The claim itself is exactly right.

---

## 08-web-ui.md — 31 checked, 8 false

Every *fact* about the surface holds. Every *line citation* into the two largest files does not.

**FALSE — all ten `screens/conversations.js` line citations.** `:1215, 1562, 1598, 1757` (anchor
writes), `:5215, 5235, 5277` (lane-side handlers), `:2375, 2419, 2462` (retrieval
stage/confirm/approve). Not one of the ten is a write call — `:1215` is a `@media print` comment,
`:5235` is `return turn;`, `:2462` is a byte-offset parse. The file is now **11,261 lines**. The
real call sites: anchor drop `:1988`, anchor mark `:2084` and `:2170` and `:7156`; retrieval
`:3494` (mission), `:3667` (return), `:3797` (stage), `:3841` (confirm), `:3884` (approve). This
paragraph *was* edited in the repair pass — two new sentences were spliced into the middle of it —
and the citations either side of the splice were left alone.

**FALSE — `RULED_WRITES` at `test/ui/no-writes.test.ts:567` and the assertion at `:2030`.**
`:590` and `:2077`. (The list holds twelve entries ✓ and the assertion is `assert.deepEqual(
bound.sort(), RULED_WRITES, …)` ✓ — set equality ✓, five files ✓, every binding name ✓.)

**FALSE — `src/ui/anchor-write.ts` registers its four routes at `:357–366`.** **`:511–522`.**
(The four paths are correct ✓.)

**FALSE — `src/ui/retrieval-write.ts` registers three at `:420–427`.** **`:425–434`** — the cited
range stops before the third. (The three paths are correct ✓.)

**FALSE — "three lines above `NAV`, `app.js` reads `// them. TWENTY-ONE OF TWENTY-ONE.` and, two
lines above that, `// FOUR groups, by TENSE, and ALL TWENTY-ONE SCREENS`."**
The order is inverted and both distances are wrong. `// them. TWENTY-ONE OF TWENTY-ONE.` is at
**:283**; `// FOUR groups … ALL TWENTY-ONE SCREENS` is at **:289** — *below* it, not above — and
`NAV` is at **:303**, twenty and fourteen lines down respectively. The substantive point is
correct: the array beneath both comments holds exactly 20 entries.

**FALSE — "1,314 key lines from each … the files themselves are 2,386 and 1,629 lines."**
**1,462 key lines each**; `en.js` is **2,648** lines and `he.js` **1,790**. (Dated 2026-09-13 in
the doc, but the tables moved again this week and this pass did not re-read them.)

**FALSE — "`src/ui/` registers **76 routes**."** **77.**

**FALSE — "the actual document viewer at `/doc.html` still opens any of the ~190 tracked Markdown
files."** **274.** `isServableDocPath` (`src/doctor/checks.ts:461`) admits `README.md` plus every
`.md` under `docs/` or `reports/`; `git ls-files` counts 274 of them. `reports/` grows daily, so
this number was never going to hold — but it is 44% low, not marginally low.

**Minor** — `strings-parity.test.ts`'s monospace test is at `:195` (cited `:204`) and the value-slot
test at `:215` (cited `:229`); both citations land *inside* the right test. `:116–123` ✓ exact.

Everything else passes: 4+6+7+3 = **20** ✓ counted off the array; `SCREENS` defines a loader for
all 20 ✓; every screen → module row ✓; `cli-help` in neither `NAV` nor `SCREENS` and imported
inside `library.js` ✓; `RAIL_COUNTS = ['doctor', 'work']` ✓; `lib/command-actions.js` imported by
exactly **eight screens** — `config`, `conversations`, `coverage`, `doctor`, `packs`, `port`,
`proc`, `work` — plus `app.js` and `lib/builder.js` ✓ **exactly**; `clearUiServerRecord(owner,
globalRoot?)` at `ui-server-record.ts:343` with the `pid` **and** `port` conjunction and the
`'names-another-server'` / `'no-record'` outcomes ✓ verbatim; four sibling parity tests ✓.

---

## 09-cli-and-mcp.md — 26 checked, 5 false

**FALSE — two broken links.** Lines 293 and 491 both point at **`./15-the-board.md`**, which does
not exist, and both label it *"Chapter 15 — The board."* The board is **`./16-the-board.md`**;
chapter 15 is the document and lane viewer. These are the only two broken internal links in all
seventeen chapters — every other `](./…md)` and every `#anchor` resolves.

**FALSE — "`src/mcp/tools.ts` (2,756 lines)."** **2,627.**

**FALSE — "Grepping for `name: '...'` finds **26 tools**, matching the set already visible in this
session's own tool list exactly."** **28 distinct tools.** The two the count misses are
`list_rules` (`tools.ts:2491`) and `verify_rules` (`:2497`).

**FALSE — "The MCP surface has **no tool** for … `rules` …"** (stated twice, at lines 415 and
454). `list_rules` and `verify_rules` are registered MCP tools, `annotations: READS`, backed by
`src/mcp/tools/rule-store.ts`. And `list_rules` takes an optional `id` — *"One entry id, to read
that entry in full instead of listing them"* — so it serves `rules show` as well as `rules list`.
The only rule-store surface genuinely absent from MCP is `--restore`, which is deliberately
excluded by name.

**FALSE — "`run` ends `return lines.join('\n')` (src/mcp/tools.ts:1434)."** The `ready` tool's
return is at **`:1405`**; `:1434` is inside `doctor`.

The rest is excellent, including two worked examples that reproduce **exactly**:

- `node src/cli/index.ts search "budget" --limit 3` — all three rows in order, and the trailer
  `Ordered by relevance… 169 contain(s) that text as one phrase; 3 more share at least one of its
  words. Searched 1306 item(s).` / `172 item(s) match; 3 shown.` ✓ digit for digit.
- `node src/cli/index.ts path --d 72` — `D72 │ open │ 2/4 │ 2 │ 0 │ 0 │ readmodel` ✓ exactly.

Also ✓: 34 files grep / **33** register / the 33-name list including `path` ✓; `registry.ts:46` ✓
exactly; `node src/cli/index.ts registry` → `unknown command "registry"` ✓; **49** top-level
commands ✓ counted off `--help`, and `docs/cli-ui-coverage.md:7` states 49 ✓; the "21-and-counting"
subjects ✓ (`path --all` says 21); `src/mcp/server.ts` is **60 lines** ✓ exactly; `.mcp.json` ✓;
seven English help topics plus `categories.he.md` and `he.ts` ✓ exactly; **twelve** `MYCONTEXT_*`
environment variables ✓ exactly; `list_items` → `searchItems` ✓; `FIELD_WEIGHTS` title/summary 3,
tags/id 2, body/observations/extra 1 ✓ exactly, and `request` deliberately unranked ✓
(`rank.ts:167`).

---

## 10-rule-store.md — 27 checked, 3 false

The count repair is correct and thorough — sixteen entries, 41,955 bytes, one product / fifteen
developer, `rules list` reproducing exactly. Three *derived* claims were not re-derived.

**FALSE — "`src/rules/store.ts` (136), `src/rules/deliver.ts` (659) and `src/rules/delivered.ts`
(384) are **1,179 lines** … `manifest.ts` (645) and `schema.ts` (432) bring the directory to
2,256."**
Actual: `store.ts` **155**, `deliver.ts` **785**, `delivered.ts` **430** = **1,370**;
`manifest.ts` **493** (not 645), `schema.ts` 432 ✓. And the directory now also holds
**`integrity.ts` (243)** — which this chapter *itself* says was split out of `manifest.ts`, which
is exactly why `manifest.ts` shrank by 152 lines. The directory is **2,538 lines**, not 2,256.
Every number in the sentence except `schema.ts` is wrong, and the chapter contains the explanation
for why.

**FALSE — "Replaying every `added` list from empty, in order, yields **12** entries against a
directory of **16**"** and its restatement "`store.changelog` (5 versions, **12** reconstructible
entries)".
The replay yields **11**. The chapter's own list of never-added entries has **five** names — and
16 − 5 = 11, not 12. The 2026-09-13 version said 11 against 15 with four missing, which was right;
the increment to 12 is arithmetic the pass did not check against its own list.

**FALSE — "There is no MCP path to the rule store at all — `rules verify|list|show` are
CLI-only."**
`list_rules` and `verify_rules` are MCP tools (see chapter 9 above), and `list_rules(id)` renders
one entry in full. The argument the bullet builds on top of it — *"an agent that only has tool
calls cannot follow its own remedy"* — fails with the premise: an agent with tool calls can run
`list_rules` today.

**Minor** — four hook citations are each 3–6 lines short: `session-start.ts:131` → `:134`;
`subagent-start.ts:318` → `:319`; `pre-compact.ts:219` → `:225`; `pre-tool-use.ts:703` → `:708`.
All still land in the right function.

Everything else passes, including the seals: `wc -c src/rules/entries/*.md` = **41,955** ✓ exactly;
sixteen `.md` ✓; one `tier: product` / fifteen `tier: developer` ✓; `mycontext rules list` prints
`16 entry(s) in force here. This workspace IS my_context, so developer-tier` ✓ verbatim; the five
entries in no `added` list, by name ✓ exactly; store version 5 published 2026-09-11T09:50:41.624Z
✓; five kinds and their required parts ✓; `Tier = 'product' | 'developer'` ✓;
`workspaceIsMyContext` ✓ verbatim; `packageRoot()` at `store.ts:51–53` ✓ exactly;
`Door` union at `delivered.ts:165` ✓ exactly; `MAX_ROWS = 5000` at `delivered.ts:233` ✓ exactly;
`hooks.json` matcher `Read|Edit|MultiEdit|Write|NotebookEdit|Agent` ✓ exactly, six names ✓;
`pre-tool-use.ts:741` for the stderr write ✓; and — correctly overturning the index — `rules verify
--restore` reachable ✓.

---

## 14-search-over-the-archive.md — 24 checked, 1 false

**The best-evidenced chapter in the reference.** §14.2's worked example reproduces **exactly**,
today, including every count the answer computes on the fly: seven hits, `phrase: 3 shown of 3`,
`near: 3 shown of 48`, `both: 1 shown of 1009`, `and 1138 more in what was RUN`, all seven rows in
order with their byte offsets. That is a live output pasted honestly.

**FALSE — §14.4's worked example is not the output it claims to be.** Run today,
`conversation search "index report -lane" --sources both --limit 2` returns **three** rows (phrase
1, near 2) and prints the three per-tier lines and the `tool_result`/`thinking` disclosure. The
pasted block shows **two** rows and then asserts `3 hit(s)` — its own table contradicts its own
count line — and drops the four trailer lines that §14.2 of the same chapter calls *"required
disclosure, not decoration."* Presenting an abridged paste as real output is exactly the shape
this reference exists to refuse.

**Moved, not wrong — three dated readings.** The chapter explicitly dates them and tells the
reader to re-run, so these are reported as current values rather than as errors:

| §14 says (2026-09-16) | today |
|---|---|
| `trigram hebrew`: 1 block old / 63 passages new | 3 phrase hits (the old reading) / **83** (3 + 58 + 22) |
| 474 transcripts, 1,269,256,560 bytes | **479**, **1,293,708,238** |
| prompt 1,671 / 6,050,609 · answer 9,920 / 7,538,303 · ran 58,361 / 30,277,871 · total 69,952 / 43,866,783 | **1,690 / 6,146,059 · 10,008 / 7,639,457 · 59,168 / 30,658,699 · 70,866 / 44,444,215** |

The table is internally consistent (the three kinds sum to the total ✓, and the `before` row is
correctly *smaller* than prompt+answer, as it must be if it was taken earlier), and the 3.2x
widening still holds at today's numbers (44.44 / 13.79 = 3.22x).

Everything else passes: `NEAR_CHARS = 30` ✓, `MIN_QUERY_CHARS = 3` ✓, `TOOL_VALUE_CAP = 2_000` ✓,
`SEARCH_TIERS = ['phrase','near','both']` ✓, `SearchSources = 'said'|'ran'|'both'` ✓,
`UNINDEXED_BLOCKS = ['tool_result','thinking']` ✓, **`Omit<SearchScope, 'offset'>` as the tiered
function's parameter type** ✓ exactly as described, `ANCHOR_PROBE_PAGES = 25` × `ANCHOR_PROBE_LIMIT
= 200` ✓, `matchProse`'s `ORDER BY score ASC` on `bm25()` ✓, `parseSearchQuery` returning
`{ phrase, terms, short, excluded }` ✓, the `-word` rule gated at `token.length - 1 >=
MIN_QUERY_CHARS` ✓, all four cited same-day reports on disk ✓, the CLI flag list ✓.

---

## 15-document-and-lane-viewer.md — 22 checked, 3 false

All three falsehoods are the same failure: a number lifted out of a source report with its
qualifier removed.

**FALSE — "`fold.js` (102 lines)."** `src/ui/public/lib/fold.js` is **760 lines at `HEAD`** and
**1,339 in the working tree**. The source report
(`reports/2026-09-16-folding-and-highlight.md:63`) says *"**102 lines of code** in a 305-line
file"* — a count of *code* lines, in a file that was 305 lines then and has more than quadrupled
since. The chapter dropped "of code", dropped "in a 305-line file", and attached the remainder to
the filename.

**FALSE — "`src/ui/public/lib/panel.js` (320 lines)."** **407 at `HEAD`**, 429 in the working tree.

**FALSE — "Typing three literal dots finds the single ellipsis character `…` — this product writes
**3,062** of them across its own strings."**
3,062 is the count of U+2026 in the **conversation archive's prose spans**, not in this product's
strings — `reports/2026-09-16-search-adopt-or-build.md:170`, under a table of the characters
responsible for the 806 of 11,251 spans that change under NFKD. Measured against the tree: the UI
string tables (`strings/en.js` + `he.js`) hold **80**; all of `src/` holds **748**; every tracked
file in the repository holds **3,452**. No reading of "its own strings" gives 3,062.

**Already overtaken, and worth flagging rather than scoring.** §15.2 describes *"three options a
reader can tick"* (case, whole word, regex). That is correct against `HEAD`. In the working tree
right now, `fold.js:731` exports `MODES = ['normal', 'wildcard', 'logical', 'regex']` — four
exclusive read modes, with `caseSensitive` and `wholeWord` as two independent booleans beside them
(`conversation-search.ts`, `FindOptions.mode`, `semantic/11`). None of it exists at `HEAD`, and the
untracked `TASK-the-find-panel-offers-regular-expressions-and-no-help-and` names the lane. The
refusal table's *"Prefix `*`"* row is the one a wildcard mode most directly unsettles. This is not
a defect in the chapter; it is a chapter that will be one day old.

Everything else passes, and the constants are exact: `FIND_SCAN_CAP = 40_000` ✓,
`FIND_HITS_PER_TURN = 500` ✓, `FIND_PAINT_PER_ROW = 300` ✓ (`conversations.js:4035`),
`FIND_REGEX_BUDGET_MS = 5_000` ✓, `nestedQuantifier` ✓ and checked *before* compilation
(`fold.js:1332`) ✓, `paintFinds` ✓ and `openFindPanel` ✓, `<dialog class="mcpanel">` created at
`panel.js:186–187` with `show()` and the explicit *"NEVER `showModal()`"* at `:422` ✓. The two
quoted strings are **verbatim from the string table**: `conv.doc.matchedFull` ✓ word for word
including "out of {records} records", and `conv.find.wordHeb`'s *"IN HEBREW THIS ALSO DROPS THE
GLUED FRONT PARTICLE"* ✓.

---

## 16-the-board.md — 22 checked, 2 false

**FALSE — "a 200-line header comment at the top of `src/core/needs.ts`."** The top-of-file header
runs lines **1–48** — the first `*/` is at `:48` and the first `import` at `:49`. The file is 866
lines and is heavily commented throughout, but the header the sentence points at is 48 lines.

**FALSE — §16.3's `ready --held --limit 3` block is a splice.** It is introduced as *"Real output
… showing both the ready list and what is held behind it"* and then shows a single table with a
`held by` column. That table is the **third** table the command prints — the held list — and it
really has **four** rows (`walk/18`, `docsys/11`, `port/99`, `port/98`), of which three are shown.
The ready list the sentence promises is absent: the command's *first* table has columns
`task │ pri │ state │ title` with no `held by`, and today reads `anchors/12`, `anchors/13`,
`budget/6`. Every *number* in the block is right — `150 ready; 3 shown`, `4 open task(s) held`,
`1 open question(s)` ✓ — so this is an editing failure, not a measurement one.

**Moved, and disclosed as dated.** "23 of 153 open task items had already been named by a commit
since 2026-09-14" → `node scripts/check-board.ts` now reports **3 of 154 open work items, over the
last 120 commits (2026-09-12 to 2026-09-16)**. Lanes have been closing items since.

Everything else passes, and §16.5's two blocks reproduce essentially verbatim: `path --d 72` ✓
exactly; `path --summary`'s WAITING ON YOU section ✓ including both subjects, `D46 · walk/89` with
its question id and `D67 — the whole subject is held by your own ruling` ✓ verbatim; **21**
subjects reading open with every item done ✓; **18** orphan work items ✓; **78** subjects in the
map ✓; the 100% disclosure paragraph ✓ verbatim. Also ✓: `scripts/check-board.ts` wired into
**both** `.github/workflows/ci.yml:145` and `release.yml:84` ✓, `check:needs-cycles` beside it in
both ✓, `--orphans` ✓, `REF-the-d-numbers-what-each-one-means-and-which-are-only` present and
`always: true` ✓, `REF-the-wave-map-…` ✓, `reports/2026-09-11-the-d-numbers-record.md` ✓,
`questions.ts`'s `plan:governance seq:9` ✓, and §16.1's 2026-08-28 measurement (425 items, zero
dependencies, 4 of ~28, `the/45`) ✓ **verbatim** from `needs.ts:5–18`.

---

## The pattern worth naming

Two failure modes account for 33 of the 38 false claims, and they are different from each other.

**1. A line number is a date too.** Nineteen of the thirty-eight are citations that no longer point
at what they name — every one into `conversation-index.ts`, ten into `conversations.js`, four in
chapter 8's test/route citations, four in chapter 10's hook citations. Not one is out of the
file's range, so nothing shallow catches them. In several cases the *prose around the citation was
edited in this very pass* and the citation inside it was not re-resolved. A line citation into a
file that grew 30% in four days is a claim with a shelf life measured in commits, and the two
worst-hit files (`conversation-index.ts`, `conversations.js`) are the two largest in the tree.

**2. A chapter can repair its new section and leave its old one describing deleted code.** Chapter
5 is the case: §5.4a and §5.6a document the 2026-09-15 and 2026-09-16 anchor landings *correctly
and in detail*, while §5.4 four paragraphs above still describes the probe list and the `ruling`
regex those landings deleted. The repair pass read the diff and wrote about what changed; it did
not re-read what the change invalidated. §5.3's two anchor measurements — one refreshed, one left
at 2026-09-12, four days and 700 rows apart, inside one section — is the same failure in miniature.

Two further observations:

- **The index is the least-verified file in the set.** Both of its false claims are bullets its own
  chapters overturn — chapter 10 struck `rules verify --restore` through and the index still
  carries it; the config file contradicts the review-dials bullet. An index that summarises
  chapters has to be re-read *after* them, and this one was not.
- **Where a chapter pasted real command output and let it be checked, it held.** `check-handover`,
  `search "budget"`, `path --d 72`, `path --summary`, `ready --held`'s figures, `rules list`,
  `conversation search "index report"` — seven live outputs, seven reproductions, digit for digit.
  The two that failed (§14.4, §16.3) failed because they were **edited** after being captured — a
  row dropped, a trailer trimmed, two tables presented as one. The discipline works; abridging
  breaks it. A pasted output should be whole or explicitly marked abridged, as chapter 4's
  `secrets` JSON correctly is.

---

*Verified 2026-09-16 against the working tree at `8519e0c7` plus uncommitted changes. Read-only:
no `git` command that writes, `src/rules/entries/` untouched, port 58888 untouched, `npm test` not
run. Every count in this report is itself a dated reading — the corpus, the anchor file and the
archive all grew while it was being written.*
