# The capabilities reference, verified a second time — 2026-09-17

`TASK-the-capabilities-reference-froze-on-2026-09-13-and-nothing`

The pass of 2026-09-16 (`reports/2026-09-16-capabilities-verified.md`) checked 214 claims across
eleven chapters and found 38 false. The architect repaired all 38, found a 39th outside that scope,
and committed the result at `1ec219c2`. The main session spot-checked six of the thirty-eight and
stated plainly that a full second pass had not been run. **This is that pass.**

**282 checkable claims verified against the working tree at `1ec219c2` (clean). 21 are false.**
Six more have legitimately moved since the repair and say so; two more cannot be reconstructed.

**All 38 repairs are genuine. Every one was re-derived from the tree and every one is correct.**
Two of them are *incomplete* rather than wrong — the fix landed in one place in a chapter and not in
its twin two screens away — and that is the same failure the first pass named in chapter 5,
reappearing inside the repair itself.

Read-only throughout: no `git` command that writes, nothing under `src/rules/entries/` touched,
port 58888 untouched, `npm test` never run.

---

## Verdict by document

| doc | checked | false | verdict |
|---|---|---|---|
| `00-index.md` | 29 | 2 | both repairs correct; its own footer's line count and byte size are wrong |
| `04-conversation-archive.md` | 26 | 0 | **clean** — all nine repaired citations land exactly |
| `05-anchors.md` | 38 | 2 | six repairs correct; §5.3's refreshed numbers now contradict five other sections |
| `06-retrieval.md` | 3 | 0 | **clean** |
| `07-restore-and-handover.md` | 15 | 1 | repair correct; `check-handover` still reproduces byte for byte |
| `08-web-ui.md` | 39 | 0 | **clean, and the strongest chapter in the set** — thirteen new citations, thirteen exact |
| `09-cli-and-mcp.md` | 25 | 2 | five repairs correct; two citations *beside* the repaired one were never re-resolved |
| `10-rule-store.md` | 33 | 8 | **the worst chapter now** — a pasted "verified by grep" block contradicts the prose below it |
| `11-self-improvement-loop.md` | 10 | 3 | the dials repair is correct; three citations around it are stale |
| `14-search-over-the-archive.md` | 18 | 0 | **clean** — §14.4's unabridged replacement reproduces exactly |
| `15-document-and-lane-viewer.md` | 25 | 2 | three repairs correct; §15.2 asserts unlanded work that had already landed |
| `16-the-board.md` | 21 | 1 | splice repaired into three tables; the held table still drops a row |

---

## Were the thirty-eight actually repaired? Yes — all 38, re-derived here

Verified individually against the tree, not against the repair's word:

**`04` — nine citations, nine correct.** `:333` is the Hebrew-from-record-5 comment; `classifyTurn`
is at `:1658` and is thirteen lines; the FTS5 DDL runs `:473–483`; `iterateTranscript` is at `:1774`;
`forgetConversations` at `:3681` with its four `DROP TABLE`s at `:3708`–`:3714`; the seven tables at
`398, 422, 458, 467, 473, 485, 497` exactly; `eachLine` imported at `:110` and called at `:1820`;
`node:sqlite` in **16** files. The byte-offset argument is now cited by symbol rather than by line,
which is the right repair.

**`05` — six for six.** `ANCHOR_PROBES` holds exactly two (`anchor-pass.ts:695`); the id-regex
`ruling` grammar is gone and `ownerTyped` + `RULING_WORDS` ship in its place, quoted verbatim;
`anchorsInTurn` returns every match; `ANCHOR_KIND_HUE` groups `ruling` *with* `decision`; the
`728 TASK-/94 DEC-` claim is deleted rather than patched; §5.3's origin block now reads off the
same instant as its `kind` block.

**`07` — `inject.ts:566–568` → `:571–573`.** Correct, both occurrences. And the worked example
still reproduces **byte for byte**: seven `CARRIED` rows at `:395, :395, :234, :310, :248, :248,
:395`, carries `10, 10, 8, 8, 4, 3, 3 of 49`, the summary line `4882 line(s), 49 block(s) · 250
distinct pointer(s): 165 lane, 85 item · 0 resolving to nothing, 4 naming retired work`, the
seven-instruction tier, **exit code 0**. `head -c` prints `## ⏭`; `BLOCK_HEAD` is `/^#{2,3}\s*⏭/`
and matches 45 `##` + 4 `###` = **49** ✓.

