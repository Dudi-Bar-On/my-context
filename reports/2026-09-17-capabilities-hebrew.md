# The Hebrew edition of `docs/capabilities/` — what landed, and what it cost to check

`rulings/109`, `TASK-the-hebrew-edition-of-the-two-document-sets-was-the-owner-s`, the
`docs/capabilities/**` half. The `docs/system/**` half was a second lane and is covered in
`reports/2026-09-17-system-hebrew.md`; where the two lanes had to agree, §6 says what was
reconciled and what was left divergent on purpose.

**All seventeen chapters landed.** The tree is left dirty and uncommitted. No git command that
writes was run.

---

## 1. What landed

| Path | Lines | What it is |
|---|---|---|
| `docs/capabilities/00-index.he.md` | 392 | mirror of `00-index.md` |
| `docs/capabilities/01-items-and-corpus.he.md` | 641 | mirror |
| `docs/capabilities/02-injection.he.md` | 683 | mirror |
| `docs/capabilities/03-creation-and-gates.he.md` | 716 | mirror |
| `docs/capabilities/04-conversation-archive.he.md` | 596 | mirror |
| `docs/capabilities/05-anchors.he.md` | 725 | mirror |
| `docs/capabilities/06-retrieval.he.md` | 654 | mirror |
| `docs/capabilities/07-restore-and-handover.he.md` | 584 | mirror |
| `docs/capabilities/08-web-ui.he.md` | 551 | mirror |
| `docs/capabilities/09-cli-and-mcp.he.md` | 971 | mirror |
| `docs/capabilities/10-rule-store.he.md` | 983 | mirror |
| `docs/capabilities/11-self-improvement-loop.he.md` | 668 | mirror |
| `docs/capabilities/12-packs-export-import-procedures.he.md` | 489 | mirror |
| `docs/capabilities/13-testing-discipline.he.md` | 741 | mirror |
| `docs/capabilities/14-search-over-the-archive.he.md` | 361 | mirror |
| `docs/capabilities/15-document-and-lane-viewer.he.md` | 828 | mirror |
| `docs/capabilities/16-the-board.he.md` | 425 | mirror |
| `test/docs/parity.test.ts` | 164 → **499** | the parity gate, extended to these seventeen pairs |
| `scripts/check-diagrams-parse.ts` | — | `FENCE_FLOOR` 51 → **68**, `FILE_FLOOR` 28 → **40** |

**11,008 lines / 946,536 bytes of Hebrew against 8,942 lines / 642,425 bytes of English.** The
prose wraps at the same column; the difference is `<span dir="ltr">` markup the English does not
need and four lines per `<div dir="rtl">` block.

**Nothing in these seventeen files was re-measured and nothing was re-audited.** Every count,
ratio, byte figure, line citation and dated reading is carried across from the English as it
stands after `5e67204a`. Each file's header comment says so in its own words. The English is the
source of record; where the two disagree the English is right and the Hebrew is stale.

### What was translated, and what deliberately was not

- **Prose, headings, tables, and every Mermaid LABEL** — translated.
- **Mermaid graph structure** — byte-for-byte the English one: same node ids, same edge operators,
  same `linkStyle` lines, same line count per fence, same HTML entities inside labels (chapter 3's
  `&lt;id&gt;` is carried as written).
- **Pasted command output — not translated, not retyped, not re-abridged.** 113 non-diagram fenced
  blocks per side, every one byte-identical, now asserted on every test run (§4). Their cut markers
  are the English chapter's own markers, character for character — including chapter 13's
  `[… 4 further lines are not shown …]`, chapter 16's `[… the last 9 non-blank lines …]`, and
  chapter 9's five `[… N further line(s) …]` blocks.
- **Item ids** — identical, never transliterated. Verified as a **multiset**: for all seventeen
  pairs the occurrence count of every `RULE-|DEC-|TASK-|…` id is the same on both sides. 93 distinct
  ids across the set.
