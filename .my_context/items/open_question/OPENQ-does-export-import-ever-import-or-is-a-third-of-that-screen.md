---
id: OPENQ-does-export-import-ever-import-or-is-a-third-of-that-screen
type: open_question
title: does Export / import ever import, or is a third of that screen permanently a description of an act this product cannot perform?
status: active
severity: soft
always: false
summary: Will bringing material in ever be possible here, or is a third of that screen permanently a description of something the product cannot do?
summary_of: bdcee763b61ea901
scope: []
tags:
  - v2
  - ui
  - "screen:port"
  - proposed
  - walk
  - security
origin: agent
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-29
valid_until: null
checksum: 60cee8b79fb4865f
blocks: "the import-buckets card on Export / import, and the size of plan:walk seq:89"
---

# does Export / import ever import, or is a third of that screen permanently a description of an act this product cannot perform?

Raised 2026-08-29 under plan:walk seq:5. `plan:walk seq:89` ruled deliberately that building an import surface is *"a different decision and not this one"* and filed nothing for it. This is that decision, filed.

**WHAT IS BUILT.** `/api/port` serves what an export CARRIES — six root rows, the audit-kind split, three format rungs, three bucket names and an argv — and `screens/port.js` draws all of it plus a composed `mycontext export --out …` block. Export ships; its read model is exercised against a real artefact written into a temp directory.

**WHAT IS NOT.** The third card, `port.coll`, is a third of the screen. It names the three buckets an import sorts an artefact into and there is no request on `/api/port` that takes one. `src/ui/port-model.ts` gives the reason and it is a boundary rather than an oversight: the two modules that would answer it bind the mutation surface and the writer, and the read server may not load either. So the bucket NAMES are served and drawn, the mockup's three example ids beside them are illustrations the endpoint says cannot be served, and every Example cell draws an em dash. The column head stays because the column is the design of record's.

**WHY THIS IS NOT THE SAME QUESTION IT WAS.** When that boundary was written the UI had no POST at all. It has one now: `POST /api/execute` runs a catalogue command behind a rendered confirm and a single-use nonce bound to the exact id and argv. *"This server never writes"* is therefore no longer the shape of the answer, and an import could reach the reader without `pack/import.ts` ever entering the read server's import graph.

**THREE ANSWERS, and the screen reads differently under each:**

1. **NEVER.** The card is documentation of what the CLI does, the dashes are permanent and correct, and the whole remedy is the key plan:walk seq:89 asks for — one sentence saying there is nothing to read yet.
2. **THROUGH THE CATALOGUE.** `mycontext pack import` becomes a catalogue entry the reader confirms, and the buckets fill from the record that import writes. No second write path in the server, and the boundary that already exists is the one that holds.
3. **A REAL IMPORT SURFACE.** A route that takes an artefact path and previews the buckets before anything is applied — a new write path, a new traversal surface, and a new gate to get right.

**RECOMMENDATION: 2**, and it is the same ruling as the open question about the three copy-only command blocks, so answer them together. It fills the cells with the reader's own data, keeps every write behind the one confirmed boundary this product has already built and defended, and adds no route.

**IF THE ANSWER IS 1, RECORD IT.** The dashes are then correct forever, plan:walk seq:89's key is the entire remedy, and that task is a far smaller piece of work than it currently reads as. Leaving this unanswered is what makes a third of a shipped screen unreadable as either finished or unfinished.
