---
id: TASK-security-ts-split-the-two-host-refusals-and-record-every
type: task
title: "security.ts: split the two Host refusals, and record every refusal in the audit log"
status: active
severity: soft
always: false
summary: Tell apart a request with no address at all from one with the wrong address, and keep a record of every request that was turned away.
summary_of: adc3ac82e0b6cd46
scope: []
tags:
  - "plan:rulings"
  - "seq:25"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-20
valid_until: null
checksum: ff0d7483508dbd10
plan: rulings
seq: "25"
state: done
progress: "100"
priority: "1"
source: "reports/V2-HANDOVER.md#twelve-owner-rulings"
last_change: "2026-08-20T17:57:34Z"
---

# security.ts: split the two Host refusals, and record every refusal in the audit log

Rulings C6 and B4, both in src/ui/security.ts.

C6 - dropping the echo made absent-Host and wrong-Host the same string, where the interpolated value used to tell them apart. Two fixed literals restore the distinction with no submitted input in either. 'No Host header at all' and 'a Host that is not loopback' are different failures.

B4 - record one audit entry per refused request, carrying the check that refused AND the submitted Host/Origin. That is where ruling 11 said the submitted value belongs, and it gives the dropped echo somewhere real to go.

THE TENSION, to be resolved rather than ignored: the UI is a read-only surface and this is the one thing it writes. It is a write on the REFUSAL path only, never on a served read. Task 13's byte-identical assertion must be scoped to say so, or it will go red for the right reason at the wrong time.

EXPLICITLY DECLINED by the owner, do not implement: an empty token header stays 403 rather than 401, because Task 13's handoff exemption keys on 401 meaning exactly 'no token header'. And unpresented nonces are NOT swept.
