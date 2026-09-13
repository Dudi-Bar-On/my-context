---
id: TASK-the-icon-sprite-test-has-never-been-able-to-fail-and-it
type: task
title: the icon sprite test has never been able to fail, and it scans neither of the real consumers
status: active
severity: soft
always: false
summary: One of the checks that is supposed to catch missing icons compares an empty list with an empty list, so it has never been capable of failing.
summary_of: d516150250c1dc86
scope:
  - test/ui/icon-sprite.test.ts
  - src/ui/public/index.html
  - src/ui/public/screens/parts.js
tags:
  - v2
  - tests
  - gate
  - vacuous
  - "plan:gates"
  - "seq:1"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 885a13dc67543d63
plan: gates
seq: "1"
state: todo
priority: "1"
---

# the icon sprite test has never been able to fail, and it scans neither of the real consumers

Raised by report 3 (`reports/2026-09-12-silent-failures-reviewed.md`, B11) as row 11 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT WAS MEASURED. `test/ui/icon-sprite.test.ts` has NEVER been able to fail. Its regex matches neither of the two `href="#i-` strings in the file it scans, so `used` is always `[]` and the assertion reduces to `deepEqual([], [])`.

AND IT IS SCANNING THE WRONG FILE. The real consumers of the sprite are `index.html` and `parts.js` · the sprite consumer (line 595), and neither is scanned by anything.

WHY IT IS A BLOCKER RATHER THAN A TEST BUG. This project's own doctrine is that "a checker is not verified until it has been made red". A gate that cannot go red is worse than an absent one, because the suite's green is read as evidence the sprite is covered. This is the vacuous member of the three ways a gate can be green over red; the other two are unwired gates and report-only gates.
