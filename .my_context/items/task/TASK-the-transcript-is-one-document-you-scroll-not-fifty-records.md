---
id: TASK-the-transcript-is-one-document-you-scroll-not-fifty-records
type: task
title: the transcript is one document you scroll, not fifty records you cannot leave
status: active
severity: soft
always: false
summary: A saved session opens as one continuous scrollable view of the whole conversation instead of a first page you cannot move past.
summary_of: 3702a2ab69512c36
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
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-07
valid_until: null
checksum: b8fa1a01a89c4255
plan: archive
seq: "7"
state: done
priority: "1"
verified_on: 2026-09-10
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

NO CAP IN THE DOCUMENT VIEW — OWNER RULING 2026-09-08, on seeing the screen say so.

The viewer prints "A turn longer than 60000 characters is shown up to there and says so; tool
output, up to 4000." His ruling: "if there is a size restriction it must be removed, i want no
restriction or limitation."

AND THE CAP DOES NOT NEED DEFENDING BECAUSE THE DELIVERY MECHANISM CHANGES. Those numbers are the
bounds of an endpoint that hands a whole page to the browser at once, and they are honest bounds for
that shape - src/ui/read-model-conversations.ts discloses every one of them as a FIELD rather than
truncating silently, which is why he could read the sentence at all. What this item replaces is the
shape: a VIRTUALISED document fetches ranges on demand, so nothing has to be handed over whole and
there is nothing for a cap to protect.

SO THE CAP IS REMOVED BY BUILDING seq:7, NOT BY RAISING A NUMBER. Raising 60000 to a bigger number
would keep the defect and move it: a turn longer than the new number would still be cut, and the
reader would still be told about it. Deleting the cap while still shipping whole pages would hand a
64 MB session to a browser in one response.

WHAT MUST SURVIVE: the DISCLOSURE habit. If any limit remains anywhere - a fetch size, a render
budget - it is named on the screen as a field, never hidden. INV-nothing-is-dropped-silently. A
viewer that quietly stops rendering is worse than one that says where it stopped.

CLOSED 2026-09-08. The virtualised document landed in b15a9ea; the no-cap ruling landed now, in
the lane that also built seq:19.

THE CAP HAD NEVER BOUND ANYTHING, which is a worse finding than it being set wrong. Measured on
the owner transcript - 66,976,537 bytes, 28,998 records, 5,076 nodes - the largest said node is
24,605 characters, 41% of the 60,000 cap, and ZERO of 2,533 said nodes exceeded it. The sentence
on his screen was disclosing a truncation that had never once occurred. 41 of 28,998 steps (0.14%)
exceeded the 4,000 step cap.

WHAT REMOVING THEM COSTS, measured rather than assumed: +90 KB on the worst 24-node window a
reader can ask for (101,267 bytes capped against 191,671 uncapped), over loopback. The largest
single record in the file is a 1,229,510-byte base64 image in a tool_result, which contributes no
text either way. The largest thing the DOM now holds is one 58,888-character pre block inside a
details element that starts closed.

AND THE DISCLOSURE FIELDS WENT WITH THE CAPS, because a disclosure that can never fire is dead
code: textTruncated, thinkingTruncated, DocStep.totalChars, and saidTextCap/stepTextCap off both
the outline and nodes endpoints. DocNodeBody.totalChars stays - on a work node it is the real
total for the run rather than a restatement of one field.

ONE CAP SURVIVES THIS RULING AND IT IS NOT AN OVERSIGHT: CONVERSATION_TEXT_CAP on
/api/conversations/:id, the WHOLE-PAGE records endpoint. This item own body keeps it - deleting
the cap while still shipping whole pages would hand a 64 MB session to a browser in one response.
That endpoint currently has no caller; if it is ever pointed at a screen again, its cap is worth
re-asking about then.

PINNED BY: test/ui/conversation-document.test.ts - a long turn and a long tool result come back
WHOLE - which asserts a 90,000-character turn and a 12,000-character step survive intact AND that
the disclosure fields are ABSENT rather than merely false.
