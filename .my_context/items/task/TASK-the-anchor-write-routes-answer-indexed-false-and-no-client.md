---
id: TASK-the-anchor-write-routes-answer-indexed-false-and-no-client
type: task
title: the anchor write routes answer indexed false and no client reads it, so the screen draws Renamed for a rename that did not happen
status: active
severity: soft
always: false
summary: The server says the change did not take effect and the page ignores that, showing a success message for something that never happened.
summary_of: 95c517a2c599a764
scope:
  - src/ui/public/screens/conversations.js
  - src/ui/read-model-conversations.ts
tags:
  - v2
  - ui
  - write-flow
  - silent-failure
  - "plan:confirm"
  - "seq:4"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 0cf82af98e64630b
plan: confirm
seq: "4"
state: todo
priority: "2"
---

# the anchor write routes answer indexed false and no client reads it, so the screen draws Renamed for a rename that did not happen

Raised by report 3 (`reports/2026-09-12-silent-failures-reviewed.md`, M21) as row 42 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT WAS MEASURED. The anchor write routes answer `200 { indexed: false }` and NOT ONE CLIENT CALL SITE READS IT. The relabel path reads only `tookOwnership`, so it draws "Renamed" for a rename that did not happen.

AND THE CODE SAYS THAT IS THE THING IT EXISTS TO FORBID. `conversations.js` · the relabel path’s own comment (line 1156) states exactly this in its own words.

A SECOND ANSWER NOBODY READS at the same module: it replies `200 { indexed: true, anchor: null }` when the row cannot be read back -- a success envelope around an absent result.

THE SUBJECT. The server told the truth. The screen drew a confirmation anyway, because nothing on the client reads the field the server sent to prevent exactly that.
