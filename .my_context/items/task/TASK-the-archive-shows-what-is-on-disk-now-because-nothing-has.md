---
id: TASK-the-archive-shows-what-is-on-disk-now-because-nothing-has
type: task
title: the archive shows what is on disk now, because nothing has ever refreshed it
status: active
severity: soft
always: false
summary: The list of saved conversations keeps itself up to date instead of showing whatever it happened to hold the last time somebody rebuilt it by hand.
summary_of: 84880066ce64d74f
scope:
  - src/core/conversation-index.ts
  - src/ui/**
tags:
  - v2
  - archive
  - ui
  - "plan:archive"
  - "seq:14"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-08
valid_until: null
checksum: 09eff7a81ba4f46f
plan: archive
seq: "14"
state: done
priority: "1"
---

# the archive shows what is on disk now, because nothing has ever refreshed it

Found 2026-09-08 by the owner, looking at the screen: his current session was missing hours of
content. Measured, it is worse than he thought.

THE INDEX SAID HIS SESSION ENDED 2026-09-07T00:50. The file was 64,506,161 bytes and had been
written to that minute. It was OVER A DAY STALE.

ROOT CAUSE: NOTHING REBUILDS THE INDEX, EVER. The only caller of rebuildConversations is
src/cli/commands/conversation.ts - the `mycontext conversation rebuild` command. The screen serves
the INDEX, not the file, so it shows whatever was there the last time a person ran that by hand.
On this workspace that was during the archive lane’s own work the day before.

AND THE FIX IS CHEAP BECAUSE THE TRANSCRIPT ONLY EVER APPENDS. The index already stores `bytes` and
`mtime_ms` per session and already uses (bytes, mtime_ms) as its freshness key. So one stat() says
whether it is behind, and a refresh only ever has to read the NEW TAIL - not the 64 MB.

WHAT TO DECIDE RATHER THAN ASSUME: where the refresh fires. Rebuilding on every page load would
scan on a read surface, which this project does not do lightly. Candidates: on opening the screen,
incrementally; on the upkeep pass that already runs; or an explicit refresh control beside a
staleness line. A STALENESS LINE IS REQUIRED WHATEVER IS CHOSEN - a cache that is behind and does
not say so is how this was invisible for a day.

AND IT IS NOT ONLY COSMETIC: plan:restore seq:1 and the self-improvement loop both read this index.
A stale index means the loop would learn from a day-old transcript and never know.

LANDED 2026-09-08, and two claims in the body above are corrected rather than left standing.

THE REFRESH FIRES ON THE Stop HOOK, once per assistant turn, and only ever on an index that
ALREADY EXISTS - a hook that built one on first sight would silently opt every workspace with
this plugin installed into indexing its transcripts. The three other candidates were rejected
with evidence: opening the screen is impossible (test/ui/no-writes.test.ts holds the write
bindings under src/ui/ to an exact set of one), the UI-server upkeep writes nothing unless
`ui.port` is set, and SessionEnd never reaches the one session that showed the defect - the
owner’s own, still running.

CORRECTION, AND IT NARROWS THIS ITEM’S OWN CONSEQUENCE CLAIM. The body says plan:restore seq:1
and the self-improvement loop read this index. THEY DO NOT: `src/core/session-summary.ts` walks
the transcript file and never opens `ConversationIndex`. The stale index never reached the loop.
What was stale was the LIST - counts and end times; the document a reader opens was always
current, because it walks the file.

MEASURED on the 65 MB transcript, catching up the real 11,231,042-byte gap: tail re-read
11,304,713 bytes in 44 ms against a full re-read of 65,119,997 in 178 ms, and `stat` alone over
the whole directory in 0.449 ms. The Stop binary is 164 ms at HEAD against 166 ms with this.

WHAT IS STILL OWED, AND IT IS THE ONE THING THIS ITEM CALLED REQUIRED: the staleness line is
built (`conv.behind`, `conv.behindRow`, `conv.current`, both languages) and has NO browser test -
`e2e/conversations.spec.ts` was not touched. It is a required deliverable of the next lane on
this screen, and it is named here so a reader does not read this closure as covering it.
