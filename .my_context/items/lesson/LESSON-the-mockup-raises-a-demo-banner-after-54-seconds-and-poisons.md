---
id: LESSON-the-mockup-raises-a-demo-banner-after-54-seconds-and-poisons
type: lesson
title: the mockup raises a demo banner after 54 seconds and poisons any long capture run
status: active
severity: soft
always: false
summary: The design file shows a fake error message about a minute after it opens, which lands in the middle of any picture taken after that and looks exactly like a real fault.
summary_of: 36938aa78154f01f
scope:
  - e2e/**
  - docs/design/**
tags:
  - v2
  - testing
  - mockup
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-11
valid_until: null
checksum: dabcf1c3ba5e2d0f
---

# the mockup raises a demo banner after 54 seconds and poisons any long capture run

MEASURED 2026-09-11 by the pixel-parity lane, and it cost twelve captures before it was caught.

`docs/design/web-ui-mockup.html` RAISES ITS OWN DEMO BANNER FIFTY-FOUR SECONDS AFTER LOAD. A
`setInterval` ticking every 900 ms counts to sixty and then draws a "server has exited" modal,
about 340 px, dead centre. It is a demonstration of a real state the app can be in — the mockup
showing what it is for — and there is nothing wrong with it.

WHAT IS WRONG IS WHAT IT DOES TO AN INSTRUMENT. A walk that opens the mockup once and visits
twenty-one screens crosses fifty-four seconds somewhere around screen eight, and every capture
after that carries a modal the app has no reason to draw. It cost the `learn` screen a reported
98,975 differing pixels where the honest figure is 42,269 — more than half of the largest number
in the run was pure fiction, and it was fiction that LOOKED like a finding: a large, solid,
centred region is exactly the shape a real layout defect makes.

THE FIX IS TO RELOAD THE MOCKUP PER SCREEN, never to edit the mockup. It is the design of record
and `RULE-1-1-with-the-mockup-and-the-owner-says-when-it-is-done` makes it the authority; an
instrument that quietly edits its own reference has stopped being an instrument.

AND THE FIRST FIX LOOKED LIKE IT WORKED AND DID NOT, which is the part worth carrying. Dismissing
the banner with `querySelector('#exdismiss, button.icon')` returns the first match in DOCUMENT
ORDER — which is the hidden `#exrefresh`, not the dismiss control. Twelve captures stayed
contaminated while the report said they had been repaired. A selector list is not a preference
order.

WHO ELSE THIS REACHES, said rather than left to be rediscovered: anything that holds the mockup
open for more than fifty-four seconds. `tree-parity` measured 36–57 s per project — right at the
edge — so it is one slow machine away from the same contamination, and nothing in it would say so.

IT WAS CAUGHT ONLY BY AN ACCIDENT OF REPORTING. The cluster namer prints the element under a
differing region, and it printed `div.banner`. Had it printed coordinates — which is what a pixel
differ naturally reports — the number would have been accepted as a finding about the screen.
AN INSTRUMENT THAT NAMES WHAT IT FOUND CATCHES ITS OWN CONTAMINATION; ONE THAT REPORTS A NUMBER
DOES NOT.
