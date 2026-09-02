---
id: TASK-the-string-grammar-has-no-bold-run-so-three-of-the-mockup
type: task
title: the string grammar has no bold run, so three of the mockup watch strings lose their emphasis
status: active
severity: soft
always: false
summary: Three emphasised phrases on the activity screen come out flat, because translated text cannot carry bold at all.
summary_of: c677fe860db81968
scope: []
tags:
  - "plan:ui3"
  - "seq:11x"
  - "state:done"
  - v2
  - ui
origin: human
source_file: null
source_anchor: null
source_checksum: b6762f4cdaf3db39
valid_from: 2026-08-22
valid_until: null
checksum: a1fb1bd9f49a60f0
state: done
plan: ui3
seq: 11x
---

# the string grammar has no bold run, so three of the mockup watch strings lose their emphasis

> The mockup's Audit stream renders three `<b>` runs inside translated text: **Activity pulse** in `watch.pulsen`, **regime change** in `watch.sub`, and **hatched void** in `watch.voidn`. Rendered side by side at 1568x779, the mockup bolds them and `screens/watch.js` does not.
>
> It is not a screen defect. `lib/i18n.js`'s run grammar is `{(mv|m):payload}` and `{name}` — monospace, monospace value, isolated value. There is NO emphasis marker, so no string table can carry one, and the mockup's own `<b>` elements sit INSIDE its `data-t` elements where its `applyLang()` destroys them on the first language toggle (the same defect `screens/parts.js` records for the verdict glyph).
>
> What it needs, in order: a fourth marker in the mockup's own grammar block; the same marker in `lib/i18n.js`'s `RUN` regex plus a `<b>` branch in `t()` (and a decision for `tFlat()`, which must drop it because an attribute cannot hold an element); the three strings re-marked in the mockup and in BOTH tables; and a case in `test/ui/viewmodel.test.ts`.
>
> Found while building ui3 Task 11 (`screens/watch.js`). Screenshots: `my-context/reports/2026-08-22-ui3-11-watch/mockup-watch-1568x779.png` beside `watch-live-1568x779.png`.

HALF DONE, 2026-08-25, by plan:walk seq:1. Read this before starting it.

This task listed five things. Three are done and two are not, and the split is
not the one anybody would guess.

DONE:
  - the marker in lib/i18n.js -- {b:} and {i:}, and they NEST, which the flat
    RUN regex this task described could not have done: the mockup wraps slots
    inside emphasis in five places and `[^}]*` cannot hold the } that closes an
    inner run. The parser was replaced rather than the pattern extended.
  - the decision for tFlat(): it FLATTENS emphasis, including what is nested
    inside it, exactly as this task predicted an attribute must.
  - the case in viewmodel.test.ts, and it asserts the nesting specifically,
    because a flat pattern passes every other case.
  - the three watch strings, and fifty-four more: 57 English keys carry
    emphasis now, transformed from the mockup's own markup.

NOT DONE, and each is its own task now:
  - THE MOCKUP'S OWN GRAMMAR BLOCK. This task's sharpest observation is still
    true and still unfixed: the mockup's <b> elements sit inside its data-t
    elements, where its applyLang() destroys them on the first language toggle.
    That is why its HE table is plain strings, and it is why Hebrew has no
    source to transform. plan:walk seq:1h.
  - BOTH TABLES. English is populated; Hebrew is the owner's, because placing
    stress in a language by pattern-matching it is guessing. plan:walk seq:1h.

Measured effect of the half that landed: 41 tree-parity findings across 18 of
21 screens became 11, and the inventory went 197 -> 164.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: SUPERSEDED BY plan:walk seq:1h for everything it has left.

The HALF DONE note above is the full account. Both remaining halves -- the mockup s own grammar block, and the Hebrew table -- are plan:walk seq:1h, which is blocked on the owner because placing stress in a language by pattern-matching it is guessing. Nothing is left here that seq:1h does not carry.

Closed because it has no remainder of its own, not because the emphasis story is finished. It is not: Hebrew still has no emphasis anywhere in the product.