**`08` — eight for eight, and this is the best repair in the commit.** Thirteen new
`conversations.js` citations were re-read one at a time and **all thirteen are exact**: `drop :1988`;
`mark :2084, :2170, :7172`; `relabel :2793, :7077`; `sweep :3106, :3166`; retrieval
`:3494, :3667, :3797, :3841, :3884`. Also correct: `no-writes.test.ts:590`/`:2077`,
`anchor-write.ts:511–522`, `retrieval-write.ts:425–434`, `app.js:283`/`:289`/`:303` in the corrected
order and distances, **1,462** keys in each table, `en.js` **2,648** / `he.js` **1,790**,
**77** routes, `strings-parity` `:195`/`:215`.

**`09` — five for five.** Both `./15-the-board.md` links are gone and **every internal chapter link
in all seventeen files resolves**; `tools.ts` is **2,627** lines; `name: '` gives 29 matches and
**28** distinct tools, `list_rules` at `:2491` and `verify_rules` at `:2497`; `:1405` really is
`return lines.join('\n')`.

**`10` — three for three, and the line-count repair is exceptional.** `store.ts` **155**,
`deliver.ts` **785**, `delivered.ts` **430** = **1,370**; `manifest.ts` **493**, `schema.ts` **432**,
`integrity.ts` **243**; `wc -l src/rules/*.ts` = **2,538** exactly. The changelog replay was
re-derived from `manifest.json` here: 12 distinct `added` strings, one of them `def-lane` which no
longer names a file, → **11** reconstructible against **16**, with the **five** never-added entries
named exactly as the chapter lists them. Store version 5, `2026-09-11T09:50:41.624Z`.

**`11` — the 39th, and it is right.** `.my_context/config.json` carries `review.enabled: true`,
`maxProposalsPerPass: 5`, `model: "claude-opus-5"`. `DEFAULT_REVIEW` ships `false` / `0` / `null`.

**`14` — §14.4 replaced with the whole output, and it reproduces.** Run today: four rows in the same
order, same tiers, same byte offsets, same timestamps, all four trailer lines present. Only two
totals moved (`near … of 103` → `105`, `both … of 961` → `974`) on an archive that grows hourly.

**`15` — three for three.** `fold.js` **1,339**, `panel.js` **429**, and the 3,062 ellipses correctly
re-attributed: `en.js` 43 + `he.js` 37 = **80**.

**`16` — two for two.** `needs.ts`'s top-of-file header is **48** lines (first `*/` at `:48`) in an
**866**-line file, and §16.3 now prints all three tables.

---

## The 21 false claims, with their true values

### `00-index.md` — 29 checked, 2 false

**FALSE — "17 files, 7,364 lines"** (line 181). **7,376.** `cat docs/capabilities/*.md | grep -c ''`
= 7,376, and `wc -l` agrees. 17 files ✓.

**FALSE — "~495 KB (`wc -c docs/capabilities/*.md`, decimal kB)"** (line 181). **508,660 bytes** —
**508.7 kB** decimal, or 496.7 KiB. The git blob total is identical, so this is not a line-ending
artefact. The stated convention makes the figure 14 kB low.

Everything else holds, including every figure most likely to have moved: 29 categories ✓ (counted
off `--help`), **61** doctor codes ✓, 16 rule entries ✓, 15 developer-tier ✓, 20 rail screens ✓,
twelve ruled write bindings across five files ✓ (enumerated from `RULED_WRITES`), all three review
dials ✓, `DEFAULT_DRIFT` `drift.ts:122` ✓ and imported by nothing but its own test ✓,
`DEFAULT_DISPATCH_GATE` `config.ts:600` ✓ and on in this repo ✓, both `watched_doc_*` finding codes
✓, the `#the-rest-of-configjson--the-eight-top-level-keys` anchor ✓, `rules.ts:316`/`:309` ✓,
`manifest.ts:112` *"`loadRules` never calls this"* ✓, all twelve appendix commands present ✓.

### `05-anchors.md` — 38 checked, 2 false

**FALSE — the chapter now carries two different sizes for one file, in one instant, and two
sections cite §5.3 for a number §5.3 does not contain.** §5.3, refreshed by this repair, reads
**1,345** rows / **1,344** automatic / **442** `report` / **862** `table`, and does the arithmetic
to prove the three readings agree. But:

