---
id: DEC-the-mockup-draws-the-builder-once-and-screens-instantiate-it
type: decision
title: the mockup draws the builder once, and screens instantiate it
status: active
severity: soft
always: false
summary: The design draws the command-building control once as a pattern and every screen reuses it, so the same choices are not redrawn and left to drift apart.
summary_of: 05f4131819bac12d
scope: []
tags:
  - v2
  - ui
  - owner-ruling
  - builder
  - mockup
  - "screen:capture"
  - "screen:palette"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-25
valid_until: null
checksum: 5cfd5f34e00b1c31
---

# the mockup draws the builder once, and screens instantiate it

OWNER RULING, 2026-08-25, at the end of the plan:port seq:98 walkthrough.

THE SITUATION, measured: the app has built real command builders and the design of record predates the requirement that asked for them.

  capture   mockup 0 labels, 0 inputs, 0 selects -- app 4, 2, 2
  palette   mockup 1 label,  1 input,  0 selects -- app 12, 8, 3

THE RULING: ONE builder is drawn in the mockup, as a PATTERN -- a select for a closed value, an input with its placeholder and its help, the disabled copy control, the composed `.cmd` -- and every screen references it rather than redrawing it.

WHY NOT REDRAW EACH SCREEN: the same decisions would be drawn three times today and N more as command sites are converted, and the day one of them differs nobody could say whether it was intended. This is the same argument as ONE declaration driving the select, the placeholder and the check -- which REQ-every-command-the-ui-offers-is-built-checked already makes, and which this extends from the code to the specification.

WHY NOT EXEMPT BUILDERS FROM PARITY: it was offered and declined. It would stop the false findings immediately and carve a hole in "the mockup is the UI specification" exactly where the newest and least-settled UI lives.

THE COST, named rather than discovered: the parity gates compare per-screen markup, so they have to learn that a screen INSTANTIATES a pattern rather than declaring its own controls. That is plan:walk seq:21 and it is the real work in this ruling.

CONSEQUENCE: plan:walk seq:13, the config composer, now instantiates this pattern rather than inventing a third builder.
