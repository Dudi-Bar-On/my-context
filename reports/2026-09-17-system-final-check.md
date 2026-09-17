# `docs/system/` — the last verification pass — 2026-09-17

`TASK-four-repair-passes-have-landed-and-nothing-has-checked-the` · `rulings/110` · lane BF ·
`docs/system/**` half only, read-only, checked against `7865d0e8`

**The discipline held.** 196 claims checked across all eight chapters. **Four false or materially
imprecise**, plus five soft imprecisions worth a line each and one sentence the pass's own filing
falsified two minutes after it committed. That is ~2%, against 31/214 (~14.5%) for the pass I am
checking and 21, 28 and 38 before it. This is the first pass in the campaign whose residual rate
fell, and it fell seven-fold.

**None of the four is a wrong mechanism.** Three are counts; one is the word "verbatim". Every
relationship I re-derived from code — every arrow direction, every edge label, every guard order,
every import direction, every exemption — was right. **My recommendation is to stop.**

Read-only. No document changed. No `git` command that writes. Port 58888 untouched. No browser
driven; the only Chromium use was one 1.6 s `npm run check:diagrams` run. `docs/capabilities/**`,
`README.md` and `docs/README.he.md` were read constantly and written never — the other lane was
committing to `src/ui/public/` while I worked and I read HEAD, not its working tree, wherever a
number depended on it.

---

## 1. What I checked, and how the 196 is made up

Every figure below is a thing I ran or recomputed in this session, not a sentence I read.

| Kind of claim | Checked | Method |
|---|---|---|
| `file:line` citations | 104 | `awk`/`grep -n` on the named line, never a `sed` window |
| Line counts (`wc -l`) | 38 | 36 against the working tree, 2 against `git show HEAD:` |
| Numeric figures recomputed from source data | 46 | WCAG luminance from hexes, `du` over the SVGs, fence `grep -c`, a JSONL origin census, a `recordAudit` census, the id/link scan |
| Command output blocks re-run and diffed line by line | 12 blocks (≈40 lines) | `decay --summary`, `contribution --summary`, `lesson --help`, `ingest --help`, `focus --show`, `focus --category rule --preview`, `ready` |
| Quotations checked verbatim against their source | 18 | including the owner's misspelling in `lane.js`, the doubled hyphen in the hue ruling, and the capitals in the D-map item |
| Relationship / direction / quantifier claims | 20 | read the code path, not the citation |
| Cited item ids | 23 distinct | scanned against 1,326 ids under `.my_context/items/` |
| Relative links | 30 | resolved against the filesystem |
| Corpus item states cited as open or done | 4 | frontmatter |
| Cross-document byte equality | 3 fences | the product's own `mermaidBlocks` extractor |

**Chapters swept: all eight — `00` through `07`.** None skipped. I read each chapter end to end as
a chapter at least once, looking for a section contradicting its neighbour, which is how finding 2
and finding 1 were found; neither is visible to anyone checking a claim against code.

**Sampled hardest where the campaign has actually bled:** `03` §4 (all 21 contrast ratios
recomputed from the hexes before reading the tables), `07` §2 (the README fence, three-way byte
comparison), `04` §2 (the `recordAudit` census re-derived from scratch), `02` §3/§5/§6, `01` §1/§4
(the diagram labels), and every caption that states a count of lines or paragraphs.

---

## 2. The four findings

### 1. `00` §"why these five" — **"covered here in five chapters"**, and there are seven. *(quantifier, self-contradicting, written by this pass)*

The pass's own repair replaced *"Five had nothing of the right shape"* with the correct
**"Seven of the 32 had no chapter at all"** — and then wrote, in the next clause:

> They are covered here in **five** chapters, because lessons, ingest and focus share one row below
> and get one chapter each.

The subordinate clause refutes the number it explains. Seven subjects, each with its own chapter,
is **seven** chapters — `docs/system/` holds `01`…`07`. What is five is the number of *rows in the
table below*, which is what "share one row below" is about. Twelve lines later the chapter says so
itself: *"Lessons, ingest and focus are three separate short chapters rather than one combined
one."*