| says | true value per §5.3 |
|---|---|
| §5.4a (line 204): *"440 of 1,342 rows (§5.3)"* | 442 of 1,345 |
| §5.6 (line 308): *"§5.3's own measurement is that even 1,342 marks"* | 1,345 |
| §5.6a (line 351): *"861 turns already carried a judged-good table mark"* | 862 |
| §5.6a (line 353): *"861 `table` + 440 `report`"* | 862 + 442 |
| §5.7 (line 403): *"1,342 on 2026-09-16"* | 1,345 |

Two of the five name §5.3 as their source and misquote it. This is the chapter-5 failure mode the
first pass named — a section refreshed while its neighbours are not — **reintroduced by the repair
that was fixing it**. (For the record the file is **1,348 / 1,347 / 443 / 40 / 864** today; that
part is ordinary, disclosed growth.)

**FALSE — "Measured on a foreign archive … 13,375 turns, 575 lanes"** (§5.6, Path 2).
`anchor-pass.ts:1076` says *"one session, 575 lanes, **13,375 prose spans**, 726 of them turns the
person typed"*. 13,375 are prose spans; the turn count is **726**.

Everything else in this chapter is exact, including every number a reader would most doubt:
`RULING_WORDS` verbatim ✓, `ANCHOR_PROBE_LIMIT = 200` ✓, `ANCHOR_PROBES` two ✓, `ownerTyped`
`:512` ✓, `anchorsInTurn` `:565` with *"at most two entries today"* at `:561` ✓, AUC 0.499 / 47% ✓,
10,836 spans / 377 of 1,164 / 296 / 519 turns / 13 days / 143 modal ✓ **all five**,
`TURN_PROSE_BUDGET_MS = 250` ✓, `TURN_PROSE_SOURCE_BYTES = 16 MiB` ✓, `IN_ANCHOR_TRANSACTION` a
`WeakSet` at `anchor-file.ts:266` ✓, `OWNER_ANCHOR_KINDS` six and in that order ✓,
`ANCHOR_KIND_HUE` nine keys ✓, 345/565 from the file header ✓, 574 candidates + 621 rows + ~550 ms
✓ (`anchor-per-turn.test.ts:200, 252, 264`), `mission.ts:50` and `:108` ✓,
`read-model-retrieval.ts:105` ✓, all four named test files ✓.

**Worth flagging, not scoring:** §5.2's pasted `head -n 1 .my_context/.anchors.jsonl` no longer
reproduces — today's first line is id `…:-:100165384`, label `"D | subject | state"`, not
`…:-:100522902` / `"today"`. The block is dated 2026-09-13 on its `wc -l` line, so it is a dated
excerpt, but it is the one live paste in the twelve files that has silently stopped being live.

### `07-restore-and-handover.md` — 15 checked, 1 false

**FALSE — "`<where>` is `the head` or `the marked section`, and the branch is `read.source`
(`src/core/handover.ts:203–209`)."** The branch is at **`:226`** —
`const where = read.source === 'marker' ? 'the marked section' : 'the head';`. Lines 203–209 are
docblock prose about line counts and a missing handover.

Everything else ✓, including `config.ts:483` `DEFAULT_HANDOVER_MARKER = '⏭'` exactly,
`OnDemandAskVerdict` at `:1382–1384` with **seven** values exactly, `handover-ask.ts:1452`'s
*"Never past the other refusals"* verbatim, `restore.ts:330`'s `s.state.toUpperCase()` exactly,
`restore.ts:71–76`'s `USAGE` ✓.

### `09-cli-and-mcp.md` — 25 checked, 2 false

Both sit in the same four-line block as the repaired `:1434` → `:1405`, and neither was
re-resolved while that one was.

**FALSE — "composing one line per task at `:1400`."** **`:1371`.** Line 1400 is
`` `what it names — stored nowhere. A task with no "${NEEDS_FIELD}" is ready here because ` + ``.

**FALSE — "`limit` is read at `:1370`."** **`:1341`** — `const limit = optNum(args, 'limit', 50);`.
Line 1370 is `lines.push(`.

