---
id: TASK-refusefileentry-echoes-a-path-with-no-bound-and-a-path-is-a
type: task
title: refuseFileEntry echoes a path with no bound, and a path is a different trade
status: active
severity: soft
always: false
summary: Error messages quote file paths from a stranger's file at unlimited length; shortening them needs a decision, since a cut path is useless.
summary_of: 254e3120f1bfc185
scope: []
tags:
  - "plan:export"
  - "seq:21"
  - v2
  - "state:doing"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-24
valid_until: null
checksum: bfd0595d1da20db9
state: doing
plan: export
seq: "21"
---

# refuseFileEntry echoes a path with no bound, and a path is a different trade

Measured 2026-08-24 while bounding the five echoes in plan:export seq:20, and deliberately left alone.

Four branches of `refuseFileEntry` and `refuseArtefactPaths` echo unbounded, all reachable from a stranger's `manifest.json`: an unknown key of 5,000 characters prints 5,379; a non-string `path` prints 7,075; a bad `sha256` prints 5,284; and a 5,000-character path through `revoice` prints 5,336.

WHY IT WAS NOT DONE WITH THE OTHERS, and this is the whole item: those branches quote PATHS. A receiver needs the WHOLE path to find the file the refusal is about, so truncating one is a different trade from truncating a name - and the rules for a path belong to `layout.ts`, not to the echo bound. Capping at 256 would produce refusals a reader cannot act on.

OPTIONS: cap much higher than 256 with the same visible marker; cap the MIDDLE and keep both ends, which is what a path actually needs; or rule that a path is echoed whole and bound the input instead, at `layout.ts`'s own validation. The middle option is the one a reader would thank you for.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: STANDS, and it was correctly left rather than swept -- the reasoning is sound and should not be overridden by a later agent tidying the other four echoes. Four branches reachable from a STRANGER S manifest.json echo unbounded, up to 7,075 characters. But they quote PATHS, and a receiver needs the WHOLE path to find the file a refusal is about, so capping at 256 would produce refusals a reader cannot act on. The rules for a path belong to layout.ts, not to the echo bound. This is a real trade needing a decision, not an oversight -- and it is a security surface, since the input is a stranger s file.
