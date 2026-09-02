---
id: TASK-measure-fs-watch-on-this-platform-before-replacing-the-poll
type: task
title: measure fs.watch on this platform before replacing the poll
status: active
severity: soft
always: false
summary: Before switching from checking a file every second to being notified of changes, measure whether those notifications are actually reliable here.
summary_of: 7bf0e8dc3c9cfadf
scope: []
tags:
  - v2
  - ui
  - live
  - "plan:live"
  - "seq:5"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-27
valid_until: null
checksum: 4a5648a125814048
plan: live
seq: "5"
state: done
priority: "2"
source: owner, 2026-08-27
---

# measure fs.watch on this platform before replacing the poll

The owner asked for events rather than a scheduler, and preferred it explicitly. The CLIENT side already is event-driven -- SSE, pushed, no polling in the browser. What polls is the SERVER, once a second, over one append-only file.

Replacing that with `fs.watch` is the "events" answer, and it should be MEASURED before it is adopted rather than assumed to be better:

  - does it fire reliably for an append to an open file on Windows?
  - does it fire for a rotation (the audit log rotates at 8 MB)?
  - what is the latency against the 1-second poll it replaces?
  - what does it do when the watched directory is replaced wholesale?

A poll that is a second late is a known quantity. A watch that misses an event is a page that is silently wrong, which is the failure this whole plan exists to end. So: measure, and if the watch wins, keep the poll as the floor beneath it rather than deleting it -- belt and braces on the one path whose failure is invisible.
