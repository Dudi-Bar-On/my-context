---
id: TASK-the-find-options-the-owner-asked-for-twice-in-a-floating
type: task
title: the find options the owner asked for twice, in a floating panel that gives the screen its room back
status: active
severity: soft
always: false
summary: Give the conversation search a proper options panel you can drag aside, with case, whole word and regular expressions.
summary_of: a3184859891c0169
scope:
  - src/ui/public/screens/conversations.js
  - src/ui/public/styles.css
  - src/ui/public/strings/**
  - src/core/conversation-search.ts
  - src/ui/read-model-conversation-document.ts
  - test/**
  - e2e/**
tags:
  - v2
  - recall
  - search
  - "plan:semantic"
  - "seq:9"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-16
valid_until: null
checksum: 0749ac42bc5f51ee
plan: semantic
seq: "9"
state: todo
priority: "1"
---

# the find options the owner asked for twice, in a floating panel that gives the screen its room back

THE OWNER ASKED FOR THIS TWICE AND DID NOT GET IT, AND THAT IS THE FIRST THING TO UNDERSTAND
BEFORE READING THE RESEARCH.

2026-09-16, first ask: "specifically look at the notepad++ and similar and find the best
feature reach search implementation". Second, after it did not arrive: "i asked you to look at
notepad++ search because they have a search dialog with various options that i wanted you to
implement in a similar way, there are many options there including lower case, upper case,
whole word, regex and much more, thats why i have asked you to search the internet for the best
open source implemented search including the ui component but you ignored and brought the first
simple implementation you found".

`reports/2026-09-16-the-search-grammar.md` §5 RECOMMENDED AGAINST EXACTLY THIS — "the failure
mode to avoid is a Find dialog with nine checkboxes nobody ticks... the right number of new
controls here is zero" — and the main session ENDORSED that and shipped it. **THE OWNER HAS
OVERRULED IT.** Read §5 and §6 for the measurements, which are good; do not read them as
permission to refuse a control he has now asked for twice. If a specific option cannot work
here, SAY SO WITH THE REASON — that is different from declining it on taste.

── THE SHAPE HE SPECIFIED, AND HE WAS PRECISE ───────────────────────

"three different subjects on three different dialogs opend from the right mouse button menu,
could be a little bit transparent, movable on screen, stays on screen while you can look at the
viewer and closed uppon clicking it’s close button as a standard window."

THIS ITEM BUILDS ONE OF THE THREE — SEARCH — and it is the TEMPLATE for the other two
(navigation, copy), which follow once he has judged this one. So the panel frame is a reusable
thing with one caller, not a bespoke box.

THE ELEMENT IS `<dialog>` AND THE METHOD IS `show()`, NOT `showModal()`. That is the whole
technical crux of "stays on screen while you can look at the viewer": a MODAL dialog blocks the
page behind it, which would make the viewer unusable while the panel is open. `show()` is
non-modal and leaves the document live.

AND THE CONSEQUENCE HAS TO BE HANDLED RATHER THAN DISCOVERED: **Escape only closes a dialog
automatically when it is MODAL.** With `show()` nothing closes on Escape unless you wire it. He
asked for a close button; ship both, because Escape is what a person expects.

Decided by the main session and his to overrule: several panels may be open at once; each
remembers where it was dragged (per-viewer, `localStorage`, and it must render correctly when
that read throws or returns nothing); clicking a panel brings it to the front.

This is the FIRST dialog in this product — measured: no `showModal`, no `<dialog>`, no dialog
styling anywhere under `src/ui/public/`. Nothing to be consistent with, and nothing to break.

── WHAT GOES IN IT ──────────────────────────────────────

The find field and its options. From his own list and Notepad++’s: CASE SENSITIVE, WHOLE WORD,
REGULAR EXPRESSION, and the count and next/previous that already exist. §1 of the grammar report
enumerates the rest of the tradition (extended escapes, backward search, mark all, search in
selection) — judge each on whether it WORKS here, not on whether a dialog should be small.

AND THE BAR MUST SHRINK AS THE PANEL FILLS. Measured on the live screen: the navigation strip
goes from 61px idle to **163px with a query**, three rows deep, and that is the crowding he is
complaining about. Moving these controls into the panel is supposed to GIVE THE SCREEN ITS ROOM
BACK — report the before and after height, and if the strip does not shrink, the change has not
landed.

── WHAT IS HARD HERE, SO IT IS NOT DISCOVERED LATE ───────────────────

  — THE FIND IS SERVER-SIDE. `findInDocument` scans every prose span (~160 ms) and the browser
    paints ranges; the options have to be implemented IN THAT SCAN, not in the page, or they
    will silently apply to the rendered rows only — the virtualised-DOM defect this project
    refuses. `reports/2026-09-16-folding-and-highlight.md` is the map.
  — REGEX CANNOT USE THE INDEX. FTS5 has no regex, so a regular expression is a SCAN. Measure
    what it costs on the real 133 MB session and say so on the screen if it is slow.
  — WHOLE WORD IS NOT MEANINGFUL EVERYWHERE. The index is trigram, deliberately: Hebrew glues
    particles to the front of words, which is why unicode61 was rejected at 51x worse. A "whole
    word" toggle that quietly does nothing in Hebrew is worse than one that says it cannot.
  — CASE AND FOLDING INTERACT. `src/ui/public/lib/fold.js` already NFKD-folds; case sensitivity
    is a second axis over it and the two must not be conflated.

Held by removal proofs, one per assertion, each reddening at its own line. Driven in Playwright
in BOTH languages before anything is reported — including dragging the panel, closing it, and
reopening it where it was left.
