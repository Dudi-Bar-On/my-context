---
id: OPENQ-how-far-does-the-mockup-s-demotion-to-a-demo-go
type: open_question
title: how far does the mockup's demotion to a demo go
status: superseded
severity: soft
always: false
summary: An unsettled question about whether calling the design mockup just a demo also retires the gates that force the app to match it.
summary_of: 12a268d36296f3dd
scope: []
tags:
  - v2
  - ui
  - planning
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-28
valid_until: 2026-08-28
checksum: 8f1e1e61fe91a44d
---

# how far does the mockup's demotion to a demo go

> Owner, 2026-08-28, answering a question about two stale Hebrew strings in the mockup: *"the mockup is just a demo what matters is the app itsef."*
>
> **The narrow consequence was applied and is not in question**: a defect that exists only in `docs/design/web-ui-mockup.html` and not in the shipped app is cosmetic, and ranks below anything a user meets. `plan:walk seq:63` was demoted accordingly.
>
> **What is NOT decided, and must not be inferred from that sentence**
>
> The mockup is currently far more than a demo in this project's machinery. It is named the DESIGN OF RECORD, and a substantial apparatus enforces it:
>
> * `RULE-everything-in-the-mockup-gets-built-and-a-proposal-to-change` — the app must build what the mockup draws.
> * Four parity gates: `screen-parity` (element KINDS per screen, with a `KNOWN_GAPS` ledger that may only shrink), `tree-parity`, `styles-parity` (byte-identical rule bodies) and `strings-parity` (key sets).
> * `e2e/bidi.spec.ts`, which censuses isolated runs per key across BOTH surfaces.
> * The standing order used repeatedly on 2026-08-28: when a design must change, **the mockup is edited FIRST and the app follows** — the order used for `cap.warn`, `cfg.nocmd` and the five-tier ribbon.
>
> If "just a demo" extends to that apparatus, a great deal changes: the parity gates stop being correctness gates and become advisory, `KNOWN_GAPS` stops meaning anything, and the mockup-first ordering — which several open tasks are written around — is void.
>
> **The assistant did not assume that**, because the sentence was said while answering a question about two Hebrew strings, and a remark scoped to a translation question should not silently retire four gates and a rule.
>
> **The three readings, so the answer is a choice rather than a drift**
>
> 1. **Narrow** — mockup-only defects are cosmetic; everything else stands. This is what was applied.
> 2. **Priority** — the mockup remains the design of record and the gates stand, but work that only improves the mockup ranks below work a user meets. Almost certainly what was meant, and it changes ordering rather than machinery.
> 3. **Structural** — the mockup is demoted from design of record to reference sketch, the parity gates become advisory, and the app becomes its own specification. That is a large change with a real cost: the gates exist because the app drifted from the design repeatedly, and `KNOWN_GAPS` is the ledger of that history.
>
> **The question**
>
> Which of the three? And if 3, what becomes the specification — because "the app is what matters" answers what to prioritise and does not answer what the app is measured AGAINST. A product that is its own specification cannot be wrong, which is not the same as being right.

## Relations
- superseded_by [[DEC-the-mockup-governs-presentation-never-behaviour-and-a]]