Everything else ✓: `registry.ts:46` ✓, 34 grep files / 33 registering ✓, **49** top-level commands
✓ counted off `--help` and matching `docs/cli-ui-coverage.md:7` ✓, `tools.ts` 2,627 ✓,
`server.ts` 60 ✓, 29 matches / 28 tools ✓, `list_rules`/`verify_rules` ✓, seven English help topics
+ `categories.he.md` + `he.ts` ✓, **twelve** `MYCONTEXT_*` variables ✓ exactly,
`FIELD_WEIGHTS` `title`/`summary` 3, `tags`/`id` 2, `body`/`observations`/`extra` 1 ✓ exactly,
`request` unranked at `rank.ts:167` ✓. `path --d 72` reproduces **exactly**; `search "budget"`
reproduces except `Searched 1306 item(s)` → **1308** (the corpus gained two items today).

### `10-rule-store.md` — 33 checked, 8 false

**FALSE — the pasted grep block under "Delivery vs. assertion" is stale on all four lines, and
misquotes two of them.** It is introduced as *"Verified exactly, by grep and by reading each hook"*
and presented as the output of `grep -rn "deliverAtDoor\|assertDoor" src/hooks/*.ts`:

| block says | the command actually prints |
|---|---|
| `pre-compact.ts:217: const missedStore = assertDoor(...)` | **`:225`** |
| `pre-tool-use.ts:684: return assertDoor(root, key);` | **`:708`** |
| `session-start.ts:130: return deliverAtDoor({...` | **`:134`**, and the text is `const delivered = deliverAtDoor({` |
| `subagent-start.ts:316: const store = deliverAtDoor({...` | **`:319`**, and the text is `const delivered = deliverAtDoor({` |

The real grep also prints four `import` lines the block omits. **The repair fixed exactly these four
citations in the prose three paragraphs below** — `:134`, `:319`, `:225`, `:708` are all correct
there — **and left the pasted block that the prose is derived from.** A chapter contradicting itself
within one section, in the evidence form this reference holds up as its most reliable.

**FALSE — "`pre-tool-use.ts:741` writes it with `process.stderr.write`"** (stated twice, in the
delivery section and in the "What's NOT built" bullet). **`:747`** —
`if (missed !== '') process.stderr.write(missed);`. Line 741 is a comment *about* stderr.

**FALSE — "`MYCONTEXT_RULES_DIR` (`RULES_DIR_ENV`, `src/rules/deliver.ts:332`)."** **`:439`.**
Line 332 is a fragment of a refusal sentence.

**FALSE — "`resolveStoreDir` (`:417–421`)."** **`:543`.**

Everything else is right, including every seal and every count: `wc -c src/rules/entries/*.md` =
**41,955** ✓ exactly, sixteen `.md` ✓, 1 `product` / 15 `developer` ✓, `rules list` prints
`my_context rules — 16 entry(s) in force here. This workspace IS my_context, so developer-tier` ✓
verbatim, store version 5 / `2026-09-11T09:50:41.624Z` ✓, the six file line counts and the 2,538
total ✓ **exactly**, the changelog replay ✓ **exactly** including the `def-lane` reasoning,
`delivered.ts:165` `Door` ✓, `delivered.ts:233` `MAX_ROWS = 5000` ✓, `store.ts:51–53` ✓,
`hooks.json`'s matcher and its six names ✓.

**Warning, not scored:** *"The delivered block omits the tier that `rules show` prints
(`deliver.ts:200`)"* — `:200` is the last line of `precedence()`, which is tier-*conditional* but is
not about omitting a tier label. The substantive claim looks right; the citation does not land on it.

### `11-self-improvement-loop.md` — 10 checked, 3 false

**FALSE — "`src/review/` holds **thirteen** modules at HEAD (`870e57c5`)."** At `870e57c5` it held
thirteen ✓ — but `870e57c5` has not been HEAD since 2026-09-13, and **HEAD holds sixteen**:
`backfill-recommendations.ts`, `promote.ts` and `recommend.ts` joined the list. The count is right
for the named commit and wrong for the word "HEAD" beside it.

**FALSE — "`src/review/drift.ts` is still imported by nothing but tests — its only importers
anywhere are `test/review/drift.test.ts` and `test/core/retrieval-return.test.ts`."** **Only
`test/review/drift.test.ts:53` imports it.** `test/core/retrieval-return.test.ts` merely *mentions*
`drift.test.ts` in two comments. Chapter 00's version of this same bullet — "imported by nothing but
its own tests" — is the correct one; chapter 11 over-specified it into a falsehood.

