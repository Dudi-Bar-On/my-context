---
id: TASK-the-loading-state-is-a-correct-terminal-sounding-label-held
type: task
title: the loading state is a correct terminal-sounding label, held for up to seven seconds
status: active
severity: soft
always: false
summary: While data is loading the screen says it has not been read, which reads as a final answer rather than a wait.
summary_of: b4d6afb3e6ea498d
scope:
  - src/ui/public/app.js
  - src/ui/public/strings/**
tags:
  - v2
  - ui
  - loading
  - measured-zero
  - "plan:walk"
  - "seq:150"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 14660ca729447076
plan: walk
seq: "150"
state: todo
priority: "2"
---

# the loading state is a correct terminal-sounding label, held for up to seven seconds

Raised by report 1 (`reports/2026-09-12-the-ui-reviewed-as-a-user.md`, 3.2) as row 51 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT WAS MEASURED. The loading state is the two words "not read yet", held for as long as the data takes -- measured at 796 ms, 345 ms, 272 ms, and about 7 s on a first boot (row 18).

WHY IT IS A DEFECT RATHER THAN A WORDING PREFERENCE. "Not read yet" is a CORRECT STATE LABEL in this product's vocabulary -- it is one of the three states the measurement vocabulary distinguishes, and both UI reviews named that vocabulary the project's signature. Used as a loading state it reads as a TERMINAL CONDITION: the user concludes nothing will arrive.

THE SUBJECT. D46 is "absent is not zero -- a blank says why it is blank". Here the blank says why, and says the wrong why.
