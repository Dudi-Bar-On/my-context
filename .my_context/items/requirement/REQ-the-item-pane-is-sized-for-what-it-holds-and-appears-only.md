---
id: REQ-the-item-pane-is-sized-for-what-it-holds-and-appears-only
type: requirement
title: the item pane is sized for what it holds, and appears only where it belongs
status: active
severity: hard
always: false
summary: The side panel can be widened or floated so a long entry is readable, and it closes when the reader leaves the screen that opened it.
summary_of: 579d1b1d17ddee43
scope: []
tags:
  - v2
  - owner-requirement
  - ui
  - pane
  - a11y
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-27
valid_until: null
checksum: a09b7ff85b4eb9d0
kind: functional
---

# the item pane is sized for what it holds, and appears only where it belongs

OWNER REQUIREMENT, stated 2026-08-27 in two halves: "resize the right pane to enlarge it or to add a button on it's top right corner to make it floating popup in order to have a bigger window to look at it because it may include a long text boddy", and then "there are many screens that it should not appear but currently it does - this should be fixed too".

THE SIZE. `styles.css` writes `.app.pane-open{grid-template-columns:214px 1fr 330px}` -- three hundred and thirty pixels, as a LITERAL, for every item in the corpus. `#pane` gets `overflow-y:auto` and nothing else, so an item whose body is a page of prose (which most of the normative ones are) is read through a column narrower than a phone. The pane already renders real Markdown into a `.well`; the content is good and the container is the defect.

TWO ANSWERS, because they answer two different complaints and are not alternatives. DRAG is for a working width -- somebody reading item after item wants the pane wider and wants it to STAY that way, so it is a PREFERENCE and it persists. FLOAT is for one long body -- somebody who has hit a 4,000-word rule wants the whole screen for a moment and wants their layout back, so it is a MODE and it does not.

THE PLACE, and this one is a defect with a measured cause. `installItemPane` delegates from the DOCUMENT, so a click on any `[data-id]` opens the pane -- and `route()` NEVER CLOSES IT. `pane-open` is a class on `.app`, which outlives every screen, so the pane opened on Coverage is still there on Simulate, on Configure, on Tutorials. Twelve of the twenty-two screens emit no `[data-id]` at all and can only ever INHERIT it. It is also why those screens look wrong: `pane-open` is what switches the layout to three columns, so the body is squeezed to make room for a panel about an item the user has navigated away from.

THE RULE THIS WRITES DOWN: the pane belongs to the screen that opened it. A route change CLOSES it -- not hides it, closes it, so the grid returns to two columns and no state carries over.

WHY IT IS BUILDABLE NOW. The 2026-08-26 ruling that THE APP IS WHAT IS BUILT dropped the app->mockup direction from `strings-parity` and from nine per-screen class checks. A pane the mockup never drew, with two controls and two string keys it never declared, would have failed those gates in the INVENTED direction before that. The gap direction still fails, so the mockup can still catch what the app is missing.

DONE WHEN, and all five:
1. The width is a custom property, clamped in CSS so that nothing which writes it can squeeze the body out of the window.
2. A handle drags it, the arrow keys move it, Home restores the default, and it announces itself to a screen reader.
3. One button in the pane head floats it over the page; Escape steps back one level rather than closing outright.
4. A route change closes it, and the twelve screens that cannot open one never show one.
5. Somebody has LOOKED at a genuinely long body both ways. A two-line fixture would pass every test above and prove nothing.

Plan: docs/superpowers/plans/2026-08-27-the-item-pane-is-resizable-and-can-float.md.
