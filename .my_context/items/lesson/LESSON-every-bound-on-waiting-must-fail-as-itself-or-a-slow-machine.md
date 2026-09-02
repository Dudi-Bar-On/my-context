---
id: LESSON-every-bound-on-waiting-must-fail-as-itself-or-a-slow-machine
type: lesson
title: every bound on waiting must fail as itself, or a slow machine accuses the code
status: active
severity: soft
always: false
summary: If giving up on waiting is allowed to pass quietly, a slow machine produces a failure that accuses the work of a fault it does not have.
summary_of: 37e7cbcadb7dc6ac
scope: []
tags:
  - v2
  - testing
  - e2e
  - concurrency
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-27
valid_until: null
checksum: e7fea00ef075a0bf
---

# every bound on waiting must fail as itself, or a slow machine accuses the code

MEASURED 2026-08-27. THREE tests failed once inside a full suite and passed in isolation, within one afternoon. Two of them turned out to have real defects of the SAME SHAPE, and naming that shape is worth more than either fix.

THE SHAPE: a test that samples something the page is still building, and a bound on the waiting that does not fail as itself.

INSTANCE 1 -- `e2e/app-refresh.spec.ts`, "a dead token is dropped in memory". It called `page.reload()` and then immediately read `window.myctx`. `reload()` resolves on `load`; `main()` is async and assigns that property some way into a boot which, on this path, includes a request that is REFUSED and recovered from. The failure read `Cannot read properties of undefined (reading 'api')` -- a message about nothing the test asserts. Fixed with a barrier on the exact property the next line reads. Note that `expectRendered` in the SAME FILE already carried the lesson in its own words: "under seven parallel workers it sometimes had not, and the test failed for a reason that had nothing to do with what it asserts. retries are 0 here by deliberate policy, so a racy test is not a nuisance -- it is a lie." One reload in that file had the barrier; the other did not.

INSTANCE 2 -- `e2e/screen-parity.spec.ts`, the seventeen-screen walk. It waits for each screen to STOP GROWING: two equal counts 400ms apart, capped at 25 attempts. Exhausting the cap fell straight through to the comparison, so a screen that was merely SLOW was compared HALF-DRAWN and reported as "the mockup draws these and the app does not". Under load the test ran 55.8s and failed that way; alone it ran 32.2s and passed 5/5. The test's own header calls this "a wall-clock failure with no assertion behind it, which is the worst kind of red because it reads exactly like a regression" -- and then the cap it added had no failure of its own. Fixed: the cap now asserts `settled` separately, so a slow screen SAYS it was slow and produces no ledger verdict at all.

THE GENERAL FORM, and it is two rules rather than one:

1. **A barrier waits for the exact thing the next line reads.** Not for a proxy of it. `expectRendered` was the wrong barrier for instance 1 -- it waits for a rail and for counts, which a locked-out page may never reach, and which is a different fact from "the shell exists".

2. **EVERY BOUND ON WAITING MUST FAIL AS ITSELF.** A timeout, a retry cap, a settle limit -- if exhausting it lets execution continue into an assertion, then a slow machine produces a message about correctness. That message is worse than no test: it accuses the code, and someone will go and look at the code. This is `STD-absent-vs-zero` in the time dimension -- "we stopped waiting" and "it is not there" are different facts, and the reassuring wrong reading is the one that gets acted on.

WHAT DID NOT GET A CAUSE: a third instance, four tests in `test/ui/execute-route.test.ts`, filed as `KNOWN-four-execute-route-tests-failed-once-and-would-not-reproduce` after 35 attempts. Given the two siblings above, the same shape is now the first hypothesis to test there rather than the last.
