---
id: TASK-the-index-tier-s-chip-is-invisible-in-the-mockup-and-in-the
type: task
title: the index tier's chip is invisible, in the mockup and in the app alike
status: active
severity: soft
always: false
summary: One label is drawn near-black on near-black and cannot be seen at all; the fault is in the design file, not in the app.
summary_of: d91701b89c9d66fe
scope: []
tags:
  - "plan:screens"
  - "seq:1s-c"
  - "state:done"
  - v2
  - ui
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-22
valid_until: null
checksum: 13f0234ed7001c24
plan: screens
seq: 1s-c
state: done
---

# the index tier's chip is invisible, in the mockup and in the app alike

Found 2026-08-23 by looking at the built tier ribbon beside the design of record's own (screens plan, seq 1s). The primitive rule sets chip color to 0b0c11, near-black, because every chip that uses it also carries a modifier - chip gov, chip ok, chip warn, chip crit, chip carry - and each of those sets its own colour and a light-on-dark ground. TIERCHIP.index is the one entry with no modifier: chip and a diamond glyph. So the fourth ribbon row draws a near-black label with a near-black border on a near-black plate and reads as no chip at all. It is identical in both files - reports/2026-08-23-ui3-1s-preview/mockup-ribbon.png shows the same blank where the index chip should be - so screens/preview.js is 1 to 1 with the design and the defect is upstream of it. What it needs: either an index chip variant in the mockup's stylesheet, or a colour on the bare chip rule. Both are the owner's file. parts.js TIERCHIP is a verbatim transcription of the mockup's own table and must not be edited ahead of it.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: STANDS. It is a defect in the design of record itself, which is the rarest kind this project produces and the one no parity gate can ever report -- both files are identical, so every gate is green while the chip is unreadable in both.

It is the same class as the pulse defect fixed in 301119c: byte-identical rules, a resolved result nobody compared. plan:walk seq:15 ("styles-parity must compare what the cascade RESOLVES to") is the gate that would have caught THAT one; it would not catch this one, because here the cascade resolves the same way in both files and the resolved value is simply wrong. Only a person looking can find this.

IT IS PART OF THE ONE MOCKUP SESSION. The owner s file, the owner s edit, and it can only be done beside the others: plan:walk seq:20 (draw the builder once), seq:13 (the config composer), seq:14 (carry the budget), seq:25 (the markdown route), seq:19 (foreign_store), seq:1h (Hebrew emphasis), seq:3 (a command block per procedure card), seq:6 (the simulate readout s data-t), and plan:screens seq:1s-b, seq:1s-c and seq:10s. TWELVE items, not six -- the reconciliation found six more that had been counted as ordinary open work.
