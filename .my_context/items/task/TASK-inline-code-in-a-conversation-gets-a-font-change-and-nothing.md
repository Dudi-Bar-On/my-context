---
id: TASK-inline-code-in-a-conversation-gets-a-font-change-and-nothing
type: task
title: inline code in a conversation gets a font change and nothing else, while the app own literals get a box
status: active
severity: soft
always: false
summary: A path or command written inside a sentence stands out from the words around it, the way it does in the terminal, instead of looking like ordinary prose.
summary_of: 239eb662fc816c81
scope:
  - src/ui/public/styles.css
  - src/ui/public/lib/markdown.js
tags:
  - v2
  - archive
  - ui
  - "plan:archive"
  - "seq:26"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-08
valid_until: null
checksum: f4aaf6fe7f80d109
plan: archive
seq: "26"
state: todo
priority: "2"
needs: archive/8
---

# inline code in a conversation gets a font change and nothing else, while the app own literals get a box

Owner observation 2026-09-08, pointing at `e2e/playwright.config.ts` as it appeared in his own
terminal: "this is an example of colored text on the terminal, could you do the same in the
session browser ?"

WHAT IT IS: inline code. A path or an identifier written in backticks, which his terminal draws
with its own styling and colour. In the viewer it is markdown inline code, and the vendored
renderer does emit it - `src/ui/public/lib/markdown.js` makes a `code` element, with NO class.

AND THE GAP IS SHARPER THAN "IT HAS NO COLOUR". This product already has a treatment for exactly
this idea and inline code does not get it:

    .tvsaid .m   background: var(--paper); border: 1px solid var(--edge);
                 border-radius: var(--r-sm); padding-inline: 4px

    <code>       only the GLOBAL rule at `.m,code,kbd,pre{...}` - monospace,
                 .87em, tabular numerals, direction:ltr, unicode-bidi:isolate

`.m` is the string table’s own `{m:...}` span - the app’s way of saying "this is a literal" - and
it gets a box. Markdown `<code>` is the SAME IDEA arriving by a different route, and it gets a font
change and nothing else. So a path the app writes looks like a literal and a path the assistant
wrote in backticks looks like prose. TWO SPELLINGS OF ONE IDEA, ONE OF THEM STYLED.

THE CHEAP HALF IS THEREFORE NOT A NEW DESIGN, IT IS APPLYING AN EXISTING ONE: give `.tvsaid code`
the treatment `.tvsaid .m` already has. That alone answers what he actually noticed - inline code
standing out from the prose around it - and it introduces no new vocabulary at all.

THE COLOUR HALF IS A RULING AND IT IS HIS, for the same reason the chip glyphs were. This file’s
own safety argument is explicit: "The five budgeted meaning hues are still the only hues that carry
MEANING here", and the sixteen-colour terminal palette is declared on `.tvterm` rather than
`:root` precisely so "the foreign vocabulary cannot leak onto a screen" - the discipline
`lib/vendor/VENDOR.md` records for Web Awesome. A hue on inline code would be a SIXTH hue in a
five-hue budget, or a leak of the terminal palette out of `.tvterm`. Neither is a lane’s to take.

SO PUT THREE THINGS TO HIM RATHER THAN PICKING ONE:
  1. THE BOX ONLY - `.m`’s existing background and border. No new hue, no leak, consistent with
     every other literal in the product. RECOMMENDED as the default.
  2. THE BOX PLUS A TINT drawn from the `.tvterm` palette, scoped so it stays inside `.tvsaid` and
     cannot reach a chip or a meaning hue. Closest to what his terminal actually shows, and it
     costs a decision about whether a sixth non-meaning tint exists.
  3. FULL SYNTAX COLOURING inside fenced blocks as well as spans. This is a different and much
     larger thing - it needs a highlighter, and `CONST-zero-runtime-dependencies` means vendoring
     one with a SHA pin and an upgrade ritual. The ANSI lane already refused a ~9-14 KB vendor to
     serve 0.004% of records; the bar here is whether prose code blocks are common enough to earn
     it. MEASURE that before offering it as real.

ONE THING THAT MUST NOT BREAK, and it is already load-bearing: the global rule sets
`direction:ltr;unicode-bidi:isolate` on `code`, and there is a separate `[dir="rtl"] code` rule
besides. A path is not prose, and this project has found a leading dot at the wrong end under RTL
after every assertion passed. Whatever is added must be measured in BOTH languages -
`e2e/conversations.spec.ts` is the pattern.

AND FENCED BLOCKS ARE ALREADY BOXED, which is worth saying so nobody "fixes" them too: `.tvsaid
pre` already carries the paper background, the edge border and its own `overflow-x:auto`. This item
is about the INLINE span, which is the thing he pointed at.

ONE MEASUREMENT TO TAKE FIRST: how much inline code is actually in the corpus of said-text. If a
typical assistant turn carries dozens of spans, a box on each could read as noise rather than
emphasis - which would be an argument for the tint over the box, and is exactly the sort of thing
that looks obvious in a mock-up and wrong on a real transcript. Render a real turn of his before
choosing.
