---
id: TASK-two-conversations-screen-notes-are-pinned-only-by-reading
type: task
title: two conversations-screen notes are pinned only by reading the screen's source text
status: active
severity: soft
always: false
summary: Two new notices on the conversations page are proven only by a test that reads the page's code as text, not by driving the page, so a change that keeps the words but stops drawing them would pass.
summary_of: 568baf5381b1b047
scope: []
tags:
  - "plan:release"
  - "seq:34"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-23
valid_until: null
checksum: ea3c2b022c671a31
plan: release
seq: "34"
state: todo
---

# two conversations-screen notes are pinned only by reading the screen's source text

Found by task 4.6 on 2026-09-23 and named by its reviewer: the M6 client half (the secrets pass over a session the server did not read; src/ui/public/screens/conversations.js) and the search-coverage note (M10) are guarded by tests that read conversations.js as source text, because Playwright was barred in phase 4 lanes. Closing condition: one browser spec per note plants the condition (a session the secrets pass could not read; an unbuilt prose index) and asserts the note is drawn where the empty paragraph or the empty result list used to be; the source-text guards may then go. Files: e2e/conversations*.spec.ts. Release phase 6 (UI), lane group browser gates.
