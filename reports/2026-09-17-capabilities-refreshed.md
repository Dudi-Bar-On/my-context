# `docs/capabilities/` refreshed — what shipped after 2026-09-13 is now in it

`TASK-the-capabilities-reference-froze-on-2026-09-13-and-nothing` (`rulings/97`)
`TASK-the-three-floating-panels-are-the-newest-thing-in-the-viewer` (`rulings/100`)

Run as **one lane deliberately**, because they are one writing job: the three floating panels *are*
the thing that landed since the 13th, so `/100` is the largest part of `/97` rather than a separate
item.

**This was additive writing, not repair.** Four repair passes over these chapters closed at
`e515eff4`; `reports/2026-09-17-capabilities-repaired-again.md` was read first, and nothing it
repaired was re-audited or undone. What follows is what was **missing**.

No `git` command that writes was run. The tree is left dirty. Port 58888 was never bound, no
browser was driven, no subagent was dispatched, and nothing outside `docs/capabilities/**` and this
report was written — see §6 for the four things that belong elsewhere and were named rather than
touched.

---

## 1. The answer, in one paragraph

**Everything on the brief's starting map was verified against the code and written in, and one item
on that map turned out to be false when checked.** The panels, the four query modes, the
regular-expression reference, the new right-click menu, the card that gave up its controls, the
`⤢` expansion, the position counter, the mid-turn mark refresh, `check:diagrams` and the existence
of `docs/system/` are all now in the reference. **Three claims that were on the page or in the
brief were disproved by reading the code and are corrected rather than repeated** (§3), the
sharpest being a source comment asserting a browser test proves six keyboard shortcuts when it
presses three. **One structural defect was found and fixed**: chapter 13 carried 27 duplicated
lines and a bullet truncated mid-sentence, left by an earlier pass (§4).

`npm run check:diagrams` 39/39, `check:text-files`, `check:retired` and `check:cited-items` green,
and the 112 documentation tests pass under the rendering pin — before and after.

---

## 2. The checked-vs-carried ledger

Every block this pass wrote, and what it rests on. **checked** = I read the code that block is
about before writing it. **carried** = taken from a lane's report or from text already on the page,
without re-deriving it, and labelled as such *in the document too*.

