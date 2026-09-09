---
id: TASK-the-reader-own-ctrl-c-still-gives-the-browser-rendered-form
type: task
title: the reader own ctrl+c still gives the browser rendered form, and the default is a button away
status: active
severity: soft
always: false
summary: Pressing the usual copy key still copies what the screen looks like, not the clean text, so a reader has to know to use the new buttons.
summary_of: c97dfd52f3c31d97
scope:
  - src/ui/public/screens/conversations.js
tags:
  - v2
  - archive
  - ui
  - "plan:archive"
  - "seq:42"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-09
valid_until: null
checksum: 3cc40a24578fd677
plan: archive
seq: "42"
state: todo
priority: "2"
needs: archive/17
---

# the reader own ctrl+c still gives the browser rendered form, and the default is a button away

Filed 2026-09-09 by the lane that built `TASK-a-selected-passage-copies-as-something-a-terminal-will`,
which ruled that the DEFAULT form is MESSAGE TEXT and left the affordance to the lane. The lane
shipped three buttons and NO keyboard shortcut, and this is the part of that decision that is the
owner's rather than a lane's.

WHAT SHIPPED. Three controls in the document's bar, named by what they are for - "to paste into a
prompt", "to paste as it looks", "the exact record" - armed the moment something is marked. The
first is the default the item rules and it is filled from the RECORD.

WHAT DID NOT SHIP, AND THE READER'S HABIT IS THE WHOLE PROBLEM. `Ctrl+C` was NOT intercepted. So a
reader who marks a passage and presses the key they have pressed for thirty years gets the browser's
own copy, which is the RENDERED form - the speaker's name, the timestamp, a fold's summary line
instead of its records, whitespace as CSS collapsed it, and nothing at all from the rows the
virtualised document has not drawn. That is not a regression; it is what the page did yesterday. It
is also exactly the outcome the item exists to steer him away from.

WHY IT WAS LEFT, and it is one obstacle rather than a judgement about what he wants. The `copy`
event is SYNCHRONOUS: `event.clipboardData.setData` has to be called before the handler returns, and
MESSAGE TEXT over a passage that spans undrawn rows needs a round trip - measured, 10 requests and
207 ms for a 274-section passage on his own transcript. An interception that sometimes served the
record and sometimes fell through to the browser would be the worst of the three: the same key
producing two different formats with nothing on screen saying which.

THREE WAYS TO CLOSE IT, cheapest first, none of them chosen here:

  1. PRE-FETCH ON SELECTION. When a passage is marked, fill `bodies` for it in the background; then
     a `copy` handler has everything it needs synchronously and can serve MESSAGE TEXT. Costs
     requests the reader did not ask for on every drag, which is why it was not simply done.
  2. INTERCEPT ONLY WHEN COMPLETE, and say so. Serve the record when every marked section is
     cached, and otherwise let the browser copy and put a sentence in the status line saying which
     form the key just gave. Honest, and it makes one key mean two things.
  3. LEAVE IT, and teach the buttons. The screen already carries a sentence explaining which of the
     three to reach for.

WHAT REVERSING COSTS EITHER WAY: a `copy` listener on the well, roughly twenty lines, plus whichever
of the three above is chosen. Nothing shipped has to be undone.

## Relations
- depends_on [[TASK-a-selected-passage-copies-as-something-a-terminal-will]]
