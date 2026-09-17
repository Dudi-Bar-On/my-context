# `docs/system/` repaired against the tree — 2026-09-17

`TASK-twenty-one-claims-in-the-system-documents-are-false-and-the` · lane AW

Work list: `reports/2026-09-17-system-docs-verified.md`, taken as evidence rather than as a claim.

**All 21 verified-false claims are repaired.** Every one was re-established against the tree before
it was touched — not to second-guess the verifier, but because a repair that copies a correction it
has not checked is the same defect one layer down. Four of the 21 were relationships read backwards
and were checked as *directions*, in the code, not as line numbers. Five of the six pasted "real
output" blocks were re-captured by **running the command** and splicing stdout; none was repaired by
editing.

**Fifteen further defects were repaired beyond the 21** — the verifier's twelve warnings and minors,
plus **three it did not find**, each of which sits directly beside a claim it did find. That is the
neighbourhood rule earning its keep, and the sharpest case is a diagram the verifier had marked
**correct**: `07`'s predicate diagram carried on an edge label the same inverted quantifier the
report had caught twice in the prose two paragraphs above it.

**One claim in my own brief had already rotted while I worked**, and is reported below rather than
repaired into the documents as if it were still true.

Read-only against everything outside `docs/system/**` and this file. No `git` command that writes;
port 58888 untouched; no subagent dispatched; `src/ui/public/` and `e2e/` left entirely to the lane
live in them.

---

## The 21, one row each

`how` is how I established the true value myself, in this session.

### `01-the-board.md` — 4

| # | The claim | What is true | How I established it |
|---|---|---|---|
| 1 | *"cancellation is recorded on `status`, checked first and independently by `readyReport` — `item.status === 'deprecated'` short-circuits before `state` is even read"* (§1) | The reverse. `const state = taskState(item)` is `needs.ts:490`, `if (state === DONE_STATE) continue` is `:491`, and the `deprecated` guard is **`:509`** — nineteen lines later. `status` is checked **second**. | Read `needs.ts:485–520` directly. The intervening 17 lines are the comment explaining that the guard was **added 2026-09-06** after six deprecated tasks (`docsys/5`, `/6`, `/9`, `/10`, `walk/16`, `tuts/4`) shipped as ready work — which is *why* it sits below rather than above, and is now in the chapter. |
| 2 | The §4 diagram edge `Q["open_question / blocks…"] --> N["needs.ts"]` | Backwards. `needs.ts` never reads `blocks`; `questions.ts` imports **from** `needs.ts`. | `grep -n blocks src/core/needs.ts` returns exactly three hits, all at `:20`, `:22`, `:26` — header prose, zero in code. `questions.ts:137–139` imports `buildTaskIndex`, `parseNeeds`, `refStatus` from `./needs.ts`. `ready.ts:2–9` and `path.ts:6` import the two modules independently. `check-board.ts` does not import `questions.ts` at all. |
| 3 | *"The `YOURS` column — `mycontext path`'s fourth column"* (§5) | The **sixth of seven**. | `path.ts:90`: `HEADERS = ['D','status','done','ready','held','yours','work']`. Then ran `mycontext path` and counted the printed header row. |
| 4 | The cross-reference *"(§6)"* for the `YOURS` column (§4) | `YOURS` is described in **§5**. §6 is the two-tier gate. | Read the chapter's own section headings. |

Also repaired here (verifier called these an omission and a minor):

- **The §4 diagram had no `[D-MAP] → check-board.ts` edge**, contradicting §6's *"Tier 1 — the map
  itself must parse."* `check-board.ts:459` calls `parseDMap`, `:470` calls `dBoard`; both now have
  an edge. Established by `grep -n "parseDMap\|dBoard" scripts/check-board.ts`.
- **A clause elided from a direct quotation without an ellipsis.** §5 quoted the D-number ruling
  without *"the D37 precedent, ruled 2026-09-08:"*. Restored verbatim from
  `REF-the-d-numbers-…:31–34`.

### `02-the-document-and-lane-viewer.md` — 3

