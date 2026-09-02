---
id: TASK-readme-section-8-still-owes-the-sentence-that-the-id-is-not
type: task
title: README section 8 still owes the sentence that the id is not supplied automatically
status: active
severity: soft
always: false
summary: The main guide never says that starting a session does not name it for you, and that naming it is a manual step.
summary_of: 9a60a2483ba26d52
scope: []
tags:
  - "plan:hooks"
  - "seq:16b"
  - v2
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-24
valid_until: null
checksum: c877d2fb1b84af5c
state: todo
plan: hooks
seq: 16b
needs: rulings/48
---

# README section 8 still owes the sentence that the id is not supplied automatically

Split out of plan:hooks seq:16 when the owner ruled it observe-only on 2026-08-24 (DEC-the-slash-command-hook-observes-and-does-not-write).

The plan's decision table says that when the automatic half is not delivered, the fact is recorded "in the probe file and in `README.md` section 8 ... and why". The probe file has it. The README does not.

WHAT THE SENTENCE MUST SAY, and it is small: a mycontext slash command is RECOGNISED - the hook records which one ran and the session it ran in - but it does not NAME the session for you. `mycontext session list` then `mycontext session name <id> <name>` is the route, and the id is copied by hand.

Say why, because the why is the interesting half: the hook could do it, and was declined deliberately - a hook that writes on a keystroke, into the store that had a lost-update defect until this week, under an invariant that says it must fail open. A write that fails open is a write that sometimes does not happen.

BOTH READMES. `docs/README.he.md` mirrors the English and `test/docs/parity.test.ts` holds them to the same heading structure.

AND NOTE plan:rulings seq:48: neither README is walked by `verify:citations`, so a claim added here is not gated. That is an argument for stating what is MEASURED rather than what is intended.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: STANDS, and it is the LAST open item of plan:hooks -- which matters disproportionately, because plan:hooks seq:22, an owner instruction, records itself blocked until "the hooks programme completes" and this is the whole remainder.

It is one sentence, and it is already written in this task: a mycontext slash command is RECOGNISED -- the hook records which one ran and the session it ran in -- but it does not NAME the session for you; `mycontext session list` then `mycontext session name <id> <name>` is the route, and the id is copied by hand.

AND IT LANDS IN A DOCUMENT NO GATE CHECKS: plan:rulings seq:48 established that verify:citations walks neither README, which is how six false claims sat there. So this sentence, once written, is unprotected -- write it with the citation-scope work, not before it.
