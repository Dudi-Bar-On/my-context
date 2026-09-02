---
id: TASK-build-init-rewrite-watched-and-offer-it-from-the-doctor
type: task
title: build init --rewrite-watched, and offer it from the doctor screen
status: active
severity: soft
always: false
summary: A one-command way to rebuild the list of watched documents when it no longer matches the project, offered from the health screen and confirmed first.
summary_of: c8c536063994cd6b
scope: []
tags:
  - v2
  - ui
  - "screen:doctor"
  - tree-parity
  - cli
  - "plan:walk"
  - "seq:18"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-25
valid_until: null
checksum: 209b035b5f5c3b11
plan: walk
seq: "18"
state: todo
priority: "1"
source: "plan:port seq:98, doctor"
needs: walk/106
---

# build init --rewrite-watched, and offer it from the doctor screen

Carries out the ruling that a dead watched-docs list earns a one-command repair.

TWO SMALL CHANGES IN TWO PLACES:
1. `mycontext init --rewrite-watched` -- a flag on the existing command, which already knows how to write `watchedDocs` from what the repository actually has.
2. `repairCommandFor` in `lib/viewmodel.js` gains `watched_docs_no_match`, beside the four codes it already answers.

THE FLAG WRITES CONFIG, so it is a CLI act and not a UI one. The deny hook s rule is that changes to `.my_context/config.json` are the user s to make; a command the user chooses to run IS the user making it, which is exactly why the repair is a `.cmd` block to copy and not a button.

THE LIST REPLACES AND NEVER MERGES -- the mockup s own Watched documents card says so, and says why: "a list you wrote must not silently gain globs you did not". A rewrite flag is the sharpest possible version of that hazard, so it must say what it will replace before it does, and `--yes` must be required for it exactly as the rest of this CLI requires it on an approval boundary.

CHECK IT AGAINST THE MOCKUP S OWN SPELLING once built: the design writes `mycontext init --rewrite-watched`, and `palette-lib.test.ts` fails a catalogue that advertises a flag the command refuses.
