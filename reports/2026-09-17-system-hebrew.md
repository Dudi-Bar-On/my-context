# The Hebrew edition of `docs/system/` — what landed, and what it cost to find

`rulings/109`, `TASK-the-hebrew-edition-of-the-two-document-sets-was-the-owner-s`, the
`docs/system/**` half. The `docs/capabilities/**` half is a second lane and is not covered here.

**The tree is left dirty and uncommitted, and there is ONE BLOCKING EDIT OUTSIDE THIS LANE'S WRITE
SCOPE that has to land in the same commit** — see [§7](#7-one-blocking-edit-this-lane-was-not-allowed-to-make).

---

## 1. What landed

| Path | Lines | What it is |
|---|---|---|
| `docs/system/00-index.he.md` | 135 | mirror of `00-index.md` |
| `docs/system/01-the-board.he.md` | 350 | mirror of `01-the-board.md` |
| `docs/system/02-the-document-and-lane-viewer.he.md` | 415 | mirror of `02-…` |
| `docs/system/03-the-palette-and-the-drawn-language.he.md` | 383 | mirror of `03-…` |
| `docs/system/04-the-audit-log-decay-and-contribution.he.md` | 304 | mirror of `04-…` |
| `docs/system/05-lessons.he.md` | 196 | mirror of `05-lessons.md` |
| `docs/system/06-ingest.he.md` | 241 | mirror of `06-ingest.md` |
| `docs/system/07-focus.he.md` | 304 | mirror of `07-focus.md` |
| `test/docs/system-parity.test.ts` | 250 | the parity gate, extended to these eight pairs |
| `scripts/check-diagrams-parse.ts` | — | `FENCE_FLOOR` 38 → **51**, `FILE_FLOOR` 21 → **28** |

2,328 lines of Hebrew against 1,816 lines of English — Hebrew prose is wrapped at the same column
but carries `<span dir="ltr">` markup the English does not need, and every `<div dir="rtl">` block
costs four lines.

**Nothing in these eight files was re-measured and nothing was re-audited.** Every count, ratio,
byte figure, contrast reading and line number is carried across from the English as it stands after
`5e67204a`. Each file's header comment says so in its own words.

### What was translated, and what deliberately was not

- **Prose, headings, tables, and every Mermaid LABEL** — translated.
- **Mermaid graph structure** — byte-for-byte identical. Same node ids, same edge operators, same
  `linkStyle` lines, same line count per fence. Verified per-fence (§6).
- **Pasted command output** — **not translated and not retyped.** All six blocks were extracted
  from the English files programmatically and spliced into the Hebrew files by a script, so a
  hand-retyped block was never possible. Byte-identity is asserted by the new test on every run.
  The two bare `...` cuts in `04` §4 and the `...` cuts in `07` §3 are the English chapter's own
  marks, in the same positions, standing for exactly what the English paragraph after each block
  says they stand for.
- **`07` §2's injection-map fence** — not translated either. The English chapter carries
  `README.md` §4's fence verbatim because README owns that drawing; the Hebrew chapter carries
  **`docs/README.he.md` §4's own fence**, extracted with the product's own `mermaidBlocks` and
  spliced byte-for-byte. Same 16 lines, same node ids, same edges. Translating README's English
  fence into a second Hebrew drawing would have manufactured exactly the second copy that section
  is about. The splice script asserts `docs/system/07-focus.md`'s fence still *is*
  `README.md`'s fence 2 before it runs, and refuses if that ever stops being true.
- **Item ids** — identical, never transliterated. Verified: for all eight pairs the *multiset* of
  `DEC-|INV-|KNOWN-|TASK-|REF-|CONST-|STD-|RULE-` ids is identical between editions, occurrence
  counts included. That includes the three ids that do not resolve against `.my_context/items/`
  and are correct not to:
  - `DEC-the-meaning-hue-budget-is-five…` and `REF-the-d-numbers…` — the two deliberate
    truncations inside Mermaid labels. Left exactly as they are: a visible ellipsis claims nothing,
    an invented suffix would look complete.
  - `INV-a-validator-that-gates-writes-must-be-a-complete-precondition-for-the-write` in `06` §5 —
    the wrong id that `src/ingest/schema.ts:340` carries. **That id being wrong is the finding.**
    Correcting it in translation would have deleted the finding.
- **Links** — the precedent's policy, which is `docs/README.he.md`'s: point at the English target.
  One exception, stated in every file's header: a sibling chapter inside `docs/system/` points at
  its own `.he.md`, because that mirror is written in the same change and is certain to exist.
  `docs/the-store.he.md` was already Hebrew and is linked as itself. All 39 links across the eight
  files were parsed out with the product's own tokeniser and every target checked to exist on disk.

### Terminology, and where it came from

Not invented. Taken from the product's own Hebrew (`src/ui/public/strings/he.js`) and from
`docs/README.he.md`, in that order of authority:

| English | Hebrew | Source |
|---|---|---|
| lane | סוכן עזר | `strings/he.js` `conv.lane` and ~20 neighbours |
| focus | מיקוד | `strings/he.js` `focus.title` |
| audit log | יומן הביקורת | `strings/he.js` `watch.resync` |
| projection | השלכה | `strings/he.js` `watch.pulseAbsent` |
| ledger | הפנקס | `docs/README.he.md` |
| lesson | לקח | `strings/he.js` (13×) and `docs/README.he.md` (39×) |
| Composer | מרכיב פקודות | `strings/he.js:136` — which is itself `03` §1's point |
| item · tier · door · record · hook | פריט · דרג · דלת · רשומה · הוק | `docs/the-store.he.md` |

**One pre-existing split in the tree, reported not resolved:** `lesson` is `לקח` in the product's
UI and in `docs/README.he.md`, but `שיעור` in
`docs/tutorials/lessons-staging-and-promotion.he.md`. I followed the majority and the product, and
noted it in `05-lessons.he.md`'s header comment. A translation is not the place to settle a term
the tree is split on; somebody should pick one.

---

## 2. English sentences I believe are wrong — translated as they stand

**None of these were fixed, softened, clarified or resolved.** Each is rendered into Hebrew with
its defect intact, because a translation that improves a claim has made an unverified claim.
Ordered by how confident I am.

### 2.1 `06-ingest.md` §5 contradicts itself in three sentences — high confidence

> *"No item under `.my_context/items/known_issue/` mentioned ingest by name until 2026-09-17, when
> this very pass filed one — which falsified the sentence 68 seconds after it was written, and is
> left here as the record of it. Re-checked 2026-09-17 with a case-insensitive grep over the whole
> directory, which returned nothing."*

The paragraph says an item **was filed** and then says a re-check of the same directory **returned
nothing**. Both cannot describe the same moment. Either the filed item does not contain the word
"ingest", or the re-check ran before the filing and is being reported after it. As written a reader
cannot tell which, and the second sentence reads as evidence for a claim the first sentence has
already withdrawn. Translated literally, contradiction included.

### 2.2 `02-the-document-and-lane-viewer.md` §4 gives one file two sizes — high confidence

The transcript is **`63,871,429` bytes** in the measurement table and the diagram, and
**"63.9 MB"** in the paragraph about what never enters memory. Two paragraphs later the same file
is **"the 61 MB transcript"**. 63,871,429 bytes is 63.9 MB decimal *or* 60.9 MiB; the chapter uses
"MB" for both readings without saying so. This is precisely the class of number-in-prose defect
this directory is about. Both figures translated as they stand.

### 2.3 `02-the-document-and-lane-viewer.md` §5 gives one population two totals — high confidence

The `SearchCursor` comparison ran over **"11,364 real archive spans"**. Four sentences later,
**"806 of 11,251 spans in the archive change under NFKD normalisation at all."** Same noun, same
archive, same section, 113 apart, with nothing distinguishing them. One of the two is a different
population or a different reading date and the chapter does not say which.

### 2.4 `07-focus.md` cites one filter at two line ranges — medium confidence

§2: *"`select.ts:1511–1518` filters `eligibleAll` through `focusHides` once."*
§6 code map: *"the actual filter, applied to `eligibleAll` at `:1515–1518`."*

Same file, same variable, same operation, two start lines. Both translated unchanged.

### 2.5 `01-the-board.md` cites `parseDMap` at two lines without saying they are two files — medium

§1 puts `parseDMap` at **`needs.ts:664`**. §4's diagram label reads **`parseDMap :459, dBoard :470`**
on an edge pointing into `scripts/check-board.ts`. The most likely reading is that `:459`/`:470`
are the *call sites* in `check-board.ts` and `:664` is the *definition* in `needs.ts` — but neither
the label nor the prose names the file for the bare `:459`, and a bare `:NNN` everywhere else in
this chapter means "the file just named". A reader will read it as a contradiction.

### 2.6 `02-the-document-and-lane-viewer.md` §3 — "the fifth of the five" is listed fourth — low

> *"The fix added **`post`** — the fifth of the five functions a lane window now hands over (`t`,
> `tFlat`, `api`, `post`, `navigate`, `lane.js:33`)."*

