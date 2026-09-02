---
id: LESSON-a-test-that-proves-a-lock-failing-under-load-is-the-lock
type: lesson
title: a test that proves a lock, failing under load, is the lock reporting a hole
status: active
severity: soft
always: false
summary: A test that only fails when things run at once is reporting a real gap, not being unreliable, and dismissing it hides the loss it found.
summary_of: 48ea777375b07dba
scope: []
tags:
  - v2
  - testing
  - concurrency
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-26
valid_until: null
checksum: b6e7a6589ec69a12
---

# a test that proves a lock, failing under load, is the lock reporting a hole

THE SESSION-NAMES CASE, 2026-08-21 to 2026-08-23, closed 2026-08-26. `test/core/session-names.test.ts` "concurrent writes from separate processes lose no entry" failed five times under multi-agent load and passed roughly twenty isolated runs. THREE SEPARATE AGENTS recommended filing it as a known flake. It was a real silent lost update in `src/core/lock.ts` -- `retryOrThrow` deleted a lock file it had never judged, and a live holder s lock went with it. See `314372e`.

THE RULE. A test whose whole purpose is to prove an EXCLUSION property is not a candidate for the flake list, ever. Filing it does not quarantine a timing artefact; it deletes the only evidence the exclusion is imperfect, and leaves the product losing writes with every writer reporting success.

THREE THINGS THIS CASE TEACHES ABOUT READING SUCH A FAILURE:
  1. THE EXIT CODES ARE THE FIRST DISCRIMINATOR. Every failing round had `nonzeroExitRounds` 0. A lock TIMEOUT would have failed the exit-code assertion first, with a message -- so the recorded timeout hypothesis was ruled out by evidence that was already in the failure, before any new instrumentation.
  2. "PASSES IN ISOLATION" IS NOT EVIDENCE OF A TIMING ARTEFACT. It is evidence that the hazard needs contention, which is exactly what a lock bug needs. The two readings are indistinguishable from the pass rate alone and must be told apart by mechanism.
  3. LOOK AT RECOVERY, NOT ACQUISITION. Acquisition here was atomic and always had been. The hole was in the path that CLEANS UP after a holder that died -- the path nobody writes a concurrency test for, because it is framed as repair rather than as a critical section.

AND THE GENERAL SHAPE, which is `INV-nothing-is-dropped-silently` again: judging a resource and then acting on its NAME rather than on the thing judged is a lost update waiting for a scheduler delay. `releaseFnFor` already carried the guard -- a nonce check before removal -- and said why. The reclaim path did not. One of two siblings having the guard is where to look first.
