---
id: KNOWN-the-session-names-lock-lost-three-of-six-concurrent-writers
type: known_issue
title: the session-names lock lost three of six concurrent writers, once
status: deprecated
severity: soft
always: false
summary: A rare test failure in which concurrent writers to the stored session names overwrote each other, suggesting the lock does not serialize writes.
summary_of: de9e7d0cc220c7fe
scope: []
tags:
  - v2
  - concurrency
  - flake
  - backend
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-23
valid_until: 2026-08-23
checksum: b867e84b6cb5f3d5
---

# the session-names lock lost three of six concurrent writers, once

OBSERVED 2026-08-23, once in roughly five full-suite runs, and NOT reproduced since - six isolated runs of the file alone and four full-suite runs were all green.

THE FAILURE, verbatim: `concurrent writes from separate processes lose no entry` (test/core/session-names.test.ts ~214) spawns six real child processes that each write a DIFFERENT session id, then asserts all six survive. It read back three.

    actual:   [ "s2", "s5", "s6" ]
    expected: [ "s1", "s2", "s3", "s4", "s5", "s6" ]

The assertion message is the hypothesis and it is the test's own: "a concurrent writer's entry was lost - the read-modify-write is not serialized". Three writers read before any wrote and the last one back overwrote them. That is precisely the failure `lock.ts` exists to rule out, so this is a real defect until it is shown otherwise - a flaky test here would be indistinguishable from a lock that does not hold under load, and the second is the one that silently loses a user's session names.

WHY IT SURFACED NOW, unproven but worth checking first: the same run was the first with `core/ui-sessions.ts` in it, which adds a read and an atomic write at every `startUiServer`, and the suite starts a lot of servers. More concurrent filesystem work is exactly the condition under which a weak lock stops holding. That is a correlation and nothing more - the seq-13 changes in the same run were data-only and cannot touch a lock.

DO NOT close this by adding a retry to the test. The claim under test is that the store serializes, and a retry would convert a lost entry into a passing run. Reproduce it under deliberate load first: raise the writer count, run the file in a loop with the rest of the suite alongside it, and read `lock.ts` for whether its acquire is atomic on win32 - `store.ts` already carries a comment about rmSync behaving differently there, so the platform has bitten this codebase in this area before.
