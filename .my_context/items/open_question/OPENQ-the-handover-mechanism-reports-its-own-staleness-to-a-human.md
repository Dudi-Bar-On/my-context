---
id: OPENQ-the-handover-mechanism-reports-its-own-staleness-to-a-human
type: open_question
title: the handover mechanism reports its own staleness to a human and to no gate
status: active
severity: soft
always: false
summary: Nothing fails when the handover file falls behind the context window; the only signal is a strip a person has to be looking at.
summary_of: 57589ffb778581ac
scope:
  - src/doctor/checks.ts
  - src/core/handover-ask.ts
  - src/hooks/stop.ts
tags:
  - v2
  - governance
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-06
valid_until: null
checksum: 6a9c3f942f370a63
---

# the handover mechanism reports its own staleness to a human and to no gate

Found 2026-09-06, immediately after the staleness bug itself was fixed.

WHAT THE FIX ACHIEVED: `askStep(percent)` and `AskLatch.askedAtPercent` mean the ask now fires on
every whole percent from the threshold up, and the statusline and the web strip both say which
percent the handover was WRITTEN at against the percent the window is at NOW. A human looking at
either surface can see the lag.

WHAT IS STILL TRUE, measured: `askedAtPercent` is read by src/cli/commands/statusline.ts,
statusline-powerline.ts, src/hooks/stop.ts (which sets it), and three UI files. It is read by
NOTHING under src/doctor/. There is no check id matching hand|ask|latch. So the lag is displayed
and never asserted.

WHY THAT MIGHT BE CORRECT AND SHOULD BE RULED RATHER THAN FIXED. Doctor checks the CORPUS - files
on disk, citations, scopes, rosters. `askedAtPercent` is SESSION state in a latch that dies with
the session. A doctor check reading it would be checking a fact about the machine’s current
conversation, which is a different kind of thing from everything else doctor knows, and it would
read differently on every run for reasons no commit caused. That is a real argument for leaving it
exactly where it is.

THE ARGUMENT THE OTHER WAY IS THE HISTORY. This defect survived seven asks and six compactions
with every audit row reading `acted-on`, because `acted-on` proves ORDERING and not CURRENCY. It
was invisible by construction and was found by measuring the corpus’s own history, not by reading
the code. A mechanism whose entire purpose is to be trustworthy at the one moment nobody is
watching is precisely the one that should not depend on somebody watching.

A MIDDLE ANSWER EXISTS and is probably the real candidate: not a doctor check, but an assertion at
the moment the handover is CONSUMED - the restore path already knows both percentages, and a
handover being read is the moment its staleness stops being cosmetic.
