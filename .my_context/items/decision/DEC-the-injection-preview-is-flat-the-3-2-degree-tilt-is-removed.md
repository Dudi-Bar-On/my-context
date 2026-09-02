---
id: DEC-the-injection-preview-is-flat-the-3-2-degree-tilt-is-removed
type: decision
title: "The injection preview is flat: the 3.2 degree tilt is removed from the design of record"
status: active
severity: soft
always: false
summary: "A slight tilt on one panel is dropped: it read as depth against a few short samples and as crooked, drifting text against real content."
summary_of: 67e8aff3f10fb516
scope: []
tags:
  - v2
  - ui
  - design
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-22
valid_until: null
checksum: e412a6f4a05986bf
---

# The injection preview is flat: the 3.2 degree tilt is removed from the design of record

The injection preview's two planes no longer tilt. The 3.2 degree rotateY on .plane.l/.plane.r and the 1600px perspective on .pair are removed from docs/design/web-ui-mockup.html and from src/ui/public/styles.css together, so the design of record and the shipped app stay byte-identical and styles-parity keeps holding them.

WHY

Of the mockup's 21 screens, preview was the only one carrying any transform or perspective - measured by unhiding each section and counting, not inferred. It was also the only card the owner reported as looking wrong, and he reported it on the MOCKUP itself, before the port existed. Those are the same fact.

The transform was never miscomputed. It was exactly the 3.2 degrees specified. What it did at real data volume was shear dense monospace prose: the left edge of every line in the right pane drifted, and the row labels - centred by the browser's default button styling, which the mockup overrides on .nav and not on .row - staggered across a 35px spread and read as a diagonal. Against four short sample bodies it is a subtle depth cue. Against 213 real item bodies it is a defect.

WHAT THIS COST, AND THE LESSON WORTH KEEPING

It was reported four separate times - skewed, tilted, diagonal - before it was traced, because I kept taking screenshots and reading them approvingly instead of measuring. The instrument that found it in one pass was a script that walks both pages and compares computed geometry and layout CSS element by element. Eyes are not an instrument. See [[RULE-a-ui-change-is-not-verified-until-someone-has-looked-at-it]]: looking is necessary and it is not sufficient.

WHAT SURVIVES

The structural half of the old rule is kept live in primitives.test.ts: if a perspective ever returns to this scene it belongs on the CONTAINER and never on a plane, because perspective on the rotated element itself resolves per element instead of establishing one shared frustum. The lesson outlives the treatment.

A separate and still-active departure: .scene>.pair carries a block-size bound in the app and not in the mockup. The mockup does not need it - four short samples come to 552px - and the app does, because 265 real items grew the same rules to 5888px in a 779px window. That one is a data-volume difference, not a design disagreement, and it is scoped to .scene precisely because a bare .pair selector reaches every screen that ever grows one.
