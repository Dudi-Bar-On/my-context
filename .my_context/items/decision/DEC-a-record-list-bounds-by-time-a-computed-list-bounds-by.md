---
id: DEC-a-record-list-bounds-by-time-a-computed-list-bounds-by
type: decision
title: a record-list bounds by time, a computed list bounds by admission order
status: active
severity: soft
always: false
summary: A list of things that happened is cut off by date; a list worked out on the spot is cut off in the order it was worked out, never by an invented time.
summary_of: bb3e370fb6d56389
scope: []
tags:
  - v2
  - ui
  - owner-ruling
  - design
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-26
valid_until: null
checksum: 068fb32960c00192
---

# a record-list bounds by time, a computed list bounds by admission order

OWNER RULING, 2026-08-26. Asked how to bound the five unbounded surfaces of `REQ-every-list-and-table-declares-what-leaves-it-and-when-and-says`, he answered: "Add timestamps like in audit, display the last N, allow the user to request more if you have it persisted -- tell me bfore doing". Told that two of the five carry no timestamp and cannot, he ruled: split the mechanism.

THE SPLIT, AND THE LINE IT FALLS ON. A surface that REPLAYS A RECORD bounds by TIME. A surface that RE-COMPUTES bounds by the order its computation admitted things in. The distinction is not stylistic -- it is about what the data can honestly be asked.

THREE SURFACES REPLAY A RECORD, and each already carries a real timestamp:
  `injected.js:70`  the injected-now table -- `InjectedLine.at`, per line, and the table already draws a When column
  `work.js:458`     the review queue -- the revision log stamps each staging
  `packs.js:522`    the pack list -- import records under the audit directory
These take the ruling as he said it: SHOW THE LAST N BY TIME, and offer the rest, because the rest is persisted and can be fetched.

TWO SURFACES COMPUTE, and carry no time field at all:
  `preview.js` · `SelectionEntry` · ~530  the delivered items -- `SelectionEntry` is `{ item, tier }`
  `preview.js` · `IndexLine` · ~617  the carried-id blocks -- `IndexLine` is `{ id, type, title, carried? }`
THE PREVIEW SCREEN SHOWS WHAT THE NEXT SESSION WOULD BE GIVEN, computed now. Every item in it arrives at the same hypothetical instant. There is no "last N" to take, and stamping a computation with a time it did not happen at is fabrication -- the precise failure `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is` exists to prevent, one layer up.

SO THEIR ORDER IS THE SELECTOR S OWN: first-fit, tier by tier, the order `select()` actually considered them. That is a real ordering, it is the one the engine used, and it is the honest thing to name. The first admitted are the ones the budget protected.

AND THEIR REMAINDER IS FREE. The whole array is already in the `/api/select` response, so the cap is a DISPLAY cap and "show all" costs no round trip. That is also what makes the true total always exact -- the one thing a provenance surface must never get wrong. The sentence must say DISPLAY in those words: "showing 20 of 47 delivered" is a claim about the screen; "you were given 20" would be a claim about the injection, and false.

THE CARRIED LIST TAKES THE SAME RULE AS THE DELIVERED LIST -- his own answer, given in those words, which closes the specific question `TASK-the-carried-id-list-is-unbounded-and-the-mockup-has-no-more` has held open since 2026-08-23.

THE ALTERNATIVE HE DECLINED, and it was genuinely available: persist delivery per item so the preview COULD carry timestamps. The audit projection already stores it -- `audit_item.role` joined to `audit.at` is what feeds the twelve-week sparkline. He declined it because it changes what that screen IS: a preview would become a history, and the screen s promise is about the NEXT session, not the last twelve.
