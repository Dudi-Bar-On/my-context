---
id: TASK-the-reader-own-ctrl-c-still-gives-the-browser-rendered-form
type: task
title: the reader own ctrl+c still gives the browser rendered form, and the default is a button away
status: active
severity: soft
always: false
summary: Pressing the usual copy key still copies what the screen looks like, not the clean text, so a reader has to know to use the new buttons.
summary_of: 3fdeb890c6b91584
scope:
  - src/ui/public/screens/conversations.js
tags:
  - v2
  - archive
  - ui
  - "plan:archive"
  - "seq:42"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-09
valid_until: null
checksum: 3e1c45b0bbd7b559
plan: archive
seq: "42"
state: done
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


BUILT 2026-09-10, EXACTLY THE RULING AND NOTHING BESIDE IT. A `copy` listener on the well
(`onCopy`) plus the pre-fetch (`runPrefetch`/`schedulePrefetch`), in
`src/ui/public/screens/conversations.js`. The three buttons were not touched. The one refactor is
`messageForm`, which splits BUILDING message text from FETCHING it, so the button and the key emit
the same bytes from one builder rather than two spellings of one format - and a browser test asserts
that byte for byte in both languages.

WHAT THE PRE-FETCH ACTUALLY COSTS, measured in both browser projects rather than carried over from
the number above: a 231-section passage with 211 of its rows never drawn cost 8 REQUESTS and
137-182 ms, over four runs. The item's own bound - 10 requests and 207 ms for 274 sections on the
owner's transcript - is confirmed, not contradicted: the same ~1 request per 27 sections, and the
cost lands entirely while marking. Nothing is spent for a passage the reader can already see,
because the fill asks only for what `bodies` is missing, and nothing at all above
`PASSAGE_NODE_CAP`, where a copy refuses anyway. The settle is 90 ms, which is the one number the
ruling did not fix: `selectionchange` fires on every mouse move of a drag, so asking per event would
spend a request per pixel.

WHEN THE PRE-FETCH HAS NOT LANDED THE KEY REFUSES, and it refuses IN THE PAYLOAD as well as on the
screen - `conv.copy.keyNotYet`, in both string tables. It does NOT fall through to the browser, which
is the ambiguity this ruling deleted, and it does not serve a partial record, which
`INV-nothing-is-dropped-silently` calls worse than the browser's own because it looks right. A key
that changed nothing on the clipboard would leave the reader's PREVIOUS copy there to be pasted, so
the refusal is written rather than withheld. Over the cap it refuses the same way, with
`conv.copy.keyTooMany`. Both refusals re-arm the fill, so the reader's next press is the record -
driven in a test that holds `/nodes` for two seconds, presses inside the hold, and presses again
after it.

`bodies` IS NOT MONOTONIC AND THE HANDLER NEVER ASSUMES IT IS. `refill` deletes the tail node's body
when a partial record is replaced (seq:19) and `rebuildReplaced` clears the map outright, so
readiness is re-read from `bodies` on every press rather than remembered in a flag.

EVIDENCE. Four new tests in `e2e/conversations.spec.ts`, green on BOTH projects: the key over a
231-section passage with 211 undrawn rows, asserted undrawn BEFORE the key is pressed and asserted
again against the browser's own `Selection.toString()`, which reaches none of the 42 turns the key
delivered; the refusal-then-record pair above; the Hebrew page, where the payload carries no
direction mark; and `/lane.html`, because `seq:51` imports `mountDocument` and forks nothing. PROVED
BY REMOVAL, twice: deleting the `copy` listener reddened all four in both projects (8 failures);
deleting only the ON-SELECTION fill - leaving the keypress re-arm, which is the declined option 4 -
reddened the load-bearing one in both projects while the others stayed green, which is what isolates
the ruling from the shape it beat.

## Relations
- depends_on [[TASK-a-selected-passage-copies-as-something-a-terminal-will]]
