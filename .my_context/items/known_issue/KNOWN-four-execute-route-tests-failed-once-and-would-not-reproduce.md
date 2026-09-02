---
id: KNOWN-four-execute-route-tests-failed-once-and-would-not-reproduce
type: known_issue
title: four execute-route tests failed once and would not reproduce in 35 attempts
status: active
severity: soft
always: false
summary: Four checks failed together once and have never failed again despite many attempts, so the cause is unknown and is recorded rather than dismissed.
summary_of: 29fd665f4ceb3406
scope: []
tags:
  - v2
  - execute
  - testing
  - unreproduced
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-27
valid_until: null
checksum: f20246ae4ba25e9a
---

# four execute-route tests failed once and would not reproduce in 35 attempts

OBSERVED ONCE on 2026-08-27 and NOT REPRODUCED IN THIRTY-FIVE FURTHER ATTEMPTS. Recorded rather than closed, because "flaky" is the verdict that cost this project two red runs on 2026-08-26 and it is a verdict nobody had measured.

WHAT HAPPENED. One `npm test` run reported 4 failures, all in `test/ui/execute-route.test.ts`: a nonce minted for one ARGV does not authorise a different one; the same nonce cannot run twice; an unknown id is 400 BEFORE the nonce is looked at; TWO audit rows per run.

WHAT WAS TRIED, and none of it reproduced the failure: the file alone, 25 consecutive runs, 0 failures. The whole suite, 8 consecutive runs, 0 failures. TWO WHOLE SUITES CONCURRENTLY -- the shape that caused the 2026-08-26 red runs -- both green at 4,704 each.

UPDATED LATER THE SAME DAY, and this changes which hypothesis comes first. TWO SIBLING FAILURES of the same outward shape -- fails once inside a full suite, passes alone -- were found and BOTH had real causes, both in the tests rather than in the code:

  - `e2e/app-refresh.spec.ts` read `window.myctx` immediately after `page.reload()`, with no barrier on the property the very next line uses.
  - `e2e/screen-parity.spec.ts` capped its settle loop at 25 samples and, on exhausting it, fell through and compared a HALF-DRAWN screen -- reporting a load failure as a missing element.

Both are recorded in `LESSON-every-bound-on-waiting-must-fail-as-itself-or-a-slow`. So the first hypothesis here is no longer the process-global binding below; it is THE SAME SHAPE: something in this file that samples or waits without a bound that fails as itself. Look for an `await` on a proxy rather than on the exact thing asserted, and for any retry or timeout whose exhaustion continues into an assertion.

STILL WORTH KNOWING, as the second hypothesis. `registerExecuteRoutes` binds the endpoint PROCESS-GLOBALLY: the route table refuses a duplicate registration outright, so the routes are registered once and the BINDING is replaced, making the most recently started server the owner. An earlier server's outstanding nonces then stop redeeming. Three of the four failures are nonce-path assertions, which is what made this the suspect. What argues against it: within one file `node --test` runs top-level tests sequentially, and across files it uses separate processes, so no second `startUiServer` should land between a mint and a redeem.

WHAT WOULD SETTLE IT: an assertion that the binding is the one the caller expects at the moment of redemption, or a test-only accessor that fails loudly when the endpoint answers from a store the test did not create. Both are cheap; neither is worth building until it recurs, and this record is what makes recurrence recognisable rather than a fresh surprise.
