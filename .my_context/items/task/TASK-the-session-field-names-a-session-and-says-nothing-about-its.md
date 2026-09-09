---
id: TASK-the-session-field-names-a-session-and-says-nothing-about-its
type: task
title: the session field names a session and says nothing about its size or how many lanes ran under it
status: active
severity: soft
always: false
summary: The status line says how large the current conversation is and how many helper agents have run under it, beside the name it already shows.
summary_of: c141ef47e095e7d9
scope:
  - src/cli/commands/statusline.ts
  - src/ui/server.ts
  - src/ui/public/app.js
tags:
  - v2
  - ui
  - statusline
  - "plan:archive"
  - "seq:44"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-09
valid_until: null
checksum: 94173df583d89642
plan: archive
seq: "44"
state: done
priority: "2"
needs: archive/12
---

# the session field names a session and says nothing about its size or how many lanes ran under it

Owner ruling 2026-09-09: "nwo staus line shows SESSION MyContext V2.0, we could add here the
session size and the amount of subagents files, if you agree". Agreed, and filed with the route
measured rather than assumed.

BOTH FACTS COME FROM DISK, NOT FROM THE INDEX, and that is the whole of the design. Measured on his
own session:

    stat the transcript                    0.021 ms   ->  72.6 MB
    readdir this session’s subagents/       1.011 ms   ->  260 files
    open the index and count the same       6.738 ms

SEVEN TIMES CHEAPER WITHOUT THE DATABASE, and the comparison that matters is not the ratio but the
budget: `measureCorpusDrift` spends 6.24 ms/min and that number is the argument that ruled out a
file watcher for this whole product. A 6.738 ms index open on the statusline path would spend a
minute’s entire allowance in one call. `stat` plus `readdir` costs 1.03 ms.

AND THERE IS A SECOND REASON THE INDEX IS THE WRONG SOURCE HERE, which is stronger than the cost:
the statusline runs in workspaces that were NEVER SCANNED. plan:archive seq:9 established that
off-by-default is enforced in three places - `ConversationIndex.open` has one caller inside
`rebuildConversations`, which has two callers, and no read surface can build one. A statusline that
opened the index would read as opting a workspace in. Reading the filesystem works whether the
archive was ever built or not, which is the only behaviour that is correct in both cases.

THE COUNT IS THE TRANSITIVE TOTAL, AND THAT IS A CONSEQUENCE OF THE CHEAP ROUTE RATHER THAN A
CHOICE. 260 files sit in that directory: 218 dispatched by the session and 43 dispatched by another
lane. Depth lives in the `agent-<id>.meta.json` sidecars, so a `readdir` cannot separate them
without opening 260 files. The total is also the more useful number - "260 lanes ran under this
session" is the fact a reader wants from a status line - but the item must SAY it is the total, so
nobody later reads it as the session’s own dispatches and finds it disagreeing with
`conversation subagents`.

SPACE IS THE REAL CONSTRAINT AND IT IS NAMED IN AN EARLIER ITEM: the status line is the tightest
space in the product. It already carries MODEL, REPO, BRANCH, CWD, CORPUS, the ctx reading, AUDIT
and CLOCK. Proposed:

    SESSION  MyContext V2.0 · 72.6 MB · 260 lanes

about twenty characters onto a field that holds a name today. MEASURE THE RENDERED WIDTH before
committing - and decide what drops first when the terminal is narrow, because something must.

TWO SURFACES, AND THEY ARE NOT THE SAME CODE. `mycontext statusline` draws the terminal line from
the payload Claude Code hands it; the web strip is filled by the heartbeat through `/api/ping`. The
owner asked for both. The terminal side already has the session id in its payload, so it can find
the directory directly. The web side must not grow a new request: `/api/ping` is where
`pingOccupancy` already answers a session-scoped question, and its own comment states the design -
"cheap enough to be asked on every heartbeat". Both facts belong on that answer, not on a route of
their own.

FOUR THINGS THAT MUST NOT BREAK:
  - `/api/ping` STAYS A READ. `test/ui/no-writes.test.ts` holds it to that, and it was strengthened
    on 2026-09-09 with a `WRITES_WITHOUT_FS` set after it was found unable to see a `node:sqlite`
    writer at all.
  - A MISSING DIRECTORY IS ZERO LANES, NOT AN ERROR. A session that dispatched none has no
    `subagents/` directory - `listSubagentFiles` already answers that way and never throws. And
    zero must be DRAWN rather than omitted, under
    STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is. Note that
    `STD-absent-vs-zero` is a nickname resolving to no item; do not cite it.
  - AN UNREADABLE SIZE IS `unmeasurable`, NOT ZERO. A `stat` that fails is a different fact from a
    0-byte transcript, and the strip already distinguishes those two states elsewhere.
  - THE TERMINAL LINE IS THE OWNER’S SCREEN. `mycontext statusline` is installed over his own
    status line, so a change here changes what he looks at all day. Keep the existing fields in
    their existing order.
