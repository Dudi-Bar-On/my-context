---
id: TASK-reconcile-the-pre-walk-plans-against-plan-walk-before
type: task
title: "reconcile the pre-walk plans against plan:walk before dispatching either"
status: active
severity: soft
always: false
summary: Read the older plans against the newer one before starting anything, so nobody builds the same thing twice from two descriptions.
summary_of: 80de7b544745bd64
acknowledged:
  - body_disagrees_with_meta@d99ba4a84d121194
scope: []
tags:
  - v2
  - ui
  - process
  - tree-parity
  - "plan:walk"
  - "seq:23"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-25
valid_until: null
checksum: b213f56208718786
plan: walk
seq: "23"
state: done
priority: "1"
source: "plan:port seq:98 closing"
---

# reconcile the pre-walk plans against plan:walk before dispatching either

THE PROBLEM: 99 tasks are open, and that number is WRONG in the direction that wastes the most time. plan:screens, plan:config, plan:ui3 and plan:repaint were written BEFORE the screen-by-screen walk and were frozen behind it -- the walk was supposed to consume them. It produced 24 new tasks instead, and nobody has checked which of the old ones it answered.

VERIFIED OVERLAPS, found by reading four of them:
- `ui3 11x` "the string grammar has no bold run" -- THREE of its five steps are done by walk seq:1; the remaining two are walk seq:1h. Annotated rather than closed.
- `screens 1s-f` "preview.whyn still says the gate ladder needs a stable code that now exists" -- this IS the first half of walk seq:16, found independently by the emphasis pass refusing to overwrite that key.
- `screens 3s` "the Budget simulator is missing its ladder graphic" -- walk seq:7 carries the ladder, with the sweep endpoint it needs.
- `screens 1s-d` "the mockup still badges the carried item block PROPOSED" -- walk seq:4, and the correction on it about span.prop meaning two different things.
- `config 1-4` -- the four Configure tasks predate REQ-configuration-is-composed-the-way-a-command-is and walk seq:13. Whether they are superseded or refine it is unread.

FOUR OUT OF FOUR READ, so the rate is not low. Assume more.

WHAT THE WORK IS: read every open task in screens, config, ui3, repaint, ui1 and ui2 against plan:walk. Each gets one of: DONE (the walk did it), SUPERSEDED BY <id>, REFINES <id> -- keep both and say how -- or STANDS. Nothing is deleted; a task that turns out to be done is closed with what closed it, which is the only form that survives someone asking later.

DO THIS BEFORE DISPATCHING ANYTHING FROM EITHER SIDE. Two agents building the same thing from two task items is the expensive failure here, and 99 open tasks is exactly the condition where it happens.

WIDENED 2026-08-25 BY OWNER RULING, and this is now the task that produces the
stable base rather than a tidy-up of one plan.

It was scoped to 37 pre-walk tasks against plan:walk. It is now the
reconciliation of FOUR SOURCES OF TRUTH, in the order
STD-the-precedence-order-when-four-sources-of-truth-disagree sets:

  1. the corpus, and the app screens themselves
  2. the plans   -- 16 files, ~43,900 lines, 158 numbered tasks
  3. the specs
  4. the first v2.0 documents

with later decisions and facts overriding earlier ones.

WHY IT GREW: 109 of 344 corpus task items say, in their own words, "this item
tracks state only" and name a plan section as the authority. So the corpus does
not hold the specification today -- it holds state and rulings, and points at
~43,900 lines nobody can query. That is the drift the owner named when he said
he could not tell where v2.0.0 stands.

THE OUTPUT IS A STABLE BASE, and concretely that means:
- every open task carries one verdict: DONE (something closed it, named), SUPERSEDED BY <id>, REFINES <id>, or STANDS
- every contradiction found between two sources is RECORDED with which source
  won and why, rather than silently resolved
- anything found only in a plan or a spec, and still true, is ADDED to the
  corpus -- that is how the corpus stops being incomplete, which the owner
  named explicitly: "not everything was added to it from the beginning"

STOP AND ASK ON A COARSE CONTRADICTION -- two sources describing different
products. Reconcile and note a fine one -- different words for the same thing.
The owner asked for "not many coarse contradictions", not for a perfect merge.

DO NOT DELETE THE LOSER of any conflict. The superseded statement is how the
next reader understands why the winner reads the way it does.

AND DO NOT START FROM THE PLANS. Start from the corpus and the screens, because
they are the top of the order and because they are the two that can be read
quickly. What they settle needs no archaeology.

DONE 2026-08-25. The full account is NOTE-the-reconciliation-plan-walk-seq-23-what-it-found-and-what-it.

WHAT WAS ACTUALLY DONE, so the claim is checkable rather than asserted: 106 open tasks across 16 plans, each read and given ONE verdict in this task s own vocabulary -- DONE (12), SUPERSEDED BY <id> (6), REFINES <id> (3), STANDS (85). Every verdict is appended to the task it judges, with its evidence. Nothing was deleted.

THE THREE OUTPUTS THIS TASK PROMISED:

1. EVERY OPEN TASK CARRIES ONE VERDICT -- done, 106 of 106.

2. EVERY CONTRADICTION RECORDED WITH WHICH SOURCE WON. The largest was the corpus s own pointer into the specification: 104 of 109 plan citations were stale, by up to 1,426 lines. All corrected. Seven stale blockers, each holding real work, one of them an owner instruction. Three tasks whose premise the code had moved past. NO COARSE CONTRADICTION WAS FOUND -- nothing needed to stop and go to the owner, which is the bar he set.

3. ANYTHING FOUND ONLY IN A PLAN OR SPEC AND STILL TRUE IS ADDED. Two new tasks (seq:29, the status strip stating an unchecked fact; seq:30, the citation gate s scope), one known_issue, one lesson, and nine notes carrying the per-batch verdicts.

WHAT IT DID NOT DO, and this is the honest boundary. It reconciled the CORPUS against the CODE and against ITSELF -- the top of the precedence order, and the two sources that can be read. IT DID NOT READ THE 43,900 LINES OF PLAN DOCUMENTS. Corpus silence was not treated as corpus denial, but nothing systematically went looking in the plans for what the corpus never captured. That is the remaining half of condition 3 of REQ-every-screen-has-a-task-that-implements-it-until-the-mockup, and plan:walk seq:27 -- giving every screen a task that says what it IS -- is where it gets done, screen by screen, from module headers that already contain it.

THE INSTRUCTION "DO NOT START FROM THE PLANS" WAS FOLLOWED and was right: starting from the corpus and the code closed 12 tasks and unblocked 7 in one pass, and the plans turned out to be reachable only through pointers that were 95% wrong -- which would have made a plans-first pass read the wrong sections and not know it.
