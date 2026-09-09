---
id: LESSON-a-locator-s-boundingbox-is-not-its-visible-box-so-a-clip
type: lesson
title: a locator's boundingBox is not its visible box, so a clip taken from one photographs whatever is under the well
status: active
severity: soft
always: false
summary: A test that photographs part of a scrolling view measures the pixels a reader sees, instead of whatever the page happens to draw below it.
summary_of: 5d0cc2f44853830c
scope:
  - e2e/**
tags:
  - v2
  - archive
  - ui
  - testing
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-09
valid_until: null
checksum: fc3597077d27e8a3
---

# a locator's boundingBox is not its visible box, so a clip taken from one photographs whatever is under the well

THE FIFTH SCREENSHOT TRAP ON THIS SURFACE IN THREE DAYS, and like the other four it produced a
measurement over the WRONG PIXELS rather than an error. Found by plan:archive seq:45 on 2026-09-09.

THE FOUR ALREADY ON RECORD, so this one is read as an addition and not a repeat: 'fullPage' resizes
the viewport and re-renders, so a '<details>' you opened comes back closed; a session opens at its
END with 'stickUntil' live, so a shot taken before pressing Top can be a byte-identical tail image;
'scrollIntoViewIfNeeded' detaches the '.tvrow' it scrolls to, because the row is absolutely
positioned inside a virtualised scroller; and the well lazily grows its document, so a
'scrollHeight' read at the top is a fraction of the real one.

THE FIFTH. 'locator.boundingBox()' returns the element's OWN box, in page coordinates, whether or
not the element is on screen. The conversation well is a fixed-height scroller and a table parked
at its top can be taller than it, so the table's box runs on PAST the well's bottom edge - and
'page.screenshot({clip: box})' happily photographs whatever the page draws down there, which is the
app's own card chrome.

WHAT IT ACTUALLY COST, measured rather than imagined: a crop that was supposed to hold one markdown
table held 38 extra pixel rows of '--panel' #17171c, '--panel-2' #1d1d24 and '--rule' #262630. A
test that scanned that crop for the table's ruling therefore reported five border populations where
there are two, and its darkest 'ruling' measured 1.06:1 - a number about the app's own panel, read
and reported as a fact about a table. The assertion FAILED, which is the only reason it was found;
had the check been a threshold on the mean it would have passed and been wrong.

THE FIX IS ONE HELPER AND IT IS NOT 'scrollIntoViewIfNeeded'. Intersect the element's box with the
WELL's box and clip to that:

    const inner = await target.boundingBox();
    const well  = await page.locator('.tvscroll').boundingBox();
    // clip = the overlap, and throw if there is not enough of it to be a picture

'e2e/code-hue.spec.ts' carries it as 'wellClip' with the reasoning. It also keeps the reason the
obvious alternative is barred: an element screenshot scrolls the element into view first, which is
trap three.

AND THE SHAPE THIS BELONGS TO IS WIDER THAN A CLIP. Four of these five traps are the same mistake in
different clothes: a browser API answered a question about the DOCUMENT when the test was asking a
question about the SCREEN. 'boundingBox' is document coordinates, 'scrollHeight' is the document's
height, 'fullPage' re-lays-out the document, and 'stickUntil' is the document moving under a shot.
A test that photographs a virtualised well has to say which of the two it means, every time.

ONE MORE THING WORTH KEEPING FROM THE SAME HOUR, because it is the same class of error one layer up:
identifying a painted feature BY COLOUR fails when the feature and its surroundings are both
near-greys. Scanning for pixels lying between '--sink' #101014 and a near-white frame is very nearly
scanning for 'is grey', and it swept up the antialiasing of '--dim' header text as though it were
part of the table's ruling. Geometry was the honest discriminator: a collapsed horizontal border is
the only thing in a table that spans its full width.