- **Two verbatim English quotations kept in English**, because the English sentence introducing
  each says a verbatim quotation is evidence here: the owner's own words on secrets in chapter 4
  (*"when user requesting export it should be askd…"*, misspellings intact) and every owner ruling
  the English marks as quoted verbatim in chapters 5, 7, 11, 12 and 15.
- **Links** — a sibling capability chapter points at its own `.he.md`, because that mirror is
  written in the same change and is certain to exist; `docs/system/NN-*.he.md` likewise, because
  the other half of this campaign landed first. **221 relative links parsed and every target
  checked to exist on disk; 5 of them carry an anchor and all 5 resolve** against the Hebrew
  heading they name.

### Terminology

Taken from `docs/the-store.he.md` and `docs/README.he.md` — the two precedents the dispatch named
— in that order of authority, not invented:

| English | Hebrew | Source |
|---|---|---|
| the rule store · a constant · an entry | מאגר הכללים · קבוע · רשומה | `docs/the-store.he.md` |
| door · tier · item · spill · stand down | דלת · דרג · פריט · דחיקה · הורדה מכוננות | `docs/the-store.he.md` |
| known-red · prove by removal · the ration | אדום ידוע · הוכחה בהסרה · המנה | `docs/the-store.he.md` |
| fact / prohibition / procedure / standard / definition | עובדה / איסור / נוהל / תקן / הגדרה | `docs/the-store.he.md` |
| preventive / detective check | בדיקה מונעת / מגלה | `docs/the-store.he.md` |
| corpus · index · injection · pinned | קורפוס · אינדקס · הזרקה · נעוץ | `docs/README.he.md` |

---

## 2. English sentences I believe are wrong — translated as they stand

**None of these were fixed, softened, clarified or resolved.** Each is rendered into Hebrew with
its defect intact, because a translation that improves a claim has made an unverified claim.
Ordered by confidence.

### 2.1 Chapter 15 says "four placeholders" and carries five — high confidence

§15.8 reads *"No screenshot in this chapter exists yet. **Four placeholders** are marked in
§15.3–§15.6."* There are **five** `SCREENSHOT PLACEHOLDER` blockquotes in the file: one in §15.3,
**two** in §15.4 (all-three-panels-open, and the step panel mid-walk), one in §15.5, one in §15.6.
"Four" is true of the *sections* and false of the *blocks*, and the sentence says placeholders.
The dispatch brief for this lane also reads "five English placeholders across four blocks", which
is the same count split the other way round. The Hebrew says four, as the English does, and
carries five Hebrew placeholders, as the English carries five English ones.

### 2.2 Chapter 15's own source-comment correction is itself under-counted — medium-high

§15.5 and §15.8 both state that a source comment in `screens/conversations.js` claims the spec
proves *"each of the six named keys"* while the suite presses three. `DOC_SHORTCUTS` is described
two paragraphs earlier as **eight** entries, and the four named as untested (`/`, `M`, `Shift+U`,
`Shift+K`) plus the three pressed plus `Shift+N` accounts for all eight. So the chapter is
correcting a comment about "six" without ever saying which six of the eight that comment meant. A
reader cannot reconstruct the claim being corrected. Translated unchanged.

### 2.3 Chapter 10's line-count arithmetic does not close — medium

§"The measured facts" gives `store.ts` 155, `deliver.ts` 785, `delivered.ts` 430 and calls the sum
**1,370**. 155 + 785 + 430 = **1,370**. That one is right. It then adds `manifest.ts` 493 and
`schema.ts` 432 for a "running total" of **2,295**; 1,370 + 493 + 432 = **2,295**, also right. It
then adds `integrity.ts` 243 for **2,538**; 2,295 + 243 = **2,538**, right again. The arithmetic
closes — what does not is the claim that this is "the directory": five files plus `integrity.ts`
is six, and §"The schema" and §"Delivery vs. assertion" between them name `entries/` and
`manifest.json` as living there too. The chapter says "the directory is 2,538 lines in total" of a
`.ts` subset it never declares as a subset. Translated as it stands.

