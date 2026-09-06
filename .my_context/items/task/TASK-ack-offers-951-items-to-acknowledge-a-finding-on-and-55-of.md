---
id: TASK-ack-offers-951-items-to-acknowledge-a-finding-on-and-55-of
type: task
title: ack offers 951 items to acknowledge a finding on and 55 of them have one
status: active
severity: soft
always: false
summary: The id picker for ack offers every item in the corpus, and the command refuses all but the 55 doctor reports on.
summary_of: 6b52ba79b5e47cef
scope:
  - src/ui/public/screens/palette.js
  - src/ui/public/lib/palette-defs.js
tags:
  - v2
  - ui
  - composer
  - "plan:builder"
  - "seq:12"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-06
valid_until: null
checksum: ad70f3e8ada6accf
plan: builder
seq: "12"
state: todo
priority: "3"
needs: builder/10
---

# ack offers 951 items to acknowledge a finding on and 55 of them have one

Found by measurement while building D11 (builder/10), not by review. Filed rather than done
because it is a change to what a picker OFFERS on a live screen, and the D11 ruling licensed
three named fields.

MEASURED 2026-09-06 against this corpus, through the running server:

  /api/items      950 items, so the `id` picker builds 951 <option> elements counting the blank
  /api/doctor      61 findings, 5 of them notes ABOUT a check rather than findings about the
                   corpus, 56 carrying an item, across 55 DISTINCT items

`mycontext ack <id> <code>` runs doctor's own checks first and refuses an id it reports nothing
on: `reportState` prints *"doctor reports no findings on <id>. There is nothing to acknowledge."*
So 895 of the 951 options this screen offers for `ack`'s `id` compose a command that will be
refused, and the reader cannot tell which is which from the list.

THE FIX IS THE ONE ALREADY IN THIS FILE. `sourceLists` (`screens/palette.js`) already filters a
picker to what the command can accept — categories are filtered on `enabled` with the reason
beside them: *"A disabled category cannot receive an item, so offering it would compose a
command the CLI refuses. The config's own `enabled` is the authority."* An `ack`-scoped `id`
source over the items `/api/doctor` names is the same rule, and the data is already fetched:
D11 added `findingOptions`, which carries `item` on every row for exactly this shape of join.

WHAT MAKES IT MORE THAN TIDYING. `finding` is narrowed by `id` (`dependsOn`), so today a reader
picking almost any item gets an empty suggestion list and the sentence *"This corpus has
nothing to offer here"* — which is TRUE and useless. Narrowing the id picker turns the whole
`ack` form into one where every combination composes a command that runs.

WHAT NEEDS DECIDING FIRST, and why this is not a one-liner. `def.args`'s `source` is a name, and
`items` is shared by nine entries. Narrowing it for `ack` alone means either a second source
name (`itemsWithFindings`) declared on that entry, or a per-entry filter the catalogue can
express — and the second is a new mechanism, so prefer the first unless a second case appears.
Either way the picker must NOT be closed to it: a bulk ruling already cleared with
`ack --all --code` can leave an acknowledgement on an item doctor no longer reports, and
`ack <id> <code> --clear` withdraws exactly that — the same escape hatch `finding` keeps.
