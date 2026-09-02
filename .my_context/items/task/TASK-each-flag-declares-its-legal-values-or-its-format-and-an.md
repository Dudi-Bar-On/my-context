---
id: TASK-each-flag-declares-its-legal-values-or-its-format-and-an
type: task
title: each flag declares its legal values OR its format and an example
status: active
severity: soft
always: false
summary: Each option states its allowed values, or its format and an example, drawn from the source the checker uses so help and refusal cannot disagree.
summary_of: 174ea760b9e9ef0b
scope: []
tags:
  - "plan:builder"
  - "seq:2"
  - "state:done"
  - v2
  - ui
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-24
valid_until: null
checksum: 29274e3da4c56bf4
plan: builder
seq: "2"
state: done
needs: builder/1, builder/1b
progress: "100"
last_change: 2026-08-31
---

# each flag declares its legal values OR its format and an example

The one declaration that drives the select, the placeholder, the help text AND the check. Owner instruction 2026-08-24: the user "does not know what is the correct format what is legal and what is not".

THE SHAPE IS ALREADY DECIDED, one level down: `UpdatableName` (core/categories.ts, plan:categories seq 13) declares closed `values` for a vocabulary, ABSENT values meaning free text - a real answer, not a gap - plus a `note` a person reads. Extend that idea to a flag rather than inventing a second vocabulary language.

What a flag needs beyond it: a FORMAT hint and an EXAMPLE, because free text is not formless. `--scope` takes comma-separated globs, `--tags` takes a comma-separated list that REPLACES the whole set, `--body` takes prose, an id argument takes an existing item id. Those are four different kinds of free text and a reader cannot tell them apart today.

DERIVE, DO NOT COPY. The values must come from the same constants the parser enforces - `AGENT_EDITS`, `SCOPE_POLICIES`, the `Status` and `Severity` unions, a category's own `updates` - so a vocabulary cannot be right in the help and wrong in the refusal. This project has paid for hand-copied lists twice this week.

DEPENDS ON seq 1.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: STANDS, and it is the KEYSTONE of the plan -- one declaration driving the select, the placeholder, the help text AND the check. It also serves two owner requirements at once: the 2026-08-24 instruction that a user "does not know what is the correct format what is legal and what is not", and the 2026-08-25 requirement that a configuration entry offers selection wherever possible and a recommended value as a placeholder where it cannot. Its rule -- DERIVE, DO NOT COPY, from the same constants the parser enforces -- is the one sentence in this plan that must not be softened; this project has paid for hand-copied lists three times now, most recently the audit filter row deriving AUDIT_KINDS from the key order of one bucket.

plan:builder IS INTERNALLY CONSISTENT and needed no correction -- the only plan of the six the reconciliation has read that did not. Its sequence stands: 1b, 1c, 2, 2b, 3, 4, then the mockup (plan:walk seq:20), then 5, 6, 7, 8, with plan:walk seq:21 teaching the parity gates to understand a screen that instantiates a pattern.