| what I wrote | rests on |
|---|---|
| `15` chapter header — the 2026-09-17 supersession note | **checked** — `conversations.js:6170-6200` (the strip-removal comment), and `grep` for `el('div', 'tvbar'` / `'tvnav'` returning nothing |
| `15.1`'s new opening — the find box is in the panel and nowhere else | **checked** — `conversations.js:10402-10455`, the body built once at mount |
| `15.2`'s radio-group paragraph | **checked** — `MODES` (`fold.js:731`), `modeRow` built as `MODES.map(...)` (`conversations.js:9995-10000`), `conv.find.modes` / `conv.find.options` read out of `strings/en.js:691-692` |
| `15.2`'s "never touches SQLite" paragraph, including the `offsets()` refusal and 463-vs-1,024 | **checked** — `fold.js`'s own header block above `MODES`, read in full |
| `15.3` — 22 worked examples, 3/5/5/9 per mode | **checked** — counted out of `EXAMPLES` programmatically, not read off a comment. (A code comment nearby says "fifteen worked examples already shipped", which was true before `semantic/14` added five; the document states today's count and its date) |
| `15.3` — the reference is 34 rows in 6 sections | **checked** — counted out of `REGEX_REF` programmatically. **A code comment says "33 keys per table"; the count today is 34 rows.** The document states the counted number |
| `15.3` — drawn only in `regex` mode, built once at mount, left column is a literal | **checked** — `conversations.js:10217-10320` |
| `15.3` — the last section's five "true here and nowhere else" rows and the `(X+)+` row | **checked** — `REGEX_REF`'s `conv.find.refHere` block |
| `15.3` — per-example hit counts on the live session, "the smallest of the five is 41 turns" | **carried** — from `reports/2026-09-17-the-find-panel-counts-and-reference.md`, and labelled carried on the page |
| `15.4` — the three panels, their names, and what is in each | **checked** — `conversations.js:10415`, `:10534`, `:10677` and the three `body.replaceChildren(...)` calls read line by line |
| `15.4` — the frame table (`show()`, Escape, `fixed`, pointer capture, one write per drag, the guarded store, the clamp, bring-to-front, the height bound) | **checked** — `lib/panel.js` read end to end |
| `15.4`'s clamp row | **checked, and narrowed against the source's own prose.** `panel.js`'s header says "`KEEP_VISIBLE_PX` of it is always reachable at both ends"; `clampPlace` uses it for `maxTop` only, while `maxStart` keeps the panel fully inside the viewport horizontally. The document states what the code does |
| `15.4` — nothing is borrowed any more; `borrow()`/`tidyStrip()`/three `onClose` paths gone | **checked** — the `semantic/15` comment at `:10415-10432` *and* the absence of those symbols in the file |
| `15.4` — the caret rules, the 47 tab stops, the two driven subtleties | **checked** — `panel.js`'s `close()` and each panel's `fallbackFocus`; the item id verified against `.my_context/items/` |
| `15.4` — the Copy panel cannot open over a live selection | **checked** — the `semantic/13` block at `:10597-10640` |
| `15.4` — `panel.js` is 429 lines, three callers | **checked** — `wc -l`, and `grep -rn createPanel` returning three call sites |
| `15.4`'s boundary diagram | **checked** — every node restates something read above; `npm run check:diagrams` run after adding it |
| `15.5` — the menu's order, the real `<hr role="separator">` drawn only when acts follow, the four possible act rows, the seven removed rows | **checked** — `openMenu` (`conversations.js:10878-10975`) read in full |
| `15.5` — **the keyboard-coverage correction** | **checked** — see §3.1. Counted `keyboard.press` in `e2e/conversations-panels.spec.ts` |
| `15.6` — `.tvbar` / `.tvnav` no longer created, and their CSS rules still present | **checked** — `grep` for the element construction (none) and for the rules in `styles.css` (present at `:4532`, `:4560`) |
| `15.6`'s pixel table — 298.9 → 67.5, 559.1 → 650.9, 65.1%, 833.9 × 1248 | **carried** from `reports/2026-09-17-the-card-gives-up-its-controls.md`, labelled carried on the page, and named in `15.8` as not re-derivable inside this pass's bounds |
| `15.6` — the count line drawn only when something is hidden, and `findPanel.isOpen()` not consulted | **checked** — `drawDisclosure` (`conversations.js:9192-9260`) read in full, including its final `count.hidden = …` |
| `15.6` — the disclosure/plain-total split | **checked** — the ruling block above `drawDisclosure` plus `navPanel.body.replaceChildren(...)` |
| `15.6` — `⤢`, `doc-wide`, no Escape, mode not remembered, panels survive | **checked** — `conversations.js:5987-6018` and `render()`'s `classList.remove('doc-wide')` at `:12507` |
| `15.8`'s new bullets (turn-walk not occurrence-walk, no wrap, no idle position) | **checked** — `step()` (`:8767-8772` for the no-wrap branch), `drawPlace` (`:9299-9340`) |
| `05` — the mid-turn refresh table and both thresholds | **checked** — `src/core/turn-refresh-soon.ts` header and constants, `src/hooks/turn-refresh-worker.ts` in full, `refreshSoon` in `post-tool-use.ts` |
| `05` — **the batching withdrawal** | **checked** — see §3.2 |
| `05` — the `P1` diagram node | **checked**; `check:diagrams` re-run immediately after |
| `13` — eleven `check:*` scripts | **checked** — enumerated out of `package.json` |
| `13` — the two new gate rows and their ubuntu-only placement | **checked** — `ci.yml:145`, `:212-214`, `release.yml:84`, `:119-121`, and `.githooks/pre-commit` read for absence |
| `13`'s `check:diagrams` section and its pasted output | **checked** — command run, stdout+stderr redirected to a file, that file's bytes pasted; the one cut marked |
| `13` — the `;`-in-a-sequenceDiagram failure the gate caught | **carried** from `reports/2026-09-17-capabilities-repaired-again.md` §9 |
| `00` — the `docs/system/` section | **checked** — `ls docs/system/` (8 files) and `docs/system/00-index.md` read for the framing sentence quoted |
| `00` — the updated chapter 13 and 15 rows, the reading path, the additive-pass paragraph | **checked** — each against the chapter it describes |
| `00`'s footer measurement — 17 files, 8,915 lines, 639,654 bytes | **checked** — `wc -l` / `wc -c` re-run after the last edit |
| `04`, `08`, `14`'s wording changes | **checked** — each replaced phrase read in place first; all are "find bar"/"find panel" singulars that the three-panel shape falsified |

**Nothing here was composed to sound plausible.** Where the true value was not knowable inside this
pass's bounds — the pixel measurements, the per-example hit counts — the document says so in those
words rather than restating a number as if this pass had taken it.

---

## 3. Three things the brief or the page asserted that the code disproves

### 3.1 · The browser suite proves three of the eight keys, not six — and the source says six

`screens/conversations.js` states it twice, once in the strip-removal block and once in `openMenu`:

> `e2e/conversations-panels.spec.ts` proves each of the six named keys with EVERY PANEL SHUT rather
> than trusting this sentence.

Counted 2026-09-17. The test named *"every key still acts with all three panels shut, and with them
open"* runs lines 985–1042 and presses `n`, `n`, `k`, `u` — **three distinct keys**. Across the
entire 1,042-line file the only presses are `n` ×7, `u` ×2, `k` ×1 and `Shift+N` ×1 — **four
distinct keys**, and `Shift+N` is in a different test. **`/`, `M`, `Shift+U` and `Shift+K` are
pressed nowhere in that file at all.**

The *architectural* claim is still sound and is written as such: those keys never went through a
menu row or a strip, so deleting either could not remove them. But it is an argument, and the
sentence that said a suite demonstrated it for six keys was the kind of claim this campaign exists
to catch. §15.5 now states the counted fact, §15.8 carries it as a gap, and both name the source
comment as wrong. **I very nearly wrote "proves six" straight through** — it was in the brief's
starting map, it was in the code, and it read as already-verified. One `grep -o "keyboard.press"`
disproved it.

### 3.2 · The anchor writer does not batch, and chapter 5 said it did

Chapter 5 carried, as a measured fact:

> marks are **flushed to `.anchors.jsonl` in batches**, and a mark stamped when a table appeared was
> measured sitting unflushed in the writer for up to **5m 37s** before the store moved at all

`src/core/turn-refresh-soon.ts`'s header addresses exactly that report and refuses it: *"A lane
reported that the anchor writer BATCHES … **It does not, and that report was wrong.**"* An anchor
row's `at` is the timestamp of the turn it points at, copied out of the index, and six consecutive
marks were checked against the transcript and **all six matched their record's own timestamp to the
millisecond**. The 5m 37s was the **turn**: 85 records were written between the marked record at
08:48:26.710 and the store write at 08:54:03.826.

The claim is withdrawn in the chapter, in those words, and replaced with the real defect — that
`stopConversationRefresh` was wired only into `Stop` — and with the fix that landed on 2026-09-16.
**This is a claim whose correction the code had been carrying for a day and which no verification
pass had reached, because every pass was checking the accuracy of sentences already on the page and
this sentence was consistent with itself.**

### 3.3 · Two counts in code comments are behind their own data

Neither is on a document page, so neither is repaired here — but both would have become false
document claims if carried:

- A comment above `REGEX_REF` says *"this is 33 keys per table and not 66"*. Counted today:
  **34 rows** in 6 sections (40 string keys including the section headings). The document states 34
  and dates it.
- A comment above the regular-expression examples says *"FIFTEEN WORKED EXAMPLES ALREADY SHIPPED"*.
  That was the count before `semantic/14` added five; today `EXAMPLES` holds **22**. The comment is
  narrating history, so it is not wrong in context — but the number is not today's, and the document
  states today's.

---

## 4. One structural defect found and fixed: 27 duplicated lines in chapter 13

`docs/capabilities/13-testing-discipline.md` ended like this:

```
…What's NOT built bullets…
## See also
…ten See-also lines…
 | wc -l`, 2026-09-17) is not described here**, though      ← a bullet beginning mid-sentence
