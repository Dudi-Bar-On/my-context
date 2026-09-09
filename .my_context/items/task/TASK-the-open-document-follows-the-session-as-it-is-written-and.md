---
id: TASK-the-open-document-follows-the-session-as-it-is-written-and
type: task
title: the open document follows the session as it is written, and only moves the reader who is already at the end
status: active
severity: soft
always: false
summary: A conversation you are reading keeps up with the session while it is still being written, so new turns arrive at the bottom on their own - and a reader who has scrolled up is told there are new turns rather than dragged down to them.
summary_of: 69b49cff6b479603
scope:
  - src/ui/**
  - src/core/conversation-index.ts
tags:
  - v2
  - archive
  - ui
  - "plan:archive"
  - "seq:19"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-08
valid_until: null
checksum: 71044232e0320cf3
plan: archive
seq: "19"
state: done
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

LANDED 2026-09-08, in the same lane as the seq:7 remainder.

BUILT AS RECOMMENDED: a screen-local timer in mountDocument at 5 s, gated by shouldPing so a
background tab stops asking, dying with the document on hash change. The global heartbeat was not
touched and nothing was added to /api/ping. A new GET /api/conversations/:id/tip is the cheap
probe; the outline endpoint gained at/from/node and reads the appended tail through the startByte
option on iterateTranscript. Freshness is (bytes, mtimeMs), the index own key.

THE 60s RULING BIT EXACTLY WHERE THIS ITEM AIMED IT, and the first implementation FAILED it. A
route that does the stat and not the sweep is not automatically cheap: resolving the file through
rowFor measured 1.930 ms per call, of which 1.917 ms is opening SQLite - the statSync itself is
0.007 ms - only to learn a path. At a 5 s timer that is 23 ms/min, FOUR TIMES the 6.24 ms/min that
measureCorpusDrift spends, which is the budget the 60s ruling exists to protect. Resolving from
listTranscriptFiles instead costs 0.057 ms: 0.68 ms/min per open document, an order of magnitude
UNDER the sweep. The resumed outline is 2.722 ms / 512 bytes against 258 ms / 884 KB for a whole
walk.

THAT IS THE ONE THING THIS ITEM OWN BODY DID NOT SAY, and it is worth carrying forward: the
expensive thing on a cheap freshness route is not the syscall, it is whatever the route has to
open in order to know WHICH file to stat.

THE NAMED NODE IS REBUILT, NOT SKIPPED - it may be an open work run that the append extended - and
at/from/node are all-or-nothing, because a defaulted node would renumber the reader document in
silence.

atTail() IS NODE-BASED, as this item warned it had to be: the last view row is the one the
viewport bottom lands in, never scrollTop + clientHeight >= scrollHeight, which was never
available over a virtualised scroll. At the tail it appends and follows; scrolled up it appends,
DOES NOT MOVE, and shows a tvnew button reading N new below.

A BUG THE LANE INTRODUCED AND CAUGHT ITSELF, kept here because it is the instructive kind: the
outline returned an unfloored mtimeMs while tip floored it, so a client would have read its own
rounding as this transcript was replaced - the loudest possible way to be wrong about a file that
had not changed. Both floor now, guarded by a test asserting the outline and the tip report the
SAME mtime for the same file.

PINNED BY: e2e/conversations.spec.ts - at the end of the file, a new turn arrives on its own, and
a reader who has scrolled up is told, not dragged - both languages, driven in a real browser
against a transcript the test appends to itself.
AMENDED 2026-09-09: THE REPLACED BRANCH NO LONGER SENDS HIM TO F5. Owner report, reading a session
and meeting `conv.doc.replaced` - "This transcript was replaced rather than added to ... Reload the
page to read it as it stands." - and his ruling was to fix it.

THE DIAGNOSIS WAS RIGHT AND ONLY THE REMEDY WAS WRONG. A transcript only ever appends, so a smaller
file, or the same length with a new mtime, is a REWRITE and every byte offset the open document
holds points somewhere else. Saying so was honest, and the `resync` discipline this item stole from
watch-model.ts is still the right instinct. What could not stand is that the only way forward was
F5, on the one screen whose entire purpose is that nobody has to press it.

AND THIS ITEM'S OWN RULE DECIDED WHO GETS WHICH ANSWER, which is why the repair needed no new
policy: the follow moves only the reader who is already at the end, and `atTail()` is the gate the
ordinary append already runs through. At the tail, `rebuildReplaced` re-reads the full outline and
redraws against the file as it now stands, and the following carries on. Above the end, nothing
changed at all - the notice stands and the follow stops, because rebuilding under a reader who is
mid-document would move their place, which is what
TASK-a-refresh-keeps-the-reader-s-place-or-it-asks forbids and what this item already refused once
for the ordinary append.

NO CHIP SAYING "REBUILT", DELIBERATELY. There is nothing for the reader to decide, and a mark like
that is a claim that decays - true for a second, then noise. app.js makes the same argument for not
drawing a "live again" chip when the shared stream recovers. `conv.doc.replaced` is kept, for the
mid-document case only, and no string was added in either table.

WHAT A REBUILD HAS TO THROW AWAY, and every one of them is load-bearing: `bodies`, `known` and
`inflight` are keyed by node index against the OLD file, so a survivor would draw one file's text at
another file's position - the hole this branch exists to refuse, one layer in. The marked passage
goes for `applyFilter`'s stated reason: a passage marked on a document that no longer exists must
not be copyable. `seenBytes`/`seenMtime` are re-seated from the rebuild, or the next tick fires the
same branch for ever.

THE PRUNED BRANCH IS UNTOUCHED - a file that is gone is not a file that moved - and a rebuild that
comes back `truncated` falls back to the notice, because the mount path refuses to follow a
truncated document at all and the reader is owed the reload that carries the truncation disclosure
with it.

ONE DEFECT THIS EXPOSED IN THE ORIGINAL BUILD, worth carrying because it was invisible while the
only answer was a reload: the head's title, branch and SIZE were drawn once at mount. A rebuilt
document would have sat under a head stating the size of a file that no longer exists - worse than
the notice it replaced, because nothing on the page would have said so. `fillHead()` is now a
function and both paths call it.

PINNED BY: e2e/conversations.spec.ts - a transcript replaced under the reader - its own harness,
home, cwd and transcript, because that block REPLACES its file while the six tests above it append
to theirs. The at-the-tail test was MEASURED NON-VACUOUS rather than assumed: with the one
`atTail()` line removed, both browser projects go red on the first rebuild assertion, still showing
the record the replaced file ended on. The scrolled-up test is deliberately green either way - it is
the guard that the repair did not widen past the reader it was ruled for.
