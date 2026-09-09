---
id: TASK-a-collapsed-table-ruling-is-painted-in-two-colours-and-43-of
type: task
title: a collapsed table ruling is painted in two colours, and 43% of it was measured at the wrong one
status: active
severity: soft
always: false
summary: A table's grid is as visible as the stylesheet says it is, instead of being half as visible on nearly half of its length.
summary_of: 6da861bb3f7c2041
scope:
  - src/ui/public/styles.css
  - e2e/code-hue.spec.ts
tags:
  - v2
  - archive
  - ui
  - "plan:archive"
  - "seq:47"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-09
valid_until: null
checksum: d262c90d692e8263
plan: archive
seq: "47"
state: done
priority: "2"
needs: archive/45
verified_on: 2026-09-09
---

# a collapsed table ruling is painted in two colours, and 43% of it was measured at the wrong one

FOUND BY plan:archive seq:45 while building the frame change the owner asked for, and it CORRECTS
A MEASUREMENT BOTH seq:38 AND seq:45 STATED AS FACT. Neither number was wrong about the token. Both
were wrong about the paint.

EVERY RATIO EITHER ITEM QUOTED FOR THE TABLE FRAME WAS COMPUTED FROM THE HEX A RULE WAS WRITTEN
WITH. Sampled out of the actual PNG instead - one table turn of the owner's own, cropped to the
table's own box inside the well and read pixel by pixel - a table's ruling is TWO colours in a
stable 57/43 split: 5,319 pixels of the token and 4,043 pixels of a FLAT 50% BLEND of the token
over the ground. Measured on '--sink' #101014:

                        the token   its painted half   share of the ruling below 3.0:1
    --edge-3  #6e6e7e      3.79:1        1.82:1        43%
    --dim     #a9a6b8      7.99:1        2.85:1        43%
    --tvframe #c9c6d4     11.31:1        3.62:1        NONE

THE CAUSE IS NOT A DEFECT AND NOT FIXABLE BY A COLOUR. 'border-collapse:collapse' over rows whose
heights are not whole device pixels - '--sp-1'/'--sp-2' padding on a 1.6 line-height at '--fs-0' -
makes the browser antialias each 1px collapsed edge across two device rows at half intensity each.
Ten border rows on a nine-row table: six painted at the token, four painted at half.

WHAT IT MEANS IS THAT seq:38 DID NOT DELIVER A 3:1 FRAME. It delivered 3.79:1 on 57% of the ruling
and 1.82:1 on the rest, and 1.82 is within a rounding error of the '--edge' #3a3a45 the owner said
he could not see. THAT IS THE MOST LIKELY REASON HE LOOKED AT seq:38 AND STILL ASKED FOR BRIGHTER,
and it is why his own number was not merely taste: #c9c6d4 is the FIRST step on this ramp at which
every pixel of the ruling clears 3.0:1. '--dim' at 7.99:1 would still have shipped 43% of the
ruling at 2.85:1, under the bar, which is an argument the arithmetic in seq:45 could not see.

ALREADY SHIPPED AND ALREADY MEASURED, so this item is not that work: 'e2e/code-hue.spec.ts' now
carries 'every pixel of the ruling clears 3:1, and not only the token', which crops the table inside
the well, finds the ruling rows by SPAN rather than by colour, and asserts the darkest of them
clears 3.0:1. It also asserts that the same blend of '--dim' and of '--edge-3' does not.

WHAT IS NOT MEASURED, AND IS THE WHOLE OF THIS ITEM. Three other borders were raised to '--edge-3'
by seq:38 on the same 3:1 argument and NONE of them has been sampled from paint:

    .tvsaid pre      the fence box - its '--paper' fill is a 0.4% step from the well, so this
                     border is the only thing saying where code starts and stops
    .tvsaid hr       a thematic break the author wrote
    .tvterm          the same box as a fence, for tool output

These are not collapsed borders, so the 50% split above does not transfer and must not be assumed.
A single 1px border on a box whose position is fractional CAN still be antialiased across two rows,
and if it is, all three are sitting at 1.82:1 on part of their length while the file claims 3.79:1.
MEASURE THEM THE WAY THE TABLE WAS MEASURED - crop inside the well, find the border rows by span,
read the paint - and then decide. If they are split, the choice is a brighter token or a 2px border,
and it is the owner's: he named the TABLE frames and only those, and seq:45 left these three alone
for exactly that reason.

