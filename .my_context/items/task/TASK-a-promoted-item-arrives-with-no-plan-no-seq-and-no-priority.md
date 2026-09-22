---
id: TASK-a-promoted-item-arrives-with-no-plan-no-seq-and-no-priority
type: task
title: a promoted item arrives with no plan, no seq and no priority, so nothing can schedule or cite the work you just approved
status: active
severity: soft
always: false
summary: Work you accept out of the queue arrives without an address, so it is the one thing in the corpus that cannot be scheduled, cited or depended on.
summary_of: 48b5497697d8b933
scope:
  - src/cli/commands/review.ts
  - src/review/**
  - src/ui/public/screens/work.js
tags:
  - v2
  - review
  - "plan:review"
  - "seq:10"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-15
valid_until: null
checksum: e06727318999ed7e
plan: review
seq: "10"
state: todo
priority: "2"
---

# a promoted item arrives with no plan, no seq and no priority, so nothing can schedule or cite the work you just approved

MEASURED 2026-09-15, the day the owner first accepted work out of his review queue: of the 8 items
carrying `origin: review`, 8 have NO `plan`, 8 have NO `seq` and 8 have NO `priority`. Not most.
All of them.

WHY THAT MATTERS, and it is not tidiness. Everything this project uses to schedule work is keyed on
an address:
  — `mycontext ready` orders by priority. A blank priority has no place in that order.
  — Work is cited, dispatched and discussed as `plan/seq` — "do accretion/2", "after D66". An item
    with no plan cannot be named that way by the owner, by a lane, or by a handover.
  — `needs:` references resolve through `plan`/`seq`. Nothing can declare a dependency ON one of
    these items, and none of them can declare one.

So a promoted proposal lands in the corpus and immediately becomes the hardest thing in it to
schedule — which is backwards, because it is the work the owner has just personally approved.

THIS IS THE SAME SHAPE AS A DEFECT THIS PROJECT HAS ALREADY PAID FOR. `accretion/5` was DANGLING
because a lane set the `seq:` TAG and not the `seq` FIELD, so the address resolved to nothing and a
gate refused a write that depended on it. Two more items carry `plan: review` with no `seq` today
and cannot be addressed either. An address that half exists is worse than none, because a reader
believes they can cite it.

THE HONEST DIFFICULTY, stated so the fix is not glib: THE PASS CANNOT KNOW WHICH PLAN A PROPOSAL
BELONGS TO. It reads a sentence out of a transcript; a plan is a human grouping of work toward a
subject. Inventing one at capture would be the pass deriving structure from the owner’s work
without being asked — the line `NOGOAL-not-a-claude-mem-replacement` draws. So the answer is not
"make the pass smarter".

THE DECISION, and each option is defensible:
  1. PROMOTE ASKS. `mycontext review promote <id>` takes `--plan` and `--seq` (and the screen
     offers them beside Accept), because promotion is the moment a PERSON is already deciding and
     is the only moment anyone knows where the work belongs. Costs one more input on the one act
     that already requires a human.
  2. A HOLDING PLAN. Every promoted item lands at `plan: review` with the next free `seq`,
     addressable immediately and re-planned later by the owner. Nothing is ever unaddressable;
     the cost is a plan that means "not yet sorted" rather than a subject.
  3. LEAVE THEM UNADDRESSED AND SAY SO. `ready` names them as a group that cannot be ordered.
     Honest, cheap, and it fixes nothing — but it beats the present silence.

RECOMMENDATION: 1 with 2 as the default when the owner does not say — he is asked, and if he
declines to answer the item is still addressable rather than lost. 3 alone is not enough: the
present failure is already silent, and a louder silence is not a fix.

ALSO TRUE AND SMALLER: `priority` is blank on all 8. Whatever is decided about `plan`, a promoted
item needs a priority or it sorts below everything the owner has never looked at.

WHAT WOULD HAVE CAUGHT IT: a test that promotes a draft and then asserts the result can be found
by `mycontext ready --plan <p>` — i.e. that the promoted item is SCHEDULABLE, not merely that it
is active. Every existing promote test asserts status, and one now asserts location
(`review/8`); none asserts that the thing can be found again by the route work is actually
dispatched through.

Owner ruling G, recorded 2026-09-22: option 1 - review promote asks --plan and --seq. Lands in release phase 5. See DEC-review-promote-asks-for-plan-and-seq-so-a-promoted-task.