**FALSE — "The call site is in `pass.ts:397–430`, not in `propose.ts`."** The model block is
`const modelCandidates` / `if (options.model !== null)` at **`:445`**, running to about **`:502`**
(`reviewPrompt(input)` at `:447`, `callAgentCli` at `:449`, `parseReply` at `:480`). Lines 397–430
are the tail of a docblock and the opening of `runPass`. The described behaviour — it runs before
the proposing block, a failed call still leaves a report — is accurate and is stated verbatim in the
comment at `:440–444`.

### `15-document-and-lane-viewer.md` — 25 checked, 2 false

Both are in §15.2's own disclaimer, which was written to protect the section and instead states two
things that are not true.

**FALSE — "an in-flight, **untracked** lane
(`TASK-the-find-panel-offers-regular-expressions-and-no-help-and`, `semantic/11`)."** The item is
**git-tracked**: `git ls-files` returns
`.my_context/items/task/TASK-the-find-panel-offers-regular-expressions-and-no-help-and.md`.

**FALSE — "That work … **had not landed at `HEAD`** when this section was written … Everything below
describes the shipped, three-option surface as it stands at the commit this reference was verified
against."** It had landed. `MODES = ['normal', 'wildcard', 'logical', 'regex']` is present at
`fold.js:731` in **`1ec219c2^`** — it shipped in `5211551d`, the *immediate parent* of the commit
that wrote this chapter, and `git merge-base --is-ancestor` confirms it. The shipped surface at that
commit is already `{ mode: 'normal', caseSensitive: false, wholeWord: false }`
(`conversations.js:6647`), four exclusive modes plus two independent booleans. So §15.2 describes a
superseded three-checkbox surface while asserting its replacement is unlanded — **the exact defect
the first pass found in §5.4, committed in the commit that repaired §5.4.**

Everything else ✓: 43 + 37 = 80 ellipses ✓, `src/` 748 ✓, `fold.js` 1,339 ✓, `panel.js` 429 ✓,
`FIND_SCAN_CAP = 40_000` ✓, `FIND_HITS_PER_TURN = 500` ✓, `FIND_PAINT_PER_ROW = 300`
(`conversations.js:4035`) ✓, `FIND_REGEX_BUDGET_MS = 5_000` ✓, `nestedQuantifier` checked before
compilation at `fold.js:1332` ✓, `paintFinds` (`:7268`) and `openFindPanel` (`:9322`) ✓,
`panel.js:186–187` `<dialog class="mcpanel">` ✓ and `:422`'s *"NEVER `showModal()`"* ✓,
`conv.doc.matchedFull` and `conv.find.wordHeb` verbatim ✓.

### `16-the-board.md` — 21 checked, 1 false

**FALSE — §16.3's block is introduced as "All three, unabridged" and the third table is abridged.**
The held table shows three rows (`walk/18`, `docsys/11`, `port/99`). The command prints **four**;
`port/98` is missing — and the block's own trailer, two lines below, says *"4 open task(s) held."*
The repair correctly added the two tables the previous version had dropped and then dropped a row
from the one it already had. The first pass reported this same fourth row.

Everything else ✓: `needs.ts` header 1–48 in an 866-line file ✓, `needs.ts:5–18`'s 2026-08-28
measurement ✓ verbatim (425 items, zero dependencies, 4 of ~28, `the/45`), `questions.ts`'s
`plan:governance seq:9` ✓, both `REF-` items ✓, `reports/2026-09-11-the-d-numbers-record.md` ✓,
`path.ts:41`'s *"THE SUBJECT CLOSES…"* ✓, `check:board` in `ci.yml:145` **and** `release.yml:84` ✓
with `check:needs-cycles` beside it in both ✓, `--orphans` ✓. `path --d 72` and `path --summary`
both reproduce, including **21** subjects open-with-everything-done, **18** orphans, **78** subjects
in the map, `D46 · walk/89` and `D67` in WAITING ON YOU.

**Could not be reconstructed:** §16.6's *"3 of 153 open work items"*. `check-board`'s window is the
last 120 commits and has slid (it now reads *"3 of 156 … (2026-09-13 to 2026-09-17)"*), so the
2026-09-16 denominator is unrecoverable. The first pass recorded **154** on that day; the chapter
says 153, which is `ready`'s open-*task* count, a different and slightly smaller set. Likely an
off-by-one from reusing the neighbouring figure, but not provable now.

