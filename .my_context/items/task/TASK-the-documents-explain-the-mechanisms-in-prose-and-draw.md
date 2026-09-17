---
id: TASK-the-documents-explain-the-mechanisms-in-prose-and-draw
type: task
title: the documents explain the mechanisms in prose and draw almost none of them
status: active
severity: soft
always: false
summary: Add explanatory diagrams to the system and capability documents, especially for the mechanisms at the heart of the product.
summary_of: 168d88ea39eec017
scope:
  - docs/system/**
  - docs/capabilities/**
tags:
  - v2
  - docs
  - "plan:rulings"
  - "seq:99"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-17
valid_until: null
checksum: 8cc085c50443cdbf
plan: rulings
seq: "99"
state: todo
priority: "1"
---

# the documents explain the mechanisms in prose and draw almost none of them

THE OWNER, 2026-09-17: "review all the generated documents capabilities and system, and add much more explenatory mermaid drawings flows state or what ever diagram it requires to simply and best explain the features especially it is critical for mechanisms that are the heart of the product".

WHERE IT STANDS. `docs/system/` carries eight Mermaid diagrams across seven documents - roughly one per document. `docs/capabilities/` carries very few. README carries good ones that nobody has reused. A mechanism with several moving parts, a lifecycle, or an order that matters is being explained in paragraphs alone.

THE MECHANISMS HE MEANS BY THE HEART OF THE PRODUCT, and each is a shape prose is bad at:
  - INJECTION - what enters a context window, the tiers, the budget, and what spills when it does not fit. A packing problem drawn as prose.
  - THE DOORS - eighteen Claude Code events, which ones deliver and which assert. A lifecycle.
  - THE BOARD - a task declares what it waits for, and readiness is computed from that. A graph.
  - THE ARCHIVE AND ITS SEARCH - a transcript becomes spans becomes an index becomes three readings of one query. A pipeline with a fan-out.
  - ANCHORS - a grammar proposes, a person disposes, and a row lands in a file that is the truth. A flow with an ownership boundary in it.
  - THE VIEWER - a 133 MB document, a windowed read, a virtualised scroll. A data flow.
  - THE GATES AT CREATION - what refuses an item and in what order. A decision tree.
  - THE STORE - already documented in Hebrew with three diagrams; the English side has none.

MERMAID TEXT, NEVER IMAGES. That is not a style preference: these documents are to be re-issued in Hebrew, and a Mermaid diagram translates LABELS while an image must be drawn twice. Every diagram already in `docs/system/` is text and there are zero images - keep it that way.

A DIAGRAM THAT IS WRONG IS WORSE THAN NO DIAGRAM, because a picture is believed faster than a sentence. Two verification passes over the capability chapters found 38 then 21 false claims; a diagram is a claim with a higher believability and a lower word count. Draw only what has been read from the code.

AND DO NOT DRAW WHAT A SENTENCE SAYS BETTER. The standing instruction to every documenter here has been: a diagram earns its place or it does not appear. A page of boxes that restates a list is noise, and this product already has a measured allergy to surfaces nobody reads.
