---
id: DEC-the-mockup-is-a-frozen-reference-it-is-read-never-written
type: decision
title: "the mockup is a frozen reference: it is read, never written, and only the mockup-ahead direction is a finding"
status: active
severity: soft
always: false
summary: "The design drawing is now read-only: it still guides unbuilt features and colours, but the product may run ahead of it without that being a fault."
summary_of: 23a7dd0f370e9af4
scope: []
tags:
  - v2
  - ui
  - mockup
  - owner-ruling
  - gates
origin: human
source_file: "C:/Users/UserC/AppData/Local/Temp/claude/D--Users-UserC-source-repos-test-mycontext-plugin/9e5b6b17-c186-4c93-a0a5-775b4eccd9e7/scratchpad/r1.md"
source_anchor: null
source_checksum: c5b7c16cdff3b0ce
valid_from: 2026-09-02
valid_until: null
checksum: 8550081ed0b4695b
---

# the mockup is a frozen reference: it is read, never written, and only the mockup-ahead direction is a finding

> OWNER RULING, 2026-09-02. Verbatim, across three messages: "i told you not to change the mockup" - "only our app" - "it should stay as reference".
>
> And, clarifying what it is FOR: "the mockup in this stage of the app which is a lot mature now, should be used as a guide especially for features that are not completely implemented and as reference for colors, styles etc"
>
> And: "because of the development process and later decisions, some app features could not appear in the mockup because they are newer then it and it's ok and normal"
>
> **THE FILE IS READ, NEVER WRITTEN.** `docs/design/web-ui-mockup.html` is not edited again. Not one byte. Only the app is changed.
>
> **IT KEEPS TWO LIVE JOBS, and neither of them requires writing to it.** First, it is a GUIDE to features that are not completely implemented: where the app has not yet caught up, the mockup is where you go to read what the thing was meant to be. Second, it is the REFERENCE for colours and styles. A frozen file can do both, because both are reading.
>
> **THE TWO DIRECTIONS ARE NO LONGER SYMMETRIC, and this is the operative half of the ruling.** Mockup-has-it-and-app-does-not is worth reporting - that is the guide job, and it names real work. App-has-it-and-mockup-does-not is NORMAL and must never fail a gate, a review or a report: the app is a lot more mature than the drawing and moves ahead of it by design, because features arrived after the mockup was drawn and later decisions changed others. A check that treats the second direction as a defect is measuring the age of a document, not the health of the product.
>
> **WHAT THIS SUPERSEDES.** Several task bodies carry the instruction "THE MOCKUP IS THE DESIGN OF RECORD AND MUST MOVE FIRST ... Draw it in the mockup, then build it, in one parity-locked commit" - plan:builder seq:5 and plan:walk seq:20 among them - and other items instruct that the mockup moves to match the engine, or that nothing may be added the mockup does not show. THOSE TASKS ARE NOT VOID. Their SUBJECT still stands; only the instruction to EDIT the mockup is dead.
>
> plan:walk seq:20 is the clearest case, and it INVERTS rather than dying. The builder pattern is exactly a not-completely-implemented feature, so the mockup is where the builder gets READ - it is the guide, in the sense this ruling gives that word - and plan:builder seq:5 is where the builder gets BUILT. What used to be two halves, a drawing and a build, is now one build informed by a reading.
>
> Nothing here is rewritten in place. The superseded task bodies keep their words and this decision is related to them, so a reader meets both and can see which instruction is the later one.

## Observations
- [note] The mockup is written to by nothing, ever. Every instruction to draw a thing there first, move a row in it, or regenerate it is dead as an instruction.
- [note] Mockup-ahead is a finding and names real work. App-ahead is normal and must never fail a gate, a review or a report.
- [note] The tasks carrying the superseded draw-it-first instruction keep their subject and their words; only the instruction to edit the mockup is dead.
- [supersession] Replaces TASK-the-mockup-gains-a-command-block-per-procedure-card: Owner ruling 2026-09-07 (plan:walk seq:140, option A). 100% a mockup edit, and the mockup is frozen. The subject ruling DEC-the-procedure-done-command-belongs-to-each-procedure-card is still active and is already satisfied in code: commandRow() builds a div.cmd per call inside procedureCard(). Nothing to build; the app is already right.
- [supersession] Replaces TASK-the-parity-gates-must-understand-a-screen-that-instantiates: Owner ruling 2026-09-07 (plan:walk seq:140, option A). Blocked since 2026-08-25 on work that became permanently impossible on 2026-09-02. The freeze also removes the need: app-has-it-and-mockup-does-not is NORMAL and must never fail a gate, a review or a report - which is exactly the finding class this item existed to suppress, so no data-p mechanism is needed. NOTE: eight plan:builder task bodies still recite this item as their pending gate work; they are now reciting a retired item.
- [supersession] Replaces TASK-documentation-two-answers-the-design-of-record-owes-the: Owner ruling 2026-09-07 (plan:walk seq:140, option A). Retired against three rulings, not one: the freeze kills both actions as written; half 1’s subject was answered by DEC-the-document-page-wears-github-styling-lists-the-readmes-and; half 2’s surface was cancelled by DEC-the-documentation-and-tutorials-screens-become-one-list-and. It fixes nothing measurable today.
- [supersession] Replaces TASK-the-mockup-catches-up-with-preview-whyn-and-work-diffn-needs: Owner ruling 2026-09-07 (plan:walk seq:140, option A): file the two missing relation edges. This item was already status:deprecated and named the freeze in its own body PROSE ONLY, carrying no successor edge - which is what made it look like a sixth retirementEdgeRefusal violation. The edge now exists.

## Relations
- constrains [[TASK-one-builder-component-rendered-from-a-catalogue-entry]]
- constrains [[TASK-draw-the-builder-once-in-the-mockup-as-the-pattern-every]]
- constrains [[INSTR-the-mockup-is-the-ui-specification-build-it-exactly-and-ask]]
- constrains [[DEC-a-drifted-source-is-a-warning-and-the-mockup-moves-to-match]]
- constrains [[DEC-claude-drafts-the-mockup-and-the-owner-approves-the-1-1-rule]]
- refines [[DEC-more-than-the-mockup-is-usually-right-less-than-the-mockup]]
- refines [[DEC-the-app-is-what-is-built-the-mockup-is-history-and-a-gap]]
- supersedes [[TASK-the-mockup-gains-a-command-block-per-procedure-card]]
- supersedes [[TASK-the-parity-gates-must-understand-a-screen-that-instantiates]]
- supersedes [[TASK-documentation-two-answers-the-design-of-record-owes-the]]
- supersedes [[TASK-the-mockup-catches-up-with-preview-whyn-and-work-diffn-needs]]
