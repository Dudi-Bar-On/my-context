---
id: OPENQ-do-the-uiux-sketches-get-resynced-when-the-mockup-changes-or
type: open_question
title: do the uiux sketches get resynced when the mockup changes, or are they a dated record
status: active
severity: soft
always: false
summary: Are the original design sketches kept up to date when the design moves on, or are they a record of a moment that readers must know may be behind?
summary_of: d634d7e490d1daa5
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
checksum: 47a3cc02fec315ea
---

# do the uiux sketches get resynced when the mockup changes, or are they a dated record

> Raised by `plan:walk seq:47` while bounding the charts to 1:1, 2026-08-29.
>
> **The finding**
>
> `reports/uiux/sketches/05-dataviz.html` — the design source the mockup renders — still carries:
>
>     svg.chart{display:block;inline-size:100%;block-size:auto;overflow:visible}
>
> **That rule is the ORIGIN of the stretch** the owner reported as "non proportional and ugly". It was carried into the mockup and from there into `styles.css`, and it is the reason nominally identical text rendered at 15.2px on one screen and 12.7px on two others.
>
> The implementer treated the fix as the design change the owner asked for rather than as a contradiction, because the MOCKUP is the design of record for appearance and the mockup has been corrected. It did not edit the sketch: that file is in the outer repo and was outside its lane.
>
> **So the sketch and the mockup now disagree**, and the sketch is the one that is wrong.
>
> **The question**
>
> **Do the sketches get resynced when the mockup changes, or are they a dated record of a moment?**
>
> Both are defensible and they are different artefacts:
>
> * **A dated record.** The sketches are what the design looked like when it was worked out, valuable precisely because they are not edited — the reasoning in their prose is the reasoning of that day. Under this reading the divergence is expected, and anyone reading them must know they may be behind.
> * **A living source.** They are consulted as the origin of house rules — this project just derived a chart density rule from `05-dataviz.html`'s prose — and a source that silently contains a superseded rule will propagate it again. `seq:47`'s own history is the proof: the stretch reached three screens from there.
>
> **What makes this urgent rather than tidy**
>
> The sketches were established two days ago as the design source for the graphics, and their prose was used as the specification for a density fix. If they are consulted as authority and are also unmaintained, the next reader takes a superseded rule as the house rule — which is exactly how this one spread.
>
> **Not in question**: the mockup remains the design of record for appearance, and `styles.css` follows it byte-identically. Whatever is decided here does not change that.
