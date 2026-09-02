---
id: NOTE-the-three-proposed-screens-audited-six-verdicts-spec-before
type: note
title: "the three PROPOSED screens audited: six verdicts, spec before plan"
status: active
severity: soft
always: false
summary: "Three planned screens are each only partly defined: what they should do is unstated in places, and the missing parts are design decisions, not building work."
summary_of: 9a494672a0699ac5
scope: []
tags:
  - v2
  - ui
  - proposed
  - audit
  - "plan:walk"
  - "seq:5a"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-02
valid_until: null
checksum: e82efb1b168bc22a
---

# the three PROPOSED screens audited: six verdicts, spec before plan

Answers plan:walk seq:5, which ran on 2026-08-29 and filed findings without ever recording the two verdicts it asks for. Six verdicts, three screens, in the task's own order and not collapsed.

ONE NOTE RATHER THAN THREE, because the answer to question 2 is the same answer three times -- one plan of one paragraph per screen, each saying "read the mockup as the specification and take its DESIGN, never its behaviour" -- and a reader who found only one note would read a shared cause as a local accident.

THE DESIGN OF RECORD SAYS THIS ABOUT ALL THREE BEFORE ANY OF THEM IS OPENED. Its own header: "Screens marked PROPOSED are not built and not specified. They are here because the owner asked for them; the label is the whole point." That is the design of record declaring its own incompleteness on exactly these three sections, and it has not been withdrawn -- all three still carry the PROPOSED chip in the slot where the other eighteen screens carry a verdict sentence.

PROCEDURES

1. IS THE SPEC COMPLETE? NO. The section draws its layout and its static prose in full, and two of its own statements are contradicted by the product while a third state is undrawn. Its table is headed "Four states, and exactly one of them injects"; the stage list is five -- proposed, ready, active, done, abandoned -- and pr.aband, drawn on the same section, names the fifth in prose with no row for it. Its ready row promises "index line only"; the selector admits active only, so no ready procedure has ever reached an index line. There is no zero state, and the five disclosures the running screen must draw have no key. The verdict slot holds the retired chip and none of the 26 pr. keys is a verdict sentence. The missing part is DESIGN and returns to the owner; it is not implementation work.

2. IS THERE A PLAN, AND DOES IT COVER THE SPEC? There is a plan and it does not cover the spec. plan:port seq:7 is the whole of it, one paragraph, approved 2026-08-22, and it delegates the specification to the mockup -- so it can cover no more than the mockup does. It was scoped to layout, graphics and static content and never reached any of the four gaps above. What is owed is tracked at plan:walk seq:96 (the ready row and the fifth row, together and not by halves), seq:97 (keys for the disclosures and the zero state), seq:108 (the verdict sentence), seq:2 and seq:3 (disclosure placement, and a command block per card). Five items, every one of them a mockup edit.

EXPORT / IMPORT

1. IS THE SPEC COMPLETE? NO on import; YES on export. Export is stated in every state -- six rows with a travels / filtered / rebuilt verdict, the history filter and where imported records land, three format rungs in order of preference with the reason for each, what it adds over git, and a real command. Import is a heading and a three-row example table, "three buckets, and nothing applies unconfirmed", and the design draws no artefact chooser, no confirm step, no per-bucket item list, and no error, conflict or zero state. The three ids in that table are illustrations rather than data. The behaviour is left to be inferred, which is the failure the audit's own ordering exists to catch. The verdict slot is again the retired chip; none of the 18 port. keys is a verdict.

2. IS THERE A PLAN, AND DOES IT COVER THE SPEC? There is a plan, it covers the export half completely, and it stops exactly where the spec stops. plan:port seq:8b enumerates the six rows, the audit kinds that carry and the five that do not, the three format rungs, the argv and seven disclosures, all answered by GET /api/port, and it names the three things the screen must get right -- including that the bucket ids are illustrations and that sorting real ids into buckets needs an artefact to have arrived. Neither plan nor spec reaches import behaviour, and that is deliberate rather than an oversight: there is no POST anywhere in this UI, and plan:walk seq:89 rules that building one is a separate decision and must not be taken to close a task.

TEMPLATE PACKS

1. IS THE SPEC COMPLETE? NO, and it is the closest of the three. Its static half is stated in states and with reasons: both import routes land as draft and there is no --trust flag, because a boundary a flag can override is not a boundary; what a pack may carry and what it never carries, with the line drawn once; four integrity rows and an explicit account of what a digest does not prove. On 2026-08-26 it gained the half it had been missing altogether -- one card per imported pack, the wire's own field names, and a bounded list with a show-all. What is still unstated is three of that card's own fields: quarantined, dropped and missing are counts the engine computes and no key can word, held open at plan:screens seq:10s. The verdict slot is the retired chip; none of the 20 pk. keys is a verdict.

2. IS THERE A PLAN, AND DOES IT COVER THE SPEC? There is a plan and it does not cover the spec, and here it is the plan that is behind rather than only shallow. plan:port seq:8 is one paragraph of the same shape as Procedures' -- build the layout, graphics and static content from the mockup section -- and it predates the per-pack card entirely. The half of this screen a person actually uses was built ahead of both its plan and its design, and no plan item covers it.

NOTE-packs-is-the-app-ahead-of-its-design-and-well-defended IS NOT THE ANSWER TO EITHER QUESTION and was read before these verdicts were written. It is a tree-parity measurement from 2026-08-25 -- 73 mockup nodes against 124 app nodes, every extra one deliberate -- and it ends "Nothing on this screen needs building." That is a statement about IMPLEMENTATION, which is the third question the audit says to reach only after the first two. It is evidence for verdict 2 above, because an app ahead of its design is precisely a plan that did not cover the spec, and it is evidence against nothing.

WHAT IS BUILT, AND WHAT IS LEFT -- reached last, as the audit requires. All three screens ship, are registered, are on the rail and are read from real endpoints. Nothing on any of the three is waiting on implementation. Every gap above is DESIGN work: three verdict sentences to draft and take to the owner, one corrected and one added row on the Procedures table, keys for a zero state and five disclosures, keys for three computed pack counts, and a decision about whether an import surface is in scope at all. None of it may be scheduled as implementation, which is what the audit's ordering was written to prevent.
