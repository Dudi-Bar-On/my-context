# `docs/system/` verified against the tree — 2026-09-17 (first pass)

`TASK-the-subjects-with-no-document-have-no-home-and-capabilities`

Eight chapters, 1,340 lines, never verified. This is the first pass over them.

**297 checkable claims examined. 21 are false.** Eight more are warnings — right in substance, wrong
in a detail that costs the next reader a lookup. Two are dated readings that have legitimately moved
and say so.

**The 12 diagrams — not 13 — were parsed in real Mermaid for the first time. All 12 parse.** One
carries a false edge, one carries undated volatile figures, and none of them is wired into the
generator that the palette chapter describes.

Read-only throughout: no `git` command that writes, nothing under `src/rules/entries/` touched,
port 58888 untouched, `npm test` never run.

---

## Verdict by document

| doc | checked | false | verdict |
|---|---|---|---|
| `00-index.md` | 26 | 0 | **clean** — all 20 links resolve, the coupling claim is exact, the "200 → 48" story checks out |
| `01-the-board.md` | 47 | 4 | prose is excellent and quotes `needs.ts` almost verbatim; **one diagram edge reverses a dependency the chapter calls "disjoint" three times** |
| `02-the-document-and-lane-viewer.md` | 58 | 3 | strongest measurement chapter in the set; **one quoted source is inverted, one measurement is swapped with its neighbour** |
| `03-the-palette-and-the-drawn-language.md` | 41 | 4 | **the worst chapter** — every row of the contrast table pairs a shipped colour with a retired colour's ratio |
| `04-the-audit-log-decay-and-contribution.md` | 39 | 3 | the 18-call-site count is exact; **both pasted outputs are abridged and one is retyped** |
| `05-lessons.md` | 23 | 2 | **an MCP tool the chapter says does not exist, does** |
| `06-ingest.md` | 31 | 2 | **the validation-order diagram is exactly right** — the best diagram in the set; one invented item id |
| `07-focus.md` | 32 | 3 | §5 is exemplary; **§2 states the axis logic backwards and contradicts its own §5** |

---

## The 21 false claims, with their true values

### `01-the-board.md` — 47 checked, 4 false

**FALSE — "cancellation is recorded on `status`, checked first and independently by `readyReport`
(`item.status === 'deprecated'` short-circuits before `state` is even read)."** (lines 72–74)

The order is the reverse. `readyReport` reads `state` first — `const state = taskState(item);` at
`needs.ts:490`, and `if (state === DONE_STATE) continue;` at **`:491`**. The
`if (item.status === 'deprecated') continue;` guard is at **`:509`**, eighteen lines later, after
the `done` short-circuit has already fired. Nothing is "checked first"; `status` is checked
**second**.

**FALSE — the §4 diagram's edge `Q["open_question / blocks: item, item…"] --> N["needs.ts"]`.**