The old framing survives in four more places, all now false against the repaired count:

- `00:25` — the heading, *"What is here, and why these five"*
- `00:86` — See also, *"the inventory that identified these five gaps"* (seven gaps)
- `04:5` — *"the most scattered of the five this pass covers"* (seven)
- `05:6` — *"the smallest of the five subjects this pass covers"* (seven)

**How established:** `ls docs/system/` → eight files, `00-index` plus seven chapters. The inventory
rows the chapter itself enumerates — 6, 9, 30, 17, 18, 19, 20 — are seven, and I read all seven in
`reports/2026-09-16-the-subjects-of-this-system.md`; each maps to exactly one chapter. The
"and for three of them not even a tutorial" in the same sentence **is** correct (rows 6, 9 and 30).

### 2. `03` §6 — **"the sixteen in `docs/capabilities/`"**, and there are seventeen; §5 of the same chapter implies seventeen. *(quantifier + chapter contradicting itself)*

`03` §5 records the gate's reading with deliberate care, and correctly:

> The totals moved between runs — 38 fences, then 39 — … 10 fences in the two READMEs, **12 under
> `docs/system/`** … and the rest under `docs/capabilities/`.

39 − 10 − 12 = **17**. Two sections later, §6 says:

> …so the twelve diagrams in `docs/system/` and the **sixteen** in `docs/capabilities/` exist only
> as fences a viewer renders

**How established:** `npm run check:diagrams` today prints `39 fence(s) across 21 of 27
document(s)`. `grep -c '^```mermaid'` gives 10 in the two READMEs, 12 under `docs/system/`, **17**
under `docs/capabilities/`. Per-commit: `git show <sha>:<file>` over the whole directory gives
**16 at `e515eff4`** and **17 at `c415c6db`** — the seventeenth landed at 17:53:11, **one minute and
41 seconds before this pass committed at 17:54:52**. So §5 knew the number was moving, refused to
state it, and wrote the shape instead — and the same correction was not carried into §6.

This is the sharpest finding of the pass, because it is the pass's own best practice applied in one
section and not the next.

### 3. `06` §5 — **"Four more instances of the same over-long id"** in `test/cli/format-table.test.ts`. *(materially imprecise — it is not the same id)*

The over-long id the chapter is about is `INV-a-validator-that-gates-writes-must-be-a-complete-`
`precondition-for-the-write` (`src/ingest/schema.ts:340`), four words longer than the real
`INV-a-validator-that-gates-writes-must-be-a-complete`.

The strings in `test/cli/format-table.test.ts` are
`INV-a-validator-that-gates-writes-must-be-a-complete-precondition` — **one** word longer than the
real id, three words shorter than `schema.ts`'s. They are not the same id.

**How established:** `grep -o "INV-a-validator[A-Za-z0-9-]*" test/cli/format-table.test.ts | sort |
uniq -c` → 3 × `…-precondition` and 1 × `…-precondi` (a deliberately truncated column-width
fixture). A tree-wide `grep -o` for the exact long form returns it in exactly three places, none of
them that file: `src/ingest/schema.ts:340` and two `TASK-` items. The count "four" is defensible if
you count the truncated fixture; **"the same over-long id" is not.**

The surrounding claims are all correct: `check-cited-items.ts` prints
`UNKNOWN src/ingest/schema.ts:340 … no item answers to it` only under `--unresolved`, exits 0, and
reports **2,621** id-shaped strings — I ran it and the number is exact.

### 4. `05` §4 — **"carries `disposition: 'intended'` and that reasoning verbatim (`plugin/parity.ts:516–523`)"**. *(a textual-identity claim that does not hold)*