"The fifth" means "the one that made it five"; the enumeration immediately after shows `post` in
position four. In a paragraph whose entire subject is a docstring that counted its own members
wrong, that is an unfortunate place to leave an ordinal a reader has to reinterpret.

### 2.7 `02-the-document-and-lane-viewer.md` §3 — "the same ratio three times" — low

757/1,409 = 53.7%, 740/1,383 = 53.5%, 704/1,310 = 53.7%. The middle one is not the same ratio to
the precision the sentence implies. The chapter's point survives; the word "same" does not.

---

## 3. Screenshots — there are none to place, and that is the finding

**`docs/system/` carries no images and no screenshot placeholders in either edition, so this lane
placed none.** Measured, not assumed: `grep -c '!\['` returns 0 for all eight English chapters and
0 for `docs/capabilities/*.md`; the four `SCREENSHOT PLACEHOLDER` blocks in
`docs/capabilities/15-document-and-lane-viewer.md` are the only ones in the tree, and they are the
other lane's directory.

**I deliberately did not invent Hebrew-only placeholders**, and this is a conscious departure from
the dispatch instruction, stated here so it is cheap to overrule. Adding a placeholder to the
Hebrew where the English has none makes the mirror carry content the source does not — the exact
asymmetry the parity gate exists to prevent, and one it could not catch, because a blockquote is
not a heading. If `rulings/101` later adds an English shot to `02` or `03`, the Hebrew needs its
own at the same point and never the English image flipped.

