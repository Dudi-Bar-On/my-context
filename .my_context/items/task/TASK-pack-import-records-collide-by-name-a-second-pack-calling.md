---
id: TASK-pack-import-records-collide-by-name-a-second-pack-calling
type: task
title: "pack import records collide by name: a second pack calling itself the same thing overwrites the first"
status: active
severity: soft
always: false
summary: Importing two collections that share a name silently overwrites the first one's record of what it brought in.
summary_of: 3ef423f9985eea61
acknowledged:
  - state_unaudited@e2964795739984df
scope: []
tags:
  - "plan:export"
  - "seq:14n"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-21
valid_until: null
checksum: ed7e880f5eef09fc
plan: export
seq: 14n
state: done
priority: "1"
---

# pack import records collide by name: a second pack calling itself the same thing overwrites the first

Found while building the test the plan asks for - 'two imports of packs with the same name are kept apart, and list shows both' - which is not achievable as literally written.

writeImportRecord does writeFileSync on <packDir>/import.json, and packDir slugs the pack's OWN name. A second import calling itself acme-security lands on top of the first record. --name is the only thing that keeps them apart, so the test drives it that way.

Nothing warns a user that re-importing a differently-sourced pack of the same name replaces the earlier membership record. The record is what pack list reads and what review promote --all --pack reads, so the loss is silent and it is the membership, not the items.

Task 16 is the natural home: it is the command that consumes these records.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: STANDS, priority 1. A shipped data-loss defect: a second pack calling itself the same name overwrites the first s import record, and the plan s own required test -- "two imports of packs with the same name are kept apart, and list shows both" -- is not achievable as literally written. Nothing in the UI plans touches it and nothing supersedes it. AND IT SITS ON A SECURITY BOUNDARY ALREADY RECORDED IN THIS CORPUS: packs[].name is attacker-controlled text -- `pack import --name` with U+202E exits 0 -- so "collide by name" is not only an accident case. Whoever fixes the collision should read that finding first, because a key derived from attacker-controlled text is the same bug twice.
