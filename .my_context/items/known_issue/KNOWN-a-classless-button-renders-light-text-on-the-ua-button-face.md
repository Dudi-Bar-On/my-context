---
id: KNOWN-a-classless-button-renders-light-text-on-the-ua-button-face
type: known_issue
title: a classless button renders light text on the UA button face — the global rule is a half-reset
status: active
severity: soft
always: false
summary: A button that misses the right surrounding container gets pale text on a pale background, so it is invisible rather than merely ugly.
summary_of: 4f0ae683a8d1cf6f
scope: []
tags:
  - v2
  - ui
  - a11y
  - styles
  - owner-reported
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-27
valid_until: null
checksum: afcba18eaec5b4eb
---

# a classless button renders light text on the UA button face — the global rule is a half-reset

REPORTED BY THE OWNER 2026-08-27 and traced the same hour: "in composer, when you select to compose a read action, a new button is generated at the bottom of the compose properties entry fields (after the copy button)" -- white background, text unreadable.

THE CAUSE IS A HALF-RESET, not a missing class on one button.

  - `styles.css` · `button{font:inherit;color:inherit}` · ~1260 is the ONLY global button rule: `button{font:inherit;color:inherit}`. It takes the app's LIGHT `color` and SETS NO BACKGROUND.
  - So a classless `<button>` gets light text from the app and its background from the USER AGENT -- near-white on Windows Chrome. Light on white. Invisible.
  - It is invisible rather than merely ugly precisely BECAUSE the half-reset succeeded at one half.

WHY ONLY SOME BUTTONS. Container rules do the real styling: `.cmd button` (~727), `.bound button` (~541), `.segbar button` (~607), `.icon` (~353). A classless button INSIDE one of those looks right. The composer's Copy is inside `div.cmd` (`palette.js` ~592, ~600) and looks right; the read action's run button is appended to `cmdBox` (`palette.js` ~441), which is `el('div')` with no class, so it matches nothing. It appears only for READS because it is created only when `readTarget(def, values)` is non-null, and reads are the entries carrying `screen`/`endpoint`.

WHY THE MOCKUP DOES NOT HAVE THE BUG AND STILL CAUSED IT. `styles.css` ~705 records that the mockup "builds the tree EXACTLY as the mockup does -- classless `<button>`", so classless buttons are the DESIGN. The design also always places them inside a container that styles them. The app copied the button and, in one place, not the container.

THE CLASS, which is what makes this worth filing rather than fixing quietly: every classless button this app adds is invisible unless someone remembers which four ancestors style buttons. That is a rule held in a person's head, and this is the second time this project has filed a defect of the shape "the product states/renders something nobody checked".

WHAT WOULD CLOSE IT, in order of honesty:

1. A GATE. Every `<button>` the app builds either carries a class the stylesheet styles, or is inside one of the four container selectors. Checkable over the built DOM in the browser suite, where the four screens that compose commands already render. That is the derivation this file's neighbours already prefer over a list.
2. Give the global rule a background token. CANNOT BE DONE UNILATERALLY: `button{font:inherit;color:inherit}` is in the mockup and `styles-parity` compares rule bodies byte-identically, so it is a design-of-record change and the owner's. Worth taking to him, because it fixes the class at the source rather than catching it afterwards.

IMMEDIATE: the composer's run button is fixed as part of `plan:execute seq:6`, which is adding a Copy-and-Execute control in the same region and would otherwise have inherited the bug.
