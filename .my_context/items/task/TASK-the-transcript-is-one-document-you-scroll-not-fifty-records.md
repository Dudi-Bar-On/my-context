---
id: TASK-the-transcript-is-one-document-you-scroll-not-fifty-records
type: task
title: the transcript is one document you scroll, not fifty records you cannot leave
status: active
severity: soft
always: false
summary: A saved session opens as one continuous scrollable view of the whole conversation instead of a first page you cannot move past.
summary_of: a5dcfc6e5ed08032
scope:
  - src/ui/**
  - src/core/conversation-index.ts
  - e2e/**
tags:
  - v2
  - ui
  - archive
  - "plan:archive"
  - "seq:7"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-07
valid_until: null
checksum: a0b5cc051dc928f6
plan: archive
seq: "7"
state: todo
priority: "1"
---

# the transcript is one document you scroll, not fifty records you cannot leave

Carries out REQ-the-conversation-archive-is-a-terminal-you-can-scroll-not-a clause 7: "view the session on a SEQUENTIAL DOCUMENT with markers for
prompts and answers AND NOT BROKEN TO PIECES - user should have a similar experience like SCROLLING
OVER A TERMINAL."

MEASURED ON THE OWNER OWN SESSION, 2026-09-07, which is how this was found: his 51.3 MB transcript
holds 24,757 records. The screen draws "Showing entries 0-50 of 24,757" and THERE IS NO WAY TO REACH
ENTRY 51. conversations.js hardcodes ?limit=50&offset=0; the endpoint accepts an offset the screen
never sends. The screen even tells him there is more: conv.walkCapped says "there is more after
this" and conv.showingAll says "Showing all {total} entries ON THIS PAGE" - a phrase that presumes a
second page the product does not have.

THE FIX IS NOT A PAGER. He was explicit that a pager is not what he asked for, and the design spec
already said "the view must page OR VIRTUALISE"; only the paging half was attempted and then not
built either. VIRTUALISED SCROLLING is the engineering problem: one scrollable document over the
whole session, with only what is on screen in the DOM.

THE MARKERS STAY. The prompt/answer chips built in archive/3 are the one thing the review found
fully correct - chip with glyph, keyed word, logical-start border accent, asserted in both languages
including the RTL edge. Keep them; they are clause 3 of the requirement. What changes is that they
mark positions in a continuous flow rather than heading a page of fifty.

AND THE COUNTING GAP DISSOLVES HERE RATHER THAN BEING FIXED SEPARATELY: 8,969 of his 24,757 records
are classified as prompt, answer or machinery; 15,788 carry no message object and are counted in
none of the three, although the code claims twice that the three account for every record. Those
15,788 ARE the terminal activities of clause 1. A view that does not classify before it draws has no
such gap. Do not "fix the counters" first - decide what the terminal view draws, and let the
headline numbers follow from it.