### 2.4 Chapter 1 gives `task` two different totals eight lines apart — medium

The dated category table reads `task … 940`. The prose under "Categories by group" reads *"even
though this corpus alone holds 866 task items"*, and §"Rationale" repeats *"by a wide margin the
largest category"*. 866 is a 2026-09-12-era figure quoted inside a sentence with no date on it,
directly beneath a table dated 2026-09-17 that says 940. The chapter's own rule — stated in that
table's own note — is that the table is the only place carrying a non-zero count. The 866 survives
that rule. Both numbers translated as they stand.

### 2.5 Chapter 11 dates the same config read two different ways — low-medium

The opening says the three dials were *"confirmed directly against `.my_context/config.json` on
**2026-09-16**"*. The config block six paragraphs later is introduced as *"read **2026-09-17** and
quoted whole"*. Both may be true — two reads a day apart — but the chapter presents the second as
the evidence for the first. Translated unchanged.

### 2.6 Chapter 13 quotes a 1,330-file run as current in one bullet and a 1,452-file run in the
prose — low

§"The `check:*` gates" pastes `1452 text file(s) scanned` dated 2026-09-17 and explains that the
figure moved from 1,330. §"What's NOT built" then says *"`check-text-files.ts` exits 0 as of
2026-09-13 over 1,330 files"* with no note that a newer reading is in the same chapter. Not wrong,
but the bullet reads as the current state. Translated unchanged.

**One thing I checked and did NOT find wrong**, because it looks like a defect and is not:
chapter 14 §14.2's pasted capture prints two identical `near` rows. The paragraph immediately above
it says so and refuses to deduplicate them. That is a correct paste of a real duplicate, and the
Hebrew carries both rows.

---

## 3. Screenshots — five Hebrew placeholders, at the five English points

`rulings/101` owns them and runs after this pass. **No English image is reused, and none could be.**

| § | Hebrew placeholder | What only a Hebrew frame can show |
|---|---|---|
| 15.3 | Search panel, `regex` radio selected, reference fold open | panel content flows right-to-left; the close button moves to the LEFT edge; the reference table's left column must still read LTR **inside** an RTL table; the `1 of 15` Latin numerals inside a Hebrew line |
| 15.4 | all three panels open at once | the cascade steps from the **RIGHT** edge, not the left — `CASCADE_STEP` is logical pixels and the physical delta is reflected at the RTL boundary |
| 15.4 | the step panel mid-walk, after two Nexts | doubles as the number-in-a-Hebrew-run check: `3` then `40` must read in that order on screen |
| 15.5 | right-click menu over a marked turn | the menu unfurls **leftward** from the click point; the `/` key chip is a Latin token inside a Hebrew row |
| 15.6 | the card before and after `⤢`, as a pair at 1280×1000 | `⤢` sits at the **left** of the card head; the rail that disappears is the **right** rail; the "no count line" frame is still the only image that can demonstrate the drawn-only-when-hiding rule |

Each Hebrew placeholder says its shot must be **in Hebrew** and names the RTL-specific property it
exists to capture. The English placeholders are untouched.

**The precedent for where a Hebrew image lives already exists**, and the system lane found it:
`docs/the-store.he.md` keeps its ten shots under `docs/the-store.he/NN-*.png`, a directory named
after the Hebrew file. A Hebrew capabilities shot belongs in that shape, not in a shared pool where
an `he`/`en` pair is told apart by a suffix.

---

## 4. The gate — extended, and proved red

**`test/docs/parity.test.ts` gained the seventeen pairs, and six new assertions.** It was extended
rather than given a new file for one measured reason: `counts.test.ts` counts `test/docs/*.test.ts`
and holds **both** READMEs to the result. That count is 13 and both READMEs already say 13. A
fourteenth file would have made both of them wrong in the same commit that added a gate.

