---
id: TASK-the-session-names-lock-may-lose-a-write-under-real-load-and
type: task
title: the session-names lock may lose a write under real load, and it is not a flake to file away
status: active
severity: soft
always: false
summary: A safeguard meant to stop two writers losing each other's work may not hold under heavy load; understand it before excusing the failure.
summary_of: 9983165a06f60edc
scope: []
tags:
  - "plan:hooks"
  - "seq:13c"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-21
valid_until: null
checksum: 9658c42ed2650b4f
plan: hooks
seq: 13c
state: done
priority: "1"
---

# the session-names lock may lose a write under real load, and it is not a flake to file away

test/core/session-names.test.ts 'concurrent writes from separate processes lose no entry' failed once during a five-agent full-suite run, and passes in isolation - verified three times, 21/21 each. It is tempting to add it to the known-flake list. Do not, until this is understood.

That test exists to prove the lock the hooks 13 agent added, and the property it asserts is the one the plan required: concurrent writes from two processes do not lose an entry. A test that proves a lock, failing under contention, is either a timing artefact or the hole itself.

The hypothesis to check first: LOCK_TIMEOUT_MS is 15_000 in src/core/lock.ts, and on exhaustion retryOrThrow THROWS. Six spawned writers against a box running five full test suites can plausibly exceed fifteen seconds, and a writer that throws loses exactly one entry's read-modify-write - which is the observed failure, precisely.

If that is the cause, the question is what setSessionName should do when it cannot get the lock in time: report written:false with the reason (nothing is dropped silently) or wait longer. Either is defensible; silently losing a name is not.

Reproduce under load rather than in isolation - in isolation it passes.

CLOSED 2026-08-26. THE ROOT CAUSE WAS FOUND AND FIXED ON 2026-08-23, in `314372e` "lock: the stale reclaim deleted a file it had never judged", and this task was simply never moved. All five observed failures are dated 2026-08-21 and 2026-08-22 -- every one of them PREDATES the fix.

IT WAS NEVER A FLAKE, AND IT WAS NOT THE LOCK TIMEOUT this task guessed at. It was a silent lost update in the RECOVERY path, not in acquisition. `retryOrThrow` read a lock payload, ruled it stale, and then deleted a PATH -- nothing checked that the file it removed was the file it had judged. From an instrumented trace: pid 52636 judged pid 25412 s lock stale and 8ms later deleted pid 25096 s LIVE lock, then walked in beside it. 22ms of double-hold, one entry lost. Reproduced on demand: 32 writers over 20 rounds lost an entry in 11 of them, up to 15 entries in a single round; 0 in 25 rounds after the fix.

WHY THE WINDOW WAS ORDINARY RATHER THAN EXOTIC, which is why load made it appear: staleness is pid-authoritative with no age requirement, and these are short-lived processes. A child that acquires, writes, releases and exits makes "the recorded pid is dead" true within milliseconds of a NORMAL release -- so a healthy release-then-reacquire was indistinguishable from a crash. Every logged reclaim in those traces deleted a payload different from the one it judged.

AND THE TASK S OWN INSTRUCTION WAS WHAT SAVED IT. Three separate agents recommended filing this as a known flake. Had it been filed, the fix would have removed nothing and the store would still be losing writes -- silently, with every writer reporting success. `nonzeroExitRounds` was 0 in EVERY failing round.

INDEPENDENTLY RE-VERIFIED 2026-08-26 against the current build, because a fix nobody confirmed is a claim:
  - 180 rounds of the test s exact shape at 36-way process contention -- 180/180 clean.
  - FOUR CONCURRENT FULL SUITES, the documented reproduction condition (18,280 tests) -- 4,570 pass, 0 fail, in all four.
