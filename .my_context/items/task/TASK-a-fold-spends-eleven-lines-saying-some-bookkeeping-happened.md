---
id: TASK-a-fold-spends-eleven-lines-saying-some-bookkeeping-happened
type: task
title: a fold spends eleven lines saying some bookkeeping happened, and eight of those rows can never hold anything
status: active
severity: soft
always: false
summary: Opening the machinery under a turn shows the steps that did something, with the harness bookkeeping counted on one line instead of filling the list.
summary_of: c025eee33fc36b04
scope:
  - src/ui/read-model-conversation-document.ts
  - src/ui/public/screens/conversations.js
tags:
  - v2
  - archive
  - ui
  - "plan:archive"
  - "seq:39"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-09
valid_until: null
checksum: 1cc084167e098daa
plan: archive
seq: "39"
state: done
priority: "1"
needs: archive/28
---

# a fold spends eleven lines saying some bookkeeping happened, and eight of those rows can never hold anything

OWNER RULING 2026-09-09, shown a real fold from his own session:

    11 machine steps
      31357  result
      31358  last-prompt
      31359  custom-title
      31360  ai-title
      31361  agent-name
      31362  mode
      31363  permission-mode
      31364  atis-latch
      31365  frame-link
      31366  bridge-session
      31367  attachment · total_tokens_reminder

He asked "is this ok ?" and, shown what those rows are, ruled: COUNT THEM AS ONE LINE.

EIGHT OF THOSE ELEVEN TYPES CAN NEVER SHOW ANYTHING. Measured on his transcript: bridge-session
1,307, mode 1,303, permission-mode 1,303, atis-latch 1,303, ai-title 1,302, custom-title 1,273,
agent-name 1,273, frame-link 887 - 9,951 records of pure harness bookkeeping. Add last-prompt’s
1,305, whose content plan:archive seq:28 deliberately leaves unread because it restates a prompt the
document already draws as its own turn, and it is 11,256 records - ABOUT 36% OF THE TRANSCRIPT
EXISTING AS ROWS WITH NOTHING IN THEM.

SO THE FOLD HAD STOPPED DOING ITS JOB. plan:archive seq:13 promoted the fold precisely so a reader
sees the CONVERSATION and can open the machinery when they want it, and seq:28 then made the
machinery worth opening by recovering 6.0 MB nothing had read. The unintended result is a fold whose
contents are mostly rows that say only their own type - eleven lines to report that some
bookkeeping happened.

WHAT TO BUILD: the contentless bookkeeping types collapse to ONE counted line inside the fold,
naming the types it covers. Any record carrying content keeps its own row.

AND NOTHING IS DROPPED, which is why this is a rendering change and not a classification one:
`sum(span) === records` is asserted and must still hold. The records stay in the node’s span and
stay counted; only their drawn form collapses. He was offered dropping them from the fold entirely
and did NOT choose it - that option would have broken the assertion, and the item records that he
was shown the cost and declined it.

TWO THINGS TO DECIDE RATHER THAN ASSUME:
  - WHICH TYPES QUALIFY, derived rather than listed. A hard-coded list of eight names rots the
    moment the harness adds a ninth - and it has 19 types in this transcript alone. The honest test
    is whether a record yielded any drawable content after seq:28’s field sweep, which is a fact the
    read model already computes.
  - WHETHER THE COLLAPSED LINE IS OPENABLE. A reader who wants the ids of the nine has nowhere to
    go otherwise, and INV-nothing-is-dropped-silently is about what a reader can reach, not only
    about what a count says. A second fold inside a fold may be worse than the problem; say which
    and why.
