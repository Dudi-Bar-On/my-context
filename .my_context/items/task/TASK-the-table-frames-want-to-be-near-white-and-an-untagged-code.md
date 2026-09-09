---
id: TASK-the-table-frames-want-to-be-near-white-and-an-untagged-code
type: task
title: the table frames want to be near-white, and an untagged code block wants a colour that is not a syntax claim
status: active
severity: soft
always: false
summary: Table lines are bright enough to see at a glance, and a code block that never said what language it is still looks like code rather than prose.
summary_of: 26f0c1aa51663aae
scope:
  - src/ui/public/styles.css
  - src/ui/public/lib/markdown.js
tags:
  - v2
  - archive
  - ui
  - "plan:archive"
  - "seq:45"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-09
valid_until: null
checksum: b3cec6e738610812
plan: archive
seq: "45"
state: done
priority: "1"
needs: archive/38
---

# the table frames want to be near-white, and an untagged code block wants a colour that is not a syntax claim

OWNER VERDICT 2026-09-09 on plan:archive seq:38, after seeing the screenshots of his own transcript:
"in general it looks better, what requires some changes is the tables frames i want them brighter
than the current color not white but near it and what i did not see in the screenshots is examples
of code colored differently - best wuold be as intelisene by syntax but if not at least different
bright than white like green or yello kind of as it is on the TUI".

THE HUE IS ACCEPTED. seq:38’s violet on inline code stands; this item is the two changes he asked
for on top of it.

── ONE: THE FRAMES GO BRIGHTER, AND HE NAMED THE TARGET ─────────────────────────────────────

seq:38 moved them from `--edge` to `--edge-3`. Measured on the transcript ground `--sink #101014`:

    --edge     #3a3a45    1.69:1   before seq:38
    --edge-3   #6e6e7e    3.79:1   now
    --faint    #7d7a90    4.57:1
    --dim      #a9a6b8    7.99:1
    near-white #c9c6d4   11.31:1
    --ink      #f0eef6   16.51:1   the prose itself

"Brighter, not white but near it" points at the 11:1 end. TAKE THE MEASUREMENT SERIOUSLY IN BOTH
DIRECTIONS THOUGH, because there is a real hazard at that brightness and it should be shown to him
rather than argued: A FRAME AT 11.31:1 IS COMPETING WITH BODY TEXT AT 16.51:1. On a table of 1,950
body rows across 300 tables, a near-white grid becomes the loudest thing on the screen and the
reader’s eye goes to the lines rather than the contents. `--dim` at 7.99 is twice as bright as
today and still recedes.

SO BUILD IT AT HIS NUMBER AND SHOW HIM BOTH. A screenshot at `--dim` and one at near-white, on a
real table turn from his own transcript, and let him pick from the picture. He has judged this
surface three times now and been right each time; do not argue him out of it with arithmetic.

── TWO: HE HAS NEVER SEEN THE SYNTAX COLOURING, BECAUSE HIS FENCES DO NOT DECLARE A LANGUAGE ─

This is not a missing feature. `e2e/screens/code-fences-en.png` shows it working exactly as he
describes wanting - keywords violet, functions blue, strings green, literals orange, comments grey,
types yellow. It was sent to him on 2026-09-09.

THE REASON HE HAS NOT SEEN IT IS THE MEASUREMENT ALREADY IN seq:26 AND seq:38: of 192 fenced blocks
in his transcript, 25 DECLARE A LANGUAGE. The other 167 get nothing, because seq:26 was ruled - by
him - not to guess, on the finding that at most 19 of the untagged ones are code at all and the
rest are command output, aligned ledgers, timelines and counts tables. Colouring those by syntax
would paint a column of numbers as though it were source.

AND HIS NEW REQUEST IS THE MIDDLE PATH THAT MEASUREMENT LEAVES OPEN, which is why it is a good
ruling rather than a repeat: "at least different bright than white like green or yello kind of as
it is on the TUI". A UNIFORM TINT ON UNTAGGED FENCE TEXT IS NOT SYNTAX COLOURING AND CANNOT LIE
ABOUT A TOKEN, because it makes no claim about any token - it says only "this block is not prose",
which is true of all 167 and is exactly what a terminal does with preformatted text.

WHAT TO BUILD: untagged fence text takes ONE colour from the scope seq:38 already established -
not nine, not a parse. The terminal palette already declares a green and a yellow on `.tvterm`,
byte-identical values are already reused for the tagged hues, so nothing new enters the product.

THREE THINGS TO GET RIGHT:
  - IT MUST NOT READ AS TAGGED. A tagged fence is labelled AND coloured, and seq:26 made that
    pairing deliberate so "coloured" and "declared" are one visible set. A uniform tint must be
    distinguishable from a syntax palette - one flat colour against several is the distinction, and
    the label is still the discriminator.
  - MEASURE IT ON A LEDGER, NOT ON CODE. The honest test of this change is one of his counts tables
    or a progress-bar block, because those are what most untagged fences are. If a green ledger
    reads as code, the tint is wrong.
  - THE PRINT REGISTER flattens every hue to black, and both changes must flatten with it.

AND THE ~19 REAL UNTAGGED CODE BLOCKS ARE STILL NOT COLOURED BY SYNTAX, deliberately. If he wants
those too, the answer remains what seq:38’s lane found: write a language tag when authoring, which
is my habit to change and not the product’s.

── BUILT 2026-09-09, AND WHAT IS STILL THE OWNER'S TO PICK ──────────────────────────────────