**Two things `rulings/101` should have from this lane when that day comes:**

1. **The precedent for where a Hebrew image lives already exists and is not the English directory.**
   `docs/the-store.he.md` carries ten screenshots under `docs/the-store.he/NN-*.png` — a directory
   named after the Hebrew file. A Hebrew `docs/system/` shot belongs beside it in the same shape,
   not in a shared pool where a `he`/`en` pair would be told apart by a suffix.
2. **The two chapters that would need shots are `02` and `03`**, and both are RTL-sensitive in ways
   an English frame cannot stand in for: `02` is about a virtualised transcript whose fold markers,
   margin marks and find-panel counters place from the opposite edge, and `03` is about chips,
   contrast and a six-symbol icon sprite whose `open` glyph is directional.

---

## 4. Bidi: eleven defects, every one invisible in the source

**I did not trust the source. I rendered all eight files through the product's own `githubNodes` in
real Chromium and measured, per element, whether the first character sits to the LEFT of the last
character.** A run that the bidi algorithm reordered answers no. The harness served
`src/ui/public/` over a loopback port on an ephemeral port — **never 58888** — and was deleted
after the run; it is not committed.

**It found eleven runs that looked correct in the source and rendered backwards.** All eleven are
fixed. Final reading: **1,764 inline runs measured across the eight files, every one left-to-right,
none unmeasurable.**

### 4.1 The convention has a hole, and this directory's own filenames fall into it

`docs/README.he.md`'s header states the rule: wrap a code span *"whose first or last character is
not alphanumeric"*; *"a code span whose two edge characters are both alphanumeric needs nothing."*

**`` `01-the-board.md` `` has alphanumeric edges and renders backwards anyway.** In an RTL run the
leading `01` resolves as a European-number run, the following `-` sits between a number and a
letter so it takes the paragraph direction (RTL), and the two Latin runs it separates are reordered
around it. The rendered result is `the-board.md-01`.

Four of the eleven were exactly this — `01-`, `02-`, `03-` and `04-` prefixed chapter filenames in
`00-index.he.md`'s table. **The rule never hit this before because no Hebrew document in this tree
had a `NN-name.md` filename in prose**; `docs/README.he.md` only ever writes paths like
`docs/README.he.md`, which begin with a letter. This directory is nothing but `NN-` filenames.

**The rule, as it must now be stated: wrap any code span that begins with a digit and contains a
hyphen, even though both its edges are alphanumeric.** That belongs in `docs/README.he.md`'s
convention block, which is not this lane's file.

### 4.2 The other seven

