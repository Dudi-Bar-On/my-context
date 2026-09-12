---
id: TASK-each-builder-shows-what-is-legal-without-leaving-the-screen
type: task
title: each builder shows what is legal, without leaving the screen
status: active
severity: soft
always: false
summary: "Done: what a field will accept is shown beside it, so nobody has to leave the screen to find out."
summary_of: b1d093f6925becfb
summary_was:
  - 2026-09-11 Show what a command does and which values it will accept, with a worked example, right where someone is filling it in.
acknowledged:
  - task_unverified@0ded2d6722f2e9bc
scope: []
tags:
  - "plan:builder"
  - "seq:8"
  - "state:done"
  - v2
  - ui
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-24
valid_until: null
checksum: daa22cb4e2d44697
plan: builder
seq: "8"
state: done
needs: builder/5, port/95
---

# each builder shows what is legal, without leaving the screen

OWNER INSTRUCTION 2026-08-24: "there are missing help examples on those screens and the user does not know what is the correct format what is legal and what is not".

The placeholder (seq 5) says what a value LOOKS like. This says what the command DOES, which values are legal, and shows a worked example - the thing `mycontext help` and `mycontext examples` already give a terminal reader and the UI gives nobody.

IT ALREADY EXISTS AS DATA, and twice over: `/api/help/:topic` serves the seven help topics, and plan:categories seq 16 made `help categories` and `examples <cat>` render the updatable surface per category. Render THOSE. Do not write a third description of the same commands in the browser - that is precisely the drift this plan is about.

Follow the mockup's existing affordance for this rather than inventing one: `details.help` with its `.helpbox` is already the design of record's answer to "explain this without leaving the screen", and it is already carried in `styles.css`.

DEPENDS ON seq 5. BLOCKED BY plan:port seq:95.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: STANDS, and it is the cheapest task in the plan because the data exists TWICE already: /api/help/:topic serves the seven help topics, and plan:categories seq:16 made `help categories` and `examples <cat>` render the updatable surface per category. RENDER THOSE. Its warning is the one to keep -- do not write a third description of the same commands in the browser, which is precisely the drift this plan is about. And it should use the mockup s existing affordance rather than invent one: details.help with its .helpbox is already the design of record s answer to "explain this without leaving the screen" and is already carried in styles.css. THAT MATTERS FOR plan:walk seq:24, the documentation programme: this screen-level help and that programme must render the same source or the product grows two manuals.

plan:builder IS INTERNALLY CONSISTENT and needed no correction -- the only plan of the six the reconciliation has read that did not. Its sequence stands: 1b, 1c, 2, 2b, 3, 4, then the mockup (plan:walk seq:20), then 5, 6, 7, 8, with plan:walk seq:21 teaching the parity gates to understand a screen that instantiates a pattern.

Landed in `1be21693`, alongside `builder/6` and `builder/17`.

CLOSED 2026-09-11, FOUR DAYS LATE, AND THE LATENESS IS THE POINT. This shipped on 2026-09-07 and
nobody set the state. It was found by the handover measurement, not by an audit: the handover
checker flagged it as an instruction "carried into 3+ blocks with the work still open", and the
lane checking whether that meant HARD or IMPOSSIBLE found it meant NEITHER — the work was done and
the item was wrong.

WHAT THE STALENESS COST, measured rather than supposed: `mycontext ready --plan builder` was
offering these as dispatchable. A lane taking that list would have REBUILT SHIPPED, TESTED WORK —
and would have found the code already there, which is the confusing version of the failure rather
than the loud one.

AND THE HANDOVER WAS NOT AT FAULT, which was checked before it was blamed: the next block written
after the landing names none of these. The residual is a fossil of this item’s own `state` field,
and the checker reads "still open" from there.

Verified before closing: `test/ui/builder.test.ts` 24 of 24 green on 2026-09-11.