---

## Moved since the repair, correctly disclosed — not scored

The brief warned that four other agents committed the same afternoon. They did, and the chapters
that disclosed their readings survived it:

| chapter | says | today |
|---|---|---|
| `05` §5.3 | 1,345 anchors, 442 `report`, 862 `table` | **1,348 / 443 / 864** |
| `08` | 274 servable Markdown files, *"expect it to be low again"* | **279** |
| `09` | `Searched 1306 item(s)` | **1308** |
| `14` §14.4 | `near … of 103`, `both … of 961` | **105**, **974** |
| `15` | 3,452 ellipses across tracked files | **3,509** |
| `16` | `149 ready of 153 open`, `3 of 153 … (09-12 to 09-16)` | **151 of 155**, `3 of 156 (09-13 to 09-17)` |

Each of these is stamped with its date in the chapter, and most carry a sentence telling the reader
to re-run. That discipline worked.

**Also worth flagging:** §14.2's worked example is the one live paste in the twelve files with **no
date on it**, and it no longer reproduces — one of the seven rows has been displaced by a newer hit
(`2026-09-16 12:38 / byte 135594684` → `2026-09-16 20:05 / byte 141684342`) and three totals moved.
§14.4, two screens below, dates its own block *and explains why the number will move*. The
difference between the two is the whole lesson.

---

## The pattern worth naming, and it is not the same one as last time

**1. The first pass's pattern is gone. Line citations are now the reference's strongest category.**
Nineteen of the 38 were stale citations; every one of those nineteen is correct today, and the
thirteen *new* `conversations.js` citations the repair wrote to replace ten bad ones are exact
without exception — into an 11,277-line file that grew while the repair was being written. The
method that produced them (re-read each one against the file, one at a time) works, and it is worth
saying so, because the remaining 21 are mostly citations *nobody was asked to check*.

**2. Every one of the 21 sits beside something that was repaired.** Not one is in a chapter the
repair ignored. `tools.ts:1400` and `:1370` are the two lines under the `:1434`→`:1405` fix.
`deliver.ts:332` and `:417–421` are in chapter 10, whose other twelve numbers were re-derived
perfectly. `pass.ts:397–430` is in chapter 11, whose dials claim was the 39th repair. The repair
pass fixed what it was handed and did not widen by one paragraph. **A verified claim makes its
neighbours look verified, and they are not.**

**3. The partial-repair failure the first pass named is now inside the repair itself, twice.**
Chapter 5 §5.3 was refreshed and five sections citing it were not — two of them by name. Chapter 10's
four hook citations were fixed in prose and left in the pasted grep block the prose describes. In
both cases a reader comparing two paragraphs of one chapter finds them disagreeing, which is exactly
what the first pass called "a chapter can contradict itself internally after a partial repair."

**4. The evidence hierarchy held again, and it is sharper than it was.** Seven live outputs were
re-run: `check-handover` (byte for byte, exit 0), `search "budget"`, `path --d 72` (exact),
`path --summary`, `rules list`, `conversation search` twice. All seven reproduce up to disclosed
growth. **The two that did not reproduce whole are the two that were edited after capture** —
chapter 16's held table lost a row, chapter 10's grep block was retyped from an older run. That is
the same finding as last time, with the same cause, in a commit written to fix it. A pasted output
is either whole or explicitly marked abridged; a *retyped* one is neither.

**5. A commit hash is not a date, and "HEAD" is not a constant.** Chapter 11 says "thirteen modules
at HEAD (`870e57c5`)" — right about the commit, wrong about HEAD, four days later. Chapter 15 says
work "had not landed at `HEAD`" when it had landed in HEAD's own parent. Pinning a reading to a
commit is the right instinct; writing "HEAD" beside the pin undoes it.

---

*Verified 2026-09-17 against `1ec219c2` with a clean working tree. Read-only: no `git` command that
writes, `src/rules/entries/` untouched, port 58888 untouched, `npm test` not run. Every count in this
report is itself a dated reading — the corpus, the anchor file and the conversation archive all grew
while it was being written, and two of the commands this report re-ran became searchable spans in the
archive it was measuring.*