…the What's NOT built bullets, again…
## See also
…the same ten See-also lines, again…
```

Twenty-seven lines — a second `## See also`, a duplicate of the last four "What's NOT built"
bullets, and one bullet whose opening had been eaten (an older revision read
`` `ls test/rules/* | wc -l` `` where the current one reads `test/rules/* (18 files as of
2026-09-17)`). Left by an earlier pass's splice. **Removed**, with the surviving copy — the current
one — kept. The file now has exactly one `## See also` and ends on the tenth of its bullets.

This was fixed rather than filed because it is damage, not a claim: no reading of the code was
needed to know a chapter should not end twice.

---

## 5. Where each screenshot placeholder sits, and what it must show

**No screenshot was taken and no browser was driven.** `rulings/101` owns them and runs after this
pass. Four placeholders are marked in `docs/capabilities/15-document-and-lane-viewer.md`, each as a
blockquote beginning **SCREENSHOT PLACEHOLDER — `rulings/101` owns this.**

| § | where it sits | what it must show |
|---|---|---|
| **15.3**, end | after the regular-expression reference | The Search panel with `regex` selected **and the reference fold open**, English: the find box with its Clear button, the count line and the `1 of 15` position line under it, all four mode radios with Regular expression selected, both option boxes, and the table scrolled far enough to show the final section heading and the `(X+)+` row. **One image that carries §15.2 and §15.3 together.** |
| **15.4**, after the frame table | after "One constraint on the Copy panel" | **All three panels open at once** over a live document, English — the cascade offset, three titles, three close buttons, and enough transcript visible behind and between them to show the viewer is still live. **This is the only possible evidence for the non-modal claim; no single panel can carry it.** |
| **15.4**, same block | immediately after the one above | **The step panel mid-walk**, English, position line reading something of the form `You are on 3 of the 40 turns that hold it.` with the standing turn emphasised behind it. Must be taken **after at least two presses of Next**, so the counter is demonstrably not at 1. |
| **15.5**, end | after the menu's key discussion | **The right-click menu open over a marked turn**, English — three opener rows with the `/` chip on the first, the horizontal separator, and the act rows below it. A second frame over an **unmarked** turn (showing *Mark this point* instead) would demonstrate the "only what this row can do" rule; that second frame is offered as `rulings/101`'s call, not required. |
| **15.6**, end | after the `⤢` block | **The card before and after**, as a pair at 1280×1000: one frame in the ordinary shell **with no search typed — which must show no count line at all** — and one with `⤢` pressed. The "no count line" frame is the only image that can demonstrate the drawn-only-when-hiding rule. |

