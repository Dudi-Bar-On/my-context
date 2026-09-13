# `conversations.js`, mapped — and the item that sent me was about a different file

Read in depth 2026-09-13 at the owner's instruction, because six independent reviews all recorded
that **nobody had ever read it**. It grew the retrieval blocker, the unpaged anchor list, the
1.2-second keystroke and the dead confirmation slot.

**Measured: 7,326 lines** — larger than `read-model.ts` at 4,203, and the largest file in the repo.

## THE ITEM'S CLAIM IS TRUE, AND IT IS ABOUT A DIFFERENT FILE

`TASK-the-largest-file-in-the-repository-is-twenty-independent` (D76) says the largest file is
"twenty independent handlers". **Its scope is literally `src/ui/read-model.ts`** — and of *that* file
the claim holds exactly: about 20 server-side handlers with almost no shared state.

**It does not transfer.** `conversations.js` is client UI with the opposite shape: a handful of real
modules plus **one outsized closure**. Its problem is not repetition. It is **shared mutable state**.

## THE REAL SHAPE — seven units and one monolith

| unit | lines | owns |
|---|---|---|
| header / design record | 1-58 | the file's own rationale; read it first |
| shared vocabulary and format helpers | 59-310 | KINDS, titleNodes, durationText, READER_ZONE |
| **list** | 311-752 | drawRow, drawList |
| **list filter** | 753-926 | filterBar — debounced at 250 ms |
| **archive search + anchors** | 927-1889 | archiveBar, markRow, drawAnchors, anchorRow |
| **retrieval panel** | 1890-2554 | mountRetrieval — **mounted twice**, at 1829 and 6795 |
| **scroll arithmetic** | 2557-2783 | estimateHeight, matchesNode, Scroller — pure, exported, already tested |
| **turn / step rendering** | 2784-4211 | drawTurn, drawDeed, drawWork, href builders — pure, params in, DOM out |
| **secrets fold** | 4212-4430 | mountSecrets, fillSecrets, secretRow |
| **mountDocument** | **4431-6803** | **2,370 lines.** Head, copy bar, scroll well, paint/refill/measure loop, a third anchor-write implementation, the clipboard machinery, the live-follow poller |
| roster | 6805-7123 | structurally a sibling of list, separate route |
| entry point | 7124-7326 | render() — the actual router |

## WHAT CROSSES THE SEAMS

**Safe.** KINDS, ANCHOR_KIND_GLYPH, READER_ZONE and every href builder are read-only with a single
source of truth. Scroller, estimateHeight and matchesNode are **already exported and independently
tested** — the easiest possible split.

**Clean boundaries.** mountRetrieval and mountSecrets are mounted *into* mountDocument's DOM but
share only a passed host and seed. **No closure leakage. Movable today.**

**The one crossing that blocks a split, and it is a third of the file.** Every helper inside
mountDocument — paint, refill, redraw, applyFilter, onCopy, onSelect, markControl, landOn,
nodeAtByte, sayArrived, atTail, the follow poller — reads and writes the same dozen variables: view,
scroller, known, bodies, live, waiting, held, marked, anchorsHere, stickUntil, seenBytes, seenMtime,
unseen. **None can be lifted out without threading all of that through parameters.** Here "a split is
not safe" is literally true.

**And a duplication that crosses screens rather than sharing a function: anchor create, relabel and
drop is implemented THREE TIMES** — markRow (1154-1242) for a search hit, anchorRow (1526-1618) for
the archive list, and markControl (5160-5297) inside the document. Each hand-builds its own input,
save and live region and calls the same three endpoints independently. **That is the strongest drift
risk in the file**, and it is the shape the file's own comments warn against elsewhere.

## THE KNOWN DEFECTS, CHECKED AGAINST CURRENT CODE

1. **The two dead retrieval modes — FIXED.** Line 1861 now reads "all four ship by owner ruling",
   state.modes is filled from the server, and the e2e asserts four modes are offered.
2. **684 anchors unpaged — CONFIRMED.** drawAnchors loops with no slice, limit or virtualization,
   **unlike the document's own Scroller two hundred lines away**. anchorRow builds 17-19 elements
   each: 684 x 18 is about **12,000 nodes**. The comment at line 952 records the 684 measurement and
   **argues only for a glyph — pagination was never considered.**
3. **The 1,200 ms keystroke — CONFIRMED, and it is ONE input of five.** The document's find box is
   wired straight to applyFilter at 5629 with **no debounce**, while every other find box in the file
   settles at 250 ms. Each keystroke scans every outline node, rebuilds the whole Scroller, then
   **tears down and repaints every live row synchronously**. **A mechanical fix, not a structural
   one** — the settle pattern already exists twice in this file.
4. **The dead aria-live region — NOT REPRODUCIBLE.** All 17 live regions were traced to a write path.
   It appears to have been fixed in the same pass as the retrieval modes, **and the item was never
   updated** — the same comment-outliving-the-code failure this project calls worse than no comment,
   showing up in an item instead of in code. Worth one browser check, since static tracing can miss
   an await ordering.
5. **Focus dropping to body — CONFIRMED AND SYSTEMIC.** At least **eight** sites disable the
   just-clicked button synchronously before await. Disabling the focused element moves focus to body;
   **none restore it** except two refusal branches. Not one line — a pattern.

## THE SPLIT, AND ITS HONEST COST

**Legitimate, but only outside mountDocument, in this order:**

1. **The pure infra** — Scroller, estimateHeight, matchesNode. Already tested in isolation, zero
   coupling. Move, keep exports, re-run one test file.
2. **Turn and step rendering** (2784-4211). Takes parameters, returns DOM, shares nothing.
3. **List, list-filter, archive+anchors, secrets, roster, retrieval** as separate files. Each is
   called from one or two sites with a narrow parameter list. **No straggler closure reference was
   found**, but a scan is the precondition before each move.
4. **mountDocument — DO NOT SPLIT YET.** First fix the two live bugs in place — debounce the document
   find box, and page or virtualize drawAnchors — **and unify the three anchor-write implementations
   into one function taking a config object.** That removes the largest duplication without moving a
   single closure boundary. Only then consider extracting the shared state.

**Cost, stated plainly:** steps 1-3 are mechanical file moves, low risk, about a day with test runs.
Step 4's prerequisite fixes are each small and worth doing **whether or not anything is ever split**.
The mountDocument decomposition itself is **a redesign of how fifteen pieces of mutable state are
shared, not a file move**, and must be scoped separately — never bundled with 1-3.

## AND ONE THING WORTH PROTECTING

**The file's own commentary is unusually honest and load-bearing.** It documents why each shape was
chosen, cites owner rulings and measured numbers, and argues against alternatives that were tried and
rejected. A split loses no institutional memory **as long as the comments move with their code** —
which is a constraint on how any split is done, not a footnote.
