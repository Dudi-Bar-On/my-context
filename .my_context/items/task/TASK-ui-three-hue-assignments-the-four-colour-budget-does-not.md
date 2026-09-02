---
id: TASK-ui-three-hue-assignments-the-four-colour-budget-does-not
type: task
title: "ui: three hue assignments the four-colour budget does not settle"
status: active
severity: soft
always: false
summary: Three places where the old look used more colours than the new limit allows; how to map them down is the owner's call.
summary_of: b03859596e26c749
scope: []
tags:
  - "plan:repaint"
  - "seq:13a"
  - "state:done"
  - v2
  - ui
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-21
valid_until: null
checksum: cfe7dd40017f2a40
plan: repaint
seq: 13a
state: done
priority: "2"
---

# ui: three hue assignments the four-colour budget does not settle

The approved direction budgets four meaning-hues: gold, ok, carry, crit. Reconciling the 31 planned UI tasks against it surfaced three places where the old design used more colours than the budget has, and the mapping is an owner ruling rather than an implementation detail.

1. AUDIT_KINDS in ui3 task 11 pulses SIX kinds in six colours. Four hues cannot carry six meanings without either doubling up or adding a second channel - shape, position or motion. Deferred to whoever builds #pulse; it should not be decided by them alone.

2. Doctor's three finding levels - error, warn, notice - lost the retired --warn token. The reconciliation assigned crit and gold to keep error and warn distinct. That is a judgement call, not something either plan fixes.

3. Configure's hard-stop and advisory messages shared one undifferentiated class. The reconciliation split them .chip.crit and .chip.gold on the same reasoning.

2 and 3 are shipped as judgement calls and are cheap to change while they are still only plan text. 1 is unresolved and blocks nothing yet.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: STANDS, WITH ONE ITEM DECIDED BY THE BUILD AND ONE PREMISE FALSE. Read the corrections before taking it to the owner.

ITEM 1 WAS DECIDED, by whoever built the pulse, exactly as this task feared it might be -- "deferred to whoever builds #pulse; it should not be decided by them alone". `src/ui/public/screens/watch.js` · `const KIND_HUE = {` · ~164 now ships:
    mutation -> --crit,  access -> --warn,  focus -> --gold,  default -> --ok,
    and a FIFTH treatment, KIND_HUE_UNKNOWN -> --faint, for "a kind this build cannot name"
That is a real answer and an argued one -- the header carries the reasoning, and the unknown hue is an honesty affordance nobody asked for. It is presented for CONFIRMATION, not as an open question.

ITEM 2 S PREMISE IS FALSE. It says doctor s three levels "lost the RETIRED --warn token". --warn IS NOT RETIRED: `styles.css` · `--gold:#e8c368; --ok:#7cc0a0; --carry:#8b9ce6; --crit:#e08b8b; --warn:#c78f3d;` · ~89 declares it beside gold, ok, carry and crit -- `--gold:#e8c368; --ok:#7cc0a0; --carry:#8b9ce6; --crit:#e08b8b; --warn:#c78f3d;` -- and it is used in eight places across decay.js, graph.js, port.js, watch.js, work.js and styles.css itself.

SO THE REAL QUESTION IS THE OPPOSITE OF THE ONE WRITTEN HERE, and it is bigger. It is not "how do three meanings fit in four hues". It is: THE APPROVED DIRECTION BUDGETS FOUR MEANING-HUES AND THE SHIPPED STYLESHEET HAS FIVE. --warn was added back by implementation rather than by ruling, and no gate compares the token set against the budget. Either the direction is stale and the budget is five, or --warn is unauthorised and eight usages need reassigning. THAT is the owner s ruling.

ITEM 3 STANDS unchanged -- Configure s hard-stop and advisory messages split .chip.crit and .chip.gold on the reconciliation s own reasoning, still a judgement call.
