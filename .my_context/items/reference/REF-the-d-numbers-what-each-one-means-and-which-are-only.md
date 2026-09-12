---
id: REF-the-d-numbers-what-each-one-means-and-which-are-only
type: reference
title: "the D numbers: what each one means, and which are only proposed"
status: active
severity: soft
always: true
summary: The short numbers used to talk about work in progress and what each one refers to, kept as a bare map so the same number never means two things; D56 widened on 2026-09-12 to the record that says where the server is.
summary_of: e511ecadba3b963a
summary_was:
  - 2026-09-12 The short numbers used to talk about work in progress and what each one refers to, kept as a bare map so the same number never means two things; five more were added on 2026-09-12 for work that had no subject.
  - 2026-09-12 The short numbers used to talk about work in progress and what each one refers to, kept as a bare map so the same number never means two things; a number for the bookmarks ruling was added on 2026-09-12.
  - 2026-09-12 The short numbers used to talk about work in progress and what each one refers to, kept as a bare map so the same number never means two things; D56 was added on 2026-09-12 for the upkeep mechanism that keeps losing the owner’s server.
acknowledged:
  - reference_no_source@8e51ecb88264cf81
scope: []
tags:
  - v2
  - planning
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-07
valid_until: null
checksum: f74b63412cbbe230
---

# the D numbers: what each one means, and which are only proposed

RULE-progress-is-reported-as-two-tables-with-stable-d-numbers says a D number is STABLE FOREVER -
never renumbered, never reused, appended at the end. AND A D NUMBER NAMES A SUBJECT, not a fixed
list of items - the D37 precedent, ruled 2026-09-08: a subject may WIDEN, and widening is neither
renumbering nor reuse. THIS ITEM IS THE MAP. When a D number is assigned, add it here in the same
act: assigning a number and recording it here are ONE ACT. A number announced in a message and not
written here is not a D number yet, whatever the message said.

PINNED 2026-09-07 BY OWNER RULING: "save D persistent". It is the only place a D number survives a
compaction. The value of a stable number is that he can say "do D11" across sessions and mean
exactly one thing; reusing one would silently redirect an instruction of his.

THE NARRATIVE BEHIND THESE ROWS - every widening, every retired instruction, the measurements that
produced D40, and the reasoning for the order - is in `reports/2026-09-11-the-d-numbers-record.md`.
This item carries the MAP. That report carries the RECORD.

