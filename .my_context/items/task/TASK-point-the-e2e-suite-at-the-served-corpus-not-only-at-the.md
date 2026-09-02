---
id: TASK-point-the-e2e-suite-at-the-served-corpus-not-only-at-the
type: task
title: point the e2e suite at the served corpus, not only at the mockup
status: active
severity: soft
always: false
summary: Run the end-to-end tests against the real running product rather than the static design file, checking relationships instead of fixed values.
summary_of: f6f8ce1e79bfaee9
scope: []
tags:
  - "plan:ui1"
  - "seq:20e"
  - "state:done"
  - v2
  - ui
  - dogfooding
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-22
valid_until: null
checksum: d2ff2039fad351ec
plan: ui1
seq: 20e
state: done
priority: "1"
---

# point the e2e suite at the served corpus, not only at the mockup

Follows REQ-the-web-ui-is-dogfooded-against-this-corpus-and-the-e2e. Cannot start until the shell and at least one screen render.

RULED BY THE OWNER 2026-08-22: assert SHAPES, not a pinned snapshot.

So every assertion is about the relationship between what the endpoint returned and what the screen drew - a row per item the API listed, a count that matches the payload, an empty state that appears only when the endpoint says empty, a 503 that renders as the stale state rather than as zeroes. No assertion names an id, a title or a number that lives in the corpus.

What that buys, and it is the reason: the suite keeps testing the product as the corpus grows, and it cannot pass by accident when a screen renders nothing. What it costs, and this must be handled rather than discovered: a failure says 'the row count did not match the payload' rather than 'CONST-postgres-pool-capped-at-20 is missing', so every assertion needs a message carrying both numbers and the query that produced them. A shape assertion with a bare message is the flakiest thing in a suite.

Two shapes that are NOT free and need deciding as they arise: ordering (if a screen sorts, the test asserts the sort holds, not which item is first) and emptiness (a screen with no data must be distinguishable in the test from a screen that failed to load - the read-only door already makes that distinction, absent versus stale, and the test should use it).

Today every e2e spec drives docs/design/web-ui-mockup.html over file://, which carries hand-written sample markup. That is right for the mockup - it is the design of record and its own e2e proves it draws all 21 screens in both languages. It is not a test of the product.

The server already spawns cleanly in tests: test/ui/watch-e2e.test.ts and server-e2e.test.ts both do it, including the token gate and an SSE stream held open.

Watch for the trap the read surface already has: the 401 is the read surface's one write, and it leaves the projection behind its log, so an authorised read after a refusal returns 503. Any sequence that refuses and then reads must expect that.

VERIFIED PARTIAL 2026-08-26. Met: the suite genuinely reaches the served corpus - syncProjection() + startUiChild(CORPUS) in the app fixture (`e2e/app.ts` · `harness = await startUiChild(CORPUS);` · ~162), consumed by seven specs. NOT MET: THE RULED SHAPE ASSERTIONS. No spec compares a drawn row count against an endpoint payload; the corpus assertion is a TEXT-LENGTH FLOOR (body.innerText.length > 200, `app-layout.spec.ts` · `return (body.innerText ?? '').trim().length;` · ~61) which is the demanded property only weakly. No absent-vs-stale (503) assertion exists under the app fixture at all - screen-parity.spec.ts:279 merely narrates the hazard. The `blocked` field was closer to the truth than the `done` tag.
