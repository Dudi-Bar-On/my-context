---
id: TASK-the-archive-shows-what-is-on-disk-now-because-nothing-has
type: task
title: the archive shows what is on disk now, because nothing has ever refreshed it
status: active
severity: soft
always: false
summary: The list of saved conversations keeps itself up to date instead of showing whatever it happened to hold the last time somebody rebuilt it by hand.
summary_of: be356a8ca189827e
scope:
  - src/core/conversation-index.ts
  - src/ui/**
tags:
  - v2
  - archive
  - ui
  - "plan:archive"
  - "seq:14"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-08
valid_until: null
checksum: f1d5235960bf6f8c
plan: archive
seq: "14"
state: todo
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