AND THE GENERAL FORM IS WORTH KEEPING WHATEVER THE ANSWER IS: A CONTRAST RATIO COMPUTED FROM A
STYLESHEET IS A CLAIM ABOUT A TOKEN, NOT ABOUT A PIXEL. Every 1px boundary in this product that
owes 3.0:1 is asserted from its hex today. Two lanes in two days quoted a number for this one
surface that 43% of its own pixels did not meet, and neither lane was careless - the number was
simply computed one layer above where a reader's eye is. Where the geometry is fractional, the
honest ratio is the one sampled from the render.

── AND THE OUTER EDGES ARE THE NEXT UNMEASURED THING, RAISED BY THE OWNER ───────────────────

Looking at the frame screenshots he asked: "just at the screenshots did not see the top and bottom
framwork lines, hope it is only because the screen capture".

THE CROP EXPLAINS WHAT HE SAW. `frame-near-white-table-en.png` is 963 x 266 against a well 1019
wide, and the last row is cut mid-height - so the top, the bottom and both sides are all outside
the frame. The lane called them tight crops and they were.

AND THE RULE SAYS THE LINES EXIST: `.tvsaid th, .tvsaid td` carry a 1px `--tvframe` border, so
under `border-collapse:collapse` the outer edge of the first and last rows IS the table’s top and
bottom line.

BUT "THE RULE SAYS SO" IS EXACTLY THE REASONING THIS ITEM EXISTS TO CORRECT. Every ratio in seq:38
and seq:45 was computed from the hex a rule was written with, and 43% of the painted pixels turned
out to be a different colour entirely. So the outer edges are a claim, not a measurement, until
somebody samples them.

AND THERE IS A SPECIFIC REASON TO DOUBT THEM RATHER THAN A GENERAL ONE: `.tvsaid table` sets
`display:block` - it is there for `overflow-x:auto`, so a wide table scrolls inside its own
container rather than pushing the page sideways. A `<table>` at `display:block` is NO LONGER A
TABLE BOX, and how `border-collapse` resolves the OUTER edge of a non-table box is not something to
reason about from the spec. It is something to photograph.

SO ADD TO THIS ITEM’S SWEEP: sample the top, bottom, left and right edges of a table, uncropped,
in both languages. Use the `wellClip` helper this lane built - `boundingBox()` is DOCUMENT
coordinates, so a table taller than the well spills past it and a clip from that box photographs
the card behind it, which is how a "ruling at 1.06:1" was once reported that was really a fact
about a panel.

IF AN EDGE IS MISSING, IT IS A DEFECT AND NOT A TASTE QUESTION: a table drawn with three sides is
a table that looks unfinished, and he noticed its absence from a cropped picture, which is the
strongest evidence that it would be noticed on a real screen.

CLOSED 2026-09-09 BY OWNER INSTRUCTION ("close 47"), and closed as DONE rather than withdrawn,
because the work shipped and the bar is met. Recorded here so nobody re-dispatches it from the
state field alone.

WHAT SHIPPED, in commit c8f5b3df: the four outer edges of a table in the viewer, measured from the
PNG rather than read off the hex, both languages -

  top 11.31:1   bottom 11.31:1   inline-start 11.31:1   inline-end 11.31:1

AND THE 43% HALF NOW CLEARS THE BAR TOO, which is what makes this done rather than half-done. This
item exists because border-collapse over fractional row heights paints 43% of a ruling as a 50%
blend, and the three tokens measured at 1.82 (--edge-3), 2.85 (--dim) and 3.62 (--tvframe). The
owner named #c9c6d4, so the blended half is 3.62:1 - above the 3.0 bar. Every painted pixel of a
table ruling in this viewer clears it. His value was the measured answer, not a preference.

AND THE BIGGER FINDING THIS ITEM PRODUCED WAS NOT ITS OWN SUBJECT: the block-end outer edge was
NOT PAINTED AT ALL - the vertical rulings ran past the last row and ended in mid-air - because the
app table base carries `tr:last-child td{border-block-end:0}` at (0,1,2) and `.tvsaid td` is
(0,1,1). The primitive had won that border since seq:26, through seq:38 and seq:45, both of which
measured a token and never looked at the paint. That is why he could see a missing line and the
arithmetic could not.

AND ONE THING THIS ITEM ARGUED THAT IS WRONG, left on the record rather than quietly dropped: it
reasoned that the outer half-border was CLIPPED by overflow-x:auto on the anonymous table box.
Driven in the page, padding-block-end, a 2px last-row border and a real display:table box each
changed nothing. It was never a clip; it was a specificity loss.

THE FENCE, THE THEMATIC BREAK AND THE TERMINAL BOX ARE NOT PART OF THIS ITEM and are not closed by
it - they are archive/52, ruled 2px by the owner the same day and shipped. .tvjump is open there too.
