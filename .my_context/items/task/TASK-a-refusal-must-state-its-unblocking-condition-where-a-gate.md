---
id: TASK-a-refusal-must-state-its-unblocking-condition-where-a-gate
type: task
title: a refusal must state its unblocking condition where a gate can test it
status: active
severity: soft
always: false
summary: When something is deliberately not done yet, the condition that would change that should be checkable, so nobody has to notice by hand.
summary_of: 2d6ab60c34a38488
scope: []
tags:
  - v2
  - ui
  - gate
  - refusals
  - process
  - "plan:walk"
  - "seq:11"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-25
valid_until: null
checksum: d145a58afb87278b
plan: walk
seq: "11"
state: todo
priority: "2"
source: owner ruling 2026-08-25
---

# a refusal must state its unblocking condition where a gate can test it

Carries out the first half of the ruling that a refusal is a state to leave.

Every refusal found so far NAMES the condition that would end it, in prose, in a comment nobody re-reads. Nothing checks whether the condition has been met, so three of them were still standing after it had.

WHAT THE WORK IS: a convention plus a checker. A refusal declares its condition in a form something can evaluate -- a symbol that must not exist, a route that must not be registered, a CSS selector that must be absent, a task id that must still be open. The checker walks them and FAILS when a condition has flipped, naming the file and the refusal to re-read. It does not decide anything; it says "this reason has expired, go look".

THE THREE FOUND ON 2026-08-24 AND 25 ARE THE TEST SET. If the checker would not have caught all three, it is not built yet:
- "no route in this plan exposes the audit projection" -> `GET /api/watch/ratio` is registered.
- "the screen contract s fetcher takes a path and nothing else" -> `post` is on `window.myctx`.
- "until ctx.api can POST" -> same.

DO NOT let this become a reason to write fewer refusals, or vaguer ones. The refusals in this codebase are among the best things in it. What is being added is an expiry check, not a discouragement.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: STANDS, AND IT SHOULD BE WIDENED FROM REFUSALS TO TASK BLOCKERS. The reconciliation found SEVEN stale blockers in one pass, and every one was the same mechanism this task describes, one layer out.

THE SEVEN, each a task that recorded what would unblock it, where the thing then happened and nobody came back:
  plan:port seq:94  -- "DEPENDS ON seq 95". seq:95 done, inventory built and reviewed with the owner. Meanwhile the failure it prevents was hit four more times.
  plan:port seq:6   -- "ui3 tasks 4 and 5 build the statusline, which is what would let the context group leave its noBridge state". Both done. The strip still lies.
  plan:config seq:2 -- "BLOCKED ON ctx.api having no POST". ctx.post shipped 2026-08-23 and has zero callers.
  plan:ui2 seq:5r   -- "BLOCKED BY plan:port seq:95, the mockup is frozen". The freeze is over.
  plan:review seq:5 -- "Blocked until mycontext ui runs -- ui1 task 15". Done. And it is the only task in the corpus that measures whether a screen WORKS.
  plan:hooks seq:22 -- "BLOCKED until the hooks programme completes". 32 done, one README sentence outstanding. It is an OWNER INSTRUCTION.
  plan:repaint seq:7b -- "worth settling when task 9 turns .card.gloss into .card.pane". Task 9 done; `status.js` · `card pane` · ~76 builds `card pane`.

SO THE RULE THIS TASK ASKS FOR SHOULD READ: a blocking condition, whether on a REFUSAL or on a TASK, must be stated where something can TEST it -- not in prose. The edge points the wrong way for anybody to traverse at the moment it matters: the task that satisfies a dependency never learns it was one.

See LESSON-a-satisfied-dependency-is-not-a-notification-so-the-work. Until this exists, a periodic sweep is the only catch, and one sweep found seven.
