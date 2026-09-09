---
id: TASK-a-lane-is-named-by-what-it-did-and-never-by-what-it-is-so
type: task
title: a lane is named by what it did and never by what it is, so the terminal name is missing
status: active
severity: soft
always: false
summary: A helper agent shows the kind of agent it is beside what it was asked to do, matching the name you already recognise from the terminal.
summary_of: bbbb73c64af7e0da
scope:
  - src/ui/public/screens/conversations.js
  - src/ui/read-model-conversations.ts
tags:
  - v2
  - archive
  - ui
  - "plan:archive"
  - "seq:50"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-09
valid_until: null
checksum: 9c370373425f1c9f
plan: archive
seq: "50"
state: done
priority: "1"
needs: archive/15
---

# a lane is named by what it did and never by what it is, so the terminal name is missing

Owner report 2026-09-09, having clicked through to a lane successfully: "near the agent there was no
name like the names i see on the terminal that mostly starts with general purpose".

WHAT HE MEANS IS THE AGENT TYPE, NOT THE DESCRIPTION, and that distinction is the whole item. The
terminal names a lane by its KIND first - general-purpose - and this viewer never draws the kind at
all. My first reading was that the description was missing; measured, all 223 Agent tool_use blocks
carry one, and DETAIL_FIELDS already surfaces it because an Agent call has no `command` so
`description` wins. So the thing he recognises from the terminal and cannot find here is the TYPE.

AND IT IS ALREADY SERVED. `mycontext conversation subagents` prints it as its own column - measured,
every row reads general-purpose - so agentType comes off the sidecar and through
/api/conversations/:id/subagents to laneIndex without anything new being read.

WHERE IT BELONGS: beside the link on the dispatching step, and on a roster row. seq:41 roster
already draws type; the DOCUMENT does not, which is where he was looking.

TWO THINGS TO GET RIGHT:
  - TYPE AND DESCRIPTION ARE DIFFERENT FACTS AND BOTH ARE WANTED. The type says what kind of worker
    it is; the description says what this one was asked to do. The terminal shows both, and a row
    showing only one is the state he is reporting. Draw them as two fields rather than
    concatenating them into a sentence.
  - EVERY LANE IN THIS CORPUS IS general-purpose, WHICH MAKES THE FIELD LOOK USELESS AND DOES NOT
    MAKE IT SO. Measured on his own roster: every row. A field constant today is still the field
    that tells an Explore lane from a Plan lane the day one appears. Do not conclude from one
    uniform corpus that it carries nothing.

DONE 2026-09-09 — WHERE EACH FIELD IS DRAWN

`laneKind(ctx, lane)` in `src/ui/public/screens/conversations.js` is the one renderer, and it draws
ONE named field: the label `type` and the value in its own monospace bidi-isolated run
(`conv.lanes.kind` = `type {mv:type}`, Hebrew `סוג {mv:type}`). Two surfaces call it:

  1. THE DISPATCHING STEP, which is where he was looking. `laneMark` now returns a LIST of marks
     instead of one node - the kind, then the link - and `stepParts` appends them to
     `.tvstephead` after `.tvdetail`. So the line reads, on his own corpus, driven in a browser:
     `2491  Agent  Measure whether subagent payloads carry a title  type general-purpose  Open
     this agent's transcript in a new tab - 198 records`. The brief and the kind are two runs;
     nothing is concatenated. `drawDeed` takes the same list, so a promoted call keeps the join.
  2. THE ROSTER ROW (seq:41). It already drew the type, as a BARE monospace run between the agent
     id and the record count, where it read as a second identifier rather than as an answer to
     "what kind of agent is this". It now draws the same named field as the document, so the word
     `type` means the same thing on both surfaces and in the CLI column it is taken from.

CSS is two declarations (`.tvkind`, `.tvkind .m`) - the label stays in the surrounding `--dim`, the
value takes `--ink`. No new hue, so the five-hue budget is untouched; no chip, because
`.tvstephead` wraps and a bordered box that breaks draws two open-ended boxes (`.tvlane`'s own
ruling). Nothing in `read-model-conversations.ts` changed: `agentType` was already served.

WHAT WAS MEASURED, INCLUDING WHERE THIS ITEM WAS WRONG

  - THE FIELD IS NOT CONSTANT, and the item's second warning is the one thing here that did not
     survive measurement. Over the whole index, 2026-09-09: 269 lanes, EIGHT distinct types -
     233 `general-purpose`, 21 `Explore`, 8 `fork`, 2 `frontend-excellence:css-expert`, 2
     `feature-dev:code-explorer`, and one each of `pr-review-toolkit:silent-failure-hunter`,
     `pr-review-toolkit:pr-test-analyzer`, `frontend-excellence:component-architect`. That is 36
     of 269 rows, 13%, saying something the brief does not. Driven in a browser on his own roster,
     all 270 rows drew a type and the tally on screen matched the index exactly. The conclusion the
     item drew is unchanged and stronger: the field discriminates TODAY, not one day.
  - THE VALUE MUST COME OFF THE ROSTER AND NOT OFF THE CALL. The dispatching call carries
     `subagent_type` in its own input, so the fold's argument list already showed it - sometimes.
     Measured on this project's session files: 227 `Agent` calls, 227 with a `description`, only
     214 with a `subagent_type`. Thirteen dispatchers named no type at all, and those thirteen
     steps would have drawn nothing. The sidecar carries `agentType` for 269 of 269 indexed lanes,
     and `/subagents` already served it into `laneIndex`, so the roster is both the complete
     answer and the one already in hand. `e2e/conversations.spec.ts` asserts the fixture's
     depth-2 call carries no `subagent_type` of its own, so that test would go red if a later
     build read the arguments instead.
  - NO LANE IN THIS WORKSPACE LACKS A TYPE (269 of 269), so an absent type draws nothing rather
     than a sentence with no measured occurrence - the same answer the roster row always gave.

THE EVIDENCE

`e2e/conversations.spec.ts`: `a dispatching step says what KIND of agent it opened, beside the
brief` (en + he) asserts the kind run, its label in the reader's own language, its value
`Explore`, that the value is NOT the common word, that `.tvdetail` still carries the brief and
carries no type, and that the call recorded no type of its own. `a roster row carries the kind of
agent and its brief as two fields` asserts `general-purpose` on the parent row and `Explore` on
the child, each beside its own brief. `the turn that dispatched a lane opens it, and the reader
does not move` (en + he) gained the same assertion on the SESSION's own 120-round document, half
way down, which is the screen he was on. All six green in chromium.
