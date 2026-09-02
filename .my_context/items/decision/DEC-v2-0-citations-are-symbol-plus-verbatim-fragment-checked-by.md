---
id: DEC-v2-0-citations-are-symbol-plus-verbatim-fragment-checked-by
type: decision
title: v2.0 citations are symbol plus verbatim fragment, checked by a script
status: active
severity: soft
always: false
summary: Design documents quote code by an exact snippet rather than a line number, and a script checks every quote still exists and repairs the hints that moved.
summary_of: c51af1480404b89c
scope: []
tags: []
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-18
valid_until: null
checksum: 2ce438a9daee7c5e
---

# v2.0 citations are symbol plus verbatim fragment, checked by a script

Design documents cite code as: file, a VERBATIM source fragment, and a ~line hint. Not file:line.

scripts/verify-citations.ts (npm run verify:citations) resolves every fragment in the named file, exits non-zero naming any row that misses, and rewrites the ~line hint when a fragment has merely moved. Zero dependencies, native TS, runs locally.

Taken because the three web-UI plans went stale silently: 186 citations against base commits that are not ancestors of HEAD, with the first two sampled off by 136 and 42 lines. Changing the notation alone would fix this instance and leave the next drift as quiet as this one.
