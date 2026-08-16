---
id: DEC-focus-discloses-and-allows-rather-than-refusing-to-hide
type: decision
title: Focus discloses and allows, rather than refusing to hide
status: active
severity: soft
always: false
scope:
  - src/core/focus.ts
  - src/core/select.ts
  - src/cli/**
tags:
  - context-control
  - design
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-16
valid_until: null
checksum: 2a55fa531e4a3db1
---

# Focus discloses and allows, rather than refusing to hide

When a session focus excludes an item that a still-visible item depends on, focus **hides it
and reports the cost** — "N items hidden by focus, M load-bearing relations now dangling".
It never silently produces a corpus that contradicts itself, and it never refuses to do what
it was asked.

The alternative was refusing to hide an item a visible one depends on, and it was rejected
for one reason: focus gets weaker the more connected the corpus is. In a well-related corpus
almost everything is reachable from almost everything, so a refusing filter narrows to
nearly the whole corpus, and "why is this still here" becomes the question the user cannot
answer. A closure that pulled hidden dependencies back in has the same defect from the other
side, and adds a worse one: it silently overrides an explicit exclusion.

Load-bearing is defined narrowly: hiding the far end leaves the visible item's own
instruction incomplete or wrongly actionable. blocks, unblocks, depends_on, constrains,
answers, enforces, enforced_by and refines are load-bearing; derived_from, relates_to,
links_to, discovered_by, produced, mitigates, supersedes and superseded_by are referential.
A relation type outside that table counts as load-bearing, so an unfamiliar edge is
over-reported rather than missed. mycontext focus --relations prints the table.

Two limits are part of the decision rather than of the implementation. Focus never hides a
severity:hard item, and says how many it kept for that reason. And the disclosure appears in
the injected block itself, not only in a command's output: a disclosure only a command
prints is a disclosure for the person who already knew.

## Relations
- supersedes [[OPENQ-how-do-filters-respect-dependencies]]