The pairing is **derived** by walking the directory, never listed, so an eighteenth chapter with no
mirror fails on its own.

| assertion | what it refuses |
|---|---|
| every chapter has a mirror, and every mirror a chapter | a chapter added or renamed in one language only |
| same section structure, all 17 pairs | a section added or removed in one language only |
| no mirror ends inside an unclosed fence | a hidden tail that would make the two below vacuous |
| every diagram survives with its graph intact | a fence lost, a diagram type changed, a line added or removed |
| every pasted block byte-identical | a retyped, translated, re-abridged or tidied command output |
| every cited item id identical | a transliterated id — still a plausible token, resolving to nothing |
| a drawing shared with the README in English is shared in Hebrew | one drawing translated twice, which is two drawings |

**All ten tests in the file pass. Six were proved RED before being believed** — each mutation
applied to a real file, the assertion built for it reddened, the file restored byte-for-byte:

| injected | caught by |
|---|---|
| `## 16.7` demoted to `###` in `16-the-board.he.md` | *same section structure* |
| `940` → `941` inside chapter 9's pasted `status` table | *every pasted block is byte-identical* |
| one edge deleted from chapter 5's `flowchart TD` | *every diagram survives with its graph intact* |
| `INV-nothing-is-dropped-silently` transliterated in chapter 13 | *every cited item id is identical* |
| chapter 0's shared fence label changed by two words | *a drawing shared with the README …* |
| `12-packs-…he.md` renamed away | *every chapter has a Hebrew mirror* |

`git status` shows no `M` against any English chapter afterwards.

**Two anti-vacuity floors in the new block were set by guess and corrected by measurement**, which
is worth recording rather than quietly fixing: I first wrote *"at least 17 mirrors carry a fenced
block"* and *"at least 100 distinct ids"*. The true readings are **16 of 17** (`08-web-ui.md`
carries no fenced block at all, and neither does its mirror — correct and faithful, and exactly
parallel to `docs/system/00-index.md` in the other lane's file) and **93 distinct ids**. Both are
now floors below a stated measurement, not pins.

**`npm test` over the whole of `test/docs/`: 125 tests, 125 pass, 0 fail.**

### The floors, and the arithmetic

`FENCE_FLOOR` 51 → **68**, `FILE_FLOOR` 28 → **40**, written into the file:

```
38 / 21   the floors before either mirror
39 / 21   what the sweep read at HEAD, before either mirror
51 / 28   39 + 12 fences, 21 + 7 documents — the system half alone
68 / 40   51 + 17 fences, 28 + 12 documents — BOTH halves
```

**68 / 40 is what `npm run check:diagrams` actually prints now**, not an estimate: `68 fence(s)
across 40 of 52 document(s) … 68 parse, 0 do not`. The system lane deliberately pinned 51/28 —
HEAD plus its own files — because this half was then unlanded, and its comment closed by naming
the one command that resolves it. That command was run. Neither half is unlanded any more, so the
reason to stay low is gone.

**The raised floors were proved red**, through the gate's own pure `verdict()`: at 67 fences it
answers `EMPTY SWEEP: 67 fence(s) found, below the floor of 68`, and at 39 documents likewise.

**This constant is the one place both lanes wrote.** If a third reading disagrees with 68/40,
re-run the command and take its number — not this report's.

---

## 5. Bidi: the convention has a hole, and this directory is made of it

`KNOWN-the-hebrew-convention-says-an-identifier-with-alphanumeric` was filed **during** this lane's
work and arrived in its context mid-pass. It is the single most useful thing that happened to this
translation, and it changed how it was checked.

**The rule as `docs/README.he.md` states it is incomplete.** `` `01-the-board.md` `` has
alphanumeric edges — `0` and `d` — so by the written rule it needs no wrapper. **It renders as
`the-board.md-01`**: the hyphen after a leading digit run takes the paragraph direction and carries
the numeric prefix to the far end. This directory is nothing but `NN-name.md` filenames.

