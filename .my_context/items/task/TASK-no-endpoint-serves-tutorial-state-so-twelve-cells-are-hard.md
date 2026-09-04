---
id: TASK-no-endpoint-serves-tutorial-state-so-twelve-cells-are-hard
type: task
title: no endpoint serves tutorial state, so twelve cells are hard-coded in the module
status: active
severity: soft
always: false
summary: The tutorials page shows tick marks that nobody ever checked, and one of them is not true of anything.
summary_of: 0124ad3b6d9291bf
scope: []
tags:
  - "plan:port"
  - "seq:5d"
  - "state:todo"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: 63a1e1461c3c349f
valid_from: 2026-08-23
valid_until: null
checksum: e2a2f09bca95930d
plan: port
seq: 5d
state: todo
---

# no endpoint serves tutorial state, so twelve cells are hard-coded in the module

> Measured 2026-08-23 by the agent that built the Tutorials screen, which has no
> plan behind it and therefore only the mockup as a specification.
>
> No endpoint serves tutorial state. `/api/help/:topic` serves four topics, none
> of them a tutorial, and none of the 28 registered GET routes serves
> `docs/TUTORIAL.md` or `docs/TUTORIAL-ADVANCED.md`. So the six rows are string
> table content and the twelve EN/HE done-or-to-write cells are HARD-CODED in the
> module. An app screen asserting a checkmark about content nobody checks is the
> shape this project's invariants exist against.
>
> Worse, the claim was hand-checked and holds only loosely: tu.1 is
> `docs/TUTORIAL.md`; tu.3, tu.4, tu.5 and tu.6 are chapters 2, 4, 8 and 6 of
> `docs/TUTORIAL-ADVANCED.md`; and tu.2 matches no heading in either file — it is
> the one row the mockup itself marks "to write". NO FILE ON DISK IS NAMED FOR ANY
> OF THE SIX. The carve-up the screen describes has not happened.
>
> Also missing, and needing a mockup change first: no key for what the checkmark
> means, so it ships as a bare glyph with no accessible name; and the EN/HE column
> headers carry no `data-t`, so the Hebrew UI still reads EN and HE.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: REFINES plan:walk seq:24. Not superseded -- it holds evidence seq:24 does not, and that evidence is the strongest single argument for why seq:24 exists.

THE EVIDENCE: twelve EN/HE done-or-to-write cells are HARD-CODED in the module, and the claim was hand-checked and holds only loosely. tu.1 is docs/TUTORIAL.md; tu.3, tu.4, tu.5 and tu.6 are chapters 2, 4, 8 and 6 of docs/TUTORIAL-ADVANCED.md; tu.2 matches no heading in either file. NO FILE ON DISK IS NAMED FOR ANY ROW.

SO THE TUTORIALS SCREEN ASSERTS A CHECKMARK ABOUT CONTENT NOBODY CHECKS, and one of the six checkmarks is not true of anything. That is worse than the docs README gap, because a missing endpoint is visibly missing and a wrong checkmark looks like an answer. Tree parity reports tut as one of the two CLEAN screens -- 0 divergences -- which is exactly right and exactly beside the point: it draws the mockup s tree perfectly and the content is unverified.

FOR seq:24: this screen is the acceptance test. A documentation programme that leaves twelve hard-coded cells asserting unchecked claims has not finished.

AND IT IS THE ONE SCREEN WITH NO PLAN BEHIND IT -- the mockup is its only specification, which is the exact condition REQ-every-screen-has-a-task-that-implements-it-until-the-mockup exists to end.
