---
id: TASK-the-upkeep-discards-a-failed-state-write-by-design-and
type: task
title: the upkeep discards a failed state write by design, and nothing counts how often that happens
status: active
severity: soft
always: false
summary: A background component quietly gives up on recording what it did, and the only evidence is a stray file nobody looks at.
summary_of: 4026c3d1221fdccb
scope:
  - src/core/ui-server-upkeep.ts
tags:
  - v2
  - ui
  - observability
  - "plan:governance"
  - "seq:4"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-06
valid_until: null
checksum: a7ea7d7807b2a494
plan: governance
seq: "4"
state: todo
priority: "3"
---

# the upkeep discards a failed state write by design, and nothing counts how often that happens

Found 2026-09-06 while checking why port 58888 went down for six seconds. It had NOT been killed by
a lane - the audit row says the server "reported its own code stale, so it was stopped and started
again", which is ui-server-upkeep doing exactly its job while three lanes edited src/ui files.

THE FINDING IS WHAT TURNED UP BESIDE IT. `writeState` in src/core/ui-server-upkeep.ts writes
`<target>.tmp-<pid>` and renames it over the target, inside a try/catch whose comment reads "a clock
that could not be written is one the next call re-derives". The reasoning above it is sound and
explicit: a discarded write costs one extra spawn attempt at worst, and the floor is restored as
soon as one write succeeds. That design is not what this item disputes.

WHAT IT DISPUTES IS THAT THE FAILURE IS INVISIBLE. Nothing counts these. The only trace a failed
write leaves is the temp file it did not rename, and nothing cleans those up either:

  MEASURED: 9 orphaned ui-server-upkeep.json.tmp-<pid> files, every PID dead, oldest 2026-09-03,
  newest the same day - roughly three per day over three days. All 209-224 bytes.

At three a day this is litter and nothing more, and .my_context/state/ carries a .gitignore of `*`
so none of it reaches the repository. The reason to record it anyway is that the RATE is the signal
and nobody is reading it. Nine failures a day is a healthy mechanism; nine thousand is a floor that
has stopped holding and a server being respawned far more often than once a minute - and BOTH look
exactly the same from outside, because the only difference is a number of files in an ignored
directory that nobody counts.

CORROBORATING, and it is why this is worth more than a tidy-up: at the moment of writing, the live
state read `"spawnPending": true, "consecutiveSpawnFailures": 1, "lastOutcome": "restarted-stale"`
while the server was demonstrably answering 200 on 58888. A record that says a spawn is pending and
has failed once, describing a server that is up, is what a discarded write looks like from the
outside.

WHY THIS MATTERS TO THE OWNER SPECIFICALLY: the server on 58888 is his, and "never restart it" is a
standing instruction to every lane. The upkeep is the one component licensed to restart it, and its
restraint - once a minute at most - is enforced by a state file whose write can fail silently.

SMALLEST HONEST FIX, and this is a suggestion rather than a ruling: unlink the temp on the failure
path, and count the failures somewhere a person can see. Neither changes the deliberate decision to
discard the write.