**The amended rule, as every file in this half now follows it:** wrap any code span that begins
with a digit and contains a hyphen, even though both its edges are alphanumeric. That sentence
belongs in `docs/README.he.md`'s convention block, which is not this lane's file.

### What was measured, and how

**I did not trust the source.** All seventeen mirrors were rendered through the product's own
`githubNodes` in real Chromium and measured, per inline run, whether the first character sits to
the LEFT of the last. The harness served `src/ui/public` on an **ephemeral loopback port — never
58888** — and was deleted after the run; it is not committed.

**The harness was proved able to fail before its zero was believed.** A control document carrying
an unwrapped `` `01-the-board.md` `` and an unwrapped `` `openIcon()` `` inside a Hebrew sentence is
pushed through first: it flags **2** backwards runs. The same sentence with both wrapped flags
**0**. Without that control the number below would mean nothing.

**Final reading: 10,453 inline runs measured across the seventeen files — 0 render right-to-left,
0 unmeasurable.**

Three defects were found and fixed by checking rather than by reading:

- Two **U+200E LEFT-TO-RIGHT MARKs** I had introduced myself (chapter 0's `Node ≥ 24`, chapter 14's
  `+13 ms`) — replaced with spans. `docs/README.he.md`'s header records why LRM was abandoned
  wholesale: *"it is invisible in a diff."* Both were. The whole set was then swept for
  `U+200E/200F/202A–202E/2066–2069/00A0/2011/FEFF` and returns nothing.
- Five code spans with a non-alphanumeric edge that the stated rule already covers and I had simply
  missed: `` `.my_context/config.json` ``, `` `src/hooks/` ``, `` `src/core/retrieval/` ``,
  `` `.githooks/pre-commit` ``, and chapter 15's `` `\d+` ``/`` `\d+ ms` ``. A `foo()` or a trailing
  slash written inline in a Hebrew sentence is the commonest way to break this, exactly as the
  other lane found.

### A Mermaid label has no escape hatch, and the same discipline applies

`securityLevel: 'strict'` is what both `check:diagrams` and `gen-diagrams.ts` initialise with, so a
`dir` attribute inside a label is not a thing to rely on. **Every Hebrew label carrying an
identifier keeps that identifier on its own `<br/>` line**, which is what `docs/the-store.he.md`'s
four diagrams already do. No label mixes a Hebrew phrase and a bare identifier on one line.

### Numbers inside a Hebrew run

This half is dense with them — chapter 15's 34-row regular-expression reference, chapter 9's five
box-drawing tables, chapter 16's three. Two structural decisions kept them safe, and the render
confirms both: **every box-drawing table and every pasted block sits OUTSIDE the `<div dir="rtl">`**
(inside one the bidi algorithm reverses the runs), and **chapter 0's self-size figure is inside a
Hebrew run and reproduces exactly** — `17 קבצים, 8,937 שורות, 641,963 בתים (642.0 kB עשרוני /
626.9 KiB)`, carried across unchanged and measured LTR in the render.

---

## 6. Where the two halves of this campaign agree, and one place they do not

The `docs/system/` lane finished first and its report is
`reports/2026-09-17-system-hebrew.md`. Read together:

- **The shared fences.** Five English fences are byte-identical across `README.md`, three
  capability chapters and `docs/system/07-focus.md`. Both lanes solved this the same way
  independently: mirror `docs/README.he.md`'s own Hebrew fence byte-for-byte rather than translate
  the English one a second time. My half's five are asserted byte-identical to it by the new test;
  the pairing is derived, so a sixth shared drawing is covered the day it appears. **The English
  fences were not touched by either lane.**
