---
id: TASK-a-gate-every-button-the-app-builds-is-styled-by-something
type: task
title: "a gate: every button the app builds is styled by something"
status: active
severity: soft
always: false
summary: Add a check in a real browser that no button renders unstyled, because an unstyled one turns invisible and nobody reports what they cannot see.
summary_of: 1800be8180619ee3
scope: []
tags:
  - v2
  - ui
  - a11y
  - styles
  - e2e
  - "plan:rulings"
  - "seq:51"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-27
valid_until: null
checksum: 3dcf7e46eae30b75
plan: rulings
seq: "51"
state: done
priority: "1"
source: owner reported 2026-08-27
---

# a gate: every button the app builds is styled by something

See KNOWN-a-classless-button-renders-light-text-on-the-ua-button. The owner reported one invisible button; the cause is that `button{font:inherit;color:inherit}` sets colour and not background, so a classless button outside the four container selectors that style buttons renders light text on the user agent's near-white button face.

BUILD THE DERIVATION, NOT A LIST. In the browser suite, over the real rendered DOM, assert that every `<button>` has a computed background that is not the UA default -- or, equivalently, that it matches one of the styled selectors. Computed style is the honest measurement here: a class list check would pass a button whose class the stylesheet does not actually style, which is a different way to be invisible.

RUN IT ON THE SCREENS THAT ACTUALLY COMPOSE, at minimum the composer, Doctor, Packs, Port, Procedures and Work -- the seven that carry a Copy control -- plus any screen the walk reaches. A screen whose buttons are all inside `.cmd` passes for free, which is correct: it IS styled.

WHY A BROWSER TEST AND NOT A SOURCE SCAN: the styling comes from ANCESTOR selectors, so the question "is this button styled" cannot be answered by reading the element's own markup. It is a question about the cascade, and the cascade only exists in a browser.

FAIL LOUDLY AND NAME THE BUTTON: the screen, the text it carries, and the container it is in. An invisible button is one a human never reports because they never see it -- this one was found only because a NEW one appeared beside a working one.