The reasoning quoted just above it is `stage_rule_candidates`'s doc comment
(`tools.ts:1882–1885`): *"The candidates it stages are inert until a HUMAN runs `mycontext
lesson-accept`, which is the only call site of `createItem` anywhere in this module and hardcodes
`origin: 'human'` with no override"*.

`parity.ts:518–523` says something else in different words: *"The approval gate
`CLI_WITHOUT_SLASH.lesson-accept` names, and `lesson/derive.ts`'s `acceptStagedRule` hardcodes
`origin: 'human'` on the `createItem` call … A tool would be the model accepting a rule on its own
authority."*

Same argument, **not verbatim**. `disposition: 'intended'` at `:517` is correct, the citation range
is correct, and the conclusion is correct. Only the word "verbatim" is false — and it is in the same
family as the `07` README claim: an assertion of textual identity written in prose, where nothing
checks it.

---

## 3. One sentence the pass's own filing falsified, two minutes after it committed

`06` §5 opens:

> No item under `.my_context/items/known_issue/` mentions ingest by name — re-checked 2026-09-17
> with a case-insensitive grep over the whole directory, which returned nothing.

`grep -ril "ingest" .my_context/items/known_issue/` now returns
`KNOWN-a-source-file-cites-an-item-id-that-does-not-resolve-and-no.md` — scope
`src/ingest/schema.ts`, body naming `docs/system/06-ingest.md`. Its mtime is **17:56**; the commit
is **17:54:52**. It is one of the three code findings the pass's own commit message says it *"named
here and filed separately"*.

It is still untracked, so the sentence is true at HEAD and false in the working tree, and will be
false at the next commit. I list it apart from the four because the pass did not write a false
sentence — it wrote a true one and then, correctly, did the thing that made it false. It is the
cleanest demonstration in this campaign of why a claim whose truth depends on the state of a
directory should not be written as a bare assertion, and the chapter already knows the fix: it
states its method and its date, so a reader can re-run the grep.

---

## 4. Five soft imprecisions — reported, not counted among the four

Each is a citation range or a count that is off by a line or two. None misleads a reader about a
mechanism. I list them so nobody has to find them twice, not as a case for another pass.

1. **`02` §3 — "the literal at `lane.js:208–213` carries six members."** The literal is at
   **`:206–213`** (`const ctx = {` is `:206`, `t:` is `:207`). As cited, the range contains five of
   the six members it is counting — in the sentence whose whole point is the count. Same class as
   the two the pass caught in itself (`path.ts:90`, `parity.ts:516–523`); this is the third.
2. **`02` §6 — "both deleted together at `:7534`."** `CSS.highlights.delete(FIND_HIGHLIGHT)` is
   `:7534`; `delete(FIND_NOW_HIGHLIGHT)` is `:7535`.
3. **`07` §6 code map — "applied to `eligibleAll` at `:1515–1518`"** disagrees with **`07` §2's
   `select.ts:1511–1518`** for the same filter. §2 is the better range (`:1511` is where the quoted
   comment begins, `:1518` is the `focusHides` call); `:1515` is the comment's last line.
4. **`03` §2 and §7 — the palette-trial comment at `:101–145`.** It runs `:101–146` (`:146` is
   `better of the two. */`). `:147` for the declaration is exact.
5. **`00` — "verified against the working tree on 2026-09-13 at fourteen chapters."** At
   `a7f267a8` (2026-09-13) `docs/capabilities/` held fourteen *files*: `00-index.md` plus chapters
   **1–13**. Under the directory's own numbering that is thirteen chapters and an index. Also in
   the same sentence, **"repaired and re-verified twice since"** `1ec219c2`: five commits touched
   `docs/capabilities/` after it, of which at least three (`471b13b3`, `e515eff4`, `c415c6db`) are
   repair-and-verify passes, the last landing 101 seconds before this sentence was committed.

---

## 5. What I checked that was right — so the denominator means something

192 of 196 held. The ones worth naming, because they are the places this campaign has bled before:

- **All 21 contrast figures in `03` §4, recomputed from the hexes under WCAG 2.x relative luminance
  before reading the chapter's tables.** Shipped on `--panel`: 7.84 / 9.31 / 6.37 / 4.75. Retired:
  8.42 / 10.58 / 6.31 / 7.00. On `--panel-2`: shipped 7.35 / 8.74 / 5.98 / **4.45**, retired 7.90 /
  9.92 / 5.92 / 6.57. `--gold` against `--ok`: **1.19** shipped, **1.26** retired, and the ruling's
  1.04 reproduces from neither. `--carry` 6.38:1 on `--panel-2` and 7.29:1 on `--paper`. **Every
  one to the second decimal.** That confirms the pass's `styles.css:1319–1320` finding
  independently: all eight numbers there are the retired palette's, on both grounds, wearing the
  shipped tokens' names, and `--crit` at 4.45 does not clear AA.
- **The `recordAudit` census, re-derived from scratch.** `grep -rn "recordAudit(" src/` → 32 hits in
  19 files; `audit.ts:1636` is the definition and `ui/read-model.ts:1521` is a comment → **18
  modules, 30 invocations**, concentrated in `pre-tool-use` (4), `post-tool-use` (3), `ui/execute`
  (3). Exactly what `04` §2 says, and the §6 contradiction the pass found is genuinely repaired.
- **The `07` README fence, byte-equal across three files *today*.** Extracted with the product's own
  `mermaidBlocks` from `README.md`, `docs/capabilities/02-injection.md` and `docs/system/07-focus.md`:
  all three 1,126 bytes, `===` true both ways. The claim that has rotted three times is currently
  true. See §7 for whether it can stay that way.
- **Both caption counts the pass corrected are right.** `mycontext decay --summary` prints exactly
  **four** indented disclosure lines (the draft that called them five was wrong, the correction is
  right). `mycontext contribution --summary` prints exactly **three** indented paragraphs where the
  first `...` sits (BASELINE, injection-is-not-reading, 1159-not-injectable) and exactly **one**
  where the second sits. Both re-run and counted in stdout.
- **`06`'s "32, not tens of thousands."** `TITLE_VARIANTS` 4 × `BODY_VARIANTS` 4 ×
  `SEVERITY_VARIANTS` 2 = 32, in a file of exactly 69 `test(` cases, charter at `:631`.
- **Every line count in the five code maps — 38 files under `wc -l`, all exact**, including the two
  the other lane is moving right now: `app.js` **8,592** and `styles.css` **5,868** are correct at
  HEAD, which is what `03` §7 says it recorded and why.
- **Every cited item id.** 23 distinct id-shaped tokens across the eight chapters against 1,326 ids
  in the corpus: **20 resolve exactly**; the 3 that do not are the two deliberate `…` truncations
  in diagram labels (`REF-the-d-numbers…`, `DEC-the-meaning-hue-budget-is-five…`) and the one
  quoted **as the defect** in `06` §5. **Zero invented ids.** The decision to leave the two
  truncations is right and I did not touch them.
- **All 30 relative links in `docs/system/` resolve.**
- **Every relationship claim I tested ran the direction the chapter draws.** `needs.ts` never reads
  `blocks` (3 header mentions, 0 in code); `questions.ts` imports *from* `needs.ts` (`:137–139`);
  `check-board.ts` never imports `questions.ts`; `state` is read at `:490` and `done` dropped at
  `:491` with the `deprecated` guard nineteen lines down at `:509`; `fold.js` has exactly two
  importers and `searchArchiveTiered` (`:1174`) is not one of `findQuery`'s consumers —
  `findInDocument` (`:1588`) is the only one; `lane.js:55–58` really does say `/doc.html` *sets* the
  trap; `focusHides` carries exactly the three exemptions in `select.ts:685/686/692`. The `01` §1
  diagram note that reads backwards on first glance — *"readyReport HOLDS this only when needs is
  also empty"* — is **correct**: `select`'s branch is `state === BLOCKED_STATE &&
  reading.satisfied.length === 0`, reached only after malformed/pending/unresolved have already
  fired.
- **Every quotation verbatim**, including the owner's *"arround"* in `lane.js`, the doubled hyphen
  and capitals in `DEC-the-meaning-hue-budget-is-five…` (the splice the pass repaired is a clean
  two-sentence quotation from `:37` and `:41`, four lines apart exactly as stated), the D-map
  item's *"AND A D NUMBER NAMES A SUBJECT"*, and `seq:7`'s *"SCROLLING OVER A TERMINAL"*.
- **`mycontext ready`'s live line** still reads *"8 active open question(s) not listed above: 4
  naming work that is already done, 4 naming nothing it blocks"* — `01` §4's repaired sentence is
  current.
- **`mycontext focus --show` reproduces byte for byte**, both lines. In `--preview`: 7 pinned, 6
  dangling with `DEC-index-lists-only-what-is-not-already-injected → INV-nothing-is-dropped-silently`
  at the head, 53 `severity:hard` with `CONST-evidence-must-cite-a-captured-record-id` at the head,
  and the closing sentence — all exact.
- **All four corpus item states cited as open or done are as cited.**
- **`npm run check:diagrams`: 39/39 parse, 1.6 s, and the RED proof fires first** and is refused,
  every run.
- **`test/docs/*.test.ts`: 112 tests, 112 pass** under the rendering pin (101 s).

---

## 6. Measured drift since the pass committed, five and a half hours ago

Not findings — the chapters name every one of these as a dated reading and tell the reader to
re-run. Recorded because the *rate* is the argument for the gate judgement below.

| Where | At the pass | Now | Chapter's own handling |
|---|---|---|---|
| `docs/capabilities/` fences | 16 | **17** | §5 refuses the number, §6 states it — finding 2 |
| `mycontext decay --summary` | `cold 0, warm 165, of which 124 unrestricted` | **`cold 2`**, rest unchanged | *"Re-run before citing — the ledger grows every session"* |
| `mycontext contribution --summary` | 3,739 records / 1,324 items / 193 ids / 165 injectable, medians 1303 / 1057 | **3,747 / 1,326 / 195 / 167, medians 1306 / 1036** | the caption is built around exactly this |
| `.my_context/.anchors.jsonl` | 757 of 1,409 lane-tagged, 1 owner / 1,408 automatic | **759 of 1,414, 1 / 1,413** | `02` §7 says re-count |
| `focus --category rule --preview` hidden | 1,135 | **1,137** | *"the hidden list is the figure that moves"* |
| `styles.css` / `app.js` working tree | 5,969 / 8,592 | **6,024 / 9,145** | `03` §7 records HEAD and names the commit — the right call |

Six moving figures in five and a half hours, on a day nobody was trying to move them. **The
chapters' handling of this is the best thing in them** — every one is dated, every one names the
command, and `03` §7 explains in three sentences why it recorded HEAD and not the working tree.

---

## 7. The deliverable: are the two gates enough, and what can they not see

**No. Not for `docs/system/**`.** They are enough for the one failure that produced them — a fence
shipping to readers as a Mermaid error box — and `check:diagrams` is a gate you can actually
believe about that, because it proves it can fail before it reports that nothing failed. But the
class of defect this campaign has spent four passes finding is almost entirely outside both.

### The finding that settles it

**`test/docs/*.test.ts` does not read `docs/system/**` at all. Neither does it read
`docs/capabilities/**`.** I grepped every path literal in all twelve files: the only documents they
open are `README.md` (27), `docs/README.he.md` (17+6), `docs/prd.md`, `docs/TUTORIAL.md`,
`docs/TUTORIAL-ADVANCED.md` and four `docs/superpowers/` specs. "Both documents", in
`counts.test.ts`'s eighteen test names, means the two READMEs. `doc-system.test.ts` is about the
document *manifest and serving routes*, not about this directory. A tree-wide grep for the string
`docs/system` across `test/` and `scripts/` returns exactly three hits: two in
`test/scripts/diagrams-parse-gate.test.ts` asserting the directory is in the sweep, and
`check-diagrams-parse.ts:112` putting it there.

So of the two gates named in the item, **one of them does not look at these chapters, and the other
looks only inside ```mermaid fences.** Roughly 1,800 lines of chapter prose are held by nothing.

### What they cannot see, concretely

1. **A wrong edge direction still parses.** `A --> B` and `B --> A` are both valid Mermaid. Every
   arrow-reversal finding of this campaign — including the four in `3aa31302` — would report green.
2. **A wrong edge *label* still parses.** The label is an opaque string to the parser. The inverted
   quantifier a verifier found inside an already-scored-clean diagram was in a label.
3. **A wrong quantifier inside a node still parses.** `"each entry lands in exactly one of FOUR"`
   parses identically whether the code has three buckets or four. The `01` §4 "every ref → three
   buckets" finding lived inside a fence and the gate was green over it.
4. **A false `file:line` citation passes everything.** Nothing anywhere compares a cited
   `path.ts:90` against `path.ts`. Three of this campaign's self-corrections, and three of my five
   soft findings, are exactly this.
5. **A cited item id is not checked.** `check-cited-items.ts`'s `SOURCE_ROOTS` is
   `['src','test','scripts','e2e']` (`:191`) — `docs/` is not walked — and even inside that reach it
   is reported-never-gated, exits 0, and buries its one real hit among 2,621 id-shaped strings.
   Already filed.
6. **A stale count is not a parse error.** Six moving numbers in five and a half hours (§6). Nothing
   re-runs a command and diffs it against a fenced block; nothing counts the indented lines a
   caption claims.
7. **A chapter contradicting itself passes both gates.** Nothing reads two sections of one file and
   compares them. Finding 1 and finding 2 are both of this shape, and both are green everywhere.
8. **Textual identity between two documents is checked by nothing.** `check:diagrams` parses
   README's copy of the five-routes fence, `02-injection.md`'s copy and `07`'s copy — three times,
   independently — and compares none of them to each other. `07` §2 says this itself.
9. **The floors are hand-maintained and are already one behind.** `FENCE_FLOOR = 38`,
   `FILE_FLOOR = 21`, against 39 fences today. They refuse a silent collapse to zero, which is what
   they are for; they will not notice one chapter's single fence being deleted.
10. **The RED proof proves the gate can fail on *one* input.** It is pinned to the pre-`471b13b3`
    chapter-7 fence, recovered from git. That is a real anti-vacuity guard and it is more than most
    gates have — but it demonstrates "mermaid rejects a broken `&`", not "this gate would catch the
    next class of breakage."

### `07`'s README claim — can a claim of that shape survive, or should the gate own it?

**It cannot survive in prose, and the gate should own it.** The evidence is that the claim has now
been written three ways and rotted all three times: byte-identical (true for one commit), provenance
(stayed true while the picture silently stopped matching — strictly worse, because it read as
reassurance), and now byte-identical again, asserted programmatically. It is byte-equal across all
three files as I write this. It will not stay that way, because README is edited by people who are
not reading `docs/system/07-focus.md`.

The chapter's own mitigation is the right one and should be kept: it demotes the equality to a dated
measurement and adds the instruction that does not rot — *"if this drawing and README §4 ever
disagree, README's is the one that is right."* But a skimmer still reads "all three byte-identical"
as a present-tense property.

**The cheapest closure in this whole report is about fifteen lines**, and it is the exact assertion
the pass performed by hand:

```
extract the five-routes fence with mermaidBlocks() from README.md,
docs/capabilities/02-injection.md and docs/system/07-focus.md;
assert all three are byte-equal, naming README as the authority in the failure message.
```

It uses the product's own extractor (no second scanner — the rule `03` §5 already argues for), runs
in milliseconds, needs no Chromium, and would have caught all three rots of this claim. It belongs
in `test/docs/`.

### In order of findings-per-line, what else would help

1. **Add `'docs'` to `check-cited-items.ts`'s `SOURCE_ROOTS`.** Already filed. Closes blind spot 5
   for the 23 ids in these chapters, which are currently held by two hand readings with dates on
   them.
2. **A citation test**: extract every `` `<path>:<N>` `` from `docs/system/**` and
   `docs/capabilities/**`, assert the file exists and has at least N lines. It will not catch an
   off-by-two inside a live file, but it catches the whole class of citations left behind by a file
   that moved — which is what rotted `03` §4's `:991`→`:1003` and `03` §5's `:61`→`:69` inside five
   hours.
3. **Make `FENCE_FLOOR` fail loudly when actual exceeds floor + 1**, or derive it. A floor that
   drifts silently upward is a floor nobody will maintain.

### Where the line actually is

The honest summary is that these two gates hold **shape**, not **truth**. They guarantee that a
fence parses and that README's counts match the code. Everything the campaign has actually been
finding — directions, quantifiers, self-contradiction, stale counts, claims of textual identity —
lives on the other side of that line, and for `docs/system/**` specifically there is nothing on that
side at all.

That is not an argument for another verification pass. It is an argument that the four things above,
which are perhaps sixty lines of test code between them, are worth more than any further reading —
because a reading has a date on it and a test does not.

---

## 8. What I could not establish either way

- **`00`'s "151,884,220 bytes on 2026-09-17"** for this project's own transcript. I did not locate
  and `stat` the file, so I neither confirmed nor refuted it. The 63,871,429-byte / 27,752-record
  figure it is compared against **is** verified, at `read-model-conversation-document.ts:26`.
- **The 14 sentences the pass marks "carried"** in its own §6 — the 0.55 ms p95, the 3,572,661-byte
  Mermaid vendoring cost, the 1,775,487-hit `SearchCursor` comparison, the eight `var(--warn)` sites
  of 2026-08-25, the "about a week" of broken lane writes. I read each one's stated source and
  confirmed the source says what the chapter says it says; I did not re-derive any of them, which
  is exactly what the pass claims and labels.
- **Whether the `e2e/*hue*.spec.ts` gates `03` §3 names actually pass.** All four files exist; I did
  not run the browser suite, per the constraint about the other lane.
- **`scripts/backfill-requests.ts`'s relationship to the live ingest flow** (`06` §5). Still not
  traced. Two passes have now flagged it and neither closed it, including this one.
- **Whether `02` §3's "about a week"** is right. Nothing in the tree dates the first broken write.
  The chapter attributes it to `lane.js`'s header, which is the honest thing to do.

---

## 9. Method, and what I ran

All read-only. No `git` command that writes; the only git used was `show`, `log`, `ls-tree`,
`status --short` and `diff --stat`.

    node src/cli/index.ts ready
    node src/cli/index.ts decay --summary
    node src/cli/index.ts contribution --summary
    node src/cli/index.ts focus --show
    node src/cli/index.ts focus --category rule --preview
    npm run check:diagrams                                   (once, 1.6 s)
    node scripts/check-cited-items.ts --quiet
    node scripts/check-cited-items.ts --unresolved
    node --import ./test/helpers/pin-rendering.ts --test "test/docs/*.test.ts"

Computed rather than read: 21 WCAG 2.x contrast ratios from hex values; the 10-SVG byte total and
mean; `grep -c '^```mermaid'` over every `.md` in the tree and over three historical commits; a
`recordAudit` module and invocation census; an origin/lane-id census over 1,414 rows of
`.my_context/.anchors.jsonl`; a 1,326-id corpus index and an id scan over all eight chapters; a
relative-link resolver over all eight chapters; `wc -l` over 38 cited files, two of them via
`git show HEAD:`; a `mermaidBlocks` extraction and three-way byte comparison between `07`,
README §4 and `docs/capabilities/02-injection.md`.

Every line citation was checked with `awk 'NR==N'` or `grep -n`, never by counting lines in a `sed`
window — which is the mistake the pass I am checking caught in itself, and the reason I did not
repeat it.

Files written: this report, and nothing else.

---

*Verified 2026-09-17 by lane BF against `7865d0e8`, with another lane holding `docs/capabilities/**`
and a third writing `src/ui/public/`. 196 claims checked, 4 false or materially imprecise, 5 soft,
1 falsified by the pass's own filing, 6 figures measurably drifted in five and a half hours. The
discipline held. Every count in this report is itself a dated reading.*
