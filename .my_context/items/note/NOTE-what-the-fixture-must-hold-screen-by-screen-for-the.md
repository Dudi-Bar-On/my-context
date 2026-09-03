---
id: NOTE-what-the-fixture-must-hold-screen-by-screen-for-the
type: note
title: what the fixture must hold, screen by screen, for the comparison to mean anything
status: superseded
severity: soft
always: false
summary: What the sample data must contain, screen by screen, so that comparing a screen to its design says something about the code and not the data.
summary_of: "5578294064018820"
scope: []
tags:
  - v2
  - ui
  - fixture
  - tree-parity
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-25
valid_until: 2026-09-03
checksum: 12acd92a48c38689
---

# what the fixture must hold, screen by screen, for the comparison to mean anything

Accumulated across the plan:port seq:98 walkthrough, for plan:port seq:94. Each line is a thing the mockup s scene has and the demo corpus does not, measured rather than guessed.

graph    -- RELATIONS. Zero items carry one today. The mockup s ego graph is seven nodes and five labelled edges, and it needs at least: an edge whose target is missing (draws dangling), a superseded neighbour, and enough neighbours to exercise the "+N more" cap.

doctor   -- FINDINGS AT ALL THREE LEVELS. One warning today; the mockup s scene has one error, two warnings, two notices. Three real divergences hid behind that until someone read the engine beside the design.

proc     -- ONE procedure, not three. The mockup s scene holds a single procedure and a prose card; three procedures misalign the walker s pairing and produce seven findings that are not about code.

gaps     -- three ungoverned rows. injected -- two injected rows.

simulate -- the spill-ratio bars need audit rows in the window; the staircase needs nothing from the fixture because it needs an endpoint first.

THE PRINCIPLE THIS IS ALL ONE INSTANCE OF: the fixture is not a smaller corpus, it is THE MOCKUP S OWN SCENE. Where it holds less, the walker reports code gaps that are data gaps; where it holds more, it reports quantity divergences that are nothing at all. Both waste the owner s attention, which is the scarcest thing in this review.

## Relations
- superseded_by [[INSTR-testing-happens-against-the-current-corpus-and-an-exception]]
