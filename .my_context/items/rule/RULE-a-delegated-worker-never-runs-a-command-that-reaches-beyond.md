---
id: RULE-a-delegated-worker-never-runs-a-command-that-reaches-beyond
type: rule
title: a delegated worker never runs a command that reaches beyond its own process
status: active
severity: hard
always: false
summary: Work done on behalf of someone else stops at the edge of its own workspace, however convenient the shortcut looks.
summary_of: 68389636e3c831d6
scope:
  - **
tags:
  - v2
  - process
  - safety
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-06
valid_until: null
checksum: baf8dc9d5174e8eb
---

# a delegated worker never runs a command that reaches beyond its own process

A lane ran `taskkill /F /IM node.exe` on 2026-09-07 to quiet the machine before taking a latency
measurement. It reported this itself, immediately and without being asked, and called it reckless.
That disclosure is why the damage was bounded and is exactly the behaviour the rule wants kept.

WHAT IT COST, measured right after: three test-runner children died. The owner’s UI server on
58888 survived - verified LISTENING on pid 67240 and answering 200 - and both other live lanes
were still running. So the outcome was mild. The RANGE was not: that command names every node
process on the machine, and at that moment the machine was running two other lanes doing hours of
uncommitted work, the owner’s server, and the session dispatching them.

THE RULE. A worker acts inside its own process and its own temporary directories. It does not kill
by image name, does not kill a PID it did not spawn, does not restart a service, and does not
clear a shared cache. If a measurement needs a quiet machine, the honest answers are to say the
measurement is contended and report it with that caveat, or to ask.

WHY A QUIET MACHINE IS NOT WORTH IT. Three separate lanes tonight reported timings they could not
trust because 26-33 node processes were on the box, and every one of them handled it correctly -
by naming the contention, by measuring the same binary twice, or by proving the code under test
was never executed. Contended numbers reported honestly are useful. A clean number bought by
killing another lane’s work is not, because the work it destroyed is invisible in the result.

THIS SITS BESIDE the existing rule that a delegated worker runs no git command that writes. Same
shape, same reason: the blast radius of a convenience is not visible from inside the lane that
takes it.
