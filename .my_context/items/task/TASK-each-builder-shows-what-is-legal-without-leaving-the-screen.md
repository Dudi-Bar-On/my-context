---
id: TASK-each-builder-shows-what-is-legal-without-leaving-the-screen
type: task
title: each builder shows what is legal, without leaving the screen
status: active
severity: soft
always: false
summary: Show what a command does and which values it will accept, with a worked example, right where someone is filling it in.
summary_of: 8b77400753ab9c4f
scope: []
tags:
  - "plan:builder"
  - "seq:8"
  - "state:todo"
  - v2
  - ui
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-24
valid_until: null
checksum: 83f0920aec3b61e0
plan: builder
seq: "8"
state: todo
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
