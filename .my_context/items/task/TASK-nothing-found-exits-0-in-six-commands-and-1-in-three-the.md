---
id: TASK-nothing-found-exits-0-in-six-commands-and-1-in-three-the
type: task
title: nothing found exits 0 in six commands and 1 in three, the split is broken twice and written down nowhere
status: active
severity: soft
always: false
summary: Commands disagree about whether finding nothing counts as a failure, the rule is inconsistent in two places, and it is not written down anywhere.
summary_of: 92c3264a614bb121
scope:
  - src/cli/**
tags:
  - v2
  - cli
  - exit-code
  - contract
  - "plan:cliscript"
  - "seq:4"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 6e6610eb3f3f3ef7
plan: cliscript
seq: "4"
state: done
priority: "2"
---

# nothing found exits 0 in six commands and 1 in three, the split is broken twice and written down nowhere

Raised by report 6 (`reports/2026-09-13-store-cli-mcp-and-gates-reviewed.md`, C5) as row 59 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT WAS MEASURED. "Nothing found" exits 0 in six commands and 1 in three. That split is DEFENSIBLE -- an empty result is not a failure, a missing target is -- and it is broken twice:

- `rules list` exits 1 because a FILE was unreadable, while the same damage to a corpus item is a warning at exit 0 in the same binary.
- THE CONTRACT IS WRITTEN DOWN NOWHERE, so there is nothing for a new command to be checked against and nothing a script author can read.

THE SUBJECT. An exit code is the one thing a script reads without parsing anything. The work here is to state the contract and then derive or gate it, not to change nine commands by hand.
