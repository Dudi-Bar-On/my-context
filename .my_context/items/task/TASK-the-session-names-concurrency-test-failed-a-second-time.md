---
id: TASK-the-session-names-concurrency-test-failed-a-second-time
type: task
title: the session-names concurrency test failed a second time under load
status: active
severity: soft
always: false
summary: A test proving simultaneous writes lose nothing keeps failing now and then; it points at a real race and must not be dismissed.
summary_of: 650ba7b5fe6918ed
scope: []
tags:
  - "plan:hooks"
  - "seq:13c2"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-21
valid_until: null
checksum: 7d36ca34e8ff0fd3
plan: hooks
seq: 13c2
state: done
priority: "1"
---

# the session-names concurrency test failed a second time under load

FOURTH and FIFTH data points, 2026-08-22: the ui3 9 agent saw 'concurrent writes from separate processes lose no entry' fail in TWO of four full-suite runs - losing entry s5 once and a different assertion the other time - and pass 21/21 in isolation. Its diff contained no TypeScript at all.

Running tally: five failures now. Two under five-agent load, one in isolation, two more under load with a diff that could not possibly cause them. Roughly twenty clean isolated runs against those five.

The isolated failure is still the one that matters: six writers against an idle box do not exhaust a fifteen-second lock timeout, so LOCK_TIMEOUT_MS alone does not explain it. Something in the read-modify-write can lose an entry without that much contention. Look at the window between readSessionNames and the rename, and at whether every writer holds the lock across the whole of it.

A second observation worth having: the failure is not always the same assertion. A lost entry and a different assertion failing are different symptoms, which argues for a race with more than one outcome rather than a single timeout.

Three separate agents have now recommended filing it as a known flake. It must not be filed. The test exists to prove the lock, and filing it deletes the only evidence the lock is imperfect.

CLOSED 2026-08-26. THE ROOT CAUSE WAS FOUND AND FIXED ON 2026-08-23, in `314372e` "lock: the stale reclaim deleted a file it had never judged", and this task was simply never moved. All five observed failures are dated 2026-08-21 and 2026-08-22 -- every one of them PREDATES the fix.

IT WAS NEVER A FLAKE, AND IT WAS NOT THE LOCK TIMEOUT this task guessed at. It was a silent lost update in the RECOVERY path, not in acquisition. `retryOrThrow` read a lock payload, ruled it stale, and then deleted a PATH -- nothing checked that the file it removed was the file it had judged. From an instrumented trace: pid 52636 judged pid 25412 s lock stale and 8ms later deleted pid 25096 s LIVE lock, then walked in beside it. 22ms of double-hold, one entry lost. Reproduced on demand: 32 writers over 20 rounds lost an entry in 11 of them, up to 15 entries in a single round; 0 in 25 rounds after the fix.

WHY THE WINDOW WAS ORDINARY RATHER THAN EXOTIC, which is why load made it appear: staleness is pid-authoritative with no age requirement, and these are short-lived processes. A child that acquires, writes, releases and exits makes "the recorded pid is dead" true within milliseconds of a NORMAL release -- so a healthy release-then-reacquire was indistinguishable from a crash. Every logged reclaim in those traces deleted a payload different from the one it judged.

AND THE TASK S OWN INSTRUCTION WAS WHAT SAVED IT. Three separate agents recommended filing this as a known flake. Had it been filed, the fix would have removed nothing and the store would still be losing writes -- silently, with every writer reporting success. `nonzeroExitRounds` was 0 in EVERY failing round.

INDEPENDENTLY RE-VERIFIED 2026-08-26 against the current build, because a fix nobody confirmed is a claim:
  - 180 rounds of the test s exact shape at 36-way process contention -- 180/180 clean.
  - FOUR CONCURRENT FULL SUITES, the documented reproduction condition (18,280 tests) -- 4,570 pass, 0 fail, in all four.
