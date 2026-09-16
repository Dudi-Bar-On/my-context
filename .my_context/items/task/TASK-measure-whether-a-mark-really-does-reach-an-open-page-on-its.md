---
id: TASK-measure-whether-a-mark-really-does-reach-an-open-page-on-its
type: task
title: measure whether a mark really does reach an open page on its own, over half an hour of ordinary work
status: active
severity: soft
always: false
summary: "Measured: every bookmark the tool made showed up on screen by itself within a second, and the real delay is that the writer saves them in batches minutes later."
summary_of: 9a7d66008a833a0c
summary_was:
  - 2026-09-16 Watch a real conversation for 30 minutes and check that every bookmark the tool makes shows up on screen by itself.
scope:
  - src/ui/read-model-conversation-document.ts
  - src/ui/public/screens/conversations.js
tags:
  - v2
  - recall
  - "plan:anchors"
  - "seq:14"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-16
valid_until: null
checksum: f6da5e083e9ddbcd
plan: anchors
seq: "14"
state: done
priority: "1"
---

# measure whether a mark really does reach an open page on its own, over half an hour of ordinary work

MEASURED 2026-09-16 by lane AH. Report: reports/2026-09-16-marks-on-the-fly-measured.md

THE MEASUREMENT RAN. 31m41s of VALIDATED observation across five windows — validated
meaning the server was probed up every 5s AND the page's no-reload sentinel was read back
intact. Measured on an EQUIVALENT server (spare ports 59123-59126) reading the same corpus,
same .anchors.jsonl and same live transcript — never the owner's 58888, which cannot be
logged into from a lane and was left untouched. Each server was checked before use: /tip
carried a `marks` object whose `bytes` equalled the store size on disk.

THE ANSWER IS THAT d53fadda WORKS. Five marks were created by the per-turn pass inside the
validated windows. All three MAIN-document marks reached the open page unprompted, with no
reload: median 267 ms, worst 674 ms. Both LANE marks correctly moved the shared store and
the token but did NOT move the main count. ZERO never-seen. The chain was timed link by
link: store changes, /tip token moves in 78-346 ms, the page refetches /anchors, the nav
count repaints. The count arithmetic was exact throughout, 588 -> 590 -> 591.

AND THE OWNER'S OWN HYPOTHESIS IS HALF THE ANSWER. 19 of the 31 measured minutes produced
no mark at all.

THE REAL DELAY IS THE WRITER, NOT THE READER. Comparing each row's own `at` with the moment
the store actually moved: marks are FLUSHED IN BATCHES, and one sat 5m37s between being
stamped and reaching the store (others 1m19s, 2m46s). So "no marks appearing on the fly" is
explained either by none being created or by one still sitting unflushed — never by the
refresh path this item was written to check.

FOUR THINGS TO FIX, none of them d53fadda: (1) the writer's batching, up to 5m37s, is the
only remaining on-the-fly delay; (2) a UI server restart silently kills an open page — the
tab-lived token dies with the process, /tip then fails every second and the page keeps
showing its last count with nothing on screen saying so (observed: a server went down and
came back by itself 7s later); (3) .anchors.jsonl is SORTED BY ID AND REWRITTEN, not
append-only as this item's own brief said — a byte-offset tail reads shifted old rows as
new, which this lane hit and had to correct mid-run; (4) an mtime-only touch with no new
rows still costs a full /anchors refetch.

WHAT WAS THROWN OUT AND WHY, recorded so the numbers are not read as cleaner than they are.
A spare UI server did not stay up: four were started, three exited silently after 6-10
minutes (not idle shutdown — IDLE_MS is 8 hours). The Playwright browser is shared with
another lane and twice navigated this lane's tab away mid-window. Every window touched by
either was discarded rather than scored. The first window (08:15-08:28) is INDETERMINATE
and is counted neither for nor against: a MAIN mark entered the store at 08:22:36.99 and
the page never moved off 584, but that server carried no health probe and its token never
moved once across 732 requests, which is what a dead server looks like.

NOTHING WAS CREATED BY THIS LANE — no mark, no rename, no take-back, no rebuild. Every mark
measured was written by the main session or another lane.
