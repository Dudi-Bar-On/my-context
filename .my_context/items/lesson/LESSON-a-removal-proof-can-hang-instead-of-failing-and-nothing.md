---
id: LESSON-a-removal-proof-can-hang-instead-of-failing-and-nothing
type: lesson
title: a removal proof can hang instead of failing, and nothing reaps it
status: active
severity: soft
always: false
summary: Proving a test by breaking the code can leave a test run spinning for ever, so every such run needs a time limit and the thing that started it must kill it.
summary_of: 29a28e77f422903e
scope:
  - test/**
  - scripts/**
tags:
  - v2
  - testing
  - lanes
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-11
valid_until: null
checksum: 9db51e2ed8cb402c
---

# a removal proof can hang instead of failing, and nothing reaps it

MEASURED 2026-09-11. A removal proof left a node test runner spinning for 495 CPU-MINUTES —
about eight and a quarter hours of one core — and it was found by the owner noticing it on his
terminal, not by anything in this project.

WHAT HAPPENED. The `plan:walk seq:122` lane ran its proofs the normal way: mutate one line, run
the test, record whether the target assertion reddened, restore the bytes. One of those runs did
not fail — IT HUNG. The runner had been invoked with `--test-timeout=0`, which is Node’s spelling
for "no timeout", so it waited for ever. The lane restored the file, reported, and completed. Its
parent shell exited. Nothing reaps an orphan on Windows, so the child kept a core busy from 05:21
until it was killed at 13:50.

THE HAZARD IS INHERENT TO THE TECHNIQUE AND NOT TO THAT LANE. A removal proof deliberately puts
the code into a state nobody designed — a guard deleted, a loop emptied, a constant made absurd.
Three outcomes are possible, not two: the assertion reddens (the proof), the assertion stays green
(a finding), and THE RUN NEVER ENDS. The third is the one no report mentions, because a lane that
is waiting has nothing to report yet, and a hang looks exactly like a slow pass until somebody
reads a CPU column.

It is also the most likely third outcome in this repo specifically: mutations here empty loops,
disable break conditions and neuter guards, and several suites poll, watch files or hold a server.

WHAT TO DO, and it is one flag: EVERY REMOVAL-PROOF RUN CARRIES A TIMEOUT. `--test-timeout=60000`
is ample for any single file in this suite — the slowest legitimate file measured is well under
that — and a proof that trips it is REPORTED AS A HANG rather than silently retried, because
"this mutation made the suite hang" is itself a finding about the code.

AND THE HARNESS KILLS WHAT IT STARTS. A proof harness that spawns a runner owns that process: it
waits with a deadline and kills the child on timeout, on its own exit, and on failure. Do not rely
on the shell dying to take the run with it — on Windows it does not.

THE DISPATCHER SHARE OF THIS. Eight lanes were briefed to run removal proofs before anybody wrote
this down, and not one brief mentioned a timeout. The technique was specified precisely and its
failure mode was not specified at all. A brief that asks for hundreds of mutate-run-restore cycles
must say what happens when one of them does not come back.

WHAT IT COST, so the size is on the record rather than the feeling: one core for eight hours while
four other lanes and a Playwright suite were competing for the same machine, and the owner watching
a progress line that had been stale for most of a working day.
