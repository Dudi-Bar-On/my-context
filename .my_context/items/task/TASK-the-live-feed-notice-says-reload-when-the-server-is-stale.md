---
id: TASK-the-live-feed-notice-says-reload-when-the-server-is-stale
type: task
title: The live-feed notice says reload when the server is stale, and reload cannot help
status: active
severity: soft
always: false
summary: When a page is newer than the server answering it, the live-feed warning tells the reader to reload, which cannot fix it, instead of pointing at the restart that can.
summary_of: 8d32720397504f20
scope: []
tags:
  - ui
  - live
  - disclosure
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-11
valid_until: null
checksum: 782b4482ec74b369
---

# The live-feed notice says reload when the server is stale, and reload cannot help

Owner report 2026-09-12: the strip says `watch.streamNotLive` — 'the live feed is not running — reload to reconnect' — and reloading does not help. His server process has been running since 2026-09-11 01:56; `src/ui/server.ts` and much of `src/core/` have changed under it. Server modules load once at startup; `src/ui/public/` is read from disk every request. So every reload produces today's client against yesterday's server, for ever.

The product already knows this state and already has the sentence for it: `ex.codeSkew`, served as `staleCode` on `/api/ping` and `/api/meta`, drawn by `showCodeSkew()`. Two defects keep it from reaching him.

1. `showLiveState()` picks between `watch.streamFault` and `watch.streamNotLive` on `liveProven` alone. It never consults the skew fact, so it offers the one remedy that provably cannot work — a reload — in the one state where a restart is the remedy.

2. The two disclosures overwrite each other. `banner()` does `replaceChildren` on `#exited`, so `showCodeSkew`, `showDisconnected` and `showExited` are one slot; and `request()`'s ok-branch hides `#exited` when `disconnectedShown`. `showCodeSkew`'s own comment already records this. The message that would explain the failure can be wiped by the one that cannot help, and only the 60s heartbeat puts it back.

Make the stream's own notice consult the skew state before telling him to reload, without a second request, and without weakening either disclosure — `codeSkewDismissed` stays a module-level, non-persisted flag that a reload restores.
