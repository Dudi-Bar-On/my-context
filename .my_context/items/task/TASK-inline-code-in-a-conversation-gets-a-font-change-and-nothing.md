---
id: TASK-inline-code-in-a-conversation-gets-a-font-change-and-nothing
type: task
title: inline code in a conversation gets a font change and nothing else, while the app own literals get a box
status: active
severity: soft
always: false
summary: A path or command written inside a sentence stands out from the words around it, the way it does in the terminal, instead of looking like ordinary prose.
summary_of: 7d5af94e03d0af13
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
checksum: f674d5b7d56b5b84
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

OWNER RULING 2026-09-08, clarifying that the path was only an example: "i gave you tha path as an
example of coloring but what i realy mean is exactly 3 Full syntax colouring in fenced blocks too.
everything that is colourd should apear similar in the viewer".

SO OPTION 3 IS RULED IN. And measuring it on his own session changes what option 3 should DO,
which is worth having before anybody vendors anything.

MEASURED, this session, assistant text blocks only:

    assistant text blocks              2,060
    blocks containing a fence            170   (8.3%)
    fenced blocks total                  370   32,617 chars
    INLINE CODE SPANS                 10,047   averaging 4.9 per block
    fences with NO language tag          345 of 370   (93.2%)
    fences WITH a tag                     25   js 11, bash 6, json 3, yaml 2, ts 1, diff 1, sql 1

TWO FACTS IN THAT TABLE DECIDE THE DESIGN.

FIRST, THE INLINE SPAN IS THE CASE, BY TWO ORDERS OF MAGNITUDE. 10,047 spans against 370 fences.
The thing he pointed at is also the thing that occurs most, and it needs no highlighter at all -
only the treatment `.tvsaid .m` already has. That half should land first and on its own, because it
is where essentially all of the visible difference is.

SECOND, 93.2% OF FENCES DO NOT SAY WHAT LANGUAGE THEY ARE. A syntax highlighter needs a language.
For 345 of 370 blocks it would have to GUESS - and a wrong guess is worse than no colour, because
it paints tokens as though they carried meaning. Highlighting shell as JavaScript makes a reader
trust a lie about what they are looking at. This project has an explicit preference for the
imperfect line over the silent one, but a MISLEADING line is neither.

SO THE RECOMMENDATION, and it serves the ruling honestly rather than literally:
  1. INLINE SPANS get the existing `.m` treatment. 10,047 occurrences, no new vocabulary.
  2. FENCES THAT DECLARE A LANGUAGE get coloured. 25 blocks today, and the number only grows as
     more code is written into conversations.
  3. FENCES THAT DECLARE NOTHING STAY AS THEY ARE - already boxed by `.tvsaid pre`, monospace,
     scrollable. NO AUTO-DETECTION. This is the part to argue about if he disagrees, and the
     argument against detection is the 93.2%, not the effort.

AND THE VENDOR QUESTION ANSWERS ITSELF AT THAT SIZE. `CONST-zero-runtime-dependencies` means a
highlighter arrives as a vendored file with a SHA pin, a VENDOR.md entry and an upgrade ritual. The
ANSI lane refused ~9-14 KB of vendoring to serve 0.004% of records and hand-wrote ~70 lines
instead; `lib/ansi.js` is the precedent sitting in this very directory. Six languages account for
every tagged fence in the corpus, and js/ts, bash and json account for 21 of 25. A small tokeniser
for those, in the shape `ansi.js` already established, is the proportionate answer - and it can be
read, tested and pinned without an upgrade ritual for a dependency nobody else needs.

MEASURE BEFORE VENDORING ANYTHING, and say the number: if a hand-written tokeniser for three
languages exceeds what a pinned vendor would cost, vendor it and say so. The rule is proportion,
not a prohibition.

"EVERYTHING THAT IS COLOURED" IS WIDER THAN MARKDOWN, and that is worth separating rather than
silently scoping away. His terminal also colours things that are not markdown at all: the tool-call
markers, tool names, diff plus and minus lines, exit codes. Some of that the viewer already draws
in its own vocabulary - `.exitcode` and `.exitcode.bad` exist, and `plan:archive seq:9`’s five
meaning hues mark a prompt and an answer. What is NOT covered is a DIFF, which the terminal colours
per line and the viewer renders as plain fenced text - and `diff` is a tagged language in the table
above, so item 2 above catches it. Anything still uncovered after that should be filed as its own
item rather than absorbed here.

THE RTL CONSTRAINT DOES NOT RELAX FOR ANY OF THIS. `code` and `pre` carry
`direction:ltr;unicode-bidi:isolate` and there is a separate `[dir="rtl"]` rule besides. Colour
spans added INSIDE a highlighted block must not break that isolation - a token wrapper is a new
inline element inside an LTR island on an RTL page, which is exactly the shape that produced a
leading dot at the wrong end once already. Measure in both languages.
