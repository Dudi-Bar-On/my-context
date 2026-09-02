---
id: DEC-the-id-grammar-is-applied-at-the-disk-load-boundary-refusing
type: decision
title: The id grammar is applied at the disk-load boundary, refusing the item
status: active
severity: soft
always: false
summary: Names are checked once as records are loaded, and a bad one is skipped and named, rather than being checked again in every place a name gets used.
summary_of: c6c7a4039597e2cc
scope: []
tags: []
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-18
valid_until: null
checksum: 3af18845c5d4e0a0
---

# The id grammar is applied at the disk-load boundary, refusing the item

item.ts validates the id read from disk against ID_GRAMMAR. A violating item is excluded and its file named; the rest of the corpus still loads — per item, never per corpus.

Chosen over hardening the ~15 command-composition sites (cli/commands/{edit,review,supersede}, core/{mutate,revision,trust}, doctor/checks.ts, ingest/request.ts, lesson/derive.ts), none of which share a funnel. The codebase already states the principle in the comment above ID_GRAMMAR: 'taken at the boundary rather than at whichever future call site first does it'. It had simply never been applied to the READ boundary.

ID_GRAMMAR accepts uppercase, underscore and dot, so the hand-authored legacy ids that comment protects still load. It rejects the dangerous shapes.
