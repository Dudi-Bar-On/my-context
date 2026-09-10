---
id: TASK-the-reader-own-ctrl-c-still-gives-the-browser-rendered-form
type: task
title: the reader own ctrl+c still gives the browser rendered form, and the default is a button away
status: active
severity: soft
always: false
summary: Pressing the usual copy key still copies what the screen looks like, not the clean text, so a reader has to know to use the new buttons.
summary_of: 39f3654eaa114af7
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
checksum: ab4611e602b0816d
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

RULED 2026-09-10 BY THE OWNER: OPTION 1, PRE-FETCH ON SELECTION. He was given the four options in
plain words - the three this item names and a fourth, fetch-on-keypress, added because it was the
one shape the item had not considered - and chose to fetch as the passage is marked.

SO Ctrl+C SERVES MESSAGE TEXT, ALWAYS, AND THE KEY MEANS ONE THING. That is the whole reason option
1 wins over option 2: this item already argues that a key which sometimes serves the record and
sometimes falls through to the browser is the WORST of the three, because the same gesture produces
two formats with nothing on screen saying which. His ruling removes the ambiguity rather than
labelling it.

WHAT IT COSTS, stated rather than discovered later: requests the reader did not ask for, on every
drag that marks undrawn rows. The measurement this item already carries bounds it - 10 requests and
207 ms for a 274-section passage on his own transcript - and that is the worst case for a very large
mark, not the typical one. The cost is paid only while marking, and only for what was marked.

AND OPTION 4 WAS DECLINED WITH THE OTHERS, so it is not re-proposed: fetch on the keypress instead
of on selection spends nothing until a copy actually happens, but it puts the delay INSIDE the
gesture - the reader presses a key that has been instant for thirty years and waits. He preferred to
spend the request early and keep the key instant.

WHAT TO BUILD, and the item already names the shape: a `copy` listener on the well, roughly twenty
lines, plus the pre-fetch. Nothing that shipped has to be undone - the three buttons stay exactly as
they are, and Ctrl+C serves what the FIRST of them serves, because that is the default this item’s
parent already ruled.

THREE THINGS THE LANE THAT BUILDS IT MUST NOT GET WRONG:
  - THE `copy` EVENT IS SYNCHRONOUS. `event.clipboardData.setData` must be called before the handler
    returns. That is the constraint that made this item exist, and pre-fetching is what satisfies it
    rather than working around it.
  - IF THE PRE-FETCH HAS NOT LANDED YET, the handler must still be honest. A copy that silently
    serves a partial record is worse than the browser’s own, because it looks right.
  - THE CLIPBOARD FORMATS ARE ALREADY RULED by the parent item and by seq:17. Ctrl+C is a new
    AFFORDANCE for an existing format, not a fourth format.

## Relations
- depends_on [[TASK-a-selected-passage-copies-as-something-a-terminal-will]]
