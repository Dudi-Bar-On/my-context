---
id: STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is
type: standard
title: a measured zero is drawn and named; an unmeasured thing is named as unmeasured; neither is blank
status: active
severity: hard
always: false
summary: Say plainly when you looked and found nothing, say plainly when you have not looked, and never show either of them as an empty space.
summary_of: 0cde201ea7161510
scope: []
tags:
  - v2
  - ui
  - owner-ruling
  - design
  - api
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-25
valid_until: null
checksum: a952bbf867460aef
---

# a measured zero is drawn and named; an unmeasured thing is named as unmeasured; neither is blank

OWNER RULING 2026-08-25, made ONCE as a principle after this product had decided the same question independently four times and got it right four times and wrong once.

THE PRINCIPLE, in three clauses:

  1. A MEASURED ZERO IS DRAWN AND NAMED. "We looked and there were none" is a finding and the reader is entitled to it.
  2. AN UNMEASURED THING IS NAMED AS UNMEASURED. "We have not looked" is a DIFFERENT fact and must never be rendered as a zero.
  3. NEITHER IS EVER RENDERED AS BLANK. A blank is indistinguishable from a failure to load, and a reader who cannot tell those apart stops trusting the surface.

WHERE THIS PRODUCT ALREADY GOT IT RIGHT, which is why it is a principle and not an opinion:
  `screens/watch.js` draws a FLOOR LINE under an empty pulse -- its own header: "a measured zero and an undrawn chart are two facts and the difference has to survive"
  the ask read model answers 200 with NO columns for a never-built projection, never 120 columns of zero, because that "would be a flat chart asserting nothing happened over a log the endpoint has not read"
  the export read model serves an unbuilt format rung as `built:false` rather than dropping it, so the page cannot silently invent a format
  `plan:rulings seq:26` asks for it a fourth time, for a missing ledger projection

WHERE IT WAS NOT APPLIED, and these are now governed by this standard rather than by three separate decisions:
  `doctor` draws a card headed "error" whose entire text is the word "error" -- the worst possible rendering of good news, on the screen a user opens to find out whether anything is wrong (`plan:walk seq:34`)
  `gaps` draws `Where/What/Next` with zero rows and no sentence -- and "there are no coverage gaps" is the best news this product can deliver
  `injected` draws `Item/Tier/When` with zero rows and no sentence (`plan:walk seq:35`)
  `plan:rulings seq:26`, the ledger, is settled by this and needs no separate ruling

SCOPE: it governs READ SURFACES and the READ MODELS behind them, because clause 2 cannot be honoured by a screen whose endpoint collapsed "none" and "not measured" into the same empty array before it arrived. It changes no WRITE path and no existing endpoint contract that already distinguishes the two -- the three examples above are the shape to copy, not to replace.

EVERY SENTENCE IT REQUIRES IS A STRING KEY, so each one needs the mockup first and then both tables (`strings-parity` compares in both directions). Draft them together in one sitting rather than one screen at a time.
