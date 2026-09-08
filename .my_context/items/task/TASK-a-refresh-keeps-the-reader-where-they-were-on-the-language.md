---
id: TASK-a-refresh-keeps-the-reader-where-they-were-on-the-language
type: task
title: a refresh keeps the reader where they were, on the language toggle and after a command runs
status: active
severity: soft
always: false
summary: Running a command or switching language no longer throws away the command you were building.
summary_of: 9e02a27c99a193b2
scope:
  - src/ui/public/app.js
  - src/ui/public/lib/**
  - e2e/**
tags:
  - v2
  - ui
  - "plan:screens"
  - "seq:25"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-08
valid_until: null
checksum: 7c902037869bea45
plan: screens
seq: "25"
state: todo
priority: "1"
---

# a refresh keeps the reader where they were, on the language toggle and after a command runs

Owner ruling 2026-09-08. This APPLIES a decision he has already taken rather than making a new one:
DEC-a-refresh-keeps-the-reader-s-place-or-it-asks. He chose KEEP THE PLACE.

THE DEFECT, measured by plan:builder seq:11 while executing writes from the Composer: run any
command and the live refresh calls render(), which builds a fresh <select>, and a fresh <select>
opens on PALETTE[0]. The chosen entry and every filled field are gone. Probe output:
  PROBE line: mycontext edit ADR-build-rather-than-adopt --title "Probe title X" --yes
  PROBE +0ms    select=ack
  PROBE +6000ms select=ack

IT IS ONE ROOT CAUSE, NOT TWO. e2e/composer-bidi.spec.ts already reported the same loss on the
LANGUAGE TOGGLE and deliberately declined to fix it, calling it a shell design question. It is the
same rebuild. Fixing the shell fixes both, and fixing only the execute path would leave the toggle
losing state for the same reason - which is how a defect gets two half-fixes and no closure.

SO THIS IS SHELL WORK, NOT COMPOSER WORK. It belongs where render()/route() rebuild a screen, not
inside builder.js, and it must not be folded into a Composer task.

IT SITS BETWEEN TWO RULINGS AND MUST SATISFY BOTH:
RULE-a-screen-shows-the-new-state-after-the-reader-acts-on-it (the refresh has to happen - the whole
point of running a write is seeing what changed) and the decision above (the reader keeps their
place). Both hold: refresh the DATA, preserve the READER’S SELECTION AND INPUT.

AND THE TEST ALREADY EXISTS IN NEGATIVE: composer-bidi.spec.ts pins the loss by assertion today.
That assertion must be INVERTED rather than deleted, the way builder seq:15 inverted the Run rule so
it could not be reintroduced.