- **The floors.** Reconciled by measurement, §4. Expect the constant to be the one merge conflict.
- **A term the two halves translate differently, reported and NOT unilaterally changed:** *lane*.
  The system lane used **סוכן עזר**, from `src/ui/public/strings/he.js`'s `conv.lane` and ~20
  neighbours. This half used **נתיב**, which is what `docs/the-store.he.md` uses in its own
  `def-a-lane` row — *"«נתיב» הוא סוכן־משנה אחד עם חלון הקשר משלו ותדריך משלו"* — the document the
  owner read and called well written, and the precedent this lane's dispatch named first. Both are
  defensible and both cite a real source; the tree is now split across the two Hebrew editions.
  **A translation is not the place to settle a term the tree is split on. Somebody should pick
  one**, and whoever does should know the split runs `strings/he.js` (product UI) against
  `docs/the-store.he.md` (documentation), not one lane against the other.

**The system lane's §7 blocking edit is already applied.** Both `README.md:86` and
`docs/README.he.md:123` read **13** test files under `test/docs/`, and there are 13. Because this
half added **no** new file — it extended `parity.test.ts` — that number stays right, and nothing
further is owed on it.

---

## 7. How this was verified

Every check below was run against the working tree after the last edit.

**Heading parity, pair by pair, independently of the test:** 17 of 17 identical depth sequences,
**234 headings each side**.

**`test/docs/parity.test.ts` — 10 tests, all green**, six of them proved red first (§4).

**The whole of `test/docs/` — 125 tests, 125 pass, 0 fail**, run with the suite's own preload
(`node --import ./test/helpers/pin-rendering.ts`), never bare.

**`npm run check:diagrams` — green.** `68 fence(s) across 40 of 52 document(s) … 68 parse, 0 do
not`. The red proof fired first, as on every run, and located the pre-repair chapter-7 fence at
`…07-restore-and-handover.md:78`.

**Structure, checked independently of any test:** 17 mermaid fences each side, every one matching in
info string, opening line and line count; **113 pasted blocks each side, all byte-identical**;
item-id multisets identical per pair; `<div dir="rtl">` balanced in every file; no unclosed fence.

**Links:** 221 relative links, every target on disk; 5 anchors, all resolving.

**Rendered:** 10,453 inline runs measured in Chromium, all left-to-right, with a planted control
proving the harness can fail (§5).

**`git status`:** no English chapter modified. Seventeen new untracked mirrors, plus
`test/docs/parity.test.ts` and `scripts/check-diagrams-parse.ts`, which are this lane's two
in-scope edits.

---

## 8. What no gate here can see

Stated plainly so a green suite is not read as more than it is, and repeated in every mirror's own
header.

**Nothing in this repository can tell whether the Hebrew says what the English says.** The gate
compares heading depths, diagram skeletons, pasted bytes and item ids. A paragraph whose Hebrew was
left behind by an English edit — same headings, same diagram, same block, same ids, stale sentence
— passes every assertion added by this lane, and `parity.test.ts`'s own last test demonstrates that
blindness against the real documents rather than asserting it.

**Translation freshness is a review obligation, not a tested one.**

**And one thing a render can see that no committed gate does.** The bidi measurement in §5 found
three real defects in files a careful writer had just produced, and it is not committed — the same
position the system lane left it in. Between the two halves that is **eleven plus three defects
invisible in source**, found only by rendering. Whether that belongs beside `check:diagrams` — it
needs the same browser and would run on the same sweep — is the owner's call, not a lane's. It
should be costed and put to him.

### Outside this lane's scope, reported not touched

- **`docs/README.he.md` carries ~48 runs that render right-to-left**, per the system lane's own
  measurement of the precedent — every category-id prefix in its glossary (`CONST-`, `INV-`,
  `TASK-`…), `/clear`, `[note]`. A glossary of ids where the ids render backwards is a glossary
  nobody can copy from. Not this lane's file, and the fix is a wrapper per site.
- **The convention block in `docs/README.he.md` still states the incomplete rule** (§5). One
  sentence, and it is wrong today for every chapter filename in both new editions.