| File | Run | Why it reordered |
|---|---|---|
| `02` §3 | `` `'owner'` `` | leading and trailing apostrophe |
| `03` §2 | `` `openIcon()` `` | trailing `()` |
| `03` §5 | ```` ```` ```mermaid ```` ```` | leading and trailing backtick-space |
| `04` §2 | `` `recordAudit()` `` | trailing `()` |
| `04` §2, §8 | `` `ledgerRows()` `` ×2 | trailing `()` |
| `06` §2 | `` `reject()` `` | trailing `()` |

All seven are the stated rule applied correctly — I had simply missed them, and only the render
caught it. A `foo()` call written inline in a Hebrew sentence is the single most common way to
break this.

### 4.3 One stray control character, removed

An early draft of `06-ingest.he.md`'s validation diagram carried a `U+200E LEFT-TO-RIGHT MARK`
before `.rejected.jsonl`. Removed. `docs/README.he.md`'s header records why LRM was abandoned
wholesale — *"it is invisible in a diff"* — and the whole file set was then swept for
`U+200E/200F/202A–202E/2066–2069/00A0/2011/FEFF`, which now returns nothing.

### 4.4 What could not be isolated, and what I did instead

**A Mermaid label has no `<span dir="ltr">` escape hatch.** `securityLevel: 'strict'` is what
`check:diagrams` and `gen-diagrams.ts` both initialise with, so a `dir` attribute inside a label is
not a thing to rely on. Every Hebrew Mermaid label that also carries an identifier therefore keeps
the identifier **on its own `<br/>` line**, which is exactly what `docs/the-store.he.md`'s four
diagrams do. No label mixes a Hebrew phrase and a bare identifier on one line.

**One glyph was changed rather than translated, and it is the only one.** `06-ingest.md` §2 writes
the round-trip as `createItem → write → parse → re-render`. In an RTL run a `→` between Hebrew
words takes the RTL direction and the sequence reads backwards, so the Hebrew uses `←`. That is a
directional adaptation of a punctuation mark, not a change to the claim; naming it here anyway,
because it is the one place a byte differs for a reason other than language.

---

## 5. Findings outside this lane's scope — reported, not touched

### 5.1 `docs/README.he.md` has ~48 runs that render right-to-left

The same harness, pointed at the precedent. **`docs/README.he.md`: 63 flagged runs**, of which
roughly fifteen are multi-line spans the harness cannot judge and the rest are real. A sample, each
of them a code span with a non-alphanumeric edge that the file's own stated rule says to wrap:

- **Every category-id prefix in the glossary** — `CONST-`, `INV-`, `TASK-`, `RULE-`, `DEC-`,
  `KNOWN-`, `REQ-`, `STD-`, `PAT-`, `ADR-`, and eighteen more. A trailing hyphen is a non-alnum
  edge; all of them render with the hyphen on the wrong side.
- `/clear` ×3 — leading slash.
- `[note]`, `[limit]`, `[kind]`, `[invariant]`, `[exception]`, `[]` ×2 — brackets, which mirror.

**`docs/the-store.he.md`: exactly one** — `` `src/rules/entries/` ``, trailing slash.

Neither file is this lane's. Both are worth a pass by whoever owns them, and the pass is cheap: the
harness is a fifty-line script and the fix is a wrapper per site.

### 5.2 `styles.css:1319–1320` — carried across, and now filed by somebody else

`03` §4 and §6 report a live defect in `src/ui/public/styles.css`: eight contrast figures that are
the *retired* colours' ratios wearing the *shipped* tokens' names, under a heading claiming they
were re-measured, concluding `"All clear AA"` for a palette whose worst hue is `--crit` at
**4.45:1**, which does not clear AA. The English chapter says it is *"filed nowhere else that this
pass could find"*.

**That sentence stopped being true during this session, and the Hebrew repeats it anyway.**
`.my_context/items/known_issue/KNOWN-the-stylesheet-asserts-aa-compliance-under-a-heading-saying.md`
is untracked in the working tree as this lane finishes — filed by another lane today, after the
English was verified. The Hebrew translates the English as it stands, which is the rule; but
whoever lands both halves should know the English chapter now carries a claim the corpus has
overtaken, and the fix belongs in `docs/system/03-…md` first and the mirror second. Neither edition
can fix the stylesheet itself.

One further known_issue appeared under `.my_context/items/known_issue/` during this session and is
not this lane's either:
`KNOWN-a-source-file-cites-an-item-id-that-does-not-resolve-and-no`, which is the
`src/ingest/schema.ts:340` finding `06` §5 describes. `06` §5 does not claim that one is unfiled,
so the Hebrew there needs nothing.

---

## 6. How this was verified

Every check below was run against the working tree after the last edit.

**`npm run check:diagrams` — green.** `59 fence(s) across 33 of 40 document(s) … 59 parse, 0 do not`.
The red proof fired first, as it does on every run, and correctly located the pre-repair chapter-7
fence at `…07-restore-and-handover.md:78`.

**`test/docs/system-parity.test.ts` — 6 tests, all green**, and **proved red before being believed.**
Three defects were injected deliberately and each reddened the assertion built for it:

| injected | caught by |
|---|---|
| one byte retyped in `05`'s pasted `--help` block | *every pasted command-output block is byte-identical* |
| one edge deleted from `01`'s `stateDiagram-v2` | *every diagram survives translation with its graph intact* |
| `## 8. מפת הקוד` demoted to `###` | *both editions carry the same section structure* |

