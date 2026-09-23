---
id: TASK-the-tutorials-read-model-reports-an-unreadable-repository
type: task
title: the tutorials read model reports an unreadable repository file as one that does not exist yet
status: active
severity: soft
always: false
summary: When a tutorial checks whether a file in the repository exists or contains a phrase, a file it cannot read is reported the same way as a file that was never created.
summary_of: cb79e8c1ee1e81a0
scope: []
tags:
  - "plan:release"
  - "seq:32"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-23
valid_until: null
checksum: 79084eab936b7fe9
plan: release
seq: "32"
state: todo
---

# the tutorials read model reports an unreadable repository file as one that does not exist yet

Found by task 4.6 and confirmed by its reviewer on 2026-09-23 (TASK-nine-sites-report-a-measured-zero-for-something-they-could, the same class as its nine sites): repoFileExists and repoFileContains in src/ui/read-model-tutorials.ts (around lines 120-141) catch every error and answer 'unmeasured', which the tutorial step draws as 'does not exist yet'. EACCES, a directory in the file's place, or a junction that cannot be followed are not absence. Closing condition: the two helpers answer three ways - exists, absent, could not read (with the errno and path) - the step draws the third as unmeasured with its reason in the shape task 4.6 gave heRollup, and a test plants a file in a directory's place and asserts the step is not told 'not yet'. Files: src/ui/read-model-tutorials.ts, src/ui/public/screens/library.js if the step's drawing needs the third state, their tests. Release phase 5.
