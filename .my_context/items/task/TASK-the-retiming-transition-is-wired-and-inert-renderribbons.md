---
id: TASK-the-retiming-transition-is-wired-and-inert-renderribbons
type: task
title: "the retiming transition is wired and inert: renderRibbons rebuilds every segment"
status: active
severity: soft
always: false
summary: The one deliberate animation never actually plays, because what it should animate is rebuilt from scratch every time.
summary_of: 16028de40dd8ef35
scope: []
tags:
  - "plan:repaint"
  - "seq:8r"
  - "state:done"
  - v2
  - ui
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-22
valid_until: null
checksum: ca38db958a349906
plan: repaint
seq: 8r
state: done
priority: "1"
---

# the retiming transition is wired and inert: renderRibbons rebuilds every segment

Found by repaint task 8, which declared the transition correctly and then checked whether it fires. It does not.

transition:inline-size var(--dur-retime) var(--ease) is on .track .seg. But renderRibbons() calls host.replaceChildren() and rebuilds every segment from scratch on each event change, so there is no persisting DOM node for inline-size to animate FROM. A brand-new element has no previous value to transition.

So the spec's one deliberate motion exception - where the movement IS the information - currently produces no movement at all.

The fix is keying or reusing .seg nodes across a re-render, which is JS render logic inside the data view's own render function, not a transition declaration. Task 8 correctly left Step 3 unchecked rather than tick a step whose verification numbers (243px to 20px to 416px) cannot honestly be produced yet.

Whoever owns the ribbon's render takes this. It is small and it is the difference between a declared exception and a real one.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: STANDS. Re-verified against the code today, and it is unchanged.

drawRibbons() at `src/ui/public/screens/preview.js` · `function drawRibbons(selection, sim) {` · ~1970 builds a fresh `card`, a fresh `plate` host and a fresh .ribbon / .track / .seg for every tier on every call, and render() opens with root.replaceChildren(). So `transition:inline-size var(--dur-retime) var(--ease)` on `.track .seg` still has no persisting node to animate FROM, and the spec s ONE deliberate motion exception -- where the movement IS the information -- still produces no movement.

NOTHING SUPERSEDES IT and no walk task found it, because no parity gate can: the elements are all present, correctly classed, correctly ordered. Tree parity sees a perfect tree. styles-parity sees the transition declared, byte-identical to the mockup. The defect is that a declaration never fires, which is a behaviour and not a shape.

THAT IS THE SIXTH DISTINCT INSTANCE of "every gate here measures what it was pointed at" this reconciliation has met.

The fix is unchanged: key or reuse .seg nodes across a re-render. It is render logic, not a transition declaration. Repaint task 8 correctly left its Step 3 unchecked rather than tick a step whose verification numbers cannot honestly be produced.
