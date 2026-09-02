---
id: LESSON-a-proxy-measured-instead-of-the-property-the-gate-does-not
type: lesson
title: "a proxy measured instead of the property: the gate does not break, it drifts, and drift has no colour"
status: active
severity: soft
always: false
summary: A check that measures something merely related to what you care about keeps passing after the two come apart, so it quietly stops protecting anything.
summary_of: 81d016b04e98118a
scope: []
tags:
  - v2
  - e2e
  - testing
  - gates
  - "plan:walk"
  - "seq:67a"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-02
valid_until: null
checksum: 377b9c566367fcca
---

# a proxy measured instead of the property: the gate does not break, it drifts, and drift has no colour

Recorded as a LESSON rather than a standard or a rule: it is a failure mode with six recorded instances and a counter-discipline that works, but binding it would be an unapproved rule about how every gate in this project must be written, and rationale tier is where an argument lives until an owner rules on it.

THE FAILURE. A check asserts on something CORRELATED with the property it exists to protect, rather than on the property itself. On the day it is written the two agree, so the check is true, cheap and correct. Then something moves around it, the correlation breaks, and the check goes on reporting -- accurately -- about the proxy. It does not break. It DRIFTS, and drift has no colour: a proxy that has come loose still passes perfectly, so nothing anywhere turns red at the moment protection stops.

That is why this is worth naming rather than fixing case by case. Each instance looks like a small oversight in one test. The class is that a green suite can stop measuring what it was built to measure, silently, with no event to notice.

THE EVIDENCE, six instances in three days, every one of them a gate that was correct about what it measured:

  PROXY                        PROPERTY IT STOOD IN FOR
  the element count stopped    the screen finished loading. Screens append
  changing                     cards synchronously and fill them when a fetch
                               resolves, so a half-drawn screen is stable.
  absent right now             absent once settled. Absence assertions were
                               satisfied by the instant before an async read
                               returns.
  a counter of in-flight       the set of requests actually open. The counter
  requests                     went negative on the first screen and inverted
                               its own wait; ten screens were inventoried at
                               three nodes apiece, green.
  some elements exist          THIS screen's elements exist. A settle was
                               satisfied by the router's holding chip, two
                               elements present from the first frame that
                               never change, so every screen reported "0
                               linked".
  the check ran                the check had something to check. A cycle check
                               passed over zero items, vacuously true, green
                               through the whole window in which there was
                               nothing to check.
  a row's BOX                  a row's CONTENT. The named instance below.

THE NAMED INSTANCE, and it is the one the pattern was extracted from. e2e/app-layout.spec.ts carried a test called "every row of the app shell is occupied -- no empty band", written against an owner report of a strip of colour across the bottom of the window, and stating its own principle: "A band of nothing is a missing element, not a styling slip." What it measured was every child's bounding rectangle, sorted, checked for vertical gaps. Geometry. So an element present at its full reserved height with NO TEXT covers its span, leaves no gap between its siblings, and passes -- and a band of nothing, the test's own words for the defect, is exactly what it was passing over. The provenance bar was 26px by 1280px with zero visible descendants and no text on every screen measured, from the day the shell landed. Eight days, one green gate. The owner found it by looking at the product.

THE COUNTER-DISCIPLINE, which is cheap and is the whole remedy: NAME THE PROPERTY IN THE ASSERTION'S OWN TITLE, THEN ASSERT THAT SENTENCE AND NOTHING ADJACENT TO IT. The replacement test is called "every row of the app shell SAYS something", which is a claim about words, so it measures words -- painted glyphs, found with a range around each text node and required to intersect the row's own rectangle, not height, not child count, not textContent, and not a label on the container. A title that names a proxy is the tell; if the sentence you would have to write to describe what the code checks is not the sentence in the title, the gap between them is where the drift will live.

THREE COROLLARIES, each learned from an instance above:

  - A CONTAINER'S OWN LABEL IS NOT ITS CONTENT. The row being asserted on carried an aria-label of its own; accepting it would have turned the new gate green on the very element that motivated it, wearing the name of the thing it fails to say. Any accessible name is therefore searched UP TO but NOT INCLUDING the element under test. The general form: never let the thing under test supply the evidence that it passes.
  - A CHECK THAT RAN OVER NOTHING HAS NOT RUN. Vacuous truth is the cheapest proxy of all. Assert the population is non-empty, or report NOT MEASURED as its own failure.
  - THE SWEEP IS A PROXY TOO. The first version of the replacement test set the hash without the router's leading slash, so four named screens all resolved to one page and the failure message named a screen it had never visited. It now reads back which screen is actually shown and asserts that the screen it measured is the screen it named -- because a gate that silently measures the wrong subject is the same defect, committed by the test written to name it.

WHAT MAKES THIS ACTIONABLE BEYOND TESTS. Nothing above is specific to a browser or to a test runner. The same shape is a dashboard whose health tile reads process-is-up for service-is-serving, a rate limiter counting requests for cost, a freshness check reading file mtime for content changed, a coverage number standing in for whether the risky path is exercised. Wherever a measurement is chosen because it is cheap and happens to agree today, the question to ask before landing it is the one this pattern answers: WHEN THESE TWO STOP AGREEING, WHAT GOES RED?
