---
id: REQ-a-served-page-reflects-the-corpus-as-it-changes-without
type: requirement
title: a served page reflects the corpus as it changes, without being reloaded
status: active
severity: soft
always: false
summary: A page keeps itself up to date as things change instead of waiting to be reloaded, without losing the reader's place or hiding a dead connection.
summary_of: a68e1630f911797e
scope: []
tags:
  - v2
  - owner-requirement
  - ui
  - live
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-27
valid_until: null
checksum: 6da10cb4ee802762
kind: functional
---

# a served page reflects the corpus as it changes, without being reloaded

OWNER REQUIREMENT, 2026-08-27: "refresh server pages when there are changes any kind including injections, audit, corpus changing and everything else, either it should be done on a scheduler basis or triggered by events (preferred)".

MOST OF THE MACHINERY EXISTS AND ONE SCREEN OUT OF TWENTY-TWO USES IT. Measured today:

  - `GET /api/watch/stream` is a real SSE stream, reached through `ctx.stream()` in `app.js` over `lib/sse.js` -- a fetch-based parser rather than `EventSource`, because the session token has to travel in a header.
  - The server tails the audit log at `STREAM_POLL_MS = 1000` and pushes every new record.
  - **The audit log is ALREADY the universal change feed.** Its seven kinds cover the whole of what he listed: `mutation` is the corpus changing, `injection` is what a session was shown, `hook` includes `file-changed`, plus `focus`, `access`, `progress` and `execution`.
  - **`watch.js` is the ONLY consumer.** The other twenty-one screens never learn that anything happened.

So this is not "build a live-update system". It is "one screen has one, and the shell should own it."

WHAT MUST BE TRUE:

1. **ONE stream for the whole shell**, opened once and shared. Twenty-two screens opening twenty-two connections against a server whose idle monitor deliberately does not count a stream as activity is a different product.
2. **A screen DECLARES what invalidates it**, and a gate holds every screen to having an answer. A blanket re-render on any record is a stampede: hooks write records on every tool call, so an idle session still produces a steady stream of them. Coverage cares about mutations; the injection preview cares about injections; Watch cares about all of them. "Nothing invalidates me" is a legal answer and must be written down as one.
3. **BURSTS ARE COALESCED.** Records arrive in clumps -- one mutation is several rows. Re-rendering per record thrashes; the refresh is debounced and the debounce is stated.
4. **THE READER DOES NOT LOSE THEIR PLACE.** A screen that silently re-renders under someone reading it takes away their scroll position, their open pane and their selection. That is the cost this requirement must not pay to satisfy itself. See DEC-a-refresh-keeps-the-reader-s-place-or-it-asks.
5. **A DEAD STREAM SAYS SO.** The idle monitor reaps the server after eight hours and an open stream does not prevent it, so a page can end up quietly frozen and looking merely quiet. STD-a-measured-zero-is-drawn-and-named applies exactly: a page that has stopped hearing is not a page where nothing is happening. `watch.js` already draws a stream fault; the shell's version owes the same.

THE GAP THIS DOES NOT CLOSE, stated rather than discovered later: **an edit made outside Claude Code produces no audit record.** `file-changed` is a Claude Code HOOK, so it fires only while a session is running; a Markdown item edited in another editor with no session open changes the corpus and appends nothing. Either the server watches `.my_context/items/` itself, or that limit is disclosed. It must not be left to be inferred from a page that did not update.

ON "EVENTS RATHER THAN A SCHEDULER", which is what he asked for: the client side already IS event-driven -- SSE, pushed. The 1-second poll is server-side, over one append-only file, and it is the thing an `fs.watch` would replace. That is worth doing and it is worth measuring first: `fs.watch` is unreliable on some platforms and silently misses events on network drives, and a change feed that misses is worse than one that is a second late. Poll-with-disclosure is the honest default until `fs.watch` is measured on this platform.
