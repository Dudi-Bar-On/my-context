---
id: TASK-the-table-frames-want-to-be-near-white-and-an-untagged-code
type: task
title: the table frames want to be near-white, and an untagged code block wants a colour that is not a syntax claim
status: active
severity: soft
always: false
summary: Table lines are bright enough to see at a glance, and a code block that never said what language it is still looks like code rather than prose.
summary_of: 49d90473c7f08671
scope:
  - src/ui/public/styles.css
  - src/ui/public/lib/markdown.js
tags:
  - v2
  - archive
  - ui
  - "plan:archive"
  - "seq:45"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-09
valid_until: null
checksum: 7218e3769c02b3e5
plan: archive
seq: "45"
state: todo
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
