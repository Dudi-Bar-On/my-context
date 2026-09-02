---
id: TASK-a-guided-flow-for-creating-a-category-with-every-detail
type: task
title: a guided flow for creating a category, with every detail selectable
status: active
severity: soft
always: false
summary: A step-by-step way to set up a new kind of item that offers the allowed choices at each step, taken from the same rules that would reject a wrong one.
summary_of: a059cd7284b77878
summary_was:
  - 2026-09-01 A step-by-step flow for defining a new kind of item that offers the legal choices at each step instead of expecting the user to know them.
scope: []
tags:
  - "plan:config"
  - "seq:3"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-23
valid_until: null
checksum: 6654fd2e3affb764
plan: config
seq: "3"
state: done
---

# a guided flow for creating a category, with every detail selectable

OWNER INSTRUCTION 2026-08-23: a very structured way to create a new category with every detail possible selected by the user; a wizard is an option.

DO: a stepped flow - name, prefix, tier, description, extra fields, agent edits, scope policy, and the `updates` declaration from plan:categories seq 13. Every step offers the legal values rather than expecting them to be known: tier is a two-member union, agentEdits and scopePolicy are closed vocabularies with defaults per tier, and prefix has collision rules against the 23 shipped categories.

A WIZARD RATHER THAN A FORM because this is the one flow with real ordering and cross-field validation - tier changes which other choices are legal, and a prefix that collides is only knowable against the whole catalogue.

IT COMPOSES, IT DOES NOT WRITE. Owner decision 2026-08-23. See seq 4 for the hand-off, and DEC-should-the-web-ui-be-allowed-to-write-config-json for the question itself.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: STANDS. Owner instruction 2026-08-23, unbuilt, and it is the sharpest instance of the 2026-08-25 requirement that a configuration entry must let the user SELECT rather than know.

Every step it lists is already a closed vocabulary in the code -- tier is a two-member union, agentEdits and scopePolicy are closed with defaults per tier, prefix has collision rules against the 23 shipped categories. So "offer the legal values rather than expecting them to be known" is a DERIVATION, not a design exercise, and plan:builder seq:2 has already ruled how it must be done: DERIVE, DO NOT COPY -- the values come from the same constants the parser enforces, so a vocabulary cannot be right in the help and wrong in the refusal.

THE WIZARD ARGUMENT SURVIVES SCRUTINY and should not be softened into a form: tier changes which other choices are legal, and a prefix collision is only knowable against the whole catalogue. That is real cross-field validation, which is exactly the case a stepped flow exists for.

IT COMPOSES, IT DOES NOT WRITE -- owner decision 2026-08-23, unchanged, and seq:4 is the hand-off.
