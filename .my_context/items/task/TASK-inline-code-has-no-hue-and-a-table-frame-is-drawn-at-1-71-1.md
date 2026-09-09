---
id: TASK-inline-code-has-no-hue-and-a-table-frame-is-drawn-at-1-71-1
type: task
title: "inline code has no hue and a table frame is drawn at 1.71:1, so almost nothing reads as coloured"
status: active
severity: soft
always: false
summary: The words and tables in a saved conversation are as easy to pick out as they are in the terminal, instead of a frame you cannot see and code that is only a different typeface.
summary_of: 48e38911afe7ed73
scope:
  - src/ui/public/styles.css
  - src/ui/public/lib/markdown.js
tags:
  - v2
  - archive
  - ui
  - "plan:archive"
  - "seq:38"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-09
valid_until: null
checksum: 0b6f8f0db10ffc1a
plan: archive
seq: "38"
state: done
priority: "1"
needs: archive/26
---

# inline code has no hue and a table frame is drawn at 1.71:1, so almost nothing reads as coloured

OWNER VERDICT 2026-09-09 on plan:archive seq:26, which was provisional by his own words. He looked
and it failed: "about color, currentlly many missing almost none so it is not good enough", then
"the tables frames are also almost not seen to dark, in general refactor it and make it at least as
the terminal TUI does, many words are highlited by color (think it is lite purple or blue), code has
different colors".

SO seq:26 IS NOT THE ANSWER AND MY RECOMMENDATION IS THE REASON, which is worth stating plainly
rather than filing this as a follow-on. I recommended the box for inline code and argued AGAINST a
tint, and the lane agreed after looking at three dense turns. Both of us were wrong, and one
measurement shows why.

── THE MEASUREMENT THAT SETTLES IT ──────────────────────────────────────────────────────────

Contrast against the transcript ground `--paper #0f0f12`:

    --edge     #3a3a45   1.71:1   table borders AND the inline-code box
    --edge-3   #6e6e7e   3.82:1   the blockquote rule
    --faint    #7d7a90   4.61:1
    --dim      #a9a6b8   8.05:1
    --ink      #f0eef6  16.64:1

WCAG asks 3.0:1 of a non-text boundary a reader must SEE. `--edge` is 1.71:1 - barely over half of
it. So the table frame he cannot see is not a matter of taste, and THE BOX I RECOMMENDED FOR INLINE
CODE IS DRAWN IN THE SAME 1.71:1 BORDER. It was never going to read as emphasis. I argued a hue was
unnecessary because the box already separated the span; the box does not separate anything at
1.71:1.

AND THE VOLUMES ARE WHY "ALMOST NONE" IS THE RIGHT WORDS. Measured on his session: 10,249 inline
code spans against 25 fenced blocks that declare a language. seq:26 coloured the 25 and left the
10,249 with a box. Colouring the untagged fences as well would reach at most 19 more blocks - it
cannot move "almost none" and is not what this item is about.

── WHAT TO BUILD ────────────────────────────────────────────────────────────────────────────

MATCH THE TERMINAL, WHICH IS THE STANDARD HE NAMED. He describes identifiers highlighted in a light
purple or blue and code carrying several colours. That is a markdown renderer with a palette, and
the viewer already has the palette - `.tvterm` declares sixteen terminal colours and seq:26 already
proved nine of them can be re-declared, scoped, without a new hue entering the product.

  1. INLINE CODE TAKES A HUE. 10,249 spans; this is the item. His own reading is "lite purple or
     blue", which in the existing scoped set is the keyword violet `#c678dd` or the function blue
     `#61afef`. MEASURE BOTH against `--paper` and pick on contrast, then show him.
  2. THE TABLE FRAME BECOMES VISIBLE. `--edge-3` at 3.82:1 already exists and already clears 3.0,
     so this may be one token swap inside `.tvsaid` rather than a new colour. CHECK the same border
     everywhere it is used in the transcript before swapping it globally - `.tvsaid pre`, the
     inline box and `.tvsaid th/td` all take `--edge` today and they are not the same job.
  3. SWEEP THE REST OF `.tvsaid` AGAINST THE TERMINAL. Headings, bold, emphasis, links, list
     markers, the horizontal rule, the blockquote. Say for each what the terminal does and what the
     viewer does, and change only what differs. `.tvsaid b` is currently `--ink` at 600 weight -
     the same colour as the prose around it, so bold is weight-only where a terminal brightens it.

── WHAT MUST NOT MOVE ───────────────────────────────────────────────────────────────────────

THE PALETTE DISCIPLINE IS THE WHOLE SAFETY ARGUMENT and it is stated in the file: the five budgeted
meaning hues are the only hues that carry MEANING, and the terminal palette lives on `.tvterm`
rather than `:root` so the foreign vocabulary cannot leak onto a screen. seq:26 respected this by
declaring its nine in ONE block scoped to `.tvsaid pre[data-lang]`. Whatever this item adds must be
scoped the same way and must not reach a chip or a meaning hue. A hue on inline code is a WIDER
scope than a hue inside a fence, so say explicitly where the boundary now sits.

THE PRINT REGISTER flattens colour to `#000` and the ground to `#fff`. Every hue added here must
flatten too, and a border raised for the dark ground must still be visible on white - the print
block sets `--paper:#fff`, so a 3.82:1 border against `#0f0f12` is a DIFFERENT ratio against white.
Measure both registers, which seq:26 did for its nine.

RTL: no token may set `direction` or `unicode-bidi`. seq:26 measured that a span left at `normal` is
transparent to the bidi algorithm and that isolating one makes it its own run - the shape that once
put a leading dot at the wrong end. Inline code already inherits `isolate` from the global rule;
adding colour must not change that.

── AND SHOW HIM BEFORE COMMITTING ───────────────────────────────────────────────────────────

He has now judged this surface twice and overturned a recommendation once. So screenshot a real
dense turn of his own - not a fixture - in both languages, and put the picture in the report before
anything is committed. The traps that make a screenshot lie here are recorded: `fullPage` resizes
the viewport and re-renders, a session opens at its end with `stickUntil` live so an early
screenshot is a byte-identical tail image, and `scrollIntoViewIfNeeded` detaches the row it is
scrolling to. Drive the well by `scrollTop`, park the row by its own `offsetTop`, screenshot the
element.
