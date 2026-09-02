---
id: REF-the-uiux-sketches-the-design-source-for-every-graphic-and-it
type: reference
title: "the uiux sketches: the design source for every graphic, and it specifies degradation"
status: active
severity: soft
always: false
summary: Where the original drawings behind every chart live, and why the reasoning written beside them matters more than the pictures themselves.
summary_of: a67eb295bef4d8de
scope: []
tags:
  - v2
  - ui
  - design
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-28
valid_until: null
checksum: 69bd9ccc4dd05e59
---

# the uiux sketches: the design source for every graphic, and it specifies degradation

> **Owner, 2026-08-28, after two guessed fixes to the graphics had failed**: *"when you ran the ui regression tests using playwright i saw snapshots of the graphics that look correct, try to look over there"* — then, correcting the search: *"not snapshots there were actually html files."*
>
> They were right, and the artefacts had never been consulted by anyone working on the UI.
>
> **Where they are**
>
> `reports/uiux/` in the OUTER repo, with `index.html` and ten sketches:
>
>     00-mockup-before.html    00-mockup-current.html   02-ia.html
>     03-interaction.html      04-visual.html           05-dataviz.html
>     06-a11y.html             07-arch.html             08-onboarding.html
>     10-requirements.html
>
> `05-dataviz.html` — *"mycontext v2.0 — data-visualisation sketch: five graphics, one palette, no dependencies"* — is the design source for every chart in the product. It is 4,773px tall and each graphic carries prose explaining its own behaviour under load.
>
> **Why this matters, and it is not a filing note**
>
> **The sketches design for DENSITY explicitly, and the implementation dropped it.** From the scope-coverage map's own prose:
>
> > *"Degradation, four layers, each disclosed. (1) The wire carries directories, not files — one row per directory with rolled-up counts; per-file detail is fetched for the opened directory only. (2) The match loop is inverted... (3) Two distinct truncations, never merged into one word: the walk's own FILE_LIMIT = 20_000 bound, and the coverage computation's time budget. (4) Only the visible ~40 rows are in the DOM."*
>
> A four-layer degradation strategy, each layer disclosed. Measured against the shipped app on 2026-08-28: the admission staircase draws **every** rung and **every** eviction label with no bound at all — 15 labels over the live corpus, **169 over `.demo-corpus`**, overprinting into an unreadable band.
>
> The recency comb (graphic 4) shows the technique the staircase needs: about ten rows, item ids truncated with an ellipsis so a long id cannot overflow, sparse markers, and **one** annotated callout rather than a label on every point.
>
> **How this was missed, which is the part worth keeping**
>
> `docs/design/web-ui-mockup.html` was correctly established as the design of record for appearance, and everyone — the owner's instructions, the parity gates, every task brief — pointed there. **The mockup is a rendering of these sketches, not their source**, and it carries six hand-authored sample rungs where the sketches carry the reasoning about what happens with six hundred. So every parity check passed while the app degraded, because the mockup degrades identically and nothing compares either against real volume.
>
> Three fixes were attempted on the graphics before anyone opened these files: two font-size changes and one viewBox theory, all wrong, all made from measurements rather than from the design.
>
> **How to use them**
>
> * **Read the prose, not only the pictures.** The value is in the paragraphs under each graphic, which state what degrades and how it is disclosed.
> * **Where a sketch and the mockup disagree, say so rather than choosing silently.** The mockup is the design of record for appearance by an explicit 2026-08-20 correction; these sketches are plainly its source and are more explicit about load. That tension is real and unresolved.
> * `00-mockup-before.html` and `00-mockup-current.html` are the mockup's own predecessors, which the owner pointed at separately when the chart typography was restored.