That is five images across four placeholder blocks (the §15.4 block carries two, and §15.6's is a
pair).

**English only, deliberately** — the Hebrew edition re-shoots rather than reuses, which is why
diagrams are required to be Mermaid text and screenshots were not required at all until now.

---

## 6. What belongs elsewhere and was deliberately left alone

Each of these is outside `docs/capabilities/**`. **Named, not touched.**

1. **`README.md` and `docs/README.he.md` — nothing needs to change, and that is a finding rather
   than an omission.** Both were checked for the three false singulars this pass repaired
   elsewhere ("the find bar", "the floating find panel", "two panels not built"); neither README
   describes the viewer's controls at all. No README edit is owed by this pass.
2. **`src/ui/public/screens/conversations.js` — two comments assert a browser suite proves six
   keyboard shortcuts.** It presses three with every panel shut. §3.1. The honest repair is either
   to correct the comment or to widen `e2e/conversations-panels.spec.ts` to press `/`, `M`,
   `Shift+U` and `Shift+K`; **widening the test is the better one**, because the comment is right
   about what *ought* to be true.
3. **`src/ui/public/styles.css` still carries `.tvbar` (`:4532`) and `.tvnav` (`:4560`) rules that
   style nothing.** The elements are gone. Dead CSS is harmless but reads as evidence the strips
   still exist. Named in `15.8` as well, so a reader of the chapter is not misled by a `grep`.