| # | The claim | What is true | How I established it |
|---|---|---|---|
| 5 | *"The fix added `postJson` to the five functions a lane window now hands over (`t`, `tFlat`, `api`, `post`, `navigate`)"* (§3) | What was added is **`post`**. `postJson` is a module-local helper, never a member of the set. | `lane.js:33` names the five exactly as the doc's own parenthetical does — and `postJson` is not among them. `lane.js:171` defines `async function postJson(url, body)`; `:210` is `post: (path, body) => postJson(path, body)`. The sentence disproved itself: the thing it said was added is absent from the list it said it was added to. |
| 6 | *"this is precisely the trap `doc.html` avoids falling into by not sharing a renderer…"* (§2) | Inverted. `lane.js:55–58`: *"it is exactly the trap `/doc.html` **sets**."* | Read `lane.js:49–58`. `doc.html` legitimately runs its own renderer because it draws prose; that legitimate precedent is what makes a second renderer for the lane window look reasonable. The chapter now says which way the hazard points and why. |
| 7 | *"this product writes an ellipsis `…` **752 times** across the archive's spans"* (§5) | Two measurements swapped. The product writes `…` **3,062** times; **752** is the number of spans *containing* one. | `fold.js:9` — *"This product writes `…` **3,062 times**"*, restated at `:506`. `fold.js:13` — *"spans containing a literal '…' 752"*. Both figures are now in the chapter, labelled. |

Also repaired here (three warnings and a minor):

- **A statistic used to size a blast radius it cannot size.** *"704 of 1,310 marks carry a lane id,
  meaning over half of every bookmark ever made … lived in the one window where writing a new one
  was silently broken."* The count is right; the inference is not. I parsed
  `.my_context/.anchors.jsonl` — **1,383 rows, 740 with a lane id, and exactly 1 with
  `origin: 'owner'` against 1,382 `origin: 'automatic'`**. The bug broke *owner* writes, so its
  population is one row. The chapter now states the mechanism as the damage and says plainly what
  the ratio does not measure.
- **§4's owner quote spliced across two rulings.** Restored as two quotations with their two
  provenances (`read-model-conversation-document.ts:12–19`).
- **§4's diagram carried `63,871,429 bytes · 27,752 records` with no date**, three paragraphs below
  a table carrying the same figures *with* a "re-measure before citing" note. The date and the
  disclosure are now in the node.
- **An owner's typo silently normalised inside a direct quotation** — `lane.js:6` reads *"arround"*.
  Restored, with one clause saying why.

### `03-the-palette-and-the-drawn-language.md` — 4, which are one error

| # | The claim | What is true | How I established it |
|---|---|---|---|
| 8–11 | §4's whole contrast table: `#22c55e` 8.42, `#eab308` 10.58, `#f97316` 6.31, `#ef4444` 7.00, carried *"exactly as the ruling recorded them"* | **7.84 · 9.31 · 6.37 · 4.75.** The four *shipped* hexes were paired with the four *retired* colours' ratios. | I did not take these from the report. I computed all sixteen ratios (four shipped and four retired, on `--panel` and `--panel-2`) from the hex values under WCAG 2.x relative luminance. The shipped column reproduces `styles.css:124–127`'s `generator` column to the second decimal; the retired column reproduces its `ours` column to the second decimal. `styles.css:101–110` records the 2026-09-01 repoint that separated them. |