BOTH CHANGES ARE IN, CSS ONLY. No renderer changed: `lib/markdown.js` and `lib/highlight.js` are
untouched, so the "no auto-detection" ruling of seq:26 is not merely respected, it is not reachable
from here.

  1. THE FRAME. `.tvsaid th,td` takes `--tvframe` #c9c6d4 at 11.31:1 on `--sink` - HIS number, and
     only the TABLE frames. `.tvsaid pre`, `.tvsaid hr` and `.tvterm` stay at `--edge-3` 3.79:1,
     because he named the tables and nothing else.
  2. THE TINT. `.tvsaid pre:not([data-lang])` takes `--tvfence` #98c379 at 9.42:1 - ONE flat colour,
     the terminal's own green, already declared on `.tva-fg` and `--tvh-string`, so nothing new
     entered the product. Green beat yellow #e5c07b on separation, not on contrast: the yellow sits
     ΔE76 38.4 from `--gold`, which is a BUDGETED MEANING HUE spent inside this very element for
     links, where the green's nearest meaning hue is `--ok` at 35.3 and `--ok` is not spent inside
     `.tvsaid` at all. The green is also dimmer, which matters for 167 blocks that must recede.

BOTH ARE PROPERTIES ON `.tvsaid`, exactly as `--tvcode` is, and BOTH FLATTEN TO #000 in the print
register on one line with it. That is not tidiness: `--tvframe` is a literal and so is NOT reached
by the print `:root`'s flattening of `--edge`/`--edge-3`, and it measures 1.68:1 on white; the tint
measures 2.02:1. Unflattened, a printed table would have lost its ruling.

ONE THING WAS WIDENED BEYOND THE ITEM, and it is one selector: a fence that declared a language
NOTHING HERE TOKENISES - ```python - also takes the flat tint, via
`.tvsaid pre[data-lang]:not(:has(span))` as a SEPARATE rule so a parser without `:has()` drops only
that half. Without it, the one block that DID say what it was would have been the only fence left at
`--ink`: the least marked block in the well would have been the one that declared most. Zero of 185
blocks on the transcript are that shape and one of the three in `e2e/code-colour.spec.ts`' fixture
is, which is why it is a line and not a mechanism.

── HE STILL PICKS THE FRAME, AND THE MEASUREMENT NOW ARGUES FOR HIM ─────────────────────────

Photographed on his own table turn, same frame, same scroll: `e2e/screens/frame-near-white-table-en
.png` (11.31:1, shipped), `frame-dim-table-en.png` (7.99:1) and `frame-edge3-table-en.png`
(3.79:1, what seq:38 shipped). The full-well pair is `frame-near-white-en.png` and `frame-dim-en
.png`.

AND THE HAZARD THIS ITEM RAISED IS REAL BUT SMALLER THAN THE ONE IT MISSED. A frame at 11.31:1 is
ΔE76 14.4 from the prose against `--dim`'s 26.2, so it does compete - the picture is what settles
that. But sampled from the PNG rather than from the hex, 43% of a collapsed ruling is painted at a
FLAT 50% BLEND of the token, so `--dim` would have shipped 43% of the ruling at 2.85:1, under the
3.0 bar, and seq:38's `--edge-3` shipped 43% of it at 1.82:1 - within a rounding error of the
`--edge` he said he could not see. #c9c6d4 is the first step on this ramp at which EVERY pixel
clears 3.0. Filed in full as `plan:archive seq:47`;
`TASK-a-collapsed-table-ruling-is-painted-in-two-colours-and-43-of` carries the numbers and names
the three unmeasured borders.

── AND THE LEDGER TEST WAS RUN, WHICH IS WHAT THIS ITEM ASKED FOR ───────────────────────────

`e2e/screens/fence-tint-ledger-en.png` is a counts table and a progress-bar block in the tint;
`fence-tint-vs-tagged-en.png` puts a tinted block and a tagged `bash` fence in ONE frame. The
verdict from the picture: the green ledger reads as TERMINAL OUTPUT and not as source - which is the
register he named - and the tagged fence is unmistakable beside it, labelled and multi-hued against
one flat colour with no label. `e2e/code-hue.spec.ts` asserts both halves of that distinction rather
than only the colour.

STILL NOT SYNTAX-COLOURED, DELIBERATELY: the ~19 untagged blocks that really are code. The answer
remains a language tag written when the block is authored.

REPORTED AND NOT CHANGED: `.tvterm` - tool output - stays `--ink` while an untagged prose fence is
now green, and both are preformatted non-prose. The argument for leaving it is that `.tvterm` is a
faithful replay of terminal bytes, where the default foreground IS white and `lib/ansi.js` paints
the runs that were coloured. An untagged fence in assistant prose was never terminal output. If he
wants tool output tinted too it is one more line, and it is his call and not a lane's.

OWNER RULINGS 2026-09-09, closing this item: "the near-white frame is good, keep .tvterm white".

So `--tvframe` #c9c6d4 stands at his number, and `.tvterm` keeps `--ink` while an untagged prose
fence takes the green tint. The asymmetry is deliberate and now ruled rather than merely
defensible: `.tvterm` REPLAYS TERMINAL BYTES, where the default foreground genuinely is white and
`lib/ansi.js` paints whatever was coloured. A prose fence is markdown that never claimed to be a
terminal, so tinting one and not the other is the honest distinction.

AND HIS NUMBER WAS THE MEASURED ANSWER, NOT THE PREFERENCE, which is worth recording because I
argued against it twice. The lane sampled the PNG rather than the hex and found a collapsed
ruling is TWO colours in a 57/43 split - so `--dim`, which I recommended, would have shipped 43%
of every ruling at 2.85:1, UNDER the bar. #c9c6d4 is the first value where every pixel clears 3.0.
See seq:47.
