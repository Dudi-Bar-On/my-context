---
id: TASK-the-open-document-follows-the-session-as-it-is-written-and
type: task
title: the open document follows the session as it is written, and only moves the reader who is already at the end
status: active
severity: soft
always: false
summary: A conversation you are reading keeps up with the session while it is still being written, so new turns arrive at the bottom on their own - and a reader who has scrolled up is told there are new turns rather than dragged down to them.
summary_of: e921a2ee7a816caf
scope:
  - src/ui/**
  - src/core/conversation-index.ts
tags:
  - v2
  - archive
  - ui
  - "plan:archive"
  - "seq:19"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-08
valid_until: null
checksum: a60b1bea820780a7
plan: archive
seq: "19"
state: todo
priority: "1"
needs: archive/13,archive/14
---

# the open document follows the session as it is written, and only moves the reader who is already at the end

Owner ruling 2026-09-08: "if the session is updated and the browser is opend on the current session,
update the browser to so if i am at the end of the file i could see the changes live near real time
asap" - and, amending it a minute later, "the same way the web status bar is updated".

THE AMENDMENT NAMES THE PRECEDENT, AND IT IS THE RIGHT ONE. The strip is filled by the heartbeat:
`src/ui/public/app.js` - `stopHeartbeat = startHeartbeat(` - a client timer that calls `/api/ping`
and folds the answer into the strip. It is already session-scoped (`pingQuery()` sends `?session=`,
re-read every tick so a reader who changes session does not keep a strip live for one nobody is
looking at), and already visible-only (`src/ui/public/lib/heartbeat.js` - `export function
shouldPing` - a background tab stops pinging, so a forgotten tab cannot hold the server up past one
idle window). Both of those are properties this screen needs and neither has to be invented.

AND THE ROUTE ALREADY STATES THE DESIGN THIS REQUEST WANTS. `src/ui/server.ts` -
`registerRoute('GET', '/api/ping'` - carries the sentence: "it is cheap enough to be asked on every
heartbeat, so the expensive refill happens only on the ticks where the reading actually moved."
That is exactly the shape here. The cheap probe is one `stat()` on the transcript; the expensive
refill is reading the new tail. Nothing about this request needs a new idea.

THERE IS A SECOND LIVE MECHANISM, AND IT SHOULD NOT BE THE ANSWER. `/api/watch/stream`
(`src/ui/watch-model.ts` - `function streamHandler`) is a real SSE feed over `AuditTail`. It works,
but it holds a socket open per tab, and the whole `kind: 'stream'` idle carve-out in the dispatch
loop exists to keep that from pinning the process alive. Do not grow a second long-lived socket for
a READ surface when a poll the page already runs will do. Steal one thing from it and only one: its
`resync` discipline - when the tail cannot be trusted, SAY SO on the channel and let the screen
refetch, rather than showing a hole.

THE EXPENSIVE HALF IS ALREADY BUILT, WHICH IS WHY THIS IS SMALL. `iterateTranscript`
(`src/core/conversation-index.ts` - `export function* iterateTranscript`) already takes `startByte`,
`startIndex` and a `cursor`, and its own header says why: a walk over BYTES rather than a decoded
split, because "this project's own corpus is half Hebrew: every offset after the first such record
would be wrong, and wrong SILENTLY". Resuming an append-only file from the last offset is a
supported call TODAY. An append therefore costs the append, not the 64 MB - and on the owner's
transcript that difference is the whole feature.

THE FRESHNESS KEY IS ALREADY CHOSEN, AND IT IS seq:14'S. The index stores `bytes` and `mtime_ms`
per session and uses `(bytes, mtime_ms)` as its freshness key. This item and seq:14 are the same
probe with two consumers - seq:14 refreshes the LIST, this refreshes the OPEN DOCUMENT. If this
lane invents a second notion of "the file moved", the list and the document will disagree about it,
and that disagreement is precisely the class of defect seq:14 was filed for. One probe, two readers.

THE REAL DECISION IS THE CADENCE, AND IT HAS A RULING AGAINST IT ALREADY. The heartbeat is 60s and
that number "was RULED rather than inherited": the occupancy read is 0.32ms and "would be affordable
far faster", but `measureCorpusDrift` rides the same request and its once-a-minute budget is the
argument that ruled out a file watcher at all - so "the interval stands", and a second timer was
refused as "a second cadence to keep in step".

Sixty seconds is not "near real time asap", so that ruling has to be met rather than stepped around.
It can be, and the note itself says how: 60s is defended because the SWEEP on that request is
expensive, not because polling is. What makes 60s sufficient there is stated too - "the sample under
it is rewritten once per assistant message" - and THAT argument does not transfer, because a
transcript gains records many times within a single turn. The recommendation is a screen-local timer
that lives and dies with the conversation document, asks a route that does the `stat()` and NOT the
drift sweep, and keeps `shouldPing`'s visible-only rule. Whatever is chosen, do not shorten the
global heartbeat, and do not put the transcript `stat()` on `/api/ping` - that is the multiplication
the existing ruling refuses.

THE HARD PART IS THE READER'S PLACE, NOT THE TRANSPORT. "if i am at the end of the file" is a
CONDITION, and it binds in both directions:
  - AT THE TAIL: append and follow, so the reader watching their own session sees it arrive.
  - SCROLLED UP: append and DO NOT MOVE. Offer "N new" and let them choose. A reader dragged to the
    bottom mid-sentence has been punished for reading, which is the same wrong seq:15 names about
    losing your place.
And "at the end" is not `scrollTop + clientHeight >= scrollHeight` here: the document is virtualised
(that is what the byte offsets bought), so the rows near the end may not be in the DOM. This is the
same anchor problem as seq:15's cursor return and seq:17's copy mapping, and the three should be
solved once rather than three times.

ONE ODDITY TO DESIGN FOR RATHER THAN DISCOVER: the session on screen may be the session writing the
record of it being on screen. The document grows BECAUSE it is being looked at. That is fine at
runtime and fatal to a test written against the live session - the fixture has to be a transcript
the test appends to itself, under INSTR-testing-happens-against-the-current-corpus-and-an-exception's exception rather than
against it.

DEPENDS ON seq:13 for the document to update and seq:14 for the probe. It must not be dispatched
alongside seq:14: both touch the conversations screen, the read model and both string tables.