4. **`src/ui/public/strings/en.js` and `he.js` carry two keys nothing references any more** —
   `conv.find.moved` (*"The find box and the match stepper are in the search panel while it is
   open."*, false since the box stopped being lent) and `conv.menu.kinds` (*"Step only through —"*,
   the three deleted radio rows). Verified unreferenced across `src/`, `e2e/` and `test/`. Both
   must be removed **from both tables in one act**, or the parity ledger will redden.
5. **`docs/system/02-the-document-and-lane-viewer.md` should gain the reciprocal pointer.**
   Chapter 15 now says, in its own §15.4 and its See-also, that `docs/system/02` carries the panel
   frame's mechanism and that chapter 15 does not repeat it. `docs/system/02` already says the
   converse about the board chapter but not about this one. A lane was live in that directory while
   this ran, so it was not edited — **this is one sentence in its See-also, not a rewrite.**

---

## 7. What was run

- **`npm run check:diagrams` after every diagram edit** — three times. `38 → 38` before, `39 → 39`
  after the one fence this pass added (§15.4's panel/menu boundary). It proves its own red path on
  every run before reporting any number.
- **`node --import ./test/helpers/pin-rendering.ts --test test/docs/*.test.ts`** — **112 of 112
  pass**, twice: once as a baseline before any edit and once at the end. A bare `node --test` was
  not used at any point.
- **`check:text-files`** (1,453 files, no NUL byte), **`check:retired`** (104 retired phrases across
  7 documents, 0 still present), **`check:cited-items`** — all green.
- **One captured paste.** `npm run check:diagrams` was run with stdout and stderr redirected to a
  file and that file's bytes pasted into chapter 13. Not one character was retyped; the single cut
  (mermaid's four-line parse-error text) is marked with the project's standard marker, and the
  marker also declares that the two npm banner lines were replaced by the `$` command line the rest
  of the chapter uses.
- **Two programmatic counts** rather than readings: the worked examples per mode, and the reference
  table's rows and sections — both extracted from the source text by a script, because both are the
  kind of number a comment beside them had already got wrong.

**Side effects:** none. No corpus file was written, no git state changed, no server was bound, no
browser was driven, no subagent was dispatched. The only files this pass wrote are the seven under
`docs/capabilities/` and this report. The `docs/system/*` changes visible in `git diff` are another
lane's.

---

## 8. And this pass needs verifying too

It wrote roughly 130 new sentences. Every one of them was written after reading the code it is
about, except the rows marked **carried** in §2 — the pixel measurements, the per-example hit
counts, and one anecdote about a gate catching a `;`.

**That is not evidence the error rate is zero.** §3.1 is the datum that argues it is lower: a claim
that was in the brief, in the code, and consistent with everything around it took one `grep -o` to
disprove. Three passes running have measured that repairing N claims produces roughly N/2 new ones;
an *additive* pass has no such measurement yet, and this is the first one, so the honest statement
is that nobody knows this pass's rate.

**The one thing that would make the next pass cheaper** is not another verification round. It is
that every count in these chapters is now either dated, derived by a command printed beside it, or
explicitly labelled as carried from a named report — so a reader who doubts a number has a route to
re-take it rather than a second document to compare it against.
