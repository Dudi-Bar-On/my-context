---
id: TASK-budget-simulator-the-fits-chip-writes-n-m-where-the-design
type: task
title: "Budget simulator: the fits chip writes n/m where the design of record writes n of m, because `of` is an unkeyed English word"
status: active
severity: soft
always: false
summary: One small label is written differently from the design because the wording cannot be translated, and someone must decide which spelling wins.
summary_of: b2265ed7b0ec21a0
scope: []
tags:
  - v2
  - ui
  - i18n
  - walk
  - "screen:simulate"
  - mockup
  - "plan:walk"
  - "seq:104"
  - "state:todo"
origin: agent
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-29
valid_until: null
checksum: e018cbe3201d279c
plan: walk
seq: "104"
state: todo
priority: "3"
progress: "0"
needs: walk/92
source: "plan:walk seq:27, measured against src/ui/public/screens/simulate.js on 2026-08-29"
---

# Budget simulator: the fits chip writes n/m where the design of record writes n of m, because `of` is an unkeyed English word

WHAT THE SCREEN IS, so it can be built without opening the mockup. `nav.inj` -- **Budget simulator**, `<section data-p="simulate">`. Drag a budget, watch what fits. A tier picker, a budget slider with its own range control, a five-row fits table it drives, the ADMISSION STAIRCASE and LADDER off `GET /api/simulate/sweep`, and the spill-ratio bar off `GET /api/watch/ratio`. TWO EVENTS, because five tiers do not live on one: `EVENT_FOR` routes `pinned`, `restored`, `continuity` and `index` through `compact` and `jit` through `tool`, so the screen holds two selections at once and reads each tier's row off whichever one ran it. A tier neither event reached is drawn ABSENT (three em dashes), never as a zero -- a `0` would claim it ran and delivered nothing, which is a different fact. No second implementation of `fitToBudget` lives here: `core/select.ts` does not export it and the sweep is the whole answer.

WHAT IT OWES, and after the staircase (seq:7), the range control (seq:7b) and the readout (seq:6) it is the last one on this screen: **the fits column is a ratio and the app cannot write it the way the design of record does.**

`sim.chipn` calls that column a ratio. The mockup's own demo loop writes it as `<n> of <m>`. `screens/simulate.js` writes `<n>/<m>` with a solidus instead, and says why in place: `of` is an unkeyed English literal in the mockup's script, with no key in either string table, and shipping it would put untranslated English inside a Hebrew sentence. It is recorded there as an open question for the owner, and no open question and no task in the corpus carries it.

SO THE SCREEN DIVERGES FROM THE DESIGN OF RECORD IN A CELL A PARITY GATE CANNOT SEE -- the two surfaces draw the same chip with different content, and `screen-parity` counts element KINDS. It is small and it is exactly the kind of divergence that is only ever found by reading, which is why it is written down.

THREE ANSWERS, AND THE OWNER PICKS. Key it -- the mockup gains a `data-t` on the chip and both tables gain the sentence, which is now possible because the gate that forbade an app-invented key was dropped on 2026-08-26 (plan:walk seq:92, which this task waits on). Or rule the solidus correct and CHANGE THE MOCKUP to match, which is the same direction plan:walk seq:3 took for the `.cmd` block and needs a screenshot. Or rule that a solidus needs no translation at all -- defensible, and then it should be written down as a rule rather than as a comment in one file, because the same question will be asked by the next ratio this UI draws.

DO NOT close it by writing `of` into the app. That is the one option the file already refused, for the reason it gives.