**The row that matters is `#ef4444`, and the chapter now says so where the table sits.** Claimed at
7.00, it is **4.75** — it clears AA for normal text by **0.25**. A reader of the old table would
conclude `--crit` had two and a half points of headroom; it has a quarter of one, and it is the only
row with no room to absorb a change. On `--panel-2` (#1d1d24) the same colour measures **4.45 and
fails** — which the chapter already said correctly, two sentences under a table that contradicted
it. `styles.css:129–133` says the same thing in the same words. The chapter's own prose was right
and its table was wrong; the repair makes the prose the subject rather than an aside.

Also repaired here:

- **`d-<sha256 of the source>.svg`** is the **first 16 hex characters** — `gen-diagrams.ts:82` takes
  `.digest('hex').slice(0, 16)`.
- **"(and this directory's, where wired in — see §7)"** — nothing in this directory is wired in.
  `DIAGRAM_SOURCES` (`gen-diagrams.ts:61`) is exactly `['README.md', 'docs/README.he.md']`, and the
  cross-reference pointed at the Code map, which says nothing about wiring. §5 now states the gap
  plainly and §6 carries it as a known-wrong with a costed recommendation (below).
- **"The screen's own label, in both languages, is Composer."** English yes
  (`strings/en.js:147`); Hebrew is **`'מרכיב פקודות'`** (`strings/he.js:136`) — "command composer",
  a translation. The substantive point (neither language says "Palette") holds and is kept.
- **The 1.04:1 `--gold`/`--ok` figure**, reported faithfully from the ruling (`:50`) and
  `styles.css:991`, **reproduces from neither palette**: shipped **1.19:1**, retired 1.26:1
  (computed alongside the sixteen above). The conclusion survives; the number is now flagged as
  never re-derived rather than presented as a measurement of the shipped palette.

### `04-the-audit-log-decay-and-contribution.md` — 3

| # | The claim | What is true | How I established it |
|---|---|---|---|
| 12 | *"the MCP tools (`audit_log`, `decay_report`, and contribution's own tool)"* (§6) | **There is no contribution MCP tool.** | `grep -rn "contribution" src/mcp/` returns nothing. Enumerated all 28 registered tool names out of `src/mcp/tools.ts`; contribution is not among them. `audit_log` (`:1551`) and `decay_report` (`:1642`) are real. §7's point that contribution is the least-documented of the three is now sharper, not softer: it is the only one with no agent-facing door at all. |
| 13 | §3's `decay --summary` block, presented as "Real output", silently drops a **five-line disclosure** and a trailing clause | The two lines it kept reproduce exactly; the five it dropped are printed on every run — and **§1 of the same chapter quotes one of them**. | **Re-captured by running `mycontext decay --summary` and splicing stdout.** The block is now complete and unabridged. |
| 14 | §4's `contribution --summary` block is not output the command produces | Spliced: the first clause is the **opening paragraph**, the second is the **final summary line** some forty lines below it, welded into one sentence. The pasted `~58000` / `~193` are invented — the command prints exact integers in both slots and has never printed a tilde. | **Re-captured by running `mycontext contribution --summary` and splicing stdout.** The block is necessarily abridged (the command prints ~35 lines) and is now abridged *in the shape `07` §3 uses*: two bare `...` lines mark the cuts, and every retained line is byte-identical to stdout. |

Also repaired here (two warnings):

- **"Eighteen call sites write to it."** Right as a count of **modules** — 18 files call
  `recordAudit(` — but **the chapter's enumeration named 17**, omitting `audit.ts`'s own call, and
  by *invocation* the number is **30**. I enumerated every call line, excluded the definition at
  `audit.ts:1636` and the comment-only mentions in `src/ui/read-model.ts`, and counted per file:
  `pre-tool-use` 4, `post-tool-use` 3, `ui/execute` 3, then 2 each in `ui/security`, `session-end`,
  `pre-compact`, `core/focus`, `cli/procedure`, and one each in `mcp/tools`, `subagent-start`,
  `subagent-stop`, `post-tool-use-failure`, `post-compact`, `observe`, `revision`, `persist`,
  `inject`, `audit`. 18 modules, 30 invocations. Both figures are now stated, and the diagram node
  says "18 modules · 30 call sites" rather than "18 call sites".
- **§1 named seven of the eight audit kinds.** `--kind`'s enum (`audit.ts:730`) is
  `mutation | injection | hook | focus | access | progress | execution | **read**`. `read` restored.

### `05-lessons.md` — 2

| # | The claim | What is true | How I established it |
|---|---|---|---|
| 15 | *"There is no MCP tool for staging, accepting or discarding a candidate"* (§4) | **Staging has an MCP door.** `stage_rule_candidates` is registered at `src/mcp/tools.ts:1889` (`annotations: ADDS`) and its `run` calls the same `stageRuleCandidates` the CLI calls. | Read `tools.ts:1878–1905`. The chapter's *conclusion* survives — `lesson-accept` and `lesson-discard` genuinely have no tool — and the source three lines above the tool says why: `CLI_WITHOUT_TOOL['lesson-accept']` *"stays `intended` for exactly that reason"*. The premise was wrong **in the direction that overstated the chapter's own case**, which is the direction least likely to be challenged. The repair keeps the conclusion and re-sources it. |
| 16 | §3's "Real output" cuts the `--agent` help mid-sentence, losing *"`lesson-accept` refuses it by name"* — the trust mechanic the chapter exists to explain — plus a blank line and a three-line trailer | The command prints all of it. | **Re-captured by running `mycontext lesson --help` and splicing stdout.** Complete and unabridged. |

### `06-ingest.md` — 2

| # | The claim | What is true | How I established it |
|---|---|---|---|
| 17 | The item id `INV-a-validator-that-gates-writes-must-be-a-complete-precondition-for-the-write` (§2) | The real id is **`INV-a-validator-that-gates-writes-must-be-a-complete`**. Four words were appended to a real id, so `mycontext show` on the cited string returns nothing. | Indexed all **1,317** item ids out of `.my_context/items/**` and checked every id-shaped token in all eight chapters against that index (below). |
| 18 | §3's "Real output" cuts the `--anchor` help mid-sentence, without even its full stop | The command prints two further sentences. | **Re-captured by running `mycontext ingest --help` and splicing stdout.** Complete and unabridged. |

Also repaired: the disambiguating suffix is **`--N`**, double hyphen — `chunk.ts:339` builds
`` `${candidate}--${n}` `` — not `-N`.

### `07-focus.md` — 3

| # | The claim | What is true | How I established it |
|---|---|---|---|
| 19 | *"an item is hidden only if it fails **every** non-empty axis"* (§2) | Inverted. Hidden if it fails **any**. | `matchesFocus` (`select.ts:637`) returns `false` on the first non-empty axis with no match; its docblock at `:631` says *"every non-empty axis has at least one match … AND across axes, OR within one"* and gives the worked example. Under the old reading `--tag billing --category rule` hides only what is neither; under the code it hides everything that is not a `billing`-tagged `rule`. The two readings differ by most of the corpus, and the chapter now says so. |
| 20 | *"Only just-in-time's branch is the one focus can narrow at all — the other four fire on their own trigger regardless"* (§2) | Focus narrows the **whole eligible set, before any tier is computed**. | `select.ts:1516–1519` filters `eligibleAll` through `focusHides` once, *"so every tier and the index inherit it from one place"*. Pinned and continuity items are protected by three explicit exemptions **inside** `focusHides` (`:683–694`) — which is the only reason `exemptHard`, `exemptAlways` and `exemptContinuity` exist. §5 of the same chapter is the proof: a focus hid six pinned items for three days in 2026, which is impossible if focus cannot reach the pinned route. |
| 21 | §3's `focus --show` block drops the second of two printed lines | Two lines are printed; the dropped one is the one that tells the reader what to do next. | **Re-captured by running `mycontext focus --show` and splicing stdout.** |

---

## Three the verifier did not find

`nothing-to-do-and-could-not-look-are-different-answers` — these are things I looked at and found.

1. **`07` §2's diagram carried the same inverted quantifier as its prose, and the verifier marked
   that diagram correct.** Its edge read `SEL -->|"fails every axis"| HIDDEN`. The verdict table
   says diagram 12 *"draws the code correctly while §2's prose two paragraphs above describes it
   wrongly, twice"* — but the edge label is a third instance of the same inversion, inside the
   artefact held up as the corrective. It now reads *"fails ANY non-empty axis — AND across axes, OR
   within one"*. **This is the strongest argument for the neighbourhood rule in the whole pass**: a
   diagram that draws the right nodes can still carry the wrong sentence on an edge, and a
   node-by-node check will not see it.

   (One thing I nearly claimed here and should not: `04`'s enumeration naming seventeen of eighteen
   call sites. The verifier **did** catch that — it is inside the invocation-count warning, easy to
   read past, but it is there. Repaired, and credited to the report.)

2. **`03`'s "roughly 630 KB" for the committed SVGs is wrong, and so is the verifier's correction of
   it.** The report says 644 KB; the chapter says roughly 630 KB. Summing the ten files gives
   **686,068 bytes — 670 KiB, or 686 KB decimal**. Neither figure matches under either convention.
   The exact byte count is now in the chapter, twice, so the next reader does not have to pick.

3. **Two item ids in diagram node labels are truncated with `…` and are therefore not citable
   either** — `REF-the-d-numbers…` (`01` §4) and `DEC-the-meaning-hue-budget-is-five…` (`03` §3).
   **I left both, deliberately**, and the distinction is the point:
   `RULE-a-citation-names-an-item-by-id-never-a-report-by-line-number` is fatal for `06`'s invented
   suffix because that id *looked complete* and silently resolved to nothing. A visible `…` claims
   nothing; both full ids appear in the prose and code map of the same chapter. Expanding them would
   have cost the two diagrams their proportions for no gain. Recorded so the decision is visible
   rather than assumed.

### Every id in all eight chapters is now verified

I indexed all **1,317** ids from `.my_context/items/**` and matched every id-shaped token in the
eight chapters against it — a broad scan (`[A-Z][A-Z_]+-` followed by a lowercase-hyphen run), not
just the prefixes I expected, so an unusual prefix could not slip through. **Twenty-one distinct ids
cited; one invented (`06`'s, repaired); two truncated in diagram labels (above); eighteen resolve
exactly.** Re-ran the scan after the repairs: the invented one is gone.

---

## One of my brief's own claims had already rotted

My brief said `docs/capabilities/07-restore-and-handover.md:78` *"ships as a Mermaid error box
today"*, and told me to use it as the live evidence that nothing parses what is not in
`DIAGRAM_SOURCES`. **It was repaired four hours before I was dispatched** — commit `471b13b3`,
2026-09-17 13:50. I had already written the claim into `03` §5 before checking it; I then parsed all
sixteen `docs/capabilities/` diagrams and all sixteen pass, so I rewrote it.

The chapter now carries the event as a **dated past fact, which does not rot**: that fence carried
`&lt;key&gt;`, whose `&` breaks Mermaid's lexer, and it drew an error box for its entire life until
a person found it. The argument is stronger this way than the version I was handed, because the
commit message records something better than the bug: **a prior pass had reported that every fence
parsed, having checked bracket balance rather than rendering.** Balance is not parsing, and nothing
in this repository performs a real parse outside the two READMEs.

This is the second time in one task that a "byte-identical / as of today" claim went stale inside a
day. The first was the one my brief warned me about. The rule that falls out of both is the one the
brief already stated and I am restating because it was right twice: **prefer a claim that survives an
edit.**

---

## The README diagram, re-checked after the repair landed

`07` §2's five-routes diagram was *"byte-identical to README's at HEAD"* when the verifier wrote
that, and my brief predicted it would stop being true. It has. README's §4 diagram now adds
`S --> CONT` and `C --> CONT`, relabels the just-in-time branches (*"offered first"* /
*"offered only after every scoped item already fit"*), and says *"once per session"* rather than
*"once per context window"*.

I did not retype the new diagram. I **read README's current §4 fence with the product's own
`mermaidBlocks` tokeniser and spliced it into `07`**, then asserted equality programmatically
afterwards: `07`'s copy and `docs/capabilities/02-injection.md`'s copy are both byte-identical to
README's right now — but the chapter no longer *claims* that, because that claim is what rotted. It
now says the diagram is reproduced from README §4, the same source the capabilities copy is drawn
from, which survives an edit to any one of the three.

The prose around it needed the same repair and was not on the list: *"the fifth, continuity, is
missing from the picture … for the same reason it is missing there"* is now false, because README
draws it. Rewritten.

---

## All 12 diagrams still parse, and so do the 16 next door

Three of the twelve were edited in this pass (`01`'s three-lenses, `02`'s memory flow, `07`'s
predicate) and one was replaced wholesale (`07`'s five routes). I extracted all twelve with the
product's own `mermaidBlocks` — the same function `gen-diagrams.ts` and the live page call, which is
also what confirms the count is **12 and not 13**, the thirteenth `grep` hit being prose at `03:90`
— and fed each to `mermaid.parse()` in real Mermaid **11.17.2** in one headless Chromium, closed on
the same tick.

**12 of 12 parse.** I ran the same check over `docs/capabilities/`: **16 of 16 parse.** Nothing was
drawn, written or committed by either run.

---

## The recommendation the item asked for, costed

**Nothing under `docs/` outside the two READMEs is generated, committed or gated**, and one diagram
shipped broken for its whole life as a result. The measurements, so the decision is made against
numbers:

| | today | if `docs/system/**` and `docs/capabilities/**` joined `DIAGRAM_SOURCES` |
|---|---|---|
| diagrams drawn | 10 (5 per README, full translations) | **38** |
| committed SVG bytes | 686,068 | **≈2.6 MB** at the measured mean of 68,607 bytes per SVG |
| code change | — | one line: `DIAGRAM_SOURCES` at `gen-diagrams.ts:61` |
| what it catches | a README diagram that stops parsing, or drifts from its SVG | every diagram under `docs/` |
| what it costs on every edit | re-draw + re-commit one SVG | re-draw + re-commit one SVG, against a repository carrying ~2.6 MB of generated binary |

**There is a cheaper option that catches the actual defect.** The error box was a *parse* failure,
not a drift failure. A **parse-only gate** — extract with `mermaidBlocks`, call `mermaid.parse()` in
the headless Chromium the suite already launches, draw nothing, commit nothing — would have caught
it at zero repository weight. That is roughly the script I ran for this report, which took well
under a minute for 28 diagrams.

So the three options are: (a) widen `DIAGRAM_SOURCES` and carry ~2.6 MB, gaining rendered SVGs the
Markdown viewers do not need; (b) add a parse-only gate over `docs/**` at no repository cost, which
catches the defect that actually occurred; (c) neither, and keep finding these by reading.
**My reading is that (b) buys almost all of (a)'s value for none of its weight — but this is the
owner's call and I have not filed it as anything but this paragraph**, per the item's own
instruction.

---

## Where I agree and disagree with my brief's groupings

- **"`03`'s four contrast rows are ONE error, not four" — correct**, and repairing them as one is
  what surfaced that the chapter's own next two sentences already refuted its table. Repairing four
  numbers would have left the sentences alone.
- **"`04`'s three are two pasted blocks" — not quite.** Two of `04`'s three are the pasted blocks;
  the third (no contribution MCP tool) is a prose claim in §6 with no relation to either block. The
  grouping is right about where the *work* is and wrong about the *count*, which matters only
  because §6's claim would have been easy to skip while re-capturing output. Noting it because the
  brief asked to be corrected where it was wrong.
- **"the four worst errors are relationships read backwards" — correct, and understated.** There
  were five, not four, once `07`'s diagram edge is counted (above). All five were invisible to a
  line-number check and visible only to re-executing the sentence against the code.

---

## What I could not fix, and why

- **`02`'s `screens/conversations.js` (11,277) and `styles.css` (5,498) line counts.** Both are
  **exact at HEAD** and both are moving under the lane live in `src/ui/public/` — the working tree
  reads 12,638 and 5,822 right now. Writing today's working-tree numbers would record another
  lane's uncommitted work as though it had landed, and would be wrong within the hour. `02` §7
  already predicts this by name and tells the reader to re-run `wc -l`. **Deliberately left at their
  HEAD values.** I re-measured every line count in all seven code maps: **32 files, of which 30 are
  exact against the working tree right now and the other two — these two — are exact at HEAD.**
- **`00-index.md`.** Clean on 26 claims and left alone, per the item. I checked for knock-on: no
  chapter heading changed, all twenty relative links still resolve, and nothing the index points at
  moved. Its one open observation (the inventory names an eighth "nothing of the right shape" row —
  row 31, the status-line bridge — that the chapter's "five" does not account for) is the verifier's
  and is still open; it is a question about the index's own grouping, not a false claim, and I did
  not have standing to re-group it.
- **The `focus_active` doctor check** flagged open in `07` §5. Still open and still correctly
  flagged: `grep -rn focus_active src/` returns exactly one hit, the comment at `focus.ts:41`, and
  nothing in `src/doctor/checks.ts`. The chapter's decision to flag rather than guess is right and I
  left it.
- **`04`'s `contribution --summary` block cannot be complete.** The command prints about 35 lines
  including a cohort table. It is abridged, and the caption says so, says where the cuts are, and
  says what they hide. That is the shape `07` §3 already used and the only honest option short of
  pasting the whole thing.

---

## Method, and what I ran

Commands run (all read-only; each output spliced into the documents is stdout, not a transcription):

```
mycontext decay --summary
mycontext contribution --summary
mycontext lesson --help
mycontext ingest --help
mycontext focus --show
mycontext focus --category rule --preview
mycontext path
```

Computed rather than copied: sixteen WCAG 2.x contrast ratios; the anchors-file origin and lane-id
census (1,383 rows); the `recordAudit` module and invocation counts; the 1,317-id corpus index and
the id scan over all eight chapters; the ten SVGs' byte total; the diagram counts for
`docs/system/`, `docs/capabilities/` and `docs/tutorials/`.

One headless Chromium, twice: once to parse `docs/system/`'s twelve diagrams after the edits, once
to parse `docs/capabilities/`'s sixteen while checking whether my brief's error-box claim still
held. Nothing was drawn or written by either.

Every repaired document was left dirty for the main session to commit. Files touched: the seven
chapters under `docs/system/` and this report. `00-index.md`, `src/`, `scripts/`, `test/`, `e2e/`
and `.my_context/` are untouched.

---

*Repaired 2026-09-17 by lane AW against `docs/system/` at `471b13b3`, with another lane's
uncommitted changes to `conversations.js`, `styles.css`, `strings/en.js`, `strings/he.js`,
`lib/diagrams.js` and five `e2e/` files present throughout and accounted for where they matter. Every
count in this report is itself a dated reading: the audit log gained records while the contribution
block was being captured, which is why that block's own totals differ between two runs a minute
apart and why its caption says to re-run.*