Both files were restored from backups taken before the mutation and the suite re-run green.

**Pair-by-pair, independently of the test:** heading depth sequences identical for all 8 pairs
(69 headings each side); 12 Mermaid fences each side, every one matching in header line and line
count and in graph skeleton once labels are blanked; 6 pasted blocks byte-identical
(613, 2491, 561, 573, 175, 532 bytes); every fenced block closed; `<div dir="rtl">` balanced in
every file.

**Item ids:** multiset-identical per pair, occurrence counts included.

**Links:** 39 parsed with the product's own tokeniser, every target exists on disk.

**Rendered:** 1,764 inline runs measured in Chromium, all left-to-right (§4).

**`test/docs/*.test.ts` — 60 of 61 green.** The one failure is §7 and is not a defect in this work.

### The floors, and why they are lower than what a sweep prints today

`FENCE_FLOOR` 38 → **51**, `FILE_FLOOR` 21 → **28**, with the arithmetic written into the file:

```
38 / 21   the floors before this change
39 / 21   what the sweep actually read at HEAD, before the mirror
51 / 28   39 + 12 fences, 21 + 7 documents — this change's own guarantee
```

**A sweep run right now prints 59 across 33 documents.** The difference is the capabilities lane's
uncommitted Hebrew files, in the same working tree. Pinning a floor to a number that includes
another lane's unlanded work would record it as though it had shipped — which is the exact error
`docs/system/02-the-document-and-lane-viewer.md` §7 names about line counts, and the reason that
chapter deliberately kept a stale figure rather than a working-tree one. So the floor is HEAD plus
this lane's own twelve, and the comment says in as many words that **whoever commits both halves
should re-run `npm run check:diagrams` and raise it again to what it prints.** That is one command.

**Both lanes have `scripts/check-diagrams-parse.ts` in scope and both were told to raise the
floors. Expect a conflict in that constant and reconcile it by measuring, not by taking either
lane's number.**

---

## 7. One blocking edit this lane was not allowed to make

**`npm test` is red until two characters change, in two files this lane's write scope excludes.**

`test/docs/counts.test.ts`'s *"both documents state the real number of documentation test files"*
counts `test/docs/*.test.ts` and holds both READMEs to the result. This lane added the thirteenth
file, so the two READMEs' `12` is now stale — which is the gate doing exactly its job.

```
README.md:86          **12 test files under `test/docs/` hold these two documents to the program.**
docs/README.he.md:123 **12 קובצי בדיקה תחת <span dir="ltr">`test/docs/`</span> מחזיקים את שני …
```

**Both must become `13`.** One digit each. `README.md` is not in this lane's scope at all and
`docs/README.he.md` was named in the dispatch as explicitly not this lane's, so neither was touched.

If the capabilities lane also adds a file under `test/docs/`, the number is 14 and not 13 — take it
from the test's own failure message rather than from this report.

---

## 8. What no gate here can see

Stated plainly so a green suite is not read as more than it is, and repeated in the new test file's
own header and in every mirror's opening line.

**Nothing in this repository can tell whether the Hebrew says what the English says.** The parity
gate compares heading depths, diagram skeletons and pasted bytes. A paragraph whose Hebrew was left
behind by an English edit — same headings, same diagram, same block, stale sentence — passes every
assertion in this lane's work, and the last test in the new file *demonstrates* that against the
real documents by garbling `01-the-board.he.md`'s prose and showing the checks still pass.

**Translation freshness is a review obligation.** The English is the source of record; each mirror
says so on its own second line, and says that where the two disagree the English is right and the
Hebrew is stale.
