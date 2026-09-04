---
id: TASK-the-no-writes-ban-only-sees-writers-its-table-already-names
type: task
title: the no-writes ban only sees writers its table already names — derive the membership
status: active
severity: soft
always: false
summary: The check that the screens change nothing only notices the ways of writing someone listed by hand, so a new one slips past unnoticed.
summary_of: fd8ea303dfdb5f29
scope: []
tags:
  - v2
  - security
  - testing
  - ui
  - "plan:rulings"
  - "seq:50"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-27
valid_until: null
checksum: 278f41ecd9ab5151
plan: rulings
seq: "50"
state: done
priority: "2"
source: found 2026-08-27 by an agent that refused to add itself to the allow-list
---

# the no-writes ban only sees writers its table already names — derive the membership

FOUND 2026-08-27, by an agent that added a write to `src/ui/server.ts` and reported that `no-writes.test.ts` STAYED GREEN — rather than adding itself to `RULED_WRITES` and moving on.

THE HOLE. `test/ui/no-writes.test.ts` has two halves. `RULED_WRITES` is the second: the exact set of write bindings the owner has ruled into `src/ui/`. `WRITERS` is the first: a hand-maintained table of (defining module -> the symbols in it that write), consulted by `isWriter`.

**The ban detects only writers the table already knows.** A new module that writes files resolves correctly, is placed correctly in its defining module, and is then judged a NON-WRITER — so `src/ui/` can bind it and the equality assertion never notices. `src/core/ui-server-record.ts` did exactly that: two writers (`writeUiServerRecord`, `clearUiServerRecord`) bound by the server, and 14/14 green.

Naming the module in `WRITERS` turned it red immediately, which is the gate working — but the naming is the step nothing enforces, and it is a step a person has to remember at exactly the moment they are busy adding a write.

THIS IS THE PINNED RULE LANDING ON THE CHECKER ITSELF. `RULE-prove-your-measurement-can-see-every-kind-of-member` is a rule about the things this project measures; here the thing that cannot see every member is a security gate. The file's own header already says the same about star forms: "a star form silently treated as 'no symbols' is a checker that passes by looking at nothing (INV-nothing-is-dropped-silently applies to the checker itself)". This is that argument, one table over.

WHAT WOULD CLOSE IT. Derive the table's MEMBERSHIP rather than its contents: scan every module under `src/core/` and `src/pack/` for a call to a filesystem write API (`writeFileSync`, `appendFileSync`, `renameSync`, `rmSync`, `mkdirSync`, `copyFileSync`, and the `fs/promises` forms), and assert that every module which has one appears as a key in `WRITERS`. The symbol lists stay hand-written — deciding WHICH exports of a writing module are the writers is a judgement — but a module that writes and is not named at all becomes impossible.

The masking machinery this needs already exists in the same file (`maskNonCode`), and the scan is the shape `uiFilesOnDisk` already uses. The failure mode of the derivation is over-reporting a module that writes only in a code path nothing exports, which is a name in a table rather than a false refusal — the safe direction.

WHY IT IS NOT URGENT AND SHOULD STILL BE DONE: every write currently in `src/ui/` is ruled in and correct. The hole is not that something got through; it is that nothing WOULD have.
