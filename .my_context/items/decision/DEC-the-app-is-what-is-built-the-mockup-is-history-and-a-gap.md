---
id: DEC-the-app-is-what-is-built-the-mockup-is-history-and-a-gap
type: decision
title: the app is what is built; the mockup is history and a gap list
status: active
severity: soft
always: false
summary: The working product is now the reference; the old drawing is kept only as history and as a list of things that were designed but never built.
summary_of: 193ac0f51a8d8787
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
checksum: 6b205291d5a2bd35
---

# the app is what is built; the mockup is history and a gap list

OWNER RULING, 2026-08-26, in his own words: "now that the app is much fuctioning, you should add the features to the app and use the mockup only for history and gap analisys for intended implementations that currentlly still not or not fully implemented in the real app ... and this also should be done carfully by asking me if somthing contradicts becase there are some decidsion that we implemented differently then in the mockup".

THE MOCKUP HAS TWO JOBS FROM TODAY, AND SPECIFYING NEW WORK IS NOT ONE OF THEM:
  1. HISTORY -- what was designed, and when. That is why the PROPOSED badges stay in it and never ship (`DEC-the-proposed-chip-is-the-design-annotating-itself-not-ui`).
  2. A GAP LIST -- something the design drew that the app has not built, or has not built fully. That direction is still worth failing a suite over, because it is the only record of what was intended and forgotten.

WHAT IS RETIRED IS THE OTHER DIRECTION. A feature built in the app no longer needs to be drawn in the mockup first. `RULE-1-1-with-the-mockup-and-the-owner-says-when-it-is-done` is AMENDED rather than deleted: its bar -- that a screen is done when the OWNER says it is, not when a gate is green -- is untouched and is the part that has been earning its keep. What no longer holds is that the app must equal the mockup in both directions.

THIS EXTENDS `DEC-more-than-the-mockup-is-usually-right-less-than-the-mockup` rather than contradicting it. That ruling already made the two directions asymmetric and said a surplus in the app is presumed correct; it still required the reconciliation to go INTO the mockup. This says it does not have to. The reason is the same one, one step further along: the mockup was drawn at a point in time and the app has passed it.

WHAT IT UNBLOCKS, and this is why it matters rather than being a change of vocabulary: `strings-parity` compares key sets IN BOTH DIRECTIONS and `styles-parity` carries CSS blocks byte-identically, so until today ANY new sentence or style rule in the app required a mockup edit FIRST. That is the bottleneck `DEC-claude-drafts-the-mockup-and-the-owner-approves-the-1-1-rule` was written to relieve by moving the pen; this removes the requirement instead. The app-to-mockup direction is dropped from both gates. The mockup-to-app direction stays and stays FAILING, because a gap nobody is forced to look at is a gap that rots.

AND THE STANDING INSTRUCTION THAT COMES WITH IT: ASK BEFORE TREATING A DIFFERENCE AS A GAP. Several differences are DECISIONS taken deliberately -- the PROPOSED badges are his own example, and `span.prop` sits in five screens ledgers for exactly that reason. A difference is a gap only once someone has ruled that the mockup was right. When it is not obvious, it goes to the owner.
