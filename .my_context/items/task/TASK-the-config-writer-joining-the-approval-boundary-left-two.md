---
id: TASK-the-config-writer-joining-the-approval-boundary-left-two
type: task
title: the config writer joining the approval boundary left two tests outside its own change failing
status: active
severity: soft
always: false
summary: Two tests fail because the new config command joined the set of commands requiring approval, and the places that record that set by hand were never told.
summary_of: 1a207d5fd58bf579
scope:
  - test/docs/counts.test.ts
  - test/ui/palette-lib.test.ts
  - README.md
  - docs/README.he.md
  - skills/mycontext/SKILL.md
  - src/ui/public/lib/palette-defs.js
tags:
  - v2
  - rulings
  - config
  - docs
  - "plan:rulings"
  - "seq:58"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-04
valid_until: null
checksum: 903891a2d176c42c
plan: rulings
seq: "58"
state: todo
priority: "1"
---

# the config writer joining the approval boundary left two tests outside its own change failing

`mycontext config`'s two write forms (`--delete`, `--disable`) take `--yes` and are now on the approval boundary the parser derives. Two tests elsewhere assert against that boundary and are red until the prose and the palette catch up — neither needs new capability, both need catch-up:

1. **`test/docs/counts.test.ts`.** It derives the approval-boundary SIZE and membership from the running parser (the `approvalBoundary()` helper, test/helpers/approval-boundary.ts) and asserts that README.md §7, docs/README.he.md and skills/mycontext/SKILL.md state that same derived size and deny `config`'s write forms by name. Update the hand-written prose and deny-list rows in all three documents (and any `commands/*.md` file documenting the same boundary) to match what the parser now reports — the same catch-up shape `ruling 32`/`ruling 34`/`ruling 35` (plan:rulings, seq 32/34/35) already closed for earlier drifts of this exact kind.

2. **`test/ui/palette-lib.test.ts`.** Its 'every composed write needs a deny rule' test computes which boundary commands the Composer palette does not compose, and asserts that set equals exactly the named entries in `NOT_IN_PALETTE` (test/ui/palette-lib.test.ts). `config`'s two write forms are on the boundary now but have no entry in `src/ui/public/lib/palette-defs.js`'s `PALETTE` and no exemption in `NOT_IN_PALETTE`. Either give `config --delete`/`config --disable` a palette entry — the boundary and `--yes` markings on a def are derived from the parser (per the test 'the boundary markings and the --yes flags are the ones the parser gives'), so no hand-marking is needed once the def exists — or add a named, justified entry to `NOT_IN_PALETTE` explaining why the Composer should not compose it, the way `inbox-promote`/`pack import`/`procedure activate`/`procedure done` are already exempted there.
