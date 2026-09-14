---
id: TASK-every-write-on-conversations-throws-focus-to-the-document
type: task
title: every write on Conversations throws focus to the document body, so a keyboard user walks 24 stops back
status: active
severity: soft
always: false
summary: After saving a change the cursor jumps to the very top of the page, so anyone working by keyboard has to travel all the way back each time.
summary_of: 11f19baa37f8401b
scope:
  - src/ui/public/screens/conversations.js
tags:
  - v2
  - ui
  - focus
  - write-flow
  - "plan:confirm"
  - "seq:1"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: bff640d42b1bf7b4
plan: confirm
seq: "1"
state: done
priority: "2"
---

# every write on Conversations throws focus to the document body, so a keyboard user walks 24 stops back

Raised by report 2 (`reports/2026-09-13-the-ui-reviewed-round-two.md`) as row 24 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT WAS MEASURED. Every new write on the Conversations screen throws focus to `document.body` -- sampled at every interval from 150 ms to 6 s after the write, always the same. After marking, after renaming and after dropping, a keyboard user is returned to the top of the document and walks 24 tab stops back to where they were.

THE COMPARISON THAT MAKES IT A DEFECT AND NOT A GAP. The OPENING half of each of those same flows moves focus into a labelled input correctly. Report 2 calls this out as new work that got focus management right; the write half then discards it.

THE SUBJECT. These are the newest write flows in the product and the question they all share is whether the screen tells you the write landed -- by where focus goes, by what is announced, by what can be undone, and by reading the answer the server actually sent.
