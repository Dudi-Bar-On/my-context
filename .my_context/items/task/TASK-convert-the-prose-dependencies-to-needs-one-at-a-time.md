---
id: TASK-convert-the-prose-dependencies-to-needs-one-at-a-time
type: task
title: convert the prose dependencies to needs, one at a time
status: active
severity: soft
always: false
summary: Turn dependencies written in prose into a real field, one at a time, since several tasks still claim to be waiting for something already finished.
summary_of: 298888f05c589ac1
acknowledged:
  - state_unaudited@4c2476a2bc47df5d
scope: []
tags:
  - v2
  - corpus
  - planning
  - "plan:categories"
  - "seq:22"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-28
valid_until: null
checksum: 83e7fb3a002e7e87
plan: categories
seq: "22"
state: done
priority: "1"
source: "plan:categories seq:21's report, 2026-08-28"
---

# convert the prose dependencies to needs, one at a time

> Follow-up to `plan:categories seq:21`, which built `needs`, the doctor checks and `mycontext ready` but deliberately did NOT migrate the prose dependencies. The ruling there was that a bulk conversion would encode its own error rate into the corpus — a regex over the prose scored 4 of 28 with a false positive on the first pass.
>
> This task is the deliberate conversion, one at a time, against each item's own body.
>
> ## The finding that makes it urgent
>
> **Six open tasks name a blocker that has ALREADY LANDED, and none is at `state: blocked`.** They sit at `state: todo` with stale prose saying they are waiting. `checkTaskNeeds`'s `blocked_needs_met` cannot see them — it only inspects tasks whose state says blocked — so this is the `plan:walk seq:8` failure wearing a different state, and it is invisible to the check built to catch it.
>
> `mycontext ready` already lists them as ready, correctly. But their bodies say otherwise, and a reader who opens one is told to wait for something that shipped.
>
> ## The convertible set, as surveyed 2026-08-28
>
> Already spelled `plan/seq` in the prose — convert these:
>
>     builder/2    -> builder/1
>     builder/3    -> builder/1, builder/2
>     builder/4    -> builder/1
>     builder/5    -> builder/2, builder/3, port/95
>     builder/6    -> builder/4, builder/5
>     builder/7    -> builder/5, builder/6, port/95
>     builder/8    -> builder/5, port/95
>     categories/19-> categories/18
>     port/93      -> port/94
>     port/94      -> port/95
>     ui2/5r       -> port/95
>     walk/8       -> walk/7
>     walk/14      -> walk/7, walk/10
>     port/6       -> walk/7
>
> `builder/1`, `categories/18`, `port/95` and `walk/7` are all `done`, which is where the six stale ones come from.
>
> **Verify each against its own body before writing the field.** The survey is a starting point, not a contract: the same pass produced a false positive on `budget/4`, which matched on *"the write is not blocked by the full window"* — a UI state, not a dependency. That is the `the/45` shape recurring, and it is why this is not a scripted migration.
>
> ## Named but NOT convertible — leave them, and say why in each
>
> * `api/6`, `config/2` name a blocker by item ID rather than `plan/seq`. Decide whether `needs` should accept an id form, or convert them by looking the id up. Do not silently drop them.
> * `rulings/20` ("the config task"), `walk/35` ("the pool"), `walk/10` ("a POST") — a description, not a reference. Resolving these means reading two items and judging; do it or leave a note, but do not guess.
> * `walk/13`, `walk/20`, `repaint/3e`, `config/1`, `walk/1h`, `walk/25` — the blocker is a PERSON or an unanswered question, not a task. `walk/1h` waits on the owner to place Hebrew emphasis across 57 strings; `walk/25` waits on a security ruling. **These correctly have no `needs`**, and `seq:21` left them empty on purpose. The mechanism for them exists on the other side: `open_question` declares `blocks`, naming what waits on an answer. Consider filing the open questions and pointing `blocks` at these tasks, rather than inventing a task-shaped reference that does not exist.
>
> ## The question this raises about the check itself
>
> `blocked_needs_met` fires only on `state: blocked`. The six stale tasks prove that a task's STATE and its PROSE can disagree, and the state is what the check trusts. `seq:21` deliberately did not widen the check to `todo`, reasoning that a `todo` whose needs are met is simply ready and `mycontext ready` already says so — which is correct for the FIELD. It is not correct for the PROSE, and nothing checks prose.
>
> Do not widen the check. Convert the prose instead: once the dependency is a field, the prose stops being the record and the disagreement cannot recur.
>
> ## Done when
>
> Every convertible reference above is a `needs` field, verified against its own body; the six stale ones have their prose corrected so it no longer claims to be waiting; the id-form and description-form cases are each either converted or annotated with why not; and no task gained a `needs` entry that its body does not support.
