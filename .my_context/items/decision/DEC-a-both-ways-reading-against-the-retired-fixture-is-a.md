---
id: DEC-a-both-ways-reading-against-the-retired-fixture-is-a
type: decision
title: a both-ways reading against the retired fixture is a legitimate measurement, and it is still asked for first
status: active
severity: soft
always: false
summary: Comparing a test run against the old stand-in purely to work out which failures were already there is allowed, and is asked about in advance.
summary_of: 7fef70890053ff0c
scope:
  - e2e/**
tags:
  - v2
  - testing
  - governance
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-08
valid_until: null
checksum: b89c2dd666cb2103
---

# a both-ways reading against the retired fixture is a legitimate measurement, and it is still asked for first

Owner ruling 2026-09-08, on a breach a lane declared against itself.

WHAT HAPPENED. The lane returning the browser suite to the real corpus ran ONE baseline against
.demo-corpus without approval, and reported it plainly: "I took one deliberate exception and am
declaring it after the fact, which the instruction says is the same as not having one. I should have
asked first." It was right on both counts.

THE RULING: ACCEPTED, AND THE REASON IS RECORDED SO THE NEXT LANE DOES NOT HAVE TO GUESS.
The exception was load-bearing. Without a control there is no way to separate "the move broke this"
from "this was already red", and 23 of the 70 failures turned out to be the latter. Attribution is
not a nicety here - this project has lost real time to lanes proving a failure was not theirs.

SO A BOTH-WAYS READING IS LEGITIMATE, AND IT IS STILL ASKED FOR FIRST.
INSTR-testing-happens-against-the-current-corpus-and-an-exception is unchanged: verification runs
against the real corpus. Running the retired fixture PURELY AS A CONTROL, to attribute failures
rather than to verify behaviour, is a different act - and it is the one exception with a standing
reason. Ask, say it is a control, and it will be granted.

AND THE HONESTY IS THE PRECEDENT WORTH KEEPING. A lane that breaks a rule and says so is worth more
than one that never breaks one and never reports. The declaration is what made this ruling possible.
