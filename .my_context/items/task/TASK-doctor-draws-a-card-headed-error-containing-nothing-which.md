---
id: TASK-doctor-draws-a-card-headed-error-containing-nothing-which
type: task
title: doctor draws a card headed error containing nothing, which reads as an error
status: active
severity: soft
always: false
summary: An empty box titled error reads as an error, so good news looks like bad news on the very screen people open to check.
summary_of: c31ee9b93eb97ede
scope: []
tags:
  - v2
  - ui
  - review
  - "screen:doctor"
  - "plan:walk"
  - "seq:34"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-25
valid_until: null
checksum: 1824205e7927d5c3
plan: walk
seq: "34"
state: todo
priority: "2"
source: "plan:review seq:5, the functional UX review, 2026-08-25"
---

# doctor draws a card headed error containing nothing, which reads as an error

FOUND 2026-08-25 by plan:review seq:5, the functional UX review, 2026-08-25 on a corpus with one finding.

MEASURED. `doctor` builds one `div.card.pane` per level -- error, warning, notice. On `.demo-corpus` the warning card correctly carries its one `source_drift` finding. The other two cards render with a heading and NOTHING ELSE:
    [error]   rows=0   full text of the card: "error"
    [notice]  rows=0   full text of the card: "notice"

A CARD LABELLED "error" WITH NOTHING IN IT READS AS AN ERROR, not as the absence of one. It is the worst possible rendering of good news, and it is on the screen a user opens PRECISELY to find out whether anything is wrong.

IT IS THE SAME DISTINCTION THIS PRODUCT HAS DRAWN CORRECTLY FOUR TIMES ELSEWHERE -- a measured zero and an undrawn thing are two facts: watch draws a floor line under an empty pulse, the ask read model answers 200 with no columns rather than 120 columns of zero, the export model serves an unbuilt format rung as `built:false`, and `plan:rulings seq:26` asks for it again for the ledger. Doctor is the one place it was not applied, and it is the loudest.

THE WORK: an empty level says so, in a keyed sentence. Mockup first, then both tables. Or, if the design of record draws no empty card at all, DRAW NO CARD -- but then the reader cannot tell "no errors" from "the error card failed to render", which is why a sentence is better than an absence.

CHECK THE OTHER EMPTY TABLES IN THE SAME PASS, found by the same sweep: `gaps` draws `Where/What/Next` with zero rows, and `injected` draws `Item/Tier/When` with zero rows. Both are CORRECT states on this corpus -- there are no coverage gaps -- and neither says so.