The arrow points the wrong way and merges two mechanisms this chapter calls separate three times
(§1 *"`needs` is not `blocks`"*, §4 *"a second, **deliberately separate** mechanism"*, §8 *"The
second, **disjoint** mechanism"*).

Measured: `needs.ts` never reads `blocks` — the field appears three times in its header prose and
**zero times in its code**. The real direction is the opposite: `questions.ts` **imports**
`needs.ts` (`questions.ts:137–139`, taking `buildTaskIndex`, `parseNeeds`, `refStatus`), and
`questionReport` reaches `ready` and `path` **directly** — `ready.ts` imports both modules
independently. `scripts/check-board.ts`, drawn downstream of `N` in the diagram, does not import
`questions.ts` at all, so no question data ever reaches it.

**FALSE — "The `YOURS` column — `mycontext path`'s fourth column."** (line 171)

It is the **sixth column of seven**. `HEADERS` (`path.ts:90`) is
`['D', 'status', 'done', 'ready', 'held', 'yours', 'work']`, and the live table confirms it:

```
┌─────┬────────┬──────┬───────┬──────┬───────┬───────────┐
│ D   │ status │ done │ ready │ held │ yours │ work      │
```

(The enumeration at line 140 — "done/total, ready, held, and a fourth column" — is fair as a count
of *measures*. Line 171's "fourth column" is a positional claim about the table, and it is wrong.)

**FALSE — the cross-reference "(§6)" for the `YOURS` column** (line 140). `YOURS` is described in
**§5** (line 171). §6 is the two-tier gate.

**Diagram omission, worth naming beside the above.** The §4 diagram draws
`M["[D-MAP] block"] --> P` and no edge from `M` to `D`. But `scripts/check-board.ts` calls
`parseDMap` at **`:459`** and `dBoard` at **`:470`** — reading the D-MAP is the whole of its Tier 1,
as **this chapter's own §6 says**: *"Tier 1 — the map itself must parse."* The diagram and §6
disagree.

**Minor — a spliced quote.** §5 quotes the D-number ruling as *"a D number names a subject, not a
fixed list of items — a subject may widen…"*. The source
(`REF-the-d-numbers-…:32–34`) reads *"…not a fixed list of items - **the D37 precedent, ruled
2026-09-08:** a subject may WIDEN…"*. A clause is elided without an ellipsis.

**Everything else in this chapter is exact**, including every figure a reader would doubt: the
2026-08-28 measurement ✓ **verbatim** from `needs.ts:5–18` (425 non-superseded tasks, ZERO
machine-readable dependencies, regex matched 4 of ~28, one resolving to `the/45` *"a plan that does
not exist, harvested out of the middle of a sentence"*, the 25% hit rate); the 48-line header ✓
(first `*/` at `:48`, first `import` at `:49`); `state` values `todo|doing|blocked|done` ✓ exactly,
from both `needs.ts:493` and `categories.ts:466`; `task` really is the **only** work category
(`isWorkCategory` requires `plan`+`seq`+`state`, and only `task` declares all three) ✓; a
`status: deprecated` target counting as **satisfied** ✓ (`needs.ts:364`); the module's purity ✓
**verbatim**; the state diagram's two notes ✓ — `blocked` is held only when every `needs` bucket is
empty (`:516`) and `done` is excluded from ready, held and `open` alike (`:491`, `open:
ready.length + held.length`); `check-board.ts`'s header *"the board is not true, and this is what
keeps it true"* ✓ **verbatim**; both Tier-1 and Tier-2 arguments ✓ including the three legitimate
namings and `NAMED-BUT-OPEN <sha> — <reason>` with its expiry ✓ (`:160`, `:539`); `parseDMap`'s two
2026-09-16 misreadings ✓ exactly (D78 quoting D57's closure, D57 scoring 0/3 off `anchors/` names);
`check:board` and `check:needs-cycles` in `package.json` ✓; `blocked_without_needs` as the doctor
code ✓ (`checks.ts:1589`); *"100% here means every remaining step is either DISPATCHABLE or NAMED AS
YOURS"* ✓ **verbatim** (`path.ts:405`); `REF-the-d-numbers-…` pinned (`always: true`) ✓; no
`board.json` anywhere ✓.

### `02-the-document-and-lane-viewer.md` — 58 checked, 3 false

**FALSE — "The fix added `postJson` to the five functions a lane window now hands over (`t`,
`tFlat`, `api`, `post`, `navigate`)."** (line 74)

What the fix added to `ctx` is **`post`**. `postJson` is a module-local fetch helper
(`lane.js:171`, `async function postJson(url, body)`) that `post` delegates to
(`post: (path, body) => postJson(path, body)`, `:210`); it was never a member of the handover set.
The sentence's own parenthetical list proves it — the thing it says was added is not in the list it
says it was added to. `lane.js:33` names the five exactly as the doc does.

**FALSE — "this is precisely the trap `doc.html` avoids falling into by *not* sharing a renderer
with content it is structurally different from."** (lines 46–48)

The polarity is inverted, and it is attributed to the file being "explicit" about it. `lane.js:55–58`
says the opposite: *"A page that reimplemented any of that would be a second viewer … — and it is
exactly the trap `/doc.html` **sets**, since that page is drawn by `githubNodes` and this content is
drawn by `markdownNodes`."* `doc.html` **sets** the trap; it does not avoid one.

**FALSE — "this product writes an ellipsis `…` **752 times** across the archive's spans."** (line 199)

Two different measurements have been swapped. `fold.js:9` reads *"This product writes `…` **3,062
times** and a reader types three dots"*, and the table three lines below it reads *"spans containing
a literal `…` **752**"*. So:

| quantity | true value |
|---|---|
| times the product writes `…` | **3,062** (`fold.js:9`, restated `:506`) |
| spans *containing* a literal `…` | **752** (`fold.js:13`) |

The chapter took the span count and labelled it the write count. (This is the third distinct
mis-statement of the 3,062 figure in this documentation set: `docs/capabilities/15` attached it to
the UI string tables and was repaired on 2026-09-16; it is now attached to the wrong row of its own
source table.)

**Warning — "704 of 1,310 marks carry a lane id, meaning over half of every bookmark ever made in
this project's archive lived in the one window where writing a new one was silently broken."**

The count is right and honestly dated (today: **732 of 1,368**, same 53%). The inference is not.
The bug broke **owner** writes from the lane window, and `.my_context/.anchors.jsonl` holds exactly
**1 row with `origin: 'owner'`** against **1,367 `origin: 'automatic'`**. "Every bookmark ever made"
reads as human-made bookmarks, of which there is one in the entire file. The statistic cannot size
this bug's blast radius, and it is used to.

**Warning — §4's owner quote is spliced from two different rulings.** The chapter renders it as
*"a way to browse, retrieve and display the content… like scrolling over a terminal."* The source
carries two separate quotations: *"a way to browse, retrieve and display the content **at a later
time**"* and, from `seq:7`, *"…user should have a similar experience like SCROLLING OVER A
TERMINAL."* (`read-model-conversation-document.ts:12–19`). The ellipsis hides a join across two
statements, not an omission inside one.

**Warning — the §4 diagram carries a dated measurement with no date.** The node reads
`transcript.jsonl / 63,871,429 bytes · 27,752 records`. Those are correct for the **2026-09-08**
reading on one specific file — and the table three paragraphs above carries exactly the same figures
*with* an explicit "re-measure before citing this" note. The diagram drops the disclosure and keeps
the numbers.

**Minor — an owner's typo silently normalised inside a direct quotation.** §2 quotes the 2026-09-09
ruling as *"…without all the app **around** it"*. `lane.js:6` reads *"arround"*.

**Everything else is exact**, and this is the best-measured chapter in the set. `doc.js` 419 ✓,
`lane.js` 323 ✓, `transcript-scroll.js` 147 ✓, `read-model-conversation-document.ts` 2,883 ✓,
`fold.js` 1,339 ✓, `panel.js` 429 ✓, `app.js` 8,592 ✓, `conversations.js` 11,277 ✓ **at HEAD** (the
working tree is at 12,461 under another lane's uncommitted work, which the chapter's §7 predicts in
as many words). `githubNodes`/`markdownNodes`/`mermaidBlocks` all exported from `lib/markdown.js` ✓;
`baseDirFor` with three address kinds ✓ (`doc.js:89–111`); the cookie bargain ✓ all three attributes
(`security.ts:95, 99, 153`) and `doc.js:18–23`'s verified-live `GET /api/doc` → 200 ✓; `sanitize.js`
the allow-list with **zero** `innerHTML` in `markdown.js` ✓. §4 reproduces `read-model-…`'s header
**digit for digit**: 24,757 ✓, 63,871,429 / 27,752 ✓, 17,375 (62.6%) ✓, 3,014 / 3,014 ✓, 2,444 ✓
(8.8% correctly derived), 157 ms per 61 MB ✓ twice, *"1 prompt, 0 answers, 49 folded '0 characters'
rows"* ✓, *"37 steps · Bash ×12, Read ×3"* ✓ **verbatim**, and `sum(span) === records` ✓ **the
literal assertion string** at `test/ui/conversation-document.test.ts:531`. `buildOutline` `:1750` ✓,
`readNodes` `:1872` ✓, `iterateTranscript` `:1774` ✓. §5's remaining numbers are exact: 456 ✓,
1,012 ✓, 806 of 11,251 ✓, 376 ✓, 1,775,487 hits / zero differences / 11,364 spans / 20 queries ✓,
the four punctuation classes ✓ (U+2011, U+2260, U+00B5, U+FF5C), `MODES` four and exclusive ✓
(`:731`), AND/OR/NOT/NEAR in the scan not FTS5 ✓ (`:712`), 108,785 ms on a 139 MB session ✓ three
times, the canary tried-and-unsound ✓. §6: *"stays on screen while you can look at the viewer"* ✓
**verbatim**, `show()` over `showModal()` ✓, hand-wired Escape ✓ (`:385`), Fenwick rejected for a
plain re-sum ✓ (`:105`), and the two highlight registries genuinely deleted and re-set on every
paint ✓ (`conversations.js:7436–7487`).

### `03-the-palette-and-the-drawn-language.md` — 41 checked, 4 false

**FALSE — every row of §4's contrast table.** The chapter says these are carried *"exactly as the
ruling recorded them"*. They are not: the four **shipped** hex values have been paired with the four
**retired** colours' contrast ratios.

`styles.css:101–110` records the repoint explicitly:

```
WAS (ours)                  NOW (the generator's)
--ok    #7cc0a0             --ok    #22c55e
--gold  #e8c368             --gold  #eab308
--warn  #c78f3d             --warn  #f97316
--crit  #e08b8b             --crit  #ef4444
```

and the contrast table at `:124–127` has **two** columns, `ours` and `generator`. The chapter kept
the `ours` column — the retired colours — and attached it to the `NOW` hex values. Computed
directly (WCAG 2.x, on `--panel #17171c`):

| level | shipped colour | doc says | **true value** | 8.42/10.58/6.31/7.00 actually belongs to |
|---|---|---|---|---|
| safe | `#22c55e` | 8.42:1 | **7.84:1** | `#7cc0a0` (retired) = 8.42 ✓ |
| caution | `#eab308` | 10.58:1 | **9.31:1** | `#e8c368` (retired) = 10.58 ✓ |
| warning | `#f97316` | 6.31:1 | **6.37:1** | `#c78f3d` (retired) = 6.31 ✓ |
| critical | `#ef4444` | 7.00:1 | **4.75:1** | `#e08b8b` (retired) = 7.00 ✓ |

Every retired colour reproduces its stated ratio to the second decimal, which is what proves the
mix-up rather than merely suggesting it.

**The chapter's own next two sentences refute its table**, and this is the part that should have
caught it before I did. It writes *"critical clears it by roughly a quarter of a point"* — true of
**4.75:1** (4.75 − 4.5 = 0.25), impossible for the 7.00:1 its table prints. And it writes *"on the
darker `--panel-2` (#1d1d24), the same critical colour measures **4.45:1** and fails"* — which is
correct ✓, computed, and belongs to the same column as 4.75. A reader who trusts the table concludes
`--crit` has 2.5 points of headroom on `--panel`; it has a quarter of one.

**Warning — "Filenames are content-addressed — `d-<sha256 of the source>.svg`."** The filename is
the **first 16 hex characters** of the SHA-256, not the digest:
`gen-diagrams.ts:82` — ``return `d-${createHash('sha256').update(source,'utf8').digest('hex').slice(0, 16)}.svg`;``

**Warning — "`scripts/gen-diagrams.ts` is the mechanism `README.md`'s own Mermaid diagrams (and
this directory's, where wired in — see §7) are drawn through."** No diagram in `docs/system/` is
wired in, and the cross-reference points at the Code map, which says nothing about wiring.
`DIAGRAM_SOURCES` (`gen-diagrams.ts:61`) is exactly `['README.md', 'docs/README.he.md']`, and
`test/ui/diagram-gate.test.ts:73` asserts *"the READMEs carry five diagrams each"*. So none of this
directory's 12 diagrams is drawn, committed as an SVG, or covered by the gate. See the diagram
verdict below.

**Minor — "The screen's own label, in both languages, is Composer."** English ✓
(`en.js:147` `'s.palette': 'Composer'`). Hebrew is **`'מרכיב פקודות'`** (`he.js:136`) — "command
composer", a translation rather than the word. The substantive point, that neither language calls it
"Palette", holds.

**Observation, not scored against this chapter.** The 1.04:1 `--gold`/`--ok` figure is reported
faithfully — it is in the ruling at `:50` *"gold against ok is 1.04:1 contrast"* and quoted again at
`styles.css:960` from `reports/uiux/sketches/06-a11y.html`. But it does not reproduce from either
palette: the shipped pair measures **1.19:1** and the retired pair **1.26:1**. The conclusion drawn
from it — that the word, not the hue, separates them — survives either way. Worth knowing that the
number itself has never been re-derived.

**Everything else passes, exactly**: `palette-defs.js` 873 ✓, `styles.css` 5,498 ✓ at HEAD,
`gen-diagrams.ts` 282 ✓; the five hues on one line ✓ (`:147`) and both role-hues ✓ (`:1983`);
`--panel #17171c` ✓ and `--panel-2 #1d1d24` ✓; **6** `<symbol>` elements and the six names
`add, confirm, copy, open, refresh, search` ✓ **exactly**, with `#i-open` the **only** glyph
referenced anywhere outside `index.html` ✓ and `openIcon()` at `parts.js:654` ✓; **10** SVGs ✓ at
644 KB ("roughly 630 KB") ✓; `DIAGRAMS`/`DIGESTS` exported ✓; mermaid **11.17.2** and playwright
both devDependencies with `dependencies` absent entirely ✓; all four `e2e/*` gates and both tests
exist ✓; and the whole §3 argument reproduces from
`DEC-the-meaning-hue-budget-is-five-…` — the 2026-08-25 ruling ✓, the corrected belief that the
budget was four ✓, `--warn` **already live in eight places** despite a task premised on its
retirement ✓ (the item enumerates all eight), the three functional reasons ✓, the 2026-08-27
amendment ✓, *"a hue may narrow a group, never name one"* ✓ **verbatim**, and §6's claim that the
ruling itself names the missing gate ✓ **verbatim** (*"there is no gate comparing the declared token
set against the budget -- which is why five hues shipped without anyone ruling on the fifth"*).

### `04-the-audit-log-decay-and-contribution.md` — 39 checked, 3 false

**FALSE — "the MCP tools (`audit_log`, `decay_report`, and contribution's own tool)."** (line 127)

There is no contribution MCP tool. `audit_log` ✓ (`tools.ts:1551`) and `decay_report` ✓ (`:1642`)
are real; the word "contribution" does not appear anywhere under `src/mcp/`. The 28 registered tools
are `ask_handover, audit_log, create_item, create_lesson, decay_report, doctor, focus_context,
get_item, ingest_document, link_items, list_drafts, list_ingest_sessions, list_items, list_rules,
list_todos, load_context, mycontext_examples, mycontext_help, preview_pack_import, query_items,
read_procedure, ready, refresh_item, stage_rule_candidates, status_report, supersede_item,
update_item, verify_rules`. The chapter's §7 argues contribution is the least-documented of the three
readings; it is also the only one of the three with **no MCP door at all**, and §6 says the opposite.

**FALSE — §3's `decay --summary` block is presented as "Real output" and is abridged.** The two
lines it prints reproduce **exactly** today, digit for digit. But the command emits a five-line
disclosure between them, which the block silently removes:

```
my_context decay — items not injected in the last 20 session(s). The ledger holds 40 session(s).
  "cold" means: not auto-injected in the last window of sessions. It does NOT mean unused — the
  ledger records injection, not reading or reliance, so a new item, and any item consulted via
  `show`, MCP `get_item`, or the Markdown file directly, look exactly like an abandoned one here.
  Do not supersede or deprecate anything on this report alone — verify real usage first.

cold 0, warm 165, of which 124 unrestricted. Rows with `mycontext decay` (default) or `--full`.
```

The final clause is dropped too. The chapter **quotes the removed disclosure in its own §1** — *"do
not supersede or deprecate anything on this report alone — verify real usage first"* — so it knows
the lines exist and presents the output without them and without an abridgement marker.

**FALSE — §4's `contribution --summary` block is not output the command produces.** It is spliced
from two places and retyped with approximations the command never emits. Run today:

- the doc's first clause comes from the **opening paragraph**, which reads *"The log holds 3659
  injection record(s) of 60537 total, naming 193 distinct id(s); the corpus holds 1311 item(s),
  **of which 165 could be chosen by `select` today**"*;
- the doc's second clause — *"165 of them injectable, of which 0 have never been delivered"* — is the
  **final summary line**, roughly forty lines further down, past a cohort table and four disclosure
  paragraphs.

They are welded into one sentence that the command never prints. And the pasted figures read
`~58000` and `~193`: the command prints exact integers in both slots and has never printed a tilde —
`193` was and still is exact. Movement in the other totals (3598 → 3659, 1306 → 1311) is ordinary and
correctly disclosed; the splice and the invented approximations are not.

**Warning — "Eighteen call sites write to it."** The figure is right as a count of **modules**:
exactly **18** files call `recordAudit(`. But the enumeration names **17** of them, omitting
`audit.ts`'s own internal call, and by *invocations* the number is **30**. Counted:
`pre-tool-use` 4, `ui/execute` 3, `post-tool-use` 3, `ui/security` 2, `session-end` 2, `pre-compact`
2, `core/focus` 2, `cli/procedure` 2, and one each in `mcp/tools`, `subagent-stop`, `subagent-start`,
`post-tool-use-failure`, `post-compact`, `observe`, `revision`, `persist`, `inject`, `audit`.

**Warning — §1 names seven of the eight audit kinds.** *"every mutation, injection, hook action,
focus change, access refusal, progress step and command execution"* — `--kind`'s enum is
`mutation|injection|hook|focus|access|progress|execution|**read**`.

**Everything else passes**, including every line count and every purity claim: `audit.ts` 1,913 ✓,
`audit-db.ts` 1,359 ✓, `ledger.ts` 1,229 ✓, `audit-tail.ts` 312 ✓, `contribution.ts` 341 ✓,
`decay.ts` 166 ✓, `ledger-replay.ts` 46 ✓, `watch.js` 2,102 ✓ — **eight for eight, exactly**.
`appendJsonlLine` really is *"a bare `appendFileSync`"* ✓ **verbatim** (`audit.ts:528`), and the
**0.55 ms p95, flat in file size** ✓ appears in three independent places (`audit-db.ts:22`,
`seen-file.ts:15`, `pre-tool-use.ts:301`). `contribution.ts` is genuinely pure — its only two imports
are `type`-only ✓; `decay.ts` likewise imports nothing that touches disk ✓. `mycontext audit
replay-ledger` exists ✓ and runs ✓ (`audit.ts:309`). No hand-append verb on `mycontext audit` ✓. All
five Watch sources appear in `watch.js` ✓. All four cited corpus items resolve ✓, as do
`INV-markdown-is-the-source-of-truth` and both `DEC-` rulings ✓.

### `05-lessons.md` — 23 checked, 2 false

**FALSE — "There is no MCP tool for staging, accepting or discarding a candidate — those three steps
exist only at the CLI."** (lines 76–78)

Staging has an MCP door. **`stage_rule_candidates`** is a registered tool (`src/mcp/tools.ts:1889`,
`annotations: ADDS`) whose `run` calls `stageRuleCandidates(ctx.root, lesson, args.candidates)` —
the same function `mycontext lesson-stage` calls. The source even explains why the *other* two are
absent, three lines above the tool: *"`CLI_WITHOUT_TOOL['lesson-accept']`, which stays `intended` for
exactly that reason."*

The conclusion the chapter draws — that accepting a rule requires a human at a terminal — **survives**,
because `lesson-accept` and `lesson-discard` genuinely have no tool. Only the premise is wrong, and it
is wrong in the direction that overstates the chapter's own case.

**FALSE — §3's "Real output" truncates the help text mid-sentence.** The pasted `--agent` line stops
at "human". The command prints:

```
  --agent  Record the lesson as origin "agent" rather than "human" - the one claim a shell cannot
           truthfully make on its own. `lesson-accept` refuses it by name.
```

The removed half — *"`lesson-accept` refuses it by name"* — is precisely the trust mechanic this
chapter exists to explain. The blank line before `flags:` and a three-line trailer are dropped too,
with no abridgement marker.

**Everything else passes**: `derive.ts` 491 ✓, `staging.ts` 299 ✓, `cli/commands/lesson.ts` 633 ✓;
`buildRuleRequest` `:114`, `stageRuleCandidates` `:305`, `acceptStagedRule` `:388` ✓ **all three
named in the code map, all three exported**; `origin: 'human'` hardcoded at `derive.ts:431` with the
comment at `:337` saying so in as many words ✓; the 8-character key ✓ (`:279` `.slice(0, 8)`);
`.my_context/.staging/` holding one JSON per lesson ✓ (five today); the usage line ✓ **verbatim**;
`lesson` on the **rationale** tier ✓ (`categories.ts:310`); `create_lesson` real ✓; the generated
text *"my_context has no model of its own — it stages what you return and waits for a human"* ✓
(`derive.ts:127`); `DEC-the-read-half-of-lesson-derive-ts-is-split-out-so-a-read` ✓ and
`TASK-lesson-accept-creates-a-rule-with-no-summary-so-the-accept` ✓ both resolve.

### `06-ingest.md` — 31 checked, 2 false

**FALSE — the item id `INV-a-validator-that-gates-writes-must-be-a-complete-precondition-for-the-write`**
(line 62). No such item. The real id is **`INV-a-validator-that-gates-writes-must-be-a-complete`**.
The chapter appended four words to a real id, so `mycontext show` on the cited string returns
nothing — the failure
`RULE-a-citation-names-an-item-by-id-never-a-report-by-line-number` exists to prevent.

**FALSE — §3's "Real output" truncates the help text mid-sentence**, the same defect as chapter 5's.
The pasted `--anchor` line ends at "document" without even its full stop. The command prints:

```
  --anchor Authentication  Ask for one section rather than the whole document. Omit it to take the
                           next pending anchor. Takes a heading from the document.
```

**Minor** — the disambiguating suffix is `--N` (double hyphen, `chunk.ts:339`), not `-N`.

**This chapter contains the best diagram in the set.** §2's validation-chain flowchart claims an
order, and the order is **exactly** the order `validateCandidates` (`src/ingest/schema.ts`) executes:
array → object & only-known-fields → real-and-enabled `type` → `title`·`body`·`summary` (in that
order) → verbatim `quote` → `severity` → `scope`. Seven gates, seven matches, no transposition — and
the chapter's own framing, *"a shape refusal before a content refusal"*, is right. Its terminal node
is right too: rejects land in the session's `.rejected.jsonl` ✓ (`apply.ts:340`, `schema.ts:381`,
`:432`), durably rather than as a throw ✓, and the parenthetical honestly says the diagram stops
short of every field.

**Everything else passes**: `schema.ts` 586 ✓, `session.ts` 705 ✓, `chunk.ts` 403 ✓, `request.ts`
167 ✓, `apply.ts` 394 ✓, `lock.ts` 74 ✓, `cli/commands/ingest.ts` 407 ✓, `backfill-requests.ts`
816 ✓ — **eight for eight**. The instruction quoted in §1 is **word for word** from `request.ts:51`:
*"You are the extractor. my_context has no model of its own and never calls one — it hands you the
text and validates what you return."* ✓ `CANDIDATE_SCHEMA` ✓ (`:144`); `_preamble` ✓; the 8-character
hash ✓ (`:321`); `status: 'draft'` / `origin: 'ingest'` asserted as an invariant ✓ (`apply.ts:138–139`,
`:267–268`); supersede-rather-than-duplicate ✓ (`:314`); the lock scoped to the workspace for the
two-process hazard ✓ (`lock.ts:15`); `src/mcp/tools/ingest.ts` implementing **both** phases ✓ — it
imports `applyCandidates` at `:5` and `runIngestDocument` takes `candidates` beside `session`; and
§5's claim that **no** `known_issue` mentions ingest by name ✓ **true** (zero matches).

### `07-focus.md` — 32 checked, 3 false

**FALSE — "`select.ts` applies the filter: an item is hidden only if it fails **every** non-empty
axis."** (line 62)

The quantifier is inverted. `matchesFocus` (`select.ts:637`) is **AND across axes**, and its own
docblock says so at `:631`: *"Whether an item is in focus: **every non-empty axis has at least one
match**. … AND across axes, OR within one."* An item is therefore hidden if it fails **any** non-empty
axis.

This is not a wording quibble. Under the chapter's rule, `--tag billing --category rule` hides only
what is neither tagged `billing` nor a `rule`. Under the code, it hides everything that is not a
`billing`-tagged `rule` — the source's own example says *"a rule tagged billing or invoicing, which is
what a person means when they type it"*. The two readings differ by most of the corpus.

**FALSE — "Only just-in-time's branch is the one focus can narrow at all — the other four fire on
their own trigger regardless of what focus is set."** (lines 38–39)

Focus narrows the **whole eligible set, before any tier is computed**. `select.ts:1515–1518`:

```
  // Focus narrows the eligible set, so every tier and the index inherit it from
  // one place. …
  const eligible = isFocusActive(focus)
    ? eligibleAll.filter((i) => !focusHides(i, focus, config))
    : eligibleAll;
```

Pinned and continuity items are protected not by lying outside focus's reach but by three explicit
exemptions **inside** `focusHides` (`:683–694`) — which is why `exemptHard`, `exemptAlways` and
`exemptContinuity` exist at all.

**And this chapter contradicts itself on it.** Twenty-four lines below the claim, §2 explains the
three exemptions; §5 then recounts the defect that produced them — *"a focus set on 2026-08-24
silently hid six `always: true` items for three days."* If focus could not narrow the pinned route,
that defect could not have happened and the exemptions would have nothing to do.

**FALSE — §3's `focus --show` block drops the second line of a two-line output.** The command prints:

```
my_context: no focus is set — every eligible item is injectable.
Set one with `mycontext focus <tag>`, or see `mycontext focus --relations`.
```

**§3's second block is the one honest paste in the whole directory, and it reproduces today.** The
`focus --category rule --preview` excerpt marks its omissions with `...` and every retained line is
**verbatim and current**: `6 load-bearing relation(s) dangling — one end is hidden, the other is not:`
✓, `DEC-index-lists-only-what-is-not-already-injected (hidden)` / `constrains →
INV-nothing-is-dropped-silently` ✓, `53 severity:hard item(s) do not match this focus and are
injected anyway — focus never hides one:` ✓ **exactly 53 today**, `CONST-evidence-must-cite-a-captured-record-id`
✓ as the first entry, `1 continuity item(s)…` ✓, and `Apply it by running the same command without
--preview.` ✓ as the genuine last line.

**Everything else passes, and §5 is the best-sourced section in the directory.** `focus.ts` 658 ✓,
`cli/commands/focus.ts` 294 ✓; `matchesFocus` `:637`, `focusHides` `:683`, `focusMatchesScope` `:625`
✓ **all three, exactly as the code map names them**; the three axes ✓ (`:54`) and *"the axes … a
person already thinks in"* ✓ (`:57`) with *"every additional axis costs the disclosure its
sharpness"* ✓; `.my_context/state/focus.json` ✓ (`:354`) and gitignored ✓; `exemptHard`/`exemptAlways`/
`exemptContinuity` tracked as three separate lists ✓ (`select.ts:1357–1372`); `focus_context` calling
`readFocus`/`setFocus`/`unsetFocus`/`focusReportLines` ✓ **all four** (`mcp/tools/focus.ts:20`);
`#focuspop` in `app.js` ✓. §5 reproduces `select.ts:660–676` almost verbatim — the 2026-08-24 focus
with `tags: plan:walk` ✓, **six** soft-severity pinned items ✓, **three days** ✓,
`INSTR-use-my-context-for-everything…` among them ✓, *"the instruction to use the product … was
itself hidden by the product, and nothing said so"* ✓ — and the ruling
`DEC-a-focus-may-not-hide-a-pinned-item-focushides-exempts-always` ✓, with the `KNOWN-` item's
`status: deprecated` / `valid_until: 2026-09-03` ✓ **exact**. §5's unresolved flag is **correct and
correctly left open**: `focus_active` appears only as a comment in `focus.ts:41` and nowhere in
`src/doctor/checks.ts` ✓.

### `00-index.md` — 26 checked, 0 false

**Clean.** All twenty internal links resolve ✓. The inventory really does hold **32** rows ✓. The
coupling argument for splitting lessons/ingest/focus is exact: **no file under `src/ingest/` imports
`focus.ts` or anything under `src/lesson/`**, and `focus.ts`'s five imports are `node:fs`, `node:path`,
`./audit.ts`, `./types.ts`, `./validate.ts` — nothing from ingest ✓. The "200 lines → 48" story checks
out in all three places: `reports/2026-09-16-the-subjects-of-this-system.md:70` is where "200-line"
was written, `reports/2026-09-16-the-mechanism-map.md:102` carries the same-day correction, and
`docs/capabilities/16-the-board.md:11` does carry its own correction sentence ✓ — with `needs.ts`'s
header ending at **`:48`** ✓.

**One observation.** "Five had **nothing of the right shape**" is the chapter's own grouping of seven
inventory rows (6, 9, 17, 18, 19, 20, 30) into five chapters, which is internally consistent. But the
inventory names an eighth row the same way — row 31, the status-line bridge, *"Tutorial only … No
chapter"* — and it is not among the five and is not mentioned. A reader counting rows will not get
five.

---

## The 12 diagrams — the first pass any of them has had

**There are twelve, not thirteen.** A bare `grep -c '```mermaid'` returns 13, but the thirteenth is
prose: `03-the-palette-and-the-drawn-language.md:90` writes ``` ```` ```mermaid ```` ``` inside a
sentence about the generator. Running the product's **own** tokeniser — `mermaidBlocks` from
`src/ui/public/lib/markdown.js`, the one function `gen-diagrams.ts` and the live page both call —
returns **12**: two in `01`, three in `02`, one each in `03`, `04`, `05`, two in `06`, two in `07`,
none in `00`.

**All 12 parse.** Extracted with `mermaidBlocks` and fed to `mermaid.parse()` in real Mermaid
**11.17.2** inside headless Chromium — the same bundle and the same mechanism `gen-diagrams.ts` uses,
because Mermaid cannot parse without a DOM. Twelve submitted, twelve accepted, zero errors. The
authors' claim holds and is now measured rather than assumed.

**None of them is generated, committed or gated.** `DIAGRAM_SOURCES` (`gen-diagrams.ts:61`) is
exactly `['README.md', 'docs/README.he.md']`; the ten committed SVGs are five per README; and
`test/ui/diagram-gate.test.ts` asserts that count. So every diagram in this directory renders only
in whatever viewer opens the Markdown, and nothing in CI would notice if one stopped parsing. That is
why this was worth doing by hand, and why chapter 3's parenthetical *"(and this directory's, where
wired in — see §7)"* should say plainly that none is.

**Node-by-node and edge-by-edge, one defect, one omission, one undated figure:**

| # | doc | verdict |
|---|---|---|
| 1 | `01` state machine | ✓ **correct**, including both notes — `blocked` is held only when every `needs` bucket is empty (`needs.ts:516`), and `done` is excluded from ready, held and `open` alike (`:491`). Every node name is a real `state` value (`categories.ts:466`). |
| 2 | `01` three lenses | ✗ **one false edge and one missing edge.** `open_question → needs.ts` reverses the real dependency (see above), and `[D-MAP] → check-board.ts` is absent although Tier 1 is nothing else. |
| 3 | `02` two renderers | ✓ **correct** — `githubNodes`, `markdownNodes`, `mountDocument`, `lib/sanitize.js`, `?doc=/?tut=/?corpus=`, `?id=<agentId>` all resolve, and `innerHTML` really is zero in `markdown.js`. |
| 4 | `02` propose/dispose | ✓ **correct**, and the subtlest one in the set: `linkStyle 4` really does select the fifth edge, which really is the dashed `SWEEP -.-> FILE` the prose calls "the boundary", and `anchor-write.ts:372–378` confirms the automatic pass never reads an `origin: 'owner'` row. |
| 5 | `02` what never enters memory | ⚠ **structurally correct, undated.** `buildOutline`, `readNodes`, the `Float64Array` prefix sum and the binary search all check out — but it carries `63,871,429 bytes · 27,752 records`, a 2026-09-08 reading on one named file, stripped of the date the table beside it keeps. |
| 6 | `03` hue budget | ✓ **correct** — five tokens, both role-hues, all four `e2e` gates exist, and the ruling node is a real item id. |
| 7 | `04` one writer, two projections | ✓ **correct** — `recordAudit` is the one writer, "18 call sites" matches the measured 18 modules, and both projections are rebuilt from the jsonl and never the reverse. |
| 8 | `05` lesson to rule | ✓ **correct** — `buildRuleRequest`, `stageRuleCandidates` → `.my_context/.staging/`, `acceptStagedRule` with `origin: human` hardcoded, and the "NOT this tool" node is the file's own position. |
| 9 | `06` ingest end to end | ✓ **correct** — `chunk.ts` → `request.ts` → `apply.ts`, `CANDIDATE_SCHEMA`, `status: draft` / `origin: ingest` "never anything else" ✓ asserted in code. |
| 10 | `06` validation chain | ✓ **correct, and the best diagram here** — seven gates in the exact execution order of `validateCandidates`, terminal node included. |
| 11 | `07` five routes | ✓ **byte-identical to `README.md`'s §4 diagram at HEAD**, as claimed — see the warning below. |
| 12 | `07` focus predicate | ✓ **correct** — `matchesFocus`/`focusHides` in `select.ts`, and the three exemptions named exactly as `exemptHard`/`exemptAlways`/`exemptContinuity`. Note it draws the *code* correctly while §2's prose two paragraphs above describes it wrongly, twice. |

**One diagram is one commit from stale, and it is not this chapter's fault.** §7's claim that its
diagram is *"reproduced from `README.md` §4 unchanged"* is **true at HEAD** — I diffed it against all
five README diagrams and it is byte-identical to the third. But `README.md` is modified in the
working tree right now by another lane, and the change repairs exactly this diagram: it adds
`S --> CONT` and `C --> CONT`, and relabels the just-in-time branches (*"offered first"* / *"offered
only after every scoped item already fit"*, and *"once per session"* rather than *"once per context
window"*). The moment that lands, `07-focus.md`'s diagram stops matching its source and its
surrounding prose — *"the fifth, continuity, is missing from the picture … for the same reason it is
missing there"* — becomes false, because README will draw it. Worth handing to whoever repairs this
set.

---

## The pattern worth naming

**1. Five of the six pasted "Real output" blocks are abridged, and only one says so.** This is the
same finding both capabilities passes made, reappearing across an entire new directory before anyone
had read it once.

| block | what happened |
|---|---|
| `04` §3 `decay --summary` | five-line disclosure removed — a disclosure **this chapter quotes in its own §1** |
| `04` §4 `contribution --summary` | two non-adjacent lines welded into one, and exact integers retyped as `~58000` / `~193` |
| `05` §3 `lesson --help` | `--agent`'s description cut mid-sentence, losing *"`lesson-accept` refuses it by name"* |
| `06` §3 `ingest --help` | `--anchor`'s description cut mid-sentence, losing two sentences and its full stop |
| `07` §3 `focus --show` | second of two lines dropped |
| `07` §3 `focus --preview` | **marked with `...`, and reproduces verbatim today** |

The one that marked its cuts is the one that survived contact with a verifier. Everything the four
others removed was a disclosure the command prints deliberately — which is the worst possible thing
to trim, because a help text's second sentence is usually the sentence that constrains the first.

**2. Where these chapters quote a source header, they are outstanding.** `needs.ts`'s 2026-08-28
measurement, `read-model-conversation-document.ts`'s whole 2026-09-08 table, `fold.js`'s comparison
run, `panel.js`'s owner instruction, `select.ts`'s 2026-08-24 defect, `request.ts`'s extractor
sentence, `check-board.ts`'s header, the hue ruling's amendment — eight long passages reproduced
word for word or near enough. Not one line count in any code map is wrong: **thirty-four files
measured, thirty-four exact** (the two that look wrong, `conversations.js` and `styles.css`, are
exact at HEAD and moved under another lane's uncommitted work, which `02` §7 predicts by name). The
method these chapters use — read the header, quote the header — works, and it is worth saying so.

**3. Where they *derive* instead of quote, they invert.** Every one of the four worst errors is a
relationship read backwards, not a number gone stale:

- `01`: `status` checked **after** `state`, documented as before.
- `01`: `questions.ts → needs.ts` drawn as `needs.ts ← open_question`.
- `02`: *"the trap `/doc.html` **sets**"* documented as the trap it *avoids*.
- `07`: AND-across-axes documented as OR; "focus narrows every tier" documented as "focus narrows
  only one".

None of these would be caught by re-reading a line number, which is what the previous two passes were
trained to check. They are caught only by re-executing the sentence against the code.

**4. Two chapters contradict themselves, and in both cases the chapter contains its own refutation.**
`03`'s contrast table says critical clears AA by 2.5 points; its very next sentence says a quarter of
a point, and the sentence is right. `07` says focus cannot narrow the pinned route; its §5 recounts
the three days in 2026 when focus narrowed the pinned route. A verifier is not needed for either —
only a reader who finishes the paragraph.

**5. The diagrams are in better shape than the prose.** Twelve diagrams, one false edge, one missing
edge, one missing date. The most order-sensitive diagram in the set — `06`'s seven-gate validation
chain — is exactly right, gate for gate. The believability worry the brief raised is real, but on
this evidence the authors drew more carefully than they wrote.

---

*Verified 2026-09-17 against the working tree at `b6949abc`, with another lane's uncommitted changes
to `conversations.js`, `styles.css`, `README.md`, `en.js`, `he.js` and six `e2e/` files present
throughout and accounted for where they matter. Read-only: no `git` command that writes,
`src/rules/entries/` untouched, port 58888 untouched, `npm test` never run. The one process I started
was a single headless Chromium, to parse twelve diagrams, closed on the same tick. Every count here is
itself a dated reading — the anchor file gained rows and `README.md` gained a diagram edge while this
was being written.*