RATIFIED - the owner has used these numbers himself.
  D1-D5   doctor perf | a cancelled dependency is discharged | builder re-cut | the 24 Hebrew tutorials
  D6      the citation gate           plan:rulings seq:64, rulings/38, 47, 67, walk/143  OPEN
  D7      the audit projection index
  D8      the Hebrew RTL convention   plan:docsys seq:12
  D9      the ins/del markers         ruled: the grammar stays at five markers
  D10     four Composer pickers
  D11     long pickers                plan:builder seq:16 + seq:10, builder/12         OPEN
  D12     the Composer tested as a user   plan:builder seq:11, walk/129, screens/25    OPEN
  D13a/b  the CLI help browser        plan:library seq:1
  D14     the handover re-asks at every percent            handover/19                 OPEN
  D15     the ASK display
  D16     the dependency budget       plan:governance seq:5
  D17     the handover lag            plan:handover seq:17
  D18     on-demand handover update (CLI, slash command, MCP tool)
  D19     the handover checked for truth
  D20     an id in a result opens the item pane   plan:builder seq:13
  D21     the result card names the command       plan:builder seq:14
  D22     Run removed from the Composer           plan:builder seq:15
  D23     pointers not claims - convention adopted, check declined   handover/16       OPEN
  D24-D26 the help skeleton, the worked lines, the cross-references
  D27     the help tested for truth   plan:library seq:6                       OPEN
  D28     both READMEs               plan:docsys seq:11                        OPEN (needs D27)
  D29     code citing a retired item is named     plan:governance seq:6
  D30     the browser suite off the demo corpus   plan:port seq:99 + seq:100, port/101,
          rulings/63                                                                    OPEN
  D31     the 42 walk items measured and ruled    plan:walk seq:140
  D32     Ask and Capture reviewed, not merged    plan:walk seq:141, walk/76, walk/100,
          ui3/15                                                                        OPEN
  D33     the contradiction gate                  plan:contra seq:2, seq:3
  D34     restoring a session from its transcript plan:restore seq:1-2
  D35     a test declares what it rests on        plan:basis seq:1-2
  D36     the agent self-improvement loop         loop/1-5, loop/1 FIRST
          D36a instrumentation and the baseline   D36b the trigger and the pass
          D36c proposals and the artifact         D36d review, decline, the indicator
          D36e retirement and the bounded cap     (plans under docs/superpowers/plans/)
          loop/1 IS FIRST AND IT IS NOT A PREFERENCE: drift is detectable only as a CHANGE, so
          instrumentation added after the first promotions has no baseline and no control.
  D37     the conversation archive rebuilt        plan:archive seq:1-54   CLOSED 2026-09-11, 54 of 54
  D38     the corpus lifecycle is enforced        governance/8 + contra/4, rulings/65  OPEN
  D39     Export / import: make the screen true   DEFERRED by owner ruling, below every open D
  D40     a contrast ratio is computed against a colour that is not painted   STARTS NOW (D37 closed)
          The ground under a card is a radial gradient, not `--panel`/`--panel-2`/`--paper`; every
          ratio computed from those tokens is a claim about a colour that is not there, and it MOVES
          with position. Read the ground FROM THE RENDER; `e2e/frame-paint.spec.ts` is the example.
  D41     the product rule store      docs/superpowers/specs/2026-09-10-product-rule-store-design.md
  D42     conversation retrieval      docs/superpowers/specs/2026-09-10-conversation-retrieval-design.md
          recall/2 is phase 2                                                           OPEN
  D43     a lifecycle note stops making a summary stale
  D44-D55 ASSIGNED 2026-09-12 to give today's open work a subject; every one of them is OPEN.
  D44     the app matched against its design of record  port/93 + 98, walk/4 + 15 + 55,
          ui-gates/1, ui2/5r
  D45     every standing refusal says what would unblock it   walk/11 + 12 + 32 + 33,
          ui2/10p (the recorded exception under this subject, and not work)
  D46     absent is not zero - a blank says why it is blank   screens/24, walk/57 + 89 + 139
  D47     an English sentence reaches the screen with no key  walk/43 + 102 + 105
  D48     Configure composes a change, and something confirms it took   budget/6, ui2/13,
          walk/14 + 18 + 106
  D49     the budget simulator measures the real window   walk/8 + 59, ui1/17b
  D50     a surface built to carry an explanation, and nothing fills it  screens/23, walk/39 +
          119 + 144
  D51     a fact kept by hand in a second place, derived instead   tuts/9, repaint/12,
          rulings/33d + 49 + 53 + 55 + 66, hooks/12q
  D52     what reaches the audit record, and whether its stores are current   budget/15,
          walk/66, live/24
  D53     a delegated lane is stopped by a mechanism, not an instruction   live/20
  D54     what a skill is, and whether our 39 are skills   review/3 + 4
  D55     mycontext helps from the first second, unconfigured   hooks/22
  D56     the mechanism that keeps the server up is what keeps taking it down   live/25 + 26
          ASSIGNED 2026-09-12. Distinct from D53, which is about STOPPING a lane; this is about
          a hook keeping a server ALIVE. Filed after the 2026-09-11 fix was live and did not hold.
  D57     every anchor capability is reachable from the screen   REQ-every-anchor-capability-is-
          reachable-from-the-screen-and-a   ASSIGNED 2026-09-12. The only open subject whose work
          is a REQUIREMENT and not a plan/seq task, so it is cited by id. Owner ruling, hard.
  D58-D62 ASSIGNED 2026-09-12 from the triage of the tasks that had no subject. The owner took
          every recommendation: three tasks WIDENED existing rows above (walk/143 onto D6,
          walk/144 onto D50, hooks/12q onto D51) and five needed subjects of their own.
  D58     the UI is present and changes nothing   rulings/21
  D59     a test binds its port through the guard, not by convention   walk/82
  D60     a time on a screen says which clock it is in   walk/142
          NOT a widening of D37: D37 closed at a counted 54 of 54 and widening it would falsify
          that close.
  D61     a disclosure sits beside the card it qualifies   walk/2
  D62     search finds the same words in another order   walk/134
          Distinct from D42: D42 retrieves from the conversation archive, this searches the
          corpus. The same verb over different stores.

THREE SEQ COLLISIONS WERE BROKEN 2026-09-12 and the new numbers are what the rows above cite.
`walk/142` named two open tasks and `rulings/21` named two, one of them closed; one task carried
`plan: walk` with NO seq at all, so nothing could cite it. The rule applied was LEAVE THE OLDER
ITEM AT THE ADDRESS: the citations task moved to walk/143, the help task took walk/144, and the
closed backlink task moved to rulings/68. Five collisions remain and are not mine to renumber
here: handover/12, probe/0, rulings/20, ui3/11x (six items) and walk/138.

THE ORDER AFTER D37, RULED BY THE OWNER 2026-09-09: D38, then D33, then D36 (loop/1 first).
The reasons are in the dated report; they were: D38 is small and half of it IS contra/4; D33 makes
the corpus trustworthy and everything rests on that; D36 is largest and has nothing built.

ONE RULING WITH NO WORK ATTACHED, kept here because this item is its only copy: plan:contra seq:2
asked whether the tests that rest on an item should be STORED on it. THE OWNER RULED: KEEP DERIVING
IT - nothing is stored, so nothing can go stale, and the answer is current by construction.

WHAT IS MISSING HERE, said rather than guessed: several ratified rows have no item reference,
because the D number was used in conversation and the work was never filed against a plan/seq - D1
to D5, D7, D13b, D14, D15, D18, D19, D23, D24-D26. Do not invent one to make the table look even.
Fill a row only from evidence. Where such a row now carries one, that reference is
the OPEN work that widened the subject, not its origin.
