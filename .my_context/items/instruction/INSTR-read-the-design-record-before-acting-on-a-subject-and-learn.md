---
id: INSTR-read-the-design-record-before-acting-on-a-subject-and-learn
type: instruction
title: Read the design record before acting on a subject, and learn the intention before proposing an implementation
status: active
severity: hard
always: true
summary: Read the design documents and plans for a subject before changing it, so the work follows what was intended rather than what the code seems to say.
summary_of: 9c90b2ab4fcfb13e
scope: []
tags:
  - process
  - design
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-03
valid_until: null
checksum: f88e369198fc8cb9
---

# Read the design record before acting on a subject, and learn the intention before proposing an implementation

Owner instruction, 2026-09-03, in his own words: "in general when you deal with a subject first go to design documents, specs, plans analysis and other resources most of them under superpowers sdd and docs and learn the intention the rational and so on, after that you will have a better understanding on how to handle implementation and solving issues".

WHAT THIS REQUIRES

Before designing, fixing or ruling on any subject, read what this project already decided about it. The order is: the design record first, the code second. Not the other way round, and not the code alone.

WHERE THE RECORD LIVES

- `docs/superpowers/specs/` - the design documents, which carry the intention.
- `docs/superpowers/plans/` - the numbered plans, which carry the task breakdown and the argument for each step.
- `docs/superpowers/ledgers/` - what was measured and reported along the way.
- `docs/design/web-ui-mockup.html` - the design of record for every screen.
- `docs/` more widely, and `reports/` for the analyses and campaign records.
- This corpus itself: the decisions, requirements, standards and known issues that govern the subject.

WHY, AND IT IS NOT A COURTESY

Code says WHAT it does. It rarely says what it was FOR, and it never says what was rejected. A feature read only from its implementation gets rebuilt as whatever the reader assumed, and the reasoning that made the original choice correct is lost silently - which is the failure this project has paid for repeatedly. The reconciliation of 2026-08-25 found 104 of 109 corpus pointers into the plans stale by up to 1,426 lines, and the reason that mattered is that the plans held the argument the corpus was pointing AT.

A worked example, and it is why this instruction exists. The Doctor screen was treated as a list of findings with an action bolted beside each row. It is not. Doctor was added to this product FOR REPAIRING - that is its role, not a menu item - and reading the design record first would have made the bulk case obvious rather than a later request.

WHAT IT RULES OUT

Reading the implementation and inferring the intention from it. Proposing a design before having read what was already designed. Answering a question about a subject from the code when a spec for that subject exists.
