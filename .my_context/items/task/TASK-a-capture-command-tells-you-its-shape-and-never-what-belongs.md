---
id: TASK-a-capture-command-tells-you-its-shape-and-never-what-belongs
type: task
title: a capture command tells you its shape and never what belongs in it
status: active
severity: soft
always: false
summary: The help for capturing an item says how long it should be, but not what kind of thing it is.
summary_of: bcd379c6c7f7bdd3
scope:
  - src/ui/read-model-cli-help.ts
  - src/ui/public/screens/cli-help.js
  - src/plugin/commands.ts
tags:
  - v2
  - ui
  - help
  - slash
  - "plan:library"
  - "seq:3"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-06
valid_until: null
checksum: 321b0415294a634c
plan: library
seq: "3"
state: done
priority: "2"
verified_on: 2026-09-07
---

# a capture command tells you its shape and never what belongs in it

Owner question 2026-09-06, on seeing the newly served hints: "[the item in one sentence] - would a
user know what to write there?" He then asked whether the slash commands themselves need
refactoring before their help does.

MEASURED ACROSS ALL 91 HINTS, because "most of them are vague" is a claim and this is the number:

  30 are CIRCULAR - the 29 `add-<category>` files plus `add` itself. Every one is generated from
     one template: `[the <category> in one sentence]`. It states the SHAPE (one sentence) and names
     the category back at the reader. It says nothing about what distinguishes a `constraint` from
     an `invariant`, which is the only thing a person actually needs at that moment.
  32 are FLAG LISTS mirroring the CLI (`list-*`, audit, decay, doctor, focus, ready, review, status,
     todo, ui). These are accurate and need nothing.
  10 are HAND-WRITTEN AND GOOD, and they are the proof that the template is the problem rather than
     the format: `link` says "[from which item, how, to which item]"; `supersede` "[which item, and
     what replaces it]"; `unlink` "[which item, which relation, pointing at what]"; `add-reference`
     "[which file, and why it matters]"; `edit` "[the item id, and what to change]". Same one-line
     budget, and each says what to SUPPLY.

SO THE ANSWER TO HIS SECOND QUESTION IS NO, NOT A REFACTOR OF THE COMMANDS. 61 of 91 files are
already right. The defect is one generated template and the fact that the help repeats it.

AND THE MISSING EXPLANATION ALREADY EXISTS, DERIVED. Every one of the 29 categories carries its own
description in `src/core/categories.ts` - "constraint: Non-negotiable limit: budget, stack,
regulation, SLA"; "invariant: Condition that must always hold during execution"; "rule: A do/dont
directive". That is exactly the sentence a reader of `/mycontext:add-rule` is missing, and it is
already the source `mycontext help categories` renders from THIS project’s resolved config, so it
includes categories a pack enabled and this repo defined.

TWO HALVES, and the first is nearly free:

  1. THE HELP CARD SHOWS THE CATEGORY DEFINITION beside the hint, for the 29 `add-*` and 32
     `list-*` entries whose name carries a category. Derived at request time from the same
     catalogue, never typed. `add` itself shows the list rather than one entry.
  2. THE GENERATED TEMPLATE IMPROVES, in `src/plugin/commands.ts`. Bounded by what a one-line hint
     can carry - it cannot teach 29 distinctions - so the target is the shape the ten good ones
     use: name what to supply, not the category again.

DO NOT HAND-WRITE 29 HINTS. That is 29 sentences nothing re-runs, in a product that measures that
drift in days. Whatever half 2 becomes, it stays generated.
